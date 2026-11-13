import type { MechanicId } from './mechanics.ts'

/**
 * Node kinds, in paint order (small nodes first so big frames sit on top).
 * A const object rather than an `enum` so Node's type-stripping can run
 * `scripts/fetch-tree.ts` directly, with no build step.
 */
export const Kind = {
  Small: 0,
  Notable: 1,
  Keystone: 2,
  Wormhole: 3,
  Start: 4,
  Mastery: 5,
} as const

export type Kind = (typeof Kind)[keyof typeof Kind]

/** One option on a "select a type of content" notable. */
export type Variant = [effectId: number, stats: string]

/**
 * A node in the shipped compact tree. Keys are short because this file is
 * downloaded by every visitor; `scripts/fetch-tree.ts` is the only writer.
 */
export interface CompactNode {
  /** Skill id — the number that goes into a tree URL. */
  i: number
  x: number
  y: number
  k: Kind
  /** Name, GGG markup already stripped. */
  n: string
  /** Stats, newline-joined, markup stripped. */
  s: string
  m: MechanicId
  /** Group id, for drawing same-orbit connections as arcs. */
  g: number
  /** Orbit index within the group. */
  r: number
  /** Icon path — the key into a sprite sheet's `coords`. */
  ic: string
  /** Outbound connections (symmetric adjacency is rebuilt on load). */
  o: number[]
  v?: Variant[]
  /** Reminder text, shown dimmed in the tooltip. */
  rt?: string
  /** Flavour text, shown italic in the tooltip. Keystones only. */
  ft?: string
}

export interface SpriteSheet {
  /** Filename under `<base>sprites/`. */
  file: string
  w: number
  h: number
  coords: Record<string, { x: number; y: number; w: number; h: number }>
}

/** Sheet kinds we actually blit. `line`, `background` and `masteryOverlay` are dropped. */
export type SheetKey =
  | 'normalActive' | 'normalInactive'
  | 'notableActive' | 'notableInactive'
  | 'keystoneActive' | 'keystoneInactive'
  | 'wormholeActive' | 'wormholeInactive'
  | 'mastery' | 'groupBackground' | 'startNode' | 'frame' | 'atlasBackground'

export interface CompactTree {
  /** e.g. "3.30.0" */
  version: string
  /** Atlas point budget (150 in 3.30). */
  totalPoints: number
  /** Id of the root/start node. */
  start: number
  bounds: [minX: number, minY: number, maxX: number, maxY: number]
  /** Zoom levels the sprite sheets are published at, ascending. */
  zoomLevels: number[]
  /** `sheets[sheetKey][zoomLevelIndex]` */
  sheets: Record<SheetKey, SpriteSheet[]>
  /** Group id -> [x, y, maxOrbit] — maxOrbit picks the group-background size. */
  groups: Record<number, [x: number, y: number, maxOrbit: number]>
  /** Orbit radii, indexed by orbit. */
  orbitRadii: number[]
  nodes: CompactNode[]
}

/** Runtime view: the shipped tree plus the indexes the UI needs. */
export interface Tree extends CompactTree {
  byId: Map<number, CompactNode>
  /** Symmetric adjacency, masteries excluded (they are not allocatable). */
  adj: Map<number, number[]>
  countsByMechanic: Map<MechanicId, number>
  /** Deduplicated drawable edges, built once rather than per frame. */
  edges: [a: CompactNode, b: CompactNode][]
}
