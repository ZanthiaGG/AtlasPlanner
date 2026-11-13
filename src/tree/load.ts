import { Kind } from './types.ts'
import type { CompactTree, Tree } from './types.ts'
import type { MechanicId } from './mechanics.ts'

/**
 * Fetch the compact tree built by `scripts/fetch-tree.ts` and build the lookup
 * structures the UI needs.
 *
 * Masteries are excluded from the graph entirely: they are cosmetic labels at the
 * centre of a cluster, not allocatable, and leaving them in would let pathfinding
 * route through them.
 */
export async function loadTree(version = '3.30.0'): Promise<Tree> {
  const res = await fetch(`${import.meta.env.BASE_URL}tree/${version}.json`)
  if (!res.ok) throw new Error(`could not load tree ${version}: ${res.status}`)
  return indexTree(await res.json() as CompactTree)
}

export function indexTree(data: CompactTree): Tree {
  const byId = new Map(data.nodes.map((n) => [n.i, n]))

  const adj = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    const na = byId.get(a), nb = byId.get(b)
    if (!na || !nb || na.k === Kind.Mastery || nb.k === Kind.Mastery) return
    let list = adj.get(a)
    if (!list) adj.set(a, (list = []))
    if (!list.includes(b)) list.push(b)
  }
  for (const n of data.nodes) {
    for (const o of n.o) { link(n.i, o); link(o, n.i) }
  }

  const countsByMechanic = new Map<MechanicId, number>()
  for (const n of data.nodes) {
    if (n.k === Kind.Mastery || n.i === data.start) continue
    countsByMechanic.set(n.m, (countsByMechanic.get(n.m) ?? 0) + 1)
  }

  // Drawable edges, deduplicated by an unordered key. GGG's `out` lists are
  // directed and not always mirrored, so comparing ids (`a.i > b.i`) to pick a
  // canonical direction would silently drop every one-way edge.
  const edges: Tree['edges'] = []
  const seen = new Set<string>()
  for (const n of data.nodes) {
    if (n.k === Kind.Mastery) continue
    for (const oid of n.o) {
      const m = byId.get(oid)
      if (!m || m.k === Kind.Mastery) continue
      // Gateways teleport across the atlas; a line between them would be nonsense.
      if (n.k === Kind.Wormhole && m.k === Kind.Wormhole) continue
      const key = n.i < m.i ? `${n.i}:${m.i}` : `${m.i}:${n.i}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push([n, m])
    }
  }

  return { ...data, byId, adj, countsByMechanic, edges }
}
