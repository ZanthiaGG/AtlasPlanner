import { useState } from 'react'
import { encodeUrl } from '../tree/codec.ts'
import type { Plan } from '../state/plan.ts'
import type { SavedPlan } from '../state/storage.ts'

interface Props {
  plan: Plan
  pointsUsed: number
  pointsTotal: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onReset: () => void
  /** Throws with a readable message when the text is not importable. */
  onImport: (text: string) => void
  saved: SavedPlan[]
  onSave: (name: string) => void
  onLoad: (saved: SavedPlan) => void
  onDelete: (id: string) => void
}

export function PlanPanel(p: Props) {
  const [name, setName] = useState('')
  const [importText, setImportText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const pct = p.pointsTotal ? (p.pointsUsed / p.pointsTotal) * 100 : 0
  const over = p.pointsUsed > p.pointsTotal

  const doImport = () => {
    setError(null)
    try {
      p.onImport(importText)
      setImportText('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that link.')
    }
  }

  const doCopy = async () => {
    setError(null)
    try {
      await navigator.clipboard.writeText(encodeUrl({
        nodes: [...p.plan.allocated],
        variants: p.plan.variants,
      }))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not reach the clipboard — copy the address bar instead.')
    }
  }

  return (
    <>
      <div className={'points' + (over ? ' over' : '')}>
        <div className="points-bar"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
        <div className="points-text"><strong>{p.pointsUsed}</strong> / {p.pointsTotal} points</div>
      </div>

      <div className="row">
        <button onClick={p.onUndo} disabled={!p.canUndo}>Undo</button>
        <button onClick={p.onRedo} disabled={!p.canRedo}>Redo</button>
        {confirmReset ? (
          <button
            className="danger"
            onClick={() => { p.onReset(); setConfirmReset(false) }}
            onBlur={() => setConfirmReset(false)}
            autoFocus
          >
            Clear {p.pointsUsed} points?
          </button>
        ) : (
          <button onClick={() => setConfirmReset(true)} disabled={p.pointsUsed === 0}>Reset</button>
        )}
      </div>

      <div className="subhead">Saved plans</div>

      <div className="row">
        <input
          className="grow"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this plan"
          aria-label="Plan name"
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { p.onSave(name.trim()); setName('') } }}
        />
        <button onClick={() => { p.onSave(name.trim()); setName('') }} disabled={!name.trim() || p.pointsUsed === 0}>
          {p.saved.some((s) => s.name === name.trim()) ? 'Overwrite' : 'Save'}
        </button>
      </div>

      {p.saved.length > 0 && (
        <ul className="saved">
          {p.saved.map((s) => (
            <li key={s.id}>
              <button className="saved-load" onClick={() => p.onLoad(s)}>{s.name}</button>
              <button className="saved-del" onClick={() => p.onDelete(s.id)} aria-label={`Delete ${s.name}`}>×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="subhead">Share</div>

      <div className="row">
        <button className="grow primary" onClick={doCopy} disabled={p.pointsUsed === 0}>
          {copied ? 'Copied' : 'Copy Path of Exile link'}
        </button>
      </div>

      <div className="row">
        <input
          className="grow"
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setError(null) }}
          placeholder="Paste an Atlas tree link"
          aria-label="Atlas tree link to import"
          onKeyDown={(e) => { if (e.key === 'Enter') doImport() }}
          spellCheck={false}
        />
        <button onClick={doImport} disabled={!importText.trim()}>Import</button>
      </div>

      {error && <p className="error">{error}</p>}
      <p className="hint">Links work both ways with pathofexile.com and other planners.</p>
    </>
  )
}
