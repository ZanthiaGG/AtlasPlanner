import { Kind } from './types.ts'
import type { Tree } from './types.ts'
import type { MechanicId } from './mechanics.ts'

/**
 * "What does my tree actually do?"
 *
 * The Atlas hands you 150 separate modifier lines; nobody can hold that in their
 * head. Most of them repeat, so they add up: 53 copies of "{}% increased Threads
 * found in your Maps" is really one number.
 *
 * On the 3.30 tree 83% of stat lines contain exactly one number, which makes
 * them summable by replacing that number with a placeholder and grouping on the
 * result. Lines with no number (13%) are statements — listed with a count.
 * Lines with several numbers (4%) are ranges or multi-part effects that cannot
 * be added meaningfully, so they are listed verbatim too.
 */

export interface SummaryLine {
  /** The stat text with the total substituted back in. */
  text: string
  /** Grouping key — the stat text with its number replaced by a placeholder. */
  key: string
  /** Summed value, or null for lines that are not summable. */
  total: number | null
  /** How many allocated nodes contribute this line. */
  count: number
  mechanic: MechanicId
}

export interface Summary {
  /** Summed modifiers, largest contribution first. */
  totals: SummaryLine[]
  /** Statements and multi-value lines, which cannot be added. */
  effects: SummaryLine[]
  /** Allocated nodes that contributed. */
  nodes: number
  /** Allocated choice notables with no option picked yet. */
  unchosen: { id: number; name: string }[]
}

const PLACEHOLDER = '••'
const NUMBER = /-?\d+(?:\.\d+)?/g

/** Round to at most one decimal, without trailing ".0". */
function tidy(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

export function summarise(
  tree: Tree,
  allocated: ReadonlySet<number>,
  variants: Record<number, number> = {},
): Summary {
  const totals = new Map<string, SummaryLine>()
  const effects = new Map<string, SummaryLine>()
  const unchosen: Summary['unchosen'] = []
  let nodes = 0

  for (const id of allocated) {
    const node = tree.byId.get(id)
    if (!node || node.k === Kind.Mastery || node.i === tree.start) continue
    nodes++

    // A choice notable contributes the option you picked, not its "select a
    // type of content" placeholder text.
    let text = node.s
    if (node.v) {
      const chosen = variants[node.i]
      const option = chosen === undefined ? undefined : node.v.find(([effect]) => effect === chosen)
      if (!option) {
        unchosen.push({ id: node.i, name: node.n })
        continue
      }
      text = option[1]
    }
    if (!text) continue

    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const found = trimmed.match(NUMBER)

      if (found?.length === 1) {
        const value = parseFloat(found[0])
        const key = trimmed.replace(NUMBER, PLACEHOLDER)
        const hit = totals.get(key)
        if (hit) { hit.total = (hit.total ?? 0) + value; hit.count++ }
        else totals.set(key, { key, text: '', total: value, count: 1, mechanic: node.m })
      } else {
        const hit = effects.get(trimmed)
        if (hit) hit.count++
        else effects.set(trimmed, { key: trimmed, text: trimmed, total: null, count: 1, mechanic: node.m })
      }
    }
  }

  for (const line of totals.values()) {
    line.text = line.key.replace(PLACEHOLDER, tidy(line.total ?? 0))
  }

  return {
    // Most-invested first: the lines you poured the most points into are the
    // ones that describe the build.
    totals: [...totals.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
    effects: [...effects.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text)),
    nodes,
    unchosen,
  }
}
