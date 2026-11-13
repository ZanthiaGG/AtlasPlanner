import { Kind } from '../tree/types.ts'
import type { CompactNode } from '../tree/types.ts'
import { MECHANIC_BY_ID } from '../tree/mechanics.ts'

interface Props {
  query: string
  onQuery: (q: string) => void
  hits: CompactNode[]
  allocated: ReadonlySet<number>
  onFocus: (node: CompactNode) => void
}

const KIND_TAG: Record<number, string> = {
  [Kind.Keystone]: 'Keystone',
  [Kind.Wormhole]: 'Gateway',
  [Kind.Notable]: 'Notable',
}

export function SearchPanel({ query, onQuery, hits, allocated, onFocus }: Props) {
  const taken = hits.filter((n) => allocated.has(n.i)).length

  return (
    <>
      <input
        className="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Name or stat — try &quot;pack size&quot;"
        spellCheck={false}
        autoComplete="off"
      />

      {query && (
        <p className="hint">
          {hits.length === 0
            ? 'No matching nodes.'
            : `${hits.length} match${hits.length === 1 ? '' : 'es'} — ${taken} allocated, ${hits.length - taken} not. Full list below.`}
        </p>
      )}

      {hits.length > 0 && (
        <ul className="results">
          {hits.slice(0, 40).map((n) => {
            const m = MECHANIC_BY_ID.get(n.m)
            return (
              <li key={n.i}>
                <button
                  className={'result' + (allocated.has(n.i) ? ' on' : '')}
                  onClick={() => onFocus(n)}
                  title={n.s}
                >
                  <i style={{ background: m?.color ?? '#888' }} />
                  <span className="result-name">{n.n}</span>
                  {KIND_TAG[n.k] && <span className="result-tag">{KIND_TAG[n.k]}</span>}
                </button>
              </li>
            )
          })}
          {hits.length > 40 && <li className="more">+{hits.length - 40} more — see the Nodes panel</li>}
        </ul>
      )}
    </>
  )
}
