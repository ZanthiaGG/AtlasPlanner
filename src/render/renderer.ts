import { Kind } from '../tree/types.ts'
import type { CompactNode, SheetKey, Tree } from '../tree/types.ts'
import type { MechanicId } from '../tree/mechanics.ts'
import { MECHANIC_BY_ID } from '../tree/mechanics.ts'
import type { Camera, Viewport } from './camera.ts'
import type { SpriteStore } from './sprites.ts'

export const COLORS = {
  bg: '#0d0f13',
  line: '#272d39',
  lineAllocated: '#4db5ff',
  linePreview: '#ffd95a',
  search: '#ff6ad5',
  frontier: '#4db5ff',
}

/** Alpha applied to nodes filtered out by the mechanic chips. Low enough that
 *  matching nodes pop, high enough that the tree's shape stays readable. */
const DIMMED = 0.22

export interface RenderState {
  tree: Tree
  allocated: ReadonlySet<number>
  /** Nodes one step outside the allocated set. */
  frontier: ReadonlySet<number>
  /** Route that would be taken if the hovered node were clicked. */
  preview: ReadonlySet<number>
  searchHits: ReadonlySet<number>
  /** Empty means "no filter" — everything draws at full strength. */
  activeMechanics: ReadonlySet<MechanicId>
  hovered: number | null
  showGroupBackgrounds: boolean
  showAtlasBackground: boolean
}

/** Sheets needed for a first paint. */
export const CORE_SHEETS: SheetKey[] = [
  'normalInactive', 'normalActive', 'notableInactive', 'notableActive', 'frame',
]

// ---------------------------------------------------------------- lookups

function iconSheet(kind: Kind, allocated: boolean): SheetKey {
  switch (kind) {
    case Kind.Notable: return allocated ? 'notableActive' : 'notableInactive'
    case Kind.Keystone: return allocated ? 'keystoneActive' : 'keystoneInactive'
    case Kind.Wormhole: return allocated ? 'wormholeActive' : 'wormholeInactive'
    case Kind.Mastery: return 'mastery'
    case Kind.Start: return 'startNode'
    default: return allocated ? 'normalActive' : 'normalInactive'
  }
}

/** The wormhole and start sheets key their single sprite by a fixed name. */
function iconKey(n: CompactNode): string {
  if (n.k === Kind.Wormhole) return 'Wormhole'
  if (n.k === Kind.Start) return 'AtlasPassiveSkillScreenStart'
  return n.ic
}

function frameKey(kind: Kind, allocated: boolean, canAllocate: boolean): string | null {
  const state = allocated ? 'Allocated' : canAllocate ? 'CanAllocate' : 'Unallocated'
  switch (kind) {
    case Kind.Notable: return `NotableFrame${state}`
    case Kind.Keystone: return `KeystoneFrame${state}`
    case Kind.Wormhole: return `WormholeFrame${state}`
    case Kind.Small:
      return allocated ? 'PSSkillFrameActive' : canAllocate ? 'PSSkillFrameHighlighted' : 'PSSkillFrame'
    default: return null // masteries and the start node draw bare
  }
}

function groupBackgroundKey(maxOrbit: number): string | null {
  if (maxOrbit <= 0) return null
  if (maxOrbit === 1) return 'PSGroupBackground1'
  if (maxOrbit === 2) return 'PSGroupBackground2'
  return 'PSGroupBackground3'
}

/** World-space hit radius, matching the drawn frame. */
export function hitRadius(n: CompactNode): number {
  switch (n.k) {
    case Kind.Keystone: return 110
    case Kind.Wormhole: return 145
    case Kind.Notable: return 76
    case Kind.Mastery: return 0 // not clickable
    case Kind.Start: return 110
    default: return 51
  }
}

// ---------------------------------------------------------------- draw

