import { useMemo, useState } from 'react'
import { Kind } from '../tree/types.ts'
import type { CompactNode } from '../tree/types.ts'
import { MECHANIC_BY_ID } from '../tree/mechanics.ts'

export type ListFilter = 'all' | 'taken' | 'available'

interface Props {
  /** The nodes to list — already narrowed by the mechanic chips and/or search. */
  pool: CompactNode[]
  allocated: ReadonlySet<number>
  /** Points needed to reach a node, or null if unreachable. */
  costOf: (id: number) => number | null
  onFocus: (node: CompactNode) => void
  onAllocate: (node: CompactNode) => void
  onDeallocate: (node: CompactNode) => void
  emptyHint: string
}

interface Row {
  key: string
  name: string
  stats: string
  kind: Kind
  mechanic: CompactNode['m']
  /** Every node sharing this exact name and stat text. */
  nodes: CompactNode[]
  taken: number
}

const KIND_TAG: Partial<Record<Kind, string>> = {
  [Kind.Keystone]: 'Keystone',
  [Kind.Wormhole]: 'Gateway',
  [Kind.Notable]: 'Notable',
}

/**
 * Every modifier in the current selection, with how many of each you own.
 *
 * The Atlas repeats the same passive many times over — there are a dozen
 * identical "Strongbox Item Quantity" nodes — so listing raw nodes would be a
 * wall of duplicates. Rows are grouped by identical name and stat text and
 * carry a `taken / total` count instead, which turns the panel into a
 * checklist of what a mechanic actually offers.
 */
export function NodeList(p: Props) {
  const [filter, setFilter] = useState<ListFilter>('all')

  const rows = useMemo(() => {
    const byKey = new Map<string, Row>()
    for (const n of p.pool) {
      if (n.k === Kind.Mastery) continue
      const key = `${n.n}\u0000${n.s}`
      let row = byKey.get(key)
      if (!row) {
        byKey.set(key, (row = {
          key, name: n.n, stats: n.s, kind: n.k, mechanic: n.m, nodes: [], taken: 0,
        }))
      }
      row.nodes.push(n)
      if (p.allocated.has(n.i)) row.taken++
      // A group's kind is the most significant kind among its members
      // (masteries are already filtered out above).
      if (n.k > row.kind) row.kind = n.k
    }

    const all = [...byKey.values()]
    all.sort((a, b) => b.kind - a.kind || a.name.localeCompare(b.name))
    return all
  }, [p.pool, p.allocated])

  const shown = rows.filter((r) =>
    filter === 'all' ? true : filter === 'taken' ? r.taken > 0 : r.taken < r.nodes.length,
  )

  const totalNodes = rows.reduce((n, r) => n + r.nodes.length, 0)
  const totalTaken = rows.reduce((n, r) => n + r.taken, 0)

  if (!p.pool.length) return <p className="hint">{p.emptyHint}</p>

  return (
    <div className="nodelist">
      <div className="nl-summary">
        <strong>{totalTaken}</strong> of {totalNodes} allocated
        <span className="nl-dim"> · {rows.length} distinct</span>
      </div>

      <div className="seg">
        {(['all', 'available', 'taken'] as ListFilter[]).map((f) => (
          <button
            key={f}
            className={filter === f ? 'on' : ''}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'available' ? 'Available' : 'Taken'}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="hint">
          {filter === 'taken' ? 'None of these are allocated yet.' : 'You have taken all of these.'}
        </p>
      )}

      <ul className="nl-rows">
        {shown.map((r) => {
          const free = r.nodes.filter((n) => !p.allocated.has(n.i))
          const complete = free.length === 0
          // Cheapest route among the copies — the Atlas scatters identical
          // passives around, and the nearest one is rarely the first in the list.
          let best: CompactNode | null = null
          let bestCost = Infinity
          for (const n of free) {
            const c = p.costOf(n.i)
            if (c !== null && c < bestCost) { bestCost = c; best = n }
          }
          const mech = MECHANIC_BY_ID.get(r.mechanic)

          return (
            <li key={r.key} className={'nl-row' + (complete ? ' done' : r.taken ? ' part' : '')}>
              <button
                className="nl-pick"
                onClick={() => p.onFocus(best ?? r.nodes[0]!)}
                title="Show on the tree"
              >
                <i style={{ background: mech?.color ?? '#888' }} />
                <span className="nl-text">
                  <span className="nl-name">
                    {r.name}
                    {KIND_TAG[r.kind] && <em className="nl-tag">{KIND_TAG[r.kind]}</em>}
                  </span>
                  {r.stats && <span className="nl-stats">{r.stats}</span>}
                </span>
                <span className="nl-count">
                  {r.taken}<span className="nl-dim">/{r.nodes.length}</span>
                </span>
              </button>

              <div className="nl-acts">
                <button
                  className="nl-act add"
                  disabled={complete || !best}
                  onClick={() => best && p.onAllocate(best)}
                  title={
                    complete ? 'All copies allocated'
                      : best ? `Allocate the nearest copy — ${bestCost} point${bestCost === 1 ? '' : 's'}`
                      : 'Unreachable'
                  }
                >
                  +
                </button>
                <button
                  className="nl-act remove"
                  disabled={r.taken === 0}
                  onClick={() => {
                    const owned = r.nodes.find((n) => p.allocated.has(n.i))
                    if (owned) p.onDeallocate(owned)
                  }}
                  title="Remove a copy"
                >
                  −
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
