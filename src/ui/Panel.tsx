import type { ReactNode } from 'react'

interface Props {
  title: string
  /** Summary shown in the header — most useful when the panel is collapsed. */
  badge?: ReactNode
  /** Extra control on the right of the header, e.g. a "clear" link. */
  action?: ReactNode
  open: boolean
  onToggle: () => void
  /** Let the body own the leftover sidebar height (used by the node list). */
  grow?: boolean
  children: ReactNode
}

/**
 * Collapsible sidebar section.
 *
 * Controlled rather than self-managing so the app can open the node list and
 * fold the mechanic chips away the moment a mechanic is picked.
 */
export function Panel({ title, badge, action, open, onToggle, grow, children }: Props) {
  return (
    <section className={'panel' + (open ? ' open' : '') + (grow && open ? ' grow' : '')}>
      <header className="panel-head">
        <button className="panel-toggle" onClick={onToggle} aria-expanded={open}>
          <span className={'caret' + (open ? ' open' : '')} aria-hidden="true">›</span>
          <h2>{title}</h2>
          {badge !== undefined && <span className="panel-badge">{badge}</span>}
        </button>
        {open && action}
      </header>
      {open && <div className="panel-body">{children}</div>}
    </section>
  )
}
