import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { indexTree } from './load.ts'
import { summarise } from './summary.ts'
import { distancesFrom, pathTo } from './pathfind.ts'
import { importPlan } from './import.ts'
import { encode } from './codec.ts'
import { Kind } from './types.ts'
import type { CompactTree, Tree } from './types.ts'

const raw: CompactTree = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../public/tree/3.30.0.json'), 'utf8'),
)
const tree: Tree = indexTree(raw)

/** Allocate a connected set of `n` nodes outward from the start. */
function spend(n: number): Set<number> {
  const allocated = new Set<number>()
  while (allocated.size < n) {
    const next = [...distancesFrom(tree, allocated)]
      .filter(([id, d]) => d === 1 && !allocated.has(id))
      .map(([id]) => id)[0]
    if (next === undefined) break
    allocated.add(next)
  }
  return allocated
}

describe('summary', () => {
  it('is empty for an empty plan', () => {
    const s = summarise(tree, new Set())
    expect(s.totals).toEqual([])
    expect(s.effects).toEqual([])
    expect(s.nodes).toBe(0)
  })

  it('adds up repeated modifiers instead of listing them twice', () => {
    // Find a stat line that several nodes share verbatim.
    const byLine = new Map<string, number[]>()
    for (const n of tree.nodes) {
      if (n.k === Kind.Mastery || !n.s || n.s.includes('\n')) continue
      if ((n.s.match(/\d+(?:\.\d+)?/g) ?? []).length !== 1) continue
      byLine.set(n.s, [...(byLine.get(n.s) ?? []), n.i])
    }
    const [line, ids] = [...byLine].find(([, v]) => v.length >= 3)!
    const value = parseFloat(line.match(/\d+(?:\.\d+)?/)![0])

    const s = summarise(tree, new Set(ids.slice(0, 3)))
    const row = s.totals.find((t) => t.count === 3)
    expect(row).toBeDefined()
    expect(row!.total).toBeCloseTo(value * 3)
    // The rendered text carries the sum, not the per-node value.
    expect(row!.text).toContain(String(value * 3))
  })

  it('counts every allocated node it summarises', () => {
    const allocated = spend(20)
    expect(summarise(tree, allocated).nodes).toBe(allocated.size)
  })

  it('separates lines that cannot be added', () => {
    const allocated = spend(60)
    const s = summarise(tree, allocated)
    for (const e of s.effects) expect(e.total).toBeNull()
    for (const t of s.totals) expect(t.total).not.toBeNull()
  })

  it('reports choice notables that have no option picked', () => {
    const variantNode = tree.nodes.find((n) => n.v)!
    const route = pathTo(tree, new Set(), variantNode.i)!
    const s = summarise(tree, new Set(route))
    expect(s.unchosen.map((u) => u.id)).toContain(variantNode.i)
  })

  it('uses the chosen option rather than the placeholder text', () => {
    const variantNode = tree.nodes.find((n) => n.v)!
    const [effect, stats] = variantNode.v![0]!
    const route = pathTo(tree, new Set(), variantNode.i)!
    const s = summarise(tree, new Set(route), { [variantNode.i]: effect })
    expect(s.unchosen).toEqual([])
    const firstLine = stats.split('\n')[0]!
    const all = [...s.totals, ...s.effects].map((l) => l.key).join('\n')
    // Summable lines keep a placeholder where the number was, so match on the
    // wording that follows it rather than the whole line.
    const tail = firstLine.split(/\d+(?:\.\d+)?/).pop()!.trim()
    expect(tail.length).toBeGreaterThan(8)
    expect(all).toContain(tail)
  })

  it('sorts the biggest investments first', () => {
    const s = summarise(tree, spend(80))
    for (let i = 1; i < s.totals.length; i++) {
      expect(s.totals[i - 1]!.count).toBeGreaterThanOrEqual(s.totals[i]!.count)
    }
  })
})

describe('distancesFrom', () => {
  it('agrees with pathTo on every reachable node', () => {
    const allocated = spend(12)
    const dist = distancesFrom(tree, allocated)
    // Spot-check a spread of nodes rather than all 966.
    for (let i = 0; i < tree.nodes.length; i += 37) {
      const n = tree.nodes[i]!
      if (n.k === Kind.Mastery) continue
      const route = pathTo(tree, allocated, n.i)
      expect(dist.get(n.i) ?? null).toBe(route ? route.length : null)
    }
  })

  it('reports zero for everything already allocated', () => {
    const allocated = spend(10)
    const dist = distancesFrom(tree, allocated)
    for (const id of allocated) expect(dist.get(id)).toBe(0)
    expect(dist.get(tree.start)).toBe(0)
  })
})

describe('import validation', () => {
  it('round-trips a plan built in the app', () => {
    const allocated = spend(15)
    const code = encode({ nodes: [...allocated], variants: {} })
    const r = importPlan(tree, code)
    expect(r.allocated).toEqual(allocated)
    expect(r.unknown).toEqual([])
    expect(r.orphaned).toEqual([])
  })

  it('drops ids this tree version does not have', () => {
    const allocated = spend(10)
    const code = encode({ nodes: [...allocated, 64001, 64002], variants: {} })
    const r = importPlan(tree, code)
    expect(r.unknown.sort()).toEqual([64001, 64002])
    expect(r.allocated).toEqual(allocated)
  })

  it('drops nodes with no connection to the start', () => {
    const allocated = spend(10)
    // A node far from the allocated island, included without its route.
    const island = [...distancesFrom(tree, allocated)].find(([, d]) => d > 4)![0]
    const r = importPlan(tree, encode({ nodes: [...allocated, island], variants: {} }))
    expect(r.orphaned).toEqual([island])
    expect(r.allocated.has(island)).toBe(false)
  })

  it('refuses a code with nothing usable in it', () => {
    expect(() => importPlan(tree, encode({ nodes: [64001], variants: {} }))).toThrow(/older patch/)
  })

  it('rejects a character passive tree', () => {
    // Same version 6, but a non-zero class id.
    const bytes = [0, 0, 0, 6, 3, 0, 1, 0, 42, 0, 0]
    const code = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_')
    expect(() => importPlan(tree, code)).toThrow(/character passive tree/)
  })

  it('keeps only variant choices the node actually offers', () => {
    const variantNode = tree.nodes.find((n) => n.v)!
    const route = pathTo(tree, new Set(), variantNode.i)!
    const good = variantNode.v![0]![0]
    const r = importPlan(tree, encode({ nodes: route, variants: { [variantNode.i]: good } }))
    expect(r.variants[variantNode.i]).toBe(good)

    const bad = importPlan(tree, encode({ nodes: route, variants: { [variantNode.i]: 1 } }))
    expect(bad.variants[variantNode.i]).toBeUndefined()
  })
})
