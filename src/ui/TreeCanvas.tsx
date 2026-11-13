import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Camera } from '../render/camera.ts'
import { SpriteStore } from '../render/sprites.ts'
import { CORE_SHEETS, draw, hitRadius } from '../render/renderer.ts'
import type { RenderState } from '../render/renderer.ts'
import { HitGrid } from '../render/hitgrid.ts'
import { Kind } from '../tree/types.ts'
import type { CompactNode, Tree } from '../tree/types.ts'

/** Drag further than this (CSS px) and the gesture is a pan, not a click. */
const DRAG_SLOP = 4

export interface TreeCanvasHandle {
  /** Centre the view on a node without changing zoom. */
  focus: (nodeId: number, zoom?: number) => void
  fitAll: () => void
  fitAllocated: (ids: ReadonlySet<number>) => void
}

interface Props {
  tree: Tree
  state: Omit<RenderState, 'tree'>
  onHover: (node: CompactNode | null) => void
  onPick: (node: CompactNode, mode: 'allocate' | 'deallocate') => void
  handleRef?: (h: TreeCanvasHandle) => void
}

export function TreeCanvas({ tree, state, onHover, onPick, handleRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const camRef = useRef(new Camera())
  const vpRef = useRef({ w: 1, h: 1 })
  const dirtyRef = useRef(true)
  const spritesRef = useRef<SpriteStore | null>(null)
  const gridRef = useRef<HitGrid | null>(null)
  // Latest props, read by the render loop without re-subscribing it.
  const stateRef = useRef(state)
  stateRef.current = state
  const treeRef = useRef(tree)
  treeRef.current = tree

  const invalidate = useCallback(() => { dirtyRef.current = true }, [])

  /** The first fit has to wait for a real viewport size, which arrives via the
   *  ResizeObserver one frame after mount. */
  const needsFit = useRef(true)

  // --- per-tree setup ---------------------------------------------------
  useLayoutEffect(() => {
    gridRef.current = new HitGrid(tree.nodes.filter((n) => n.k !== Kind.Mastery))
    spritesRef.current = new SpriteStore(tree, import.meta.env.BASE_URL, invalidate)
    needsFit.current = true
    if (vpRef.current.w > 2) {
      camRef.current.fit(...tree.bounds, vpRef.current)
      needsFit.current = false
    }
    spritesRef.current.preload(camRef.current.scale, CORE_SHEETS)
    invalidate()
  }, [tree, invalidate])

  // --- sizing -----------------------------------------------------------
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      vpRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      if (needsFit.current) {
        camRef.current.fit(...treeRef.current.bounds, vpRef.current)
        spritesRef.current?.preload(camRef.current.scale, CORE_SHEETS)
        needsFit.current = false
      }
      invalidate()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [invalidate])

  // --- render loop ------------------------------------------------------
  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!dirtyRef.current) return
      const canvas = canvasRef.current
      const sprites = spritesRef.current
      if (!canvas || !sprites) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      dirtyRef.current = false
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(ctx, camRef.current, vpRef.current, sprites, { tree: treeRef.current, ...stateRef.current })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Redraw whenever anything the renderer reads changes.
  useEffect(invalidate, [state, invalidate])

  // --- imperative handle ------------------------------------------------
  useEffect(() => {
    if (!handleRef) return
    handleRef({
      focus: (nodeId, zoom) => {
        const n = tree.byId.get(nodeId)
        if (!n) return
        const cam = camRef.current
        cam.cx = n.x; cam.cy = n.y
        if (zoom) cam.scale = zoom
        invalidate()
      },
      fitAll: () => { camRef.current.fit(...tree.bounds, vpRef.current); invalidate() },
      fitAllocated: (ids) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const id of ids) {
          const n = tree.byId.get(id)
          if (!n) continue
          minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
          minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
        }
        if (!Number.isFinite(minX)) camRef.current.fit(...tree.bounds, vpRef.current)
        else camRef.current.fit(minX, minY, maxX, maxY, vpRef.current, 800)
        invalidate()
      },
    })
  }, [tree, handleRef, invalidate])

  // --- pointer ----------------------------------------------------------
  const drag = useRef({ active: false, moved: false, x: 0, y: 0, id: -1 })

  const nodeAt = useCallback((clientX: number, clientY: number): CompactNode | null => {
    const canvas = canvasRef.current
    const grid = gridRef.current
    if (!canvas || !grid) return null
    const rect = canvas.getBoundingClientRect()
    const cam = camRef.current
    const wx = cam.screenToWorldX(clientX - rect.left, vpRef.current)
    const wy = cam.screenToWorldY(clientY - rect.top, vpRef.current)
    return grid.pick(wx, wy, hitRadius)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 2) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { active: true, moved: false, x: e.clientX, y: e.clientY, id: e.pointerId }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (d.active && d.id === e.pointerId) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) > DRAG_SLOP) d.moved = true
      if (d.moved) {
        camRef.current.panBy(dx, dy)
        d.x = e.clientX; d.y = e.clientY
        invalidate()
        onHover(null)
        return
      }
    }
    onHover(nodeAt(e.clientX, e.clientY))
  }, [nodeAt, onHover, invalidate])

  const endDrag = useCallback((e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active || d.id !== e.pointerId) return
    drag.current = { ...d, active: false }
    if (d.moved) return
    const node = nodeAt(e.clientX, e.clientY)
    if (!node || node.k === Kind.Mastery) return
    const deallocating = e.button === 2 || e.shiftKey || e.altKey
    onPick(node, deallocating ? 'deallocate' : 'allocate')
  }, [nodeAt, onPick])

  // Wheel must be a non-passive native listener or preventDefault is ignored
  // and the page scrolls behind the canvas.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const factor = Math.pow(1.0015, -e.deltaY)
      camRef.current.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top, vpRef.current)
      invalidate()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [invalidate])

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => onHover(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
