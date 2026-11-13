import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { indexTree } from './load.ts'
import { Kind } from './types.ts'
import type { CompactTree, Tree } from './types.ts'
import { orbitAngles, nodePos } from './geometry.ts'
import { pathTo, prune, frontier, deallocate } from './pathfind.ts'
import { search } from './search.ts'
import { ICON_BASE_TO_MECHANIC, MECHANICS, mechanicFor } from './mechanics.ts'

const raw: CompactTree = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../public/tree/3.30.0.json'), 'utf8'),
)
const tree: Tree = indexTree(raw)

describe('geometry', () => {
  const angles = orbitAngles([1, 6, 16, 16, 40, 72, 72])

  it('spaces even orbits evenly', () => {
    // Orbit 1 has 6 slots: 0, 60, 120 ... degrees.
    expect(angles[1]!.map((a) => Math.round((a * 180) / Math.PI))).toEqual([0, 60, 120, 180, 240, 300])
  })

  it('uses the irregular table for 16-slot orbits', () => {
    // Not 22.5-degree steps — the slots bunch toward the cardinals.
    expect(Math.round((angles[2]![1]! * 180) / Math.PI)).toBe(30)
    expect(Math.round((angles[2]![2]! * 180) / Math.PI)).toBe(45)
  })

  it('uses the irregular table for 40-slot orbits', () => {
    expect(Math.round((angles[4]![5]! * 180) / Math.PI)).toBe(45)
    expect(angles[4]).toHaveLength(40)
  })

  it('places slot 0 directly above the group centre', () => {
    const [x, y] = nodePos({ x: 100, y: 200 }, 1, 0, [0, 82], angles)
    expect(x).toBe(100)
    expect(y).toBe(118) // 200 - 82: y grows downward
  })

  it('places a quarter turn to the right of the centre', () => {
    // Orbit 2, slot 4 is 90 degrees.
    const [x, y] = nodePos({ x: 0, y: 0 }, 1, 0, [0, 100], angles)
    expect([x, y]).toEqual([0, -100])
    const [x2, y2] = nodePos({ x: 0, y: 0 }, 2, 4, [0, 0, 100], angles)
    expect([x2, y2]).toEqual([100, 0])
  })
})

