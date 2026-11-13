import { decode, encode } from '../tree/codec.ts'
import type { Plan } from './plan.ts'
import { emptyPlan } from './plan.ts'

const PLANS_KEY = 'atlasplanner.plans.v1'

export interface SavedPlan {
  id: string
  name: string
  /** The plan as a tree code, so a saved plan is also a shareable link. */
  code: string
  updated: number
}

// ---------------------------------------------------------------- url hash

/** Mirror the current plan into `#<code>` so the page URL is always shareable. */
export function writeHash(plan: Plan) {
  try {
    const code = encode({ nodes: [...plan.allocated], variants: plan.variants })
    const next = plan.allocated.size ? `#${code}` : ' '
    history.replaceState(null, '', next)
  } catch {
    // An over-long plan simply does not get mirrored; the app still works.
  }
}

/** Read a plan out of the page URL on first load. */
export function readHash(): Plan | null {
  const raw = location.hash.replace(/^#/, '')
  if (!raw) return null
  try {
    const { nodes, variants } = decode(raw)
    return { allocated: new Set(nodes), variants }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- saved plans

export function loadPlans(): SavedPlan[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedPlan[]) : []
  } catch {
    // Private browsing, blocked storage, or corrupted JSON — not worth failing over.
    return []
  }
}

function writePlans(plans: SavedPlan[]) {
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans))
  } catch {
    /* storage unavailable */
  }
}

export function savePlan(plans: SavedPlan[], name: string, plan: Plan): SavedPlan[] {
  const code = encode({ nodes: [...plan.allocated], variants: plan.variants })
  const existing = plans.find((p) => p.name === name)
  const next = existing
    ? plans.map((p) => (p.id === existing.id ? { ...p, code, updated: Date.now() } : p))
    : [...plans, { id: crypto.randomUUID(), name, code, updated: Date.now() }]
  next.sort((a, b) => b.updated - a.updated)
  writePlans(next)
  return next
}

export function deletePlan(plans: SavedPlan[], id: string): SavedPlan[] {
  const next = plans.filter((p) => p.id !== id)
  writePlans(next)
  return next
}

export function planFromSaved(saved: SavedPlan): Plan {
  try {
    const { nodes, variants } = decode(saved.code)
    return { allocated: new Set(nodes), variants }
  } catch {
    return emptyPlan()
  }
}
