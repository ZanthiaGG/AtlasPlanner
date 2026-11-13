import { decode } from './codec.ts'
import { prune } from './pathfind.ts'
import type { Tree } from './types.ts'

export interface ImportedPlan {
  allocated: Set<number>
  variants: Record<number, number>
  /** Ids in the code that this tree version does not have. */
  unknown: number[]
  /** Ids dropped because nothing connected them to the start node. */
  orphaned: number[]
}

/**
 * Turn a pasted code or link into an allocation this tree can actually show.
 *
 * `decode` only reads bytes; it has no idea whether the ids mean anything here.
 * A code from an older patch, a hand-edited URL or a different tree would
 * otherwise sail through and leave the point counter claiming a plan that the
 * canvas cannot draw, with no error. So ids are checked against the tree and the
 * result is pruned to the component reachable from the start node — the same
 * guard a deallocation uses.
 */
export function importPlan(tree: Tree, input: string): ImportedPlan {
  const { nodes, variants } = decode(input)

  const unknown: number[] = []
  const known = new Set<number>()
  for (const id of nodes) {
    if (id === tree.start) continue
    if (tree.byId.has(id)) known.add(id)
    else unknown.push(id)
  }

  if (known.size === 0) {
    throw new Error(
      unknown.length
        ? `None of those ${unknown.length} nodes exist in the ${tree.version} tree — the link may be from an older patch.`
        : 'That link has no allocated nodes.',
    )
  }

  const connected = prune(tree, known)
  const orphaned = [...known].filter((id) => !connected.has(id))

  // Keep only choices for notables that survived, and only effects the node
  // actually offers.
  const kept: Record<number, number> = {}
  for (const [key, effect] of Object.entries(variants)) {
    const id = Number(key)
    const node = tree.byId.get(id)
    if (!connected.has(id) || !node?.v) continue
    if (node.v.some(([e]) => e === effect)) kept[id] = effect
  }

  return { allocated: connected, variants: kept, unknown, orphaned }
}

/** One short sentence describing anything the import had to drop, or null. */
export function importWarning(r: ImportedPlan): string | null {
  const bits: string[] = []
  if (r.unknown.length) bits.push(`${r.unknown.length} node${r.unknown.length === 1 ? '' : 's'} not in this tree version`)
  if (r.orphaned.length) bits.push(`${r.orphaned.length} not connected to the start`)
  return bits.length ? `Dropped ${bits.join(' and ')}.` : null
}
