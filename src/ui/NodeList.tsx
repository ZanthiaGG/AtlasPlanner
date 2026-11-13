import { useMemo, useState } from 'react'
import { Kind } from '../tree/types.ts'
import type { CompactNode } from '../tree/types.ts'
import { mechanicColor } from '../tree/mechanics.ts'
import type { MechanicId } from '../tree/mechanics.ts'

export type ListFilter = 'all' | 'available' | 'taken'

interface Props {
  /** The nodes to list — already narrowed by the mechanic chips and/or search. */
  pool: CompactNode[]
  allocated: ReadonlySet<number>
  /** nodeId -> chosen effectId. */
  variants: Record<number, number>
  /** Points needed to reach a node, or null if unreachable. */
  costOf: (id: number) => number | null
  pointsLeft: number
  selectedMechanics: MechanicId[]
  onFocus: (node: CompactNode) => void
  onAllocate: (node: CompactNode) => void
  onDeallocate: (node: CompactNode) => void
  onChooseVariant: (nodeId: number, effectId: number) => void
  emptyHint: string
}

interface Row {
  key: string
  name: string
  stats: string
  kind: Kind
  mechanic: MechanicId
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
 * The Atlas repeats the same passive many times over — there are 44 identical
 * "Map Drop Chance" nodes — so listing raw nodes would be a wall of duplicates.
 * Rows group by identical name and stat text and carry a `taken / total` count,
 * which turns the panel into a checklist of what a mechanic actually offers.
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

      <div className="seg" role="group" aria-label="Filter the list">
        {(['all', 'available', 'taken'] as ListFilter[]).map((f) => (
          <button key={f} className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
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

          // Identical passives are scattered all over the Atlas, so the nearest
          // copy is rarely the first one found.
          let best: CompactNode | null = null
          let bestCost = Infinity
          for (const n of free) {
            const c = p.costOf(n.i)
            if (c !== null && c < bestCost) { bestCost = c; best = n }
          }
          const affordable = best !== null && bestCost <= p.pointsLeft
          const color = mechanicColor(r.mechanic, p.selectedMechanics)

          // A choice notable needs an option picked before it does anything.
          const chooseable = r.nodes.filter((n) => n.v && p.allocated.has(n.i))

          return (
            <li key={r.key} className={'nl-row' + (complete ? ' done' : r.taken ? ' part' : '')}>
              <div className="nl-main">
                <button className="nl-pick" onClick={() => p.onFocus(best ?? r.nodes[0]!)} title="Show on the tree">
                  <i style={{ background: color }} />
                  <span className="nl-text">
                    <span className="nl-name">
                      {r.name}
                      {KIND_TAG[r.kind] && <em className="nl-tag">{KIND_TAG[r.kind]}</em>}
                    </span>
                    {r.stats && <span className="nl-stats">{r.stats}</span>}
                  </span>
                  <span className="nl-meta">
                    <span className="nl-count">{r.taken}<span className="nl-dim">/{r.nodes.length}</span></span>
                    {!complete && best !== null && (
                      <span className={'nl-cost' + (affordable ? '' : ' unaffordable')}>
                        {affordable ? `${bestCost}p` : `${bestCost}p`}
                      </span>
                    )}
                    {!complete && best === null && <span className="nl-cost unreachable">—</span>}
                  </span>
                </button>

                <div className="nl-acts">
                  <button
                    className="nl-act add"
                    disabled={complete || !affordable}
                    onClick={() => best && p.onAllocate(best)}
                    aria-label={`Allocate ${r.name}`}
                    title={
                      complete ? 'All copies allocated'
                        : best === null ? 'Unreachable'
                        : !affordable ? `Needs ${bestCost} points, you have ${p.pointsLeft} left`
                        : `Allocate the nearest copy — ${bestCost} point${bestCost === 1 ? '' : 's'}`
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
                    aria-label={`Remove ${r.name}`}
                    title="Remove a copy"
                  >
                    −
                  </button>
                </div>
              </div>

              {chooseable.map((n) => (
                <div className="nl-variants" key={n.i}>
                  <div className="nl-variants-head">
                    {p.variants[n.i] === undefined ? 'Choose an option' : 'Option'}
                  </div>
                  {n.v!.map(([effect, stats]) => (
                    <button
                      key={effect}
                      className={'nl-variant' + (p.variants[n.i] === effect ? ' chosen' : '')}
                      aria-pressed={p.variants[n.i] === effect}
                      onClick={() => p.onChooseVariant(n.i, effect)}
                    >
                      {stats}
                    </button>
                  ))}
                </div>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
