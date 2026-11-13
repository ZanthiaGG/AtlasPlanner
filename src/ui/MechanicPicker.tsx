import { useMemo, useState } from 'react'
import { MECHANICS, mechanicColor } from '../tree/mechanics.ts'
import type { MechanicId } from '../tree/mechanics.ts'
import type { Tree } from '../tree/types.ts'
import { Kind } from '../tree/types.ts'

interface Props {
  tree: Tree
  allocated: ReadonlySet<number>
  /** Selection order decides which colour each one gets. */
  selected: MechanicId[]
  onToggle: (id: MechanicId) => void
  onClear: () => void
}

/**
 * The mechanic chooser.
 *
 * Lives in a popover and stays open while you pick, because choosing two or
 * three mechanics is the normal case. It has its own filter box: 43 chips is
 * more than fits on screen, and hunting for "Expedition" by eye through a
 * scrolling grid was the slowest part of the whole app.
 */
export function MechanicPicker({ tree, allocated, selected, onToggle, onClear }: Props) {
  const [q, setQ] = useState('')

  const taken = useMemo(() => {
    const counts = new Map<MechanicId, number>()
    for (const id of allocated) {
      const n = tree.byId.get(id)
      if (!n || n.k === Kind.Mastery) continue
      counts.set(n.m, (counts.get(n.m) ?? 0) + 1)
    }
    return counts
  }, [tree, allocated])

  const needle = q.trim().toLowerCase()
  const shown = needle ? MECHANICS.filter((m) => m.label.toLowerCase().includes(needle)) : MECHANICS

  return (
    <>
      <input
        className="pop-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter mechanics…"
        autoFocus
        spellCheck={false}
      />

      <div className="chips">
        {shown.map((m) => {
          const total = tree.countsByMechanic.get(m.id) ?? 0
          if (!total) return null
          const got = taken.get(m.id) ?? 0
          const on = selected.includes(m.id)
          const color = mechanicColor(m.id, selected)
          return (
            <button
              key={m.id}
              className={'chip' + (on ? ' on' : '')}
              style={on ? { borderColor: color, color } : undefined}
              onClick={() => onToggle(m.id)}
              aria-pressed={on}
              title={`${got} of ${total} ${m.label} nodes allocated`}
            >
              <i style={{ background: color }} />
              <span className="chip-label">{m.label}</span>
              <span className="chip-count">{got}/{total}</span>
            </button>
          )
        })}
        {shown.length === 0 && <p className="hint">No mechanic matches “{q}”.</p>}
      </div>

      <div className="pop-actions">
        <span className="hint">
          {selected.length === 0 ? 'Nothing selected — the list shows the whole tree.'
            : `${selected.length} selected`}
        </span>
        {selected.length > 0 && <button className="link" onClick={onClear}>clear all</button>}
      </div>
    </>
  )
}
