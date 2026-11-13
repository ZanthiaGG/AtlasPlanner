import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadTree } from './tree/load.ts'
import { search } from './tree/search.ts'
import { Kind } from './tree/types.ts'
import type { CompactNode, Tree } from './tree/types.ts'
import { MECHANIC_BY_ID, mechanicColor } from './tree/mechanics.ts'
import type { MechanicId } from './tree/mechanics.ts'
import { importPlan, importWarning } from './tree/import.ts'
import { usePlan } from './state/plan.ts'
import type { Plan } from './state/plan.ts'
import { loadPlans, savePlan, deletePlan, planFromSaved, readHash, writeHash } from './state/storage.ts'
import type { SavedPlan } from './state/storage.ts'
import { TreeCanvas } from './ui/TreeCanvas.tsx'
import type { TreeCanvasHandle } from './ui/TreeCanvas.tsx'
import { NodeTooltip } from './ui/NodeTooltip.tsx'
import { NodeList } from './ui/NodeList.tsx'
import { Popover } from './ui/Popover.tsx'
import { MechanicPicker } from './ui/MechanicPicker.tsx'
import { SummaryPanel } from './ui/SummaryPanel.tsx'
import { PlanPanel } from './ui/PlanPanel.tsx'

const EMPTY_SET: ReadonlySet<number> = new Set()

type PopoverId = 'mechanics' | 'summary' | 'plan'

