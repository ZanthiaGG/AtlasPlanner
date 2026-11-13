import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Camera, clamp, MAX_SCALE, MIN_SCALE } from '../render/camera.ts'
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
  onHover: (node: CompactNode | null, x: number, y: number) => void
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
  const stateRef = useRef(state)
  const treeRef = useRef(tree)

  const invalidate = useCallback(() => { dirtyRef.current = true }, [])

  // Latest props for the render loop, written in an effect rather than during
  // render so an abandoned concurrent render cannot leak into the canvas.
  useEffect(() => { stateRef.current = state; treeRef.current = tree; invalidate() }, [state, tree, invalidate])

  /**
   * Keep re-framing until the user takes control.
   *
   * The first ResizeObserver callback can arrive before the layout settles, and
   * fitting once against that early size left the tree at roughly half scale in
   * a mostly empty canvas — measured at 49% of the width and 34% of the height.
   * Refitting on every resize until the first pan, zoom or allocation gives a
   * correct opening view without ever yanking the camera from under someone.
   */
  const userDrivesCamera = useRef(false)

  // --- per-tree setup ---------------------------------------------------
  useLayoutEffect(() => {
    gridRef.current = new HitGrid(tree.nodes.filter((n) => n.k !== Kind.Mastery))
    const store = new SpriteStore(tree, import.meta.env.BASE_URL, invalidate)
    spritesRef.current = store
    userDrivesCamera.current = false
    if (vpRef.current.w > 2) camRef.current.fit(...tree.bounds, vpRef.current)
    store.preload(camRef.current.scale, CORE_SHEETS)
    invalidate()
    return () => { if (spritesRef.current === store) spritesRef.current = null }
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
      if (!userDrivesCamera.current) {
        camRef.current.fit(...treeRef.current.bounds, vpRef.current)
        spritesRef.current?.preload(camRef.current.scale, CORE_SHEETS)
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

  // --- imperative handle ------------------------------------------------
  useEffect(() => {
    if (!handleRef) return
    handleRef({
      focus: (nodeId, zoom) => {
        const n = tree.byId.get(nodeId)
        if (!n) return
        userDrivesCamera.current = true
        const cam = camRef.current
        cam.cx = n.x; cam.cy = n.y
        if (zoom) cam.scale = clamp(zoom, MIN_SCALE, MAX_SCALE)
        invalidate()
      },
      fitAll: () => {
        userDrivesCamera.current = true
        camRef.current.fit(...tree.bounds, vpRef.current)
        invalidate()
      },
      fitAllocated: (ids) => {
        userDrivesCamera.current = true
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
  /** Every pointer currently down, so two fingers can pinch. */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef({ moved: false, x: 0, y: 0, id: -1 })
  const pinch = useRef<{ dist: number } | null>(null)

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
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) {
      // Capture is for dragging one pointer. Holding it while a second finger
      // arrives can swallow that finger's events, which would silently turn a
      // pinch back into a one-finger pan.
      for (const id of pointers.current.keys()) {
        try { (e.currentTarget as Element).releasePointerCapture(id) } catch { /* not captured */ }
      }
      drag.current.id = -1 // a second finger ends any tap in progress
    } else {
      try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* fine without it */ }
      drag.current = { moved: false, x: e.clientX, y: e.clientY, id: e.pointerId }
    }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // A move for a pointer we never saw go down means its pointerdown was lost
    // — the touch began outside the canvas, or capture swallowed it. Adopt it,
    // so a two-finger gesture still works instead of degrading to a pan.
    const tracked = pointers.current.get(e.pointerId)
    if (tracked) { tracked.x = e.clientX; tracked.y = e.clientY }
    else if (e.pointerType !== 'mouse' || e.buttons !== 0) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.current.size >= 2) drag.current.id = -1
    }

    // Two fingers: scale about the midpoint. Without this, touch devices have
    // no way to zoom at all — `touch-action: none` also blocks the native pinch.
    if (pointers.current.size >= 2) {
      const canvas = canvasRef.current
      if (!canvas) return
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      // Seed the baseline on the first two-pointer move rather than relying on
      // pointerdown having run for both.
      if (pinch.current && pinch.current.dist > 0 && dist > 0) {
        const rect = canvas.getBoundingClientRect()
        const mx = (a!.x + b!.x) / 2 - rect.left
        const my = (a!.y + b!.y) / 2 - rect.top
        userDrivesCamera.current = true
        camRef.current.zoomAt(dist / pinch.current.dist, mx, my, vpRef.current)
        invalidate()
      }
      pinch.current = { dist }
      onHover(null, 0, 0)
      return
    }

    const d = drag.current
    if (d.id === e.pointerId) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y
      if (!d.moved && Math.hypot(dx, dy) > DRAG_SLOP) d.moved = true
      if (d.moved) {
        userDrivesCamera.current = true
        camRef.current.panBy(dx, dy)
        d.x = e.clientX; d.y = e.clientY
        invalidate()
        onHover(null, 0, 0)
        return
      }
    }
    // Coordinates come straight off the event: reading them from a window-level
    // listener instead left the tooltip one move behind the cursor.
    onHover(nodeAt(e.clientX, e.clientY), e.clientX, e.clientY)
  }, [nodeAt, onHover, invalidate])

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null

    const d = drag.current
    if (d.id !== e.pointerId) return
    drag.current = { ...d, id: -1 }
    if (d.moved) return
    const node = nodeAt(e.clientX, e.clientY)
    if (!node) return
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
      userDrivesCamera.current = true
      camRef.current.zoomAt(Math.pow(1.0015, -e.deltaY), e.clientX - rect.left, e.clientY - rect.top, vpRef.current)
      invalidate()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [invalidate])

  // --- keyboard access --------------------------------------------------
  // The tree is a canvas, so none of it is reachable by keyboard on its own.
  // Arrow keys pan, +/- zoom, which at least makes the view navigable.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 240 : 80
    const vp = vpRef.current
    const cam = camRef.current
    let handled = true
    switch (e.key) {
      case 'ArrowLeft': cam.panBy(step, 0); break
      case 'ArrowRight': cam.panBy(-step, 0); break
      case 'ArrowUp': cam.panBy(0, step); break
      case 'ArrowDown': cam.panBy(0, -step); break
      case '+': case '=': cam.zoomAt(1.2, vp.w / 2, vp.h / 2, vp); break
      case '-': case '_': cam.zoomAt(1 / 1.2, vp.w / 2, vp.h / 2, vp); break
      default: handled = false
    }
    if (handled) { e.preventDefault(); userDrivesCamera.current = true; invalidate() }
  }, [invalidate])

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Atlas passive tree. Arrow keys pan, plus and minus zoom. Use the node list to allocate."
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={() => onHover(null, 0, 0)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  )
}
