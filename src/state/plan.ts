import { useCallback, useMemo, useState } from 'react'
import type { Tree } from '../tree/types.ts'
import { pathTo, deallocate as deallocateNode, frontier as frontierOf } from '../tree/pathfind.ts'

export interface Plan {
  allocated: Set<number>
  /** nodeId -> chosen effectId for "select a type of content" notables. */
  variants: Record<number, number>
}

export const emptyPlan = (): Plan => ({ allocated: new Set(), variants: {} })

const HISTORY_LIMIT = 100

/**
 * Allocation state with undo/redo.
 *
 * Plans are small (at most 150 ids), so each history entry is a full snapshot —
 * far simpler than diffing, and the memory cost is trivial.
 */
export function usePlan(tree: Tree | null) {
  const [history, setHistory] = useState<Plan[]>([emptyPlan()])
  const [cursor, setCursor] = useState(0)

  const plan = history[cursor] ?? history[0]!

  const commit = useCallback((next: Plan) => {
    setHistory((h) => {
      const trimmed = h.slice(Math.max(0, cursor + 1 - HISTORY_LIMIT), cursor + 1)
      return [...trimmed, next]
    })
    setCursor((c) => Math.min(c + 1, HISTORY_LIMIT - 1))
  }, [cursor])

  /** Replace the plan outright (import, load, reset) and reset history. */
  const replace = useCallback((next: Plan) => {
    setHistory([next])
    setCursor(0)
  }, [])

  const frontier = useMemo(
    () => (tree ? frontierOf(tree, plan.allocated) : new Set<number>()),
    [tree, plan.allocated],
  )

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
    const variants = { ...plan.variants }
    for (const key of Object.keys(variants)) {
      if (!allocated.has(Number(key))) delete variants[Number(key)]
    }
    commit({ allocated, variants })
  }, [tree, plan, commit])

  const setVariant = useCallback((nodeId: number, effectId: number) => {
    commit({ allocated: plan.allocated, variants: { ...plan.variants, [nodeId]: effectId } })
  }, [plan, commit])

  const reset = useCallback(() => replace(emptyPlan()), [replace])

  return {
    plan,
    frontier,
    pointsUsed: plan.allocated.size,
    pointsTotal: tree?.totalPoints ?? 0,
    routeTo,
    allocate,
    deallocate,
    setVariant,
    replace,
    reset,
    undo: useCallback(() => setCursor((c) => Math.max(0, c - 1)), []),
    redo: useCallback(() => setCursor((c) => Math.min(history.length - 1, c + 1)), [history.length]),
    canUndo: cursor > 0,
    canRedo: cursor < history.length - 1,
  }
}

export type PlanApi = ReturnType<typeof usePlan>