export function App() {
  const [tree, setTree] = useState<Tree | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const plan = usePlan(tree)
  const [query, setQuery] = useState('')
  /** Ordered: position decides which colour each mechanic gets. */
  const [mechanics, setMechanics] = useState<MechanicId[]>([])
  const [hover, setHover] = useState<{ node: CompactNode; x: number; y: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedPlan[]>([])
  // On a phone the sidebar covers the canvas, so start with the tree visible.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth > 760,
  )
  const [popover, setPopover] = useState<PopoverId | null>(null)

  const canvas = useRef<TreeCanvasHandle | null>(null)
  const handleRef = useCallback((h: TreeCanvasHandle) => { canvas.current = h }, [])

  const togglePopover = useCallback((id: PopoverId) => {
    setPopover((cur) => (cur === id ? null : id))
  }, [])

  // --- load -------------------------------------------------------------
  const replacePlan = plan.replace
  useEffect(() => {
    let cancelled = false
    loadTree()
      .then((t) => {
        if (cancelled) return
        setTree(t)
        const fromUrl = readHash(t)
        if (fromUrl?.allocated.size) replacePlan(fromUrl)
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
    setSaved(loadPlans())
    return () => { cancelled = true }
  }, [replacePlan])

  useEffect(() => { if (tree) writeHash(plan.plan) }, [tree, plan.plan])

  // --- derived ----------------------------------------------------------
  const results = useMemo(
    () => (tree ? search(tree, query) : { hits: [], ids: EMPTY_SET as Set<number> }),
    [tree, query],
  )

  /**
   * What the node list shows: the mechanic selection narrowed by the search box.
   * With neither active it lists the whole tree — 966 nodes, but only 371
   * distinct modifiers once identical copies are grouped.
   */
  const pool = useMemo(() => {
    if (!tree) return []
    const hasMechanics = mechanics.length > 0
    const hasQuery = query.trim().length > 0
    const selected = new Set(mechanics)
    const listable = (n: CompactNode) => n.k !== Kind.Mastery && n.i !== tree.start
    return tree.nodes.filter((n) =>
      listable(n) &&
      (!hasMechanics || selected.has(n.m)) &&
      (!hasQuery || results.ids.has(n.i)),
    )
  }, [tree, mechanics, query, results.ids])

  const routeTo = plan.routeTo
  const allocatedSet = plan.plan.allocated

  const preview = useMemo(() => {
    if (!hover || allocatedSet.has(hover.node.i)) return EMPTY_SET
    const route = routeTo(hover.node.i)
    return route ? new Set(route) : EMPTY_SET
  }, [hover, allocatedSet, routeTo])

  const activeMechanics = useMemo(() => new Set(mechanics), [mechanics])

  const renderState = useMemo(() => ({
    allocated: allocatedSet,
    frontier: plan.frontier,
    preview,
    searchHits: results.ids,
    activeMechanics,
    selectedMechanics: mechanics,
    hovered: hover?.node.i ?? null,
    showGroupBackgrounds: true,
    showAtlasBackground: true,
  }), [allocatedSet, plan.frontier, preview, results.ids, activeMechanics, mechanics, hover])

  // --- actions ----------------------------------------------------------
  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200)
  }, [])

  const onPick = useCallback((node: CompactNode, mode: 'allocate' | 'deallocate') => {
    if (mode === 'deallocate') { plan.deallocate(node.i); return }
    const r = plan.allocate(node.i)
    if (!r.ok && r.reason) flash(r.reason)
  }, [plan, flash])

  const onHover = useCallback((node: CompactNode | null, x: number, y: number) => {
    setHover((prev) => {
      if (!node) return null
      if (prev && prev.node.i === node.i && prev.x === x && prev.y === y) return prev
      return { node, x, y }
    })
  }, [])

  const toggleMechanic = useCallback((id: MechanicId) => {
    setMechanics((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }, [])

  const focusNode = useCallback((n: CompactNode) => { canvas.current?.focus(n.i, 0.35) }, [])

  const applyPlan = useCallback((p: Plan, note?: string) => {
    plan.replace(p)
    setTimeout(() => canvas.current?.fitAllocated(p.allocated), 0)
    if (note) flash(note)
  }, [plan, flash])

  const doImport = useCallback((text: string) => {
    if (!tree) return
    const r = importPlan(tree, text)
    applyPlan({ allocated: r.allocated, variants: r.variants })
    const warn = importWarning(r)
    flash(warn ? `Imported ${r.allocated.size} nodes. ${warn}` : `Imported ${r.allocated.size} nodes.`)
  }, [tree, applyPlan, flash])

  /** From the summary's "needs an option" links: surface the node in the list. */
  const findNode = useCallback((id: number) => {
    const n = tree?.byId.get(id)
    if (!n) return
    setQuery(n.n)
    setMechanics([])
    setPopover(null)
    canvas.current?.focus(id, 0.35)
  }, [tree])

  // --- keyboard ---------------------------------------------------------
  const { undo, redo } = plan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if (e.key === 'f' && !mod) { e.preventDefault(); canvas.current?.fitAll() }
      else if (e.key === 'a' && !mod) { e.preventDefault(); canvas.current?.fitAllocated(allocatedSet) }
      else if (e.key === '/' && !mod) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.search')?.focus()
      } else if (e.key === 'Escape') {
        setQuery('')
        setMechanics([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, allocatedSet])

  // --- render -----------------------------------------------------------
  if (loadError) {
    return (
      <div className="boot error-boot">
        <h1>Could not load the Atlas tree</h1>
        <p>{loadError}</p>
      </div>
    )
  }
  if (!tree) return <div className="boot"><div className="spinner" /><p>Loading the Atlas…</p></div>

  const over = plan.pointsUsed > plan.pointsTotal

  return (
    <div className={'app' + (sidebarOpen ? '' : ' collapsed')}>
      <aside className="sidebar">
        <div className="brand">
          <h1>Atlas Planner</h1>
          <span className="version">{tree.version}</span>
        </div>

        <div className="filterbar">
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search names and stats…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Search nodes"
          />

          <div className="filter-chips">
            <button
              className={'filter-add' + (popover === 'mechanics' ? ' on' : '')}
              onClick={() => togglePopover('mechanics')}
              data-popover-toggle=""
              aria-expanded={popover === 'mechanics'}
            >
              Mechanics{mechanics.length > 0 && <span className="pill">{mechanics.length}</span>}
            </button>

            {mechanics.map((id) => {
              const color = mechanicColor(id, mechanics)
              return (
                <button
                  key={id}
                  className="filter-chip"
                  style={{ borderColor: color, color }}
                  onClick={() => toggleMechanic(id)}
                  title="Remove this filter"
                >
                  <i style={{ background: color }} />
                  {MECHANIC_BY_ID.get(id)?.label}
                  <span className="x">×</span>
                </button>
              )
            })}

            {query && (
              <button className="filter-chip query" onClick={() => setQuery('')} title="Clear the search">
                “{query}”<span className="x">×</span>
              </button>
            )}
          </div>
        </div>

        <NodeList
          pool={pool}
          allocated={allocatedSet}
          variants={plan.plan.variants}
          costOf={plan.costOf}
          pointsLeft={plan.pointsLeft}
          selectedMechanics={mechanics}
          onFocus={focusNode}
          onAllocate={(n) => onPick(n, 'allocate')}
          onDeallocate={(n) => plan.deallocate(n.i)}
          onChooseVariant={plan.setVariant}
          emptyHint="Nothing matches that combination of mechanic and search."
        />

        <footer className="credits">
          <p>
            Fan-made and unaffiliated with Grinding Gear Games. Tree data from GGG's
            official <a href="https://github.com/grindinggear/atlastree-export" target="_blank" rel="noreferrer">atlastree-export</a>.
          </p>
        </footer>
      </aside>

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? 'Hide the panel' : 'Show the panel'}
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      <main>
        <TreeCanvas tree={tree} state={renderState} onHover={onHover} onPick={onPick} handleRef={handleRef} />

        <div className="hudbar">
          <div className={'hud' + (over ? ' over' : '')} title="Atlas points spent">
            <strong>{plan.pointsUsed}</strong><span>/ {plan.pointsTotal}</span>
          </div>
          <button
            className={'hud-btn' + (popover === 'summary' ? ' on' : '')}
            onClick={() => togglePopover('summary')}
            data-popover-toggle=""
            aria-expanded={popover === 'summary'}
          >
            Summary
          </button>
          <button
            className={'hud-btn' + (popover === 'plan' ? ' on' : '')}
            onClick={() => togglePopover('plan')}
            data-popover-toggle=""
            aria-expanded={popover === 'plan'}
          >
            Plan
          </button>
        </div>

        {popover === 'mechanics' && (
          <Popover title="Mechanics" anchor="sidebar" onClose={() => setPopover(null)}>
            <MechanicPicker
              tree={tree}
              allocated={allocatedSet}
              selected={mechanics}
              onToggle={toggleMechanic}
              onClear={() => setMechanics([])}
            />
          </Popover>
        )}

        {popover === 'summary' && (
          <Popover title="Tree summary" anchor="top-right" onClose={() => setPopover(null)}>
            <SummaryPanel
              tree={tree}
              plan={plan.plan}
              pointsUsed={plan.pointsUsed}
              pointsTotal={plan.pointsTotal}
              onFocusNode={findNode}
            />
          </Popover>
        )}

        {popover === 'plan' && (
          <Popover title="Plan" anchor="top-right" onClose={() => setPopover(null)}>
            <PlanPanel
              plan={plan.plan}
              pointsUsed={plan.pointsUsed}
              pointsTotal={plan.pointsTotal}
              canUndo={plan.canUndo}
              canRedo={plan.canRedo}
              onUndo={plan.undo}
              onRedo={plan.redo}
              onReset={plan.reset}
              onImport={doImport}
              saved={saved}
              onSave={(name) => { setSaved(savePlan(saved, name, plan.plan)); flash(`Saved “${name}”.`) }}
              onLoad={(s) => applyPlan(planFromSaved(s, tree), `Loaded “${s.name}”.`)}
              onDelete={(id) => setSaved(deletePlan(saved, id))}
            />
          </Popover>
        )}

        <div className="view-actions">
          <button onClick={() => canvas.current?.fitAll()}>Whole atlas</button>
          <button onClick={() => canvas.current?.fitAllocated(allocatedSet)} disabled={plan.pointsUsed === 0}>
            Fit plan
          </button>
        </div>

        {hover && (
          <NodeTooltip
            node={hover.node}
            x={hover.x}
            y={hover.y}
            allocated={allocatedSet.has(hover.node.i)}
            isStart={hover.node.i === tree.start}
            cost={plan.costOf(hover.node.i)}
            chosenVariant={plan.plan.variants[hover.node.i]}
            mechanicColor={mechanicColor(hover.node.m, mechanics)}
          />
        )}

        <div className="toast-slot" aria-live="polite">
          {toast && <div className="toast">{toast}</div>}
        </div>
      </main>
    </div>
  )
}
