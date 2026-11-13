import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  /** Which corner it hangs from. */
  anchor: 'top-right' | 'sidebar'
  children: ReactNode
  footer?: ReactNode
}

/**
 * A panel that stays open until you close it.
 *
 * The sidebar used to stack everything in accordions that fought each other for
 * height, and picking a mechanic slammed its own panel shut. These float over
 * the canvas instead: opening one costs the node list no room, and clicking
 * around inside never dismisses it. Escape or a click outside closes it.
 */
export function Popover({ title, onClose, anchor, children, footer }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    const onDown = (e: PointerEvent) => {
      const el = ref.current
      if (!el || el.contains(e.target as Node)) return
      // The button that opened this popover handles its own toggle; closing here
      // too would make the click a no-op.
      if ((e.target as Element).closest?.('[data-popover-toggle]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  return (
    <div className={`popover pop-${anchor}`} ref={ref} role="dialog" aria-label={title}>
      <header className="pop-head">
        <h2>{title}</h2>
        <button className="pop-close" onClick={onClose} aria-label={`Close ${title}`}>×</button>
      </header>
      <div className="pop-body">{children}</div>
      {footer && <footer className="pop-foot">{footer}</footer>}
    </div>
  )
}