describe('shipped tree data', () => {
  it('has the expected shape for 3.30', () => {
    expect(tree.version).toBe('3.30.0')
    expect(tree.totalPoints).toBe(150)
    expect(tree.nodes.length).toBeGreaterThan(1000)
    expect(tree.byId.has(tree.start)).toBe(true)
  })

  it('maps every node to a declared mechanic', () => {
    const known = new Set(MECHANICS.map((m) => m.id))
    for (const n of tree.nodes) expect(known.has(n.m)).toBe(true)
  })

  it('has no mechanic id in the icon map that the chip list omits', () => {
    const known = new Set(MECHANICS.map((m) => m.id))
    for (const id of Object.values(ICON_BASE_TO_MECHANIC)) expect(known.has(id)).toBe(true)
  })

  it('resolves per-node overrides ahead of the icon', () => {
    // Thorough Exploration shares the generic keystone icon but is a Wildwood node.
    expect(mechanicFor('x/NewAtlasKeystone1.png', 'Thorough Exploration')).toBe('azmeri')
    expect(mechanicFor('x/NewAtlasKeystone1.png', 'Map Magic Monsters')).toBe('magicMonsters')
  })

  it('excludes masteries from the graph', () => {
    for (const n of tree.nodes) {
      if (n.k !== Kind.Mastery) continue
      expect(tree.adj.has(n.i)).toBe(false)
    }
  })

  it('builds a symmetric adjacency', () => {
    for (const [id, neighbours] of tree.adj) {
      for (const n of neighbours) expect(tree.adj.get(n)).toContain(id)
    }
  })

  it('keeps every edge drawable and deduplicated', () => {
    const seen = new Set<string>()
    for (const [a, b] of tree.edges) {
      const key = a.i < b.i ? `${a.i}:${b.i}` : `${b.i}:${a.i}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
    expect(tree.edges.length).toBeGreaterThan(1000)
  })
})

describe('pathfinding', () => {
  /** A node several steps out from the start, found by walking the graph. */
  function nodeAtDepth(depth: number): number {
    let layer = [tree.start]
    const seen = new Set(layer)
    for (let i = 0; i < depth; i++) {
      const next: number[] = []
      for (const id of layer) {
        for (const n of tree.adj.get(id) ?? []) {
          if (!seen.has(n)) { seen.add(n); next.push(n) }
        }
      }
      layer = next
    }
    return layer[0]!
  }

  it('returns an empty route for an already-allocated node', () => {
    expect(pathTo(tree, new Set([31]), 31)).toEqual([])
  })

  it('returns an empty route for the start node', () => {
    expect(pathTo(tree, new Set(), tree.start)).toEqual([])
  })

  it('returns null for an id that is not in the tree', () => {
    expect(pathTo(tree, new Set(), 99_999)).toBeNull()
  })

  it('finds a route of the right length from the start', () => {
    const target = nodeAtDepth(4)
    const route = pathTo(tree, new Set(), target)
    expect(route).not.toBeNull()
    expect(route!).toHaveLength(4)
    expect(route!.at(-1)).toBe(target)
  })

  it('returns a route that is actually connected end to end', () => {
    const target = nodeAtDepth(6)
    const route = pathTo(tree, new Set(), target)!
    const owned = new Set([tree.start])
    for (const id of route) {
      const touches = (tree.adj.get(id) ?? []).some((n) => owned.has(n))
      expect(touches).toBe(true)
      owned.add(id)
    }
  })

  it('measures from the whole allocated set, not just the start', () => {
    const far = nodeAtDepth(6)
    const firstLeg = pathTo(tree, new Set(), far)!
    const allocated = new Set(firstLeg)
    const neighbour = (tree.adj.get(far) ?? []).find((n) => !allocated.has(n))!
    expect(pathTo(tree, allocated, neighbour)).toEqual([neighbour])
  })

  it('reports every node adjacent to the allocated set as frontier', () => {
    const f = frontier(tree, new Set())
    expect(f.size).toBeGreaterThan(0)
    for (const id of f) {
      expect((tree.adj.get(id) ?? []).some((n) => n === tree.start)).toBe(true)
    }
  })

  it('prunes a branch orphaned by a deallocation', () => {
    const route = pathTo(tree, new Set(), nodeAtDepth(5))!
    const allocated = new Set(route)
    // Cut the route at its second node; everything past it must fall away.
    const after = deallocate(tree, allocated, route[1]!)
    expect(after.has(route[0]!)).toBe(true)
    expect(after.has(route[1]!)).toBe(false)
    expect(after.has(route.at(-1)!)).toBe(false)
    expect(after.size).toBe(1)
  })

  it('keeps a fully connected plan intact when pruning', () => {
    const route = pathTo(tree, new Set(), nodeAtDepth(5))!
    const allocated = new Set(route)
    expect(prune(tree, allocated)).toEqual(allocated)
  })

  it('drops nodes that were never connected to the start', () => {
    expect(prune(tree, new Set([99_999]))).toEqual(new Set())
  })
})

describe('search', () => {
  it('finds nodes by name', () => {
    const { hits } = search(tree, 'essence')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((n) => n.n.toLowerCase().includes('essence'))).toBe(true)
  })

  it('finds nodes by stat text', () => {
    expect(search(tree, 'pack size').hits.length).toBeGreaterThan(0)
  })

  it('requires every term to match', () => {
    const one = search(tree, 'ritual').hits.length
    const two = search(tree, 'ritual tribute').hits.length
    expect(two).toBeLessThan(one)
    expect(two).toBeGreaterThan(0)
  })

  it('ranks keystones and notables above small nodes', () => {
    const { hits } = search(tree, 'breach')
    const firstSmall = hits.findIndex((n) => n.k === Kind.Small)
    const lastBig = hits.map((n) => n.k !== Kind.Small).lastIndexOf(true)
    if (firstSmall !== -1 && lastBig !== -1) expect(firstSmall).toBeGreaterThan(lastBig - 1)
  })

  it('returns nothing for an empty query', () => {
    expect(search(tree, '   ').hits).toEqual([])
  })

  it('never returns masteries', () => {
    for (const n of search(tree, 'a').hits) expect(n.k).not.toBe(Kind.Mastery)
  })
})
