import { useCallback, useMemo, useState } from 'react'
import type { Tree } from '../tree/types.ts'
import { pathTo, deallocate as deallocateNode, frontier as frontierOf, distancesFrom } from '../tree/pathfind.ts'

export interface Plan {
  allocated: Set<number>
  /** nodeId -> chosen effectId for "select a type of content" notables. */
  variants: Record<number, number>
}

export const emptyPlan = (): Plan => ({ allocated: new Set(), variants: {} })

export const HISTORY_LIMIT = 100

/** Undo/redo stack. Exported so the index arithmetic can be tested without React. */
export interface History {
  entries: Plan[]
  cursor: number
}

export const initialHistory = (plan: Plan = emptyPlan()): History => ({ entries: [plan], cursor: 0 })

export const current = (h: History): Plan => h.entries[h.cursor] ?? h.entries[0]!

/**
 * Append a state, dropping any redo branch and the oldest entries past the limit.
 *
 * The slice keeps at most `HISTORY_LIMIT - 1` entries so that appending lands
 * exactly on the limit. Keeping `HISTORY_LIMIT` instead grows the array to
 * `LIMIT + 1` while a separately-clamped cursor stops at `LIMIT - 1`, after
 * which every commit is written past a cursor that never moves again — the UI
 * freezes on the 100th edit while Redo lights up. See plan.test.ts.
 */
export function commitTo(h: History, next: Plan): History {
  const kept = h.entries.slice(Math.max(0, h.cursor + 1 - (HISTORY_LIMIT - 1)), h.cursor + 1)
  return { entries: [...kept, next], cursor: kept.length }
}

export const undoIn = (h: History): History => ({ ...h, cursor: Math.max(0, h.cursor - 1) })
export const redoIn = (h: History): History => ({ ...h, cursor: Math.min(h.entries.length - 1, h.cursor + 1) })

/**
 * Allocation state with undo/redo.
 *
 * Plans are small (at most 150 ids), so each history entry is a full snapshot —
 * far simpler than diffing, and the memory cost is trivial.
 */
export function usePlan(tree: Tree | null) {
  const [history, setHistory] = useState<History>(() => initialHistory())
  const plan = current(history)

  const commit = useCallback((next: Plan) => setHistory((h) => commitTo(h, next)), [])

  /** Replace the plan outright (import, load, reset) and drop the history. */
  const replace = useCallback((next: Plan) => setHistory(initialHistory(next)), [])

  const frontier = useMemo(
    () => (tree ? frontierOf(tree, plan.allocated) : new Set<number>()),
    [tree, plan.allocated],
  )

  /**
   * Point cost to reach every node, computed in a single pass and reused by the
   * node list, the tooltip and the hover preview. Doing this per node instead
   * meant ~966 graph searches per render.
   */
  const distances = useMemo(
    () => (tree ? distancesFrom(tree, plan.allocated) : new Map<number, number>()),
    [tree, plan.allocated],
  )

  /** Points needed to reach `id`, or null when it cannot be reached. */
  const costOf = useCallback((id: number) => distances.get(id) ?? null, [distances])

  /** Nodes that would be added by clicking `id` — the hover preview. */
  const routeTo = useCallback(
    (id: number): number[] | null => (tree ? pathTo(tree, plan.allocated, id) : null),
    [tree, plan.allocated],
  )

  /**
   * Allocate `id` and everything on the cheapest route to it.
   * Refuses rather than truncating when the route would exceed the budget.
   */
  const allocate = useCallback((id: number): { ok: boolean; reason?: string } => {
    if (!tree) return { ok: false }
    if (plan.allocated.has(id) || id === tree.start) return { ok: true }
    const route = pathTo(tree, plan.allocated, id)
    if (!route) return { ok: false, reason: 'That node cannot be reached.' }
    if (plan.allocated.size + route.length > tree.totalPoints) {
      const over = plan.allocated.size + route.length - tree.totalPoints
      return { ok: false, reason: `That route needs ${over} more point${over === 1 ? '' : 's'} than you have.` }
    }
    const allocated = new Set(plan.allocated)
    for (const n of route) allocated.add(n)
    commit({ allocated, variants: plan.variants })
    return { ok: true }
  }, [tree, plan, commit])

  /** Deallocate `id`, dropping anything it was the only route to. */
  const deallocate = useCallback((id: number) => {
    if (!tree || !plan.allocated.has(id)) return
    const allocated = deallocateNode(tree, plan.allocated, id)
    const variants: Record<number, number> = {}
    for (const [key, effect] of Object.entries(plan.variants)) {
      if (allocated.has(Number(key))) variants[Number(key)] = effect
    }
    commit({ allocated, variants })
  }, [tree, plan, commit])

  /** Choose an option on a multiple-choice notable. */
  const setVariant = useCallback((nodeId: number, effectId: number) => {
    commit({ allocated: plan.allocated, variants: { ...plan.variants, [nodeId]: effectId } })
  }, [plan, commit])

  const reset = useCallback(() => replace(emptyPlan()), [replace])

  return {
    plan,
    frontier,
    distances,
    pointsUsed: plan.allocated.size,
    pointsTotal: tree?.totalPoints ?? 0,
    pointsLeft: Math.max(0, (tree?.totalPoints ?? 0) - plan.allocated.size),
    costOf,
    routeTo,
    allocate,
    deallocate,
    setVariant,
    replace,
    reset,
    undo: useCallback(() => setHistory(undoIn), []),
    redo: useCallback(() => setHistory(redoIn), []),
    canUndo: history.cursor > 0,
    canRedo: history.cursor < history.entries.length - 1,
  }
}
