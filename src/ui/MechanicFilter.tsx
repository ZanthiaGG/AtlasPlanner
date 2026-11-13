import { useMemo } from 'react'
import { MECHANICS } from '../tree/mechanics.ts'
import type { MechanicId } from '../tree/mechanics.ts'
import type { Tree } from '../tree/types.ts'
import { Kind } from '../tree/types.ts'

interface Props {
  tree: Tree
  allocated: ReadonlySet<number>
  active: ReadonlySet<MechanicId>
  onToggle: (id: MechanicId) => void
  onClear: () => void
}

/**
 * The "pick what you want to farm" control.
 *
 * Each chip shows `taken / total` for that mechanic, so the panel doubles as a
 * progress readout: pick Breach and you can see at a glance how much of the
 * Breach tree you already own.
 */
export function MechanicFilter({ tree, allocated, active, onToggle, onClear }: Props) {
  const taken = useMemo(() => {
    const counts = new Map<MechanicId, number>()
    for (const id of allocated) {
      const n = tree.byId.get(id)
      if (!n || n.k === Kind.Mastery) continue
      counts.set(n.m, (counts.get(n.m) ?? 0) + 1)
    }
    return counts
  }, [tree, allocated])

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Mechanics</h2>
        {active.size > 0 && (
          <button className="link" onClick={onClear}>clear</button>
        )}
      </header>

      <p className="hint">
        {active.size === 0
          ? 'Pick one or more to highlight their nodes and dim everything else.'
          : `${active.size} selected — everything else is dimmed.`}
      </p>

      <div className="chips">
        {MECHANICS.map((m) => {
          const total = tree.countsByMechanic.get(m.id) ?? 0
          if (!total) return null
          const got = taken.get(m.id) ?? 0
          const on = active.has(m.id)
          return (
            <button
              key={m.id}
              className={'chip' + (on ? ' on' : '')}
              style={on ? { borderColor: m.color, color: m.color } : undefined}
              onClick={() => onToggle(m.id)}
              title={`${got} of ${total} ${m.label} nodes allocated`}
            >
              <i style={{ background: m.color }} />
              <span className="chip-label">{m.label}</span>
              <span className="chip-count">{got}/{total}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