export function draw(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  vp: Viewport,
  sprites: SpriteStore,
  st: RenderState,
) {
  const { tree } = st
  const level = sprites.levelFor(cam.scale)
  const [vMinX, vMinY, vMaxX, vMaxY] = cam.visibleBounds(vp)
  const filtering = st.activeMechanics.size > 0

  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, vp.w, vp.h)

  const sx = (x: number) => cam.worldToScreenX(x, vp)
  const sy = (y: number) => cam.worldToScreenY(y, vp)

  // --- atlas backdrop -------------------------------------------------
  if (st.showAtlasBackground) {
    const bg = sprites.sheet('atlasBackground', level)
    const c = bg && bg.sheet.coords['AtlasPassiveBackground']
    if (bg && c) {
      const [bMinX, bMinY, bMaxX, bMaxY] = tree.bounds
      ctx.globalAlpha = 0.5
      ctx.drawImage(bg.img, c.x, c.y, c.w, c.h,
        sx(bMinX), sy(bMinY), (bMaxX - bMinX) * cam.scale, (bMaxY - bMinY) * cam.scale)
      ctx.globalAlpha = 1
    }
  }

  // --- group backgrounds ----------------------------------------------
  if (st.showGroupBackgrounds) {
    const gb = sprites.sheet('groupBackground', level)
    if (gb) {
      ctx.globalAlpha = 0.55
      for (const gid in tree.groups) {
        const g = tree.groups[gid]!
        const [gx, gy, maxOrbit] = g
        const key = groupBackgroundKey(maxOrbit)
        if (!key) continue
        const c = gb.sheet.coords[key]
        if (!c) continue
        const w = (c.w / tree.zoomLevels[gb.level]!) * cam.scale
        const h = (c.h / tree.zoomLevels[gb.level]!) * cam.scale
        const px = sx(gx), py = sy(gy)
        if (px + w / 2 < 0 || px - w / 2 > vp.w || py + h / 2 < 0 || py - h / 2 > vp.h) continue
        ctx.drawImage(gb.img, c.x, c.y, c.w, c.h, px - w / 2, py - h / 2, w, h)
      }
      ctx.globalAlpha = 1
    }
  }

  // --- connections ----------------------------------------------------
  // Batched into one path per state: ~2400 edges as three strokes rather than
  // 2400, which is the difference between smooth and janky while panning.
  type Edge = [a: CompactNode, b: CompactNode]
  const plain: Edge[] = [], active: Edge[] = [], preview: Edge[] = []

  for (const edge of tree.edges) {
    const [n, m] = edge
    if (Math.max(n.x, m.x) < vMinX || Math.min(n.x, m.x) > vMaxX) continue
    if (Math.max(n.y, m.y) < vMinY || Math.min(n.y, m.y) > vMaxY) continue

    const aOn = st.allocated.has(n.i) || n.i === tree.start
    const bOn = st.allocated.has(m.i) || m.i === tree.start
    const aPrev = st.preview.has(n.i), bPrev = st.preview.has(m.i)
    if ((aPrev && (bPrev || bOn)) || (bPrev && aOn)) preview.push(edge)
    else if (aOn && bOn) active.push(edge)
    else plain.push(edge)
  }

  const strokeEdges = (edges: Edge[], color: string, width: number) => {
    if (!edges.length) return
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, width * cam.scale)
    ctx.beginPath()
    for (const [a, b] of edges) {
      if (a.g === b.g && a.r === b.r && a.r > 0) {
        const g = tree.groups[a.g]
        const r = tree.orbitRadii[a.r]
        if (g && r) {
          const a0 = Math.atan2(a.y - g[1], a.x - g[0])
          const a1 = Math.atan2(b.y - g[1], b.x - g[0])
          // Always take the short way round: adjacent orbit slots are never
          // more than half the circle apart.
          let d = a1 - a0
          while (d > Math.PI) d -= Math.PI * 2
          while (d < -Math.PI) d += Math.PI * 2
          // Without this moveTo, arc() draws a chord from wherever the batched
          // path last ended to the arc's start — which looks like stray lines
          // flung across the whole tree.
          ctx.moveTo(sx(a.x), sy(a.y))
          ctx.arc(sx(g[0]), sy(g[1]), r * cam.scale, a0, a1, d < 0)
          continue
        }
      }
      ctx.moveTo(sx(a.x), sy(a.y))
      ctx.lineTo(sx(b.x), sy(b.y))
    }
    ctx.stroke()
  }

  ctx.globalAlpha = filtering ? 0.5 : 1
  strokeEdges(plain, COLORS.line, 14)
  ctx.globalAlpha = 1
  strokeEdges(active, COLORS.lineAllocated, 20)
  strokeEdges(preview, COLORS.linePreview, 20)

  // --- nodes ----------------------------------------------------------
  // Sorted by kind so small frames never paint over keystones.
  const visible: CompactNode[] = []
  for (const n of tree.nodes) {
    const r = Math.max(hitRadius(n), 120)
    if (n.x + r < vMinX || n.x - r > vMaxX || n.y + r < vMinY || n.y - r > vMaxY) continue
    visible.push(n)
  }
  visible.sort((a, b) => a.k - b.k)

  const blit = (key: SheetKey, coordKey: string, cx: number, cy: number, boost = 1) => {
    const s = sprites.sheet(key, level)
    if (!s) return false
    const c = s.sheet.coords[coordKey]
    if (!c) return false
    const lv = tree.zoomLevels[s.level]!
    const w = (c.w / lv) * cam.scale * boost
    const h = (c.h / lv) * cam.scale * boost
    ctx.drawImage(s.img, c.x, c.y, c.w, c.h, cx - w / 2, cy - h / 2, w, h)
    return true
  }

  for (const n of visible) {
    const allocated = st.allocated.has(n.i) || n.i === tree.start
    const inPreview = st.preview.has(n.i)
    const canAllocate = !allocated && st.frontier.has(n.i)
    const px = sx(n.x), py = sy(n.y)

    const dim = filtering && !st.activeMechanics.has(n.m)
    ctx.globalAlpha = dim ? (allocated ? DIMMED * 2 : DIMMED) : 1

    // Masteries are orientation landmarks, not targets — keep them subtle.
    if (n.k === Kind.Mastery) {
      ctx.globalAlpha *= 0.75
      blit('mastery', n.ic, px, py)
      ctx.globalAlpha = 1
      continue
    }

    const fk = frameKey(n.k, allocated || inPreview, canAllocate)
    if (fk) blit('frame', fk, px, py)
    blit(iconSheet(n.k, allocated || inPreview), iconKey(n), px, py)

    // Search hits get a ring in the mechanic-neutral magenta so they read
    // against both the blue allocated state and the gold preview.
    if (st.searchHits.has(n.i)) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = COLORS.search
      ctx.lineWidth = Math.max(2, 10 * cam.scale)
      ctx.beginPath()
      ctx.arc(px, py, hitRadius(n) * cam.scale * 0.95, 0, Math.PI * 2)
      ctx.stroke()
    }

    if (n.i === st.hovered) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1.5, 6 * cam.scale)
      ctx.beginPath()
      ctx.arc(px, py, hitRadius(n) * cam.scale * 1.05, 0, Math.PI * 2)
      ctx.stroke()
    }

    // When a filter is on, ring every matching node in its mechanic's colour —
    // small nodes included, since "which of these can I still take?" is the
    // whole point of the filter.
    if (filtering && !dim) {
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = MECHANIC_BY_ID.get(n.m)?.color ?? COLORS.frontier
      ctx.lineWidth = Math.max(1, (n.k === Kind.Small ? 4 : 6) * cam.scale)
      ctx.beginPath()
      ctx.arc(px, py, hitRadius(n) * cam.scale * 1.12, 0, Math.PI * 2)
      ctx.stroke()
    }

    ctx.globalAlpha = 1
  }
}
