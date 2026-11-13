import { useMemo } from 'react'
import { summarise } from '../tree/summary.ts'
import type { Tree } from '../tree/types.ts'
import type { Plan } from '../state/plan.ts'

interface Props {
  tree: Tree
  plan: Plan
  pointsUsed: number
  pointsTotal: number
  onFocusNode: (id: number) => void
}

/**
 * What the allocated tree actually does, with repeated modifiers added up.
 * See `src/tree/summary.ts` for why most lines can be summed.
 */
export function SummaryPanel({ tree, plan, pointsUsed, pointsTotal, onFocusNode }: Props) {
  const s = useMemo(
    () => summarise(tree, plan.allocated, plan.variants),
    [tree, plan.allocated, plan.variants],
  )

  if (pointsUsed === 0) {
    return <p className="hint">Allocate some nodes and this will show what your tree does, with repeated modifiers added together.</p>
  }

  return (
    <>
      <p className="sum-head">
        <strong>{pointsUsed}</strong> of {pointsTotal} points · {s.totals.length + s.effects.length} distinct modifiers
      </p>

      {s.unchosen.length > 0 && (
        <div className="sum-warn">
          {s.unchosen.length} notable{s.unchosen.length === 1 ? '' : 's'} still need an option chosen:
          {' '}
          {s.unchosen.map((u, i) => (
            <span key={u.id}>
              {i > 0 && ', '}
              <button className="link" onClick={() => onFocusNode(u.id)}>{u.name}</button>
            </span>
          ))}
        </div>
      )}

      {s.totals.length > 0 && (
        <ul className="sum-list">
          {s.totals.map((line) => (
            <li key={line.key}>
              <span className="sum-text">{line.text}</span>
              <span className="sum-count" title={`${line.count} nodes`}>×{line.count}</span>
            </li>
          ))}
        </ul>
      )}

      {s.effects.length > 0 && (
        <>
          <div className="subhead">Effects</div>
          <ul className="sum-list effects">
            {s.effects.map((line) => (
              <li key={line.key}>
                <span className="sum-text">{line.text}</span>
                {line.count > 1 && <span className="sum-count">×{line.count}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
