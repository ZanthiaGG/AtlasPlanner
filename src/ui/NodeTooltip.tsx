import { Kind } from '../tree/types.ts'
import type { CompactNode } from '../tree/types.ts'
import { MECHANIC_BY_ID } from '../tree/mechanics.ts'

const KIND_LABEL: Record<number, string> = {
  [Kind.Small]: 'Passive',
  [Kind.Notable]: 'Notable',
  [Kind.Keystone]: 'Keystone',
  [Kind.Wormhole]: 'Gateway',
  [Kind.Start]: 'Start',
  [Kind.Mastery]: 'Mastery',
}

interface Props {
  node: CompactNode
  x: number
  y: number
  allocated: boolean
  isStart: boolean
  /** Points the cheapest route would cost, or null if unreachable. */
  cost: number | null
  chosenVariant?: number
  mechanicColor: string
}

export function NodeTooltip({ node, x, y, allocated, isStart, cost, chosenVariant, mechanicColor }: Props) {
  const mechanic = MECHANIC_BY_ID.get(node.m)

  // Flip to the other side of the cursor near the viewport edges so the tooltip
  // never gets clipped.
  const flipX = x > window.innerWidth - 380
  const flipY = y > window.innerHeight - 280

  return (
    <div
      className="tooltip"
      style={{
        left: flipX ? undefined : x + 18,
        right: flipX ? window.innerWidth - x + 18 : undefined,
        top: flipY ? undefined : y + 18,
        bottom: flipY ? window.innerHeight - y + 18 : undefined,
      }}
    >
      <div className="tt-head">
        <span className="tt-name">{node.n || 'Atlas Start'}</span>
        <span className="tt-kind">{KIND_LABEL[node.k]}</span>
      </div>

      {mechanic && (
        <div className="tt-mechanic">
          <i style={{ background: mechanicColor }} />
          {mechanic.label}
        </div>
      )}

      {node.s && <div className="tt-stats">{node.s}</div>}

      {node.v && (
        <div className="tt-variants">
          <div className="tt-sub">{chosenVariant === undefined ? 'Options — choose one in the list' : 'Options'}</div>
          {node.v.map(([effect, stats]) => (
            <div key={effect} className={'tt-variant' + (chosenVariant === effect ? ' chosen' : '')}>
              {stats}
            </div>
          ))}
        </div>
      )}

      {node.rt && <div className="tt-reminder">{node.rt}</div>}
      {node.ft && <div className="tt-flavour">{node.ft}</div>}

      <div className="tt-foot">
        {isStart ? (
          <span className="tt-on">Where every Atlas tree begins</span>
        ) : allocated ? (
          <span className="tt-on">Allocated — shift-click to remove</span>
        ) : cost === null ? (
          <span className="tt-off">Unreachable</span>
        ) : (
          <span className="tt-cost">{cost} point{cost === 1 ? '' : 's'} to reach</span>
        )}
      </div>
    </div>
  )
}
