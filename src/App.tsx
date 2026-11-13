import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTree } from './tree/load.ts'
import { search } from './tree/search.ts'
import type { CompactNode, Tree } from './tree/types.ts'
import type { MechanicId } from './tree/mechanics.ts'
import { usePlan } from './state/plan.ts'
import type { Plan } from './state/plan.ts'
import {
  loadPlans, savePlan, deletePlan, planFromSaved, readHash, writeHash,
} from './state/storage.ts'
import type { SavedPlan } from './state/storage.ts'
import { TreeCanvas } from './ui/TreeCanvas.tsx'
import type { TreeCanvasHandle } from './ui/TreeCanvas.tsx'
import { NodeTooltip } from './ui/NodeTooltip.tsx'
import { MechanicFilter } from './ui/MechanicFilter.tsx'
import { SearchPanel } from './ui/SearchPanel.tsx'
import { PlanPanel } from './ui/PlanPanel.tsx'

const EMPTY_SET: ReadonlySet<number> = new Set()

export function App() {
  const [tree, setTree] = useState<Tree | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const plan = usePlan(tree)
  const [query, setQuery] = useState('')
  const [mechanics, setMechanics] = useState<ReadonlySet<MechanicId>>(new Set())
  const [hover, setHover] = useState<{ node: CompactNode; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedPlan[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const canvas = useRef<TreeCanvasHandle | null>(null)
  const handleRef = useCallback((h: TreeCanvasHandle) => { canvas.current = h }, [])

  // --- load -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    loadTree()
      .then((t) => {
        if (cancelled) return
        setTree(t)
        const fromUrl = readHash()
        if (fromUrl?.allocated.size) plan.replace(fromUrl)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
    setSaved(loadPlans())
    return () => { cancelled = true }
    // Runs once; `plan.replace` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the address bar in step with the plan so it is always shareable.
  useEffect(() => { if (tree) writeHash(plan.plan) }, [tree, plan.plan])

  // --- derived ----------------------------------------------------------
  const results = useMemo(
    () => (tree ? search(tree, query) : { hits: [], ids: EMPTY_SET as Set<number> }),
    [tree, query],
  )

  // The route that clicking the hovered node would take — drawn in gold so the
  // cost of a click is visible before committing to it.
  const preview = useMemo(() => {
    if (!hover || plan.plan.allocated.has(hover.node.i)) return EMPTY_SET
    const route = plan.routeTo(hover.node.i)
    return route ? new Set(route) : EMPTY_SET
  }, [hover, plan])

  const hoverCost = useMemo(() => {
    if (!hover) return null
    if (plan.plan.allocated.has(hover.node.i)) return 0
    const route = plan.routeTo(hover.node.i)
    return route ? route.length : null
  }, [hover, plan])

  const renderState = useMemo(() => ({
    allocated: plan.plan.allocated,
    frontier: plan.frontier,
    preview,
    searchHits: results.ids,
    activeMechanics: mechanics,
    hovered: hover?.node.i ?? null,
    showGroupBackgrounds: true,
    showAtlasBackground: true,
  }), [plan.plan.allocated, plan.frontier, preview, results.ids, mechanics, hover])

  // --- actions ----------------------------------------------------------
  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600)
  }, [])

  const onPick = useCallback((node: CompactNode, mode: 'allocate' | 'deallocate') => {
    if (mode === 'deallocate') { plan.deallocate(node.i); return }
    const r = plan.allocate(node.i)
    if (!r.ok && r.reason) flash(r.reason)
  }, [plan, flash])

  const onHover = useCallback((node: CompactNode | null) => {
    setHover((prev) => {
      if (!node) return null
      const pos = lastPointer.current
      if (prev?.node.i === node.i) return { node, x: pos.x, y: pos.y }
      return { node, x: pos.x, y: pos.y }
    })
  }, [])

  const lastPointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const onMove = (e: PointerEvent) => { lastPointer.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const toggleMechanic = useCallback((id: MechanicId) => {
    setMechanics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const focusNode = useCallback((n: CompactNode) => {
    canvas.current?.focus(n.i, 0.35)
  }, [])

  const importPlan = useCallback((p: Plan) => {
    plan.replace(p)
    setTimeout(() => canvas.current?.fitAllocated(p.allocated), 0)
    flash(`Imported ${p.allocated.size} nodes.`)
  }, [plan, flash])

  // --- keyboard ---------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? plan.redo() : plan.undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); plan.redo() }
      else if (e.key === 'f' && !mod) { e.preventDefault(); canvas.current?.fitAll() }
      else if (e.key === 'a' && !mod) { e.preventDefault(); canvas.current?.fitAllocated(plan.plan.allocated) }
      else if (e.key === '/' && !mod) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.search')?.focus()
      } else if (e.key === 'Escape') {
        setQuery('')
        setMechanics(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [plan])

  // --- render -----------------------------------------------------------
  if (loadError) {
    return (
      <div className="boot error-boot">
        <h1>Could not load the Atlas tree</h1>
        <p>{loadError}</p>
      </div>
    )
  }

  if (!tree) {
    return <div className="boot"><div className="spinner" /><p>Loading the Atlas…</p></div>
  }

  return (
    <div className={'app' + (sidebarOpen ? '' : ' collapsed')}>
      <aside className="sidebar">
        <div className="brand">
          <h1>Atlas Planner</h1>
          <span className="version">{tree.version}</span>
        </div>

        <SearchPanel
          query={query}
          onQuery={setQuery}
          hits={results.hits}
          allocated={plan.plan.allocated}
          onFocus={focusNode}
        />

        <MechanicFilter
          tree={tree}
          allocated={plan.plan.allocated}
          active={mechanics}
          onToggle={toggleMechanic}
          onClear={() => setMechanics(new Set())}
        />

        <PlanPanel
          plan={plan.plan}
          pointsUsed={plan.pointsUsed}
          pointsTotal={plan.pointsTotal}
          canUndo={plan.canUndo}
          canRedo={plan.canRedo}
          onUndo={plan.undo}
          onRedo={plan.redo}
          onReset={plan.reset}
          onImport={importPlan}
          saved={saved}
          onSave={(name) => { setSaved(savePlan(saved, name, plan.plan)); flash(`Saved "${name}".`) }}
          onLoad={(s) => importPlan(planFromSaved(s))}
          onDelete={(id) => setSaved(deletePlan(saved, id))}
        />

        <footer className="credits">
          <p>
            Fan-made and unaffiliated with Grinding Gear Games. Tree data from GGG's
            official <a href="https://github.com/grindinggear/atlastree-export" target="_blank" rel="noreferrer">atlastree-export</a>.
          </p>
          <p className="keys">
            <kbd>/</kbd> search · <kbd>F</kbd> fit all · <kbd>A</kbd> fit plan ·
            <kbd>Shift</kbd>+click to remove
          </p>
        </footer>
      </aside>

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        title={sidebarOpen ? 'Hide panel' : 'Show panel'}
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      <main>
        <TreeCanvas
          tree={tree}
          state={renderState}
          onHover={onHover}
          onPick={onPick}
          handleRef={handleRef}
        />

        <div className="view-actions">
          <button onClick={() => canvas.current?.fitAll()}>Whole atlas</button>
          <button
            onClick={() => canvas.current?.fitAllocated(plan.plan.allocated)}
            disabled={plan.pointsUsed === 0}
          >
            Fit plan
          </button>
        </div>

        {hover && (
          <NodeTooltip
            node={hover.node}
            x={hover.x}
            y={hover.y}
            allocated={plan.plan.allocated.has(hover.node.i)}
            cost={hoverCost}
            chosenVariant={plan.plan.variants[hover.node.i]}
          />
        )}

        {toast && <div className="toast">{toast}</div>}
      </main>
    </div>
  )
}
