import { Kind } from './types.ts'
import type { CompactNode, Tree } from './types.ts'

export interface SearchResult {
  hits: CompactNode[]
  ids: Set<number>
}

const EMPTY: SearchResult = { hits: [], ids: new Set() }

/**
 * Free-text search over node names, stats and the options on multiple-choice
 * notables — searching "breach" should find "Breach Magic Monster Chance" by
 * name and "Outside Entities" by one of its hidden options.
 *
 * Multiple whitespace-separated terms must all match (AND), so "ritual tribute"
 * narrows rather than widens.
 */
export function search(tree: Tree, query: string): SearchResult {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return EMPTY

  const hits: CompactNode[] = []
  for (const n of tree.nodes) {
    if (n.k === Kind.Mastery) continue
    const hay = `${n.n}\n${n.s}\n${n.v ? n.v.map((v) => v[1]).join('\n') : ''}`.toLowerCase()
    if (terms.every((t) => hay.includes(t))) hits.push(n)
  }

  // Notables and keystones first (they are what people actually hunt for), then
  // by name so the jump order is stable between keystrokes.
  hits.sort((a, b) => rank(b) - rank(a) || a.n.localeCompare(b.n))
  return { hits, ids: new Set(hits.map((n) => n.i)) }
}

function rank(n: CompactNode): number {
  if (n.k === Kind.Keystone) return 3
  if (n.k === Kind.Wormhole) return 2
  if (n.k === Kind.Notable) return 1
  return 0
}
