/**
 * Path of Exile tree-code version 6 — the format behind
 * `pathofexile.com/atlas-skill-tree/<code>` links.
 *
 * Layout, all integers big-endian:
 *
 * | offset | size            | field                                  |
 * |--------|-----------------|----------------------------------------|
 * | 0      | u32             | version (6)                            |
 * | 4      | u8              | class id          — always 0 for atlas |
 * | 5      | u8              | ascendancy byte   — always 0 for atlas |
 * | 6      | u8              | nodeCount                              |
 * | 7      | nodeCount x u16 | allocated node ids, ascending          |
 * | ...    | u8              | extendedNodeCount — always 0 for atlas |
 * | ...    | u8              | masteryEffectCount                     |
 * | ...    | n x (u16, u16)  | (effectId, nodeId) — effect first      |
 *
 * The byte string is then base64url-encoded (`+`->`-`, `/`->`_`).
 *
 * Verified against two independent implementations that agree exactly:
 * the encoder in `Path of Claude/src/atlas.ts:223` and PathOfPathing's
 * `SkillTreeUrlV6Decoder`. On the Atlas tree the mastery-effect block carries the
 * chosen option for "select a type of content" notables.
 */

export const TREE_VERSION = 6
/** A tree code's node count is a single byte. */
export const MAX_NODES = 255

export const EXPORT_PREFIX = 'https://www.pathofexile.com/fullscreen-atlas-skill-tree/'

export interface TreeCode {
  /** Allocated node ids (the start node is implicit and not included). */
  nodes: number[]
  /** nodeId -> chosen effectId, for multiple-choice notables. */
  variants: Record<number, number>
}

// ---------------------------------------------------------------- base64url

function bytesToBase64Url(bytes: number[]): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlToBytes(code: string): Uint8Array {
  const padded = code.replace(/-/g, '+').replace(/_/g, '/')
  // Tolerate codes pasted without their `=` padding.
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ---------------------------------------------------------------- encode

/** Serialise an allocation to a bare base64url tree code. */
export function encode({ nodes, variants }: TreeCode): string {
  const sorted = [...new Set(nodes)].sort((a, b) => a - b)
  if (sorted.length > MAX_NODES) {
    throw new Error(`a tree code holds at most ${MAX_NODES} nodes (got ${sorted.length})`)
  }

  const b: number[] = [0, 0, 0, TREE_VERSION, 0, 0]
  b.push(sorted.length)
  for (const id of sorted) b.push((id >> 8) & 255, id & 255)
  b.push(0) // extendedNodeCount

  const pairs = Object.entries(variants)
    .map(([node, effect]) => [Number(node), effect] as const)
    // Only keep choices for nodes actually allocated, so a stale choice left over
    // from a deallocated notable never leaks into the exported link.
    .filter(([node]) => sorted.includes(node))
  b.push(pairs.length)
  for (const [node, effect] of pairs) {
    b.push((effect >> 8) & 255, effect & 255, (node >> 8) & 255, node & 255)
  }

  return bytesToBase64Url(b)
}

/** A full pathofexile.com link for an allocation. */
export function encodeUrl(code: TreeCode): string {
  return EXPORT_PREFIX + encode(code)
}

// ---------------------------------------------------------------- decode

/**
 * Parse a tree code. Accepts a bare code or any pathofexile.com atlas-tree URL
 * (`/atlas-skill-tree/`, `/fullscreen-atlas-skill-tree/`, with or without a
 * `?ver=` query or a trailing slash).
 *
 * Throws with a readable message on anything it cannot parse — this runs on
 * whatever the user pastes into the import box.
 */
export function decode(input: string): TreeCode {
  const code = extractCode(input)
  if (!code) throw new Error('That does not look like a tree code or an Atlas tree link.')

  let bytes: Uint8Array
  try {
    bytes = base64UrlToBytes(code)
  } catch {
    throw new Error('That code is not valid base64 — it may have been truncated.')
  }

  if (bytes.length < 7) throw new Error('That code is too short to be a tree.')

  const version = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!
  if (version !== TREE_VERSION) {
    throw new Error(`Unsupported tree code version ${version} — this planner reads version ${TREE_VERSION}.`)
  }

  // Character passive-tree links are version 6 too, and they are easy to confuse
  // with Atlas ones. They carry a non-zero class or ascendancy; the Atlas tree
  // always has both at zero. Without this check a character tree imports as a
  // pile of ids that mean nothing here — the point counter moves and the canvas
  // stays empty.
  const classId = bytes[4]!
  const ascendancy = bytes[5]!
  if (classId !== 0 || ascendancy !== 0) {
    throw new Error('That looks like a character passive tree, not an Atlas tree.')
  }

  let o = 6
  const nodeCount = bytes[o++]!
  const nodes: number[] = []
  for (let i = 0; i < nodeCount; i++) {
    if (o + 1 >= bytes.length) throw new Error('That code ends mid-way through its node list.')
    nodes.push((bytes[o++]! << 8) | bytes[o++]!)
  }

  // extendedNodeCount — unused by the Atlas tree, but skip it properly so the
  // mastery block is read from the right offset.
  const extendedCount = o < bytes.length ? bytes[o++]! : 0
  o += extendedCount * 2

  const variants: Record<number, number> = {}
  const effectCount = o < bytes.length ? bytes[o++]! : 0
  for (let i = 0; i < effectCount; i++) {
    // Be strict here for the same reason the node list is: silently dropping
    // half the choices would import a plan that quietly differs from the link.
    if (o + 3 >= bytes.length) {
      throw new Error('That code ends mid-way through its list of notable choices.')
    }
    const effect = (bytes[o++]! << 8) | bytes[o++]!
    const node = (bytes[o++]! << 8) | bytes[o++]!
    variants[node] = effect
  }

  return { nodes, variants }
}

/** Pull the base64url payload out of a URL, or return a bare code unchanged. */
function extractCode(input: string): string | null {
  let s = input.trim()
  if (!s) return null

  if (/^https?:\/\//i.test(s) || s.includes('/')) {
    // Last non-empty path segment, minus any query or fragment.
    s = s.split(/[?#]/)[0] ?? ''
    const parts = s.split('/').filter(Boolean)
    s = parts[parts.length - 1] ?? ''
  }

  return /^[A-Za-z0-9\-_=]+$/.test(s) && s.length >= 8 ? s : null
}
