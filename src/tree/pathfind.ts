import { Kind } from './types.ts'
import type { Tree } from './types.ts'

/**
 * Routing over the Atlas graph.
 *
 * Every edge costs one point, so this is really a BFS — but ties are extremely
 * common on a tree this dense, and which of two equal-length routes you get
 * matters a lot to the player. So it runs as a Dijkstra with sub-unit cost
 * nudges that break ties toward routes picking up notables. Adapted from
 * `Path of Claude/src/atlas.ts:162`.
 *
 * The discount is 0.01, so a step costs between 0.99 and 1. An (L+1)-step route
 * can therefore only undercut an L-step one once 0.99 * (L + 1) < L, i.e. at
 * L >= 100. The deepest node on the 3.30 tree is 21 steps from the start and
 * multi-source distances only shrink, so hop count always wins and the discount
 * only ever breaks ties. Raising it past 1/L for the tree's depth would make
 * this routine start returning genuinely longer routes.
 */
function stepCost(tree: Tree, id: number): number {
  const n = tree.byId.get(id)
  if (!n) return 1
  if (n.k === Kind.Notable || n.k === Kind.Keystone) return 1 - 0.01
  return 1
}

/**
 * Cheapest route from the allocated set to `target`.
 *
 * Multi-source: every allocated node starts at distance 0, so the route is
 * measured from the whole tree you already own, not just from the start node.
 *
 * Returns the nodes that must be *added* (target last), or `null` if the target
 * cannot be reached. Returns `[]` when the target is already allocated.
 */
export function pathTo(tree: Tree, allocated: ReadonlySet<number>, target: number): number[] | null {
  if (allocated.has(target) || target === tree.start) return []
  if (!tree.byId.has(target)) return null

  const dist = new Map<number, number>()
  const prev = new Map<number, number>()
  // Simple binary heap keyed by distance. The graph is ~1100 nodes, so this is
  // comfortably fast enough to run on every hover.
  const heap: [dist: number, id: number][] = []

  const push = (d: number, id: number) => {
    heap.push([d, id])
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p]![0] <= heap[i]![0]) break
      ;[heap[p], heap[i]] = [heap[i]!, heap[p]!]
      i = p
    }
  }
  const pop = (): [number, number] | undefined => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length && last) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1, r = l + 1
        let m = i
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i]!, heap[m]!]
        i = m
      }
    }
    return top
  }

  for (const id of sources(tree, allocated)) { dist.set(id, 0); push(0, id) }

  while (heap.length) {
    const entry = pop()
    if (!entry) break
    const [d, id] = entry
    if (d > (dist.get(id) ?? Infinity)) continue
    if (id === target) break
    for (const next of tree.adj.get(id) ?? []) {
      const nd = d + stepCost(tree, next)
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd)
        prev.set(next, id)
        push(nd, next)
      }
    }
  }

  if (!dist.has(target)) return null

  const route: number[] = []
  for (let at: number | undefined = target; at !== undefined; at = prev.get(at)) {
    if (allocated.has(at) || at === tree.start) break
    route.push(at)
  }
  return route.reverse()
}

/**
 * Point cost to reach *every* node from the allocated set, in one pass.
 *
 * Because step costs sit in [0.99, 1] and the tree is only 21 deep, the
 * cheapest route is always one with the fewest hops (see the note above), so an
 * unweighted multi-source BFS gives exactly the same point cost `pathTo` would
 * report — in O(V + E) rather than a heap-based search per target.
 *
 * The UI needs this for hundreds of rows at once; calling `pathTo` per node
 * instead meant ~966 full graph searches on every render.
 */
export function distancesFrom(tree: Tree, allocated: ReadonlySet<number>): Map<number, number> {
  const dist = new Map<number, number>()
  let layer: number[] = []
  for (const id of sources(tree, allocated)) {
    if (!tree.byId.has(id) && id !== tree.start) continue
    if (dist.has(id)) continue
    dist.set(id, 0)
    layer.push(id)
  }
  for (let d = 1; layer.length; d++) {
    const next: number[] = []
    for (const id of layer) {
      for (const n of tree.adj.get(id) ?? []) {
        if (dist.has(n)) continue
        dist.set(n, d)
        next.push(n)
      }
    }
    layer = next
  }
  return dist
}

/** The allocated set plus the always-owned start node. */
function sources(tree: Tree, allocated: ReadonlySet<number>): number[] {
  const out = [tree.start]
  for (const id of allocated) out.push(id)
  return out
}

/**
 * Drop any allocated node no longer connected to the start node.
 *
 * Called after a deallocation: removing a node mid-branch orphans everything
 * beyond it, and silently keeping those allocated would let a plan spend points
 * on an unreachable branch.
 */
export function prune(tree: Tree, allocated: ReadonlySet<number>): Set<number> {
  const keep = new Set<number>()
  const queue = [tree.start]
  const seen = new Set<number>([tree.start])
  while (queue.length) {
    const id = queue.pop()!
    for (const next of tree.adj.get(id) ?? []) {
      if (seen.has(next) || !allocated.has(next)) continue
      seen.add(next)
      keep.add(next)
      queue.push(next)
    }
  }
  return keep
}

/**
 * Nodes one step outside the allocated set — the "you could take this next" ring,
 * drawn highlighted so the next move is always obvious.
 */
export function frontier(tree: Tree, allocated: ReadonlySet<number>): Set<number> {
  const out = new Set<number>()
  for (const id of sources(tree, allocated)) {
    for (const next of tree.adj.get(id) ?? []) {
      if (!allocated.has(next) && next !== tree.start) out.add(next)
    }
  }
  return out
}

/**
 * Deallocate `target` and everything that depended on it.
 * Returns the new allocated set.
 */
export function deallocate(tree: Tree, allocated: ReadonlySet<number>, target: number): Set<number> {
  if (!allocated.has(target)) return new Set(allocated)
  const without = new Set(allocated)
  without.delete(target)
  return prune(tree, without)
}
