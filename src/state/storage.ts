import { encode } from '../tree/codec.ts'
import { importPlan } from '../tree/import.ts'
import type { Tree } from '../tree/types.ts'
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

/** `encode` throws above 255 nodes; nothing here should take a click down with it. */
function safeEncode(plan: Plan): string | null {
  try {
    return encode({ nodes: [...plan.allocated], variants: plan.variants })
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- url hash

/** Mirror the current plan into `#<code>` so the page URL is always shareable. */
export function writeHash(plan: Plan) {
  const code = plan.allocated.size ? safeEncode(plan) : null
  try {
    history.replaceState(null, '', code ? `#${code}` : ' ')
  } catch {
    /* some embedded webviews refuse replaceState; the app still works */
  }
}

/**
 * Read a plan out of the page URL on first load.
 *
 * Validated against the tree, so a stale or hand-edited hash cannot produce a
 * point total with nothing on the canvas.
 */
export function readHash(tree: Tree): Plan | null {
  const raw = location.hash.replace(/^#/, '')
  if (!raw) return null
  try {
    const r = importPlan(tree, raw)
    return { allocated: r.allocated, variants: r.variants }
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
  const code = safeEncode(plan)
  if (code === null) return plans
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

/** Saved plans are stored as codes; they still need validating on the way back in. */
export function planFromSaved(saved: SavedPlan, tree?: Tree): Plan {
  if (!tree) return emptyPlan()
  try {
    const r = importPlan(tree, saved.code)
    return { allocated: r.allocated, variants: r.variants }
  } catch {
    return emptyPlan()
  }
}
