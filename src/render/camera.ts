/**
 * Viewport transform for the tree canvas.
 *
 * World space is GGG's tree coordinate system (x right, y down, roughly
 * 13800 x 14800 units for the 3.30 Atlas). `scale` is screen pixels per world
 * unit; the sprite sheets are published at scales 0.1246 .. 0.5, so 0.5 is
 * "icons at their native resolution" and makes a sensible maximum.
 */

export const MIN_SCALE = 0.02
export const MAX_SCALE = 0.55

export interface Viewport {
  /** CSS pixels. */
  w: number
  h: number
}

export class Camera {
  /** World coordinate at the centre of the viewport. */
  cx = 0
  cy = 0
  scale = 0.1

  worldToScreenX(x: number, vp: Viewport) { return (x - this.cx) * this.scale + vp.w / 2 }
  worldToScreenY(y: number, vp: Viewport) { return (y - this.cy) * this.scale + vp.h / 2 }
  screenToWorldX(sx: number, vp: Viewport) { return (sx - vp.w / 2) / this.scale + this.cx }
  screenToWorldY(sy: number, vp: Viewport) { return (sy - vp.h / 2) / this.scale + this.cy }

  /** Pan by a screen-pixel delta. */
  panBy(dxPx: number, dyPx: number) {
    this.cx -= dxPx / this.scale
    this.cy -= dyPx / this.scale
  }

  /**
   * Zoom by `factor`, keeping the world point under (sx, sy) pinned to that
   * screen position — the behaviour that makes wheel-zoom feel right.
   */
  zoomAt(factor: number, sx: number, sy: number, vp: Viewport) {
    const wx = this.screenToWorldX(sx, vp)
    const wy = this.screenToWorldY(sy, vp)
    const next = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE)
    if (next === this.scale) return
    this.scale = next
    // Solve for the centre that puts (wx, wy) back under (sx, sy).
    this.cx = wx - (sx - vp.w / 2) / next
    this.cy = wy - (sy - vp.h / 2) / next
  }

  /** Frame a world-space rectangle, with `pad` world units of margin. */
  fit(minX: number, minY: number, maxX: number, maxY: number, vp: Viewport, pad = 400) {
    const w = Math.max(1, maxX - minX + pad * 2)
    const h = Math.max(1, maxY - minY + pad * 2)
    this.scale = clamp(Math.min(vp.w / w, vp.h / h), MIN_SCALE, MAX_SCALE)
    this.cx = (minX + maxX) / 2
    this.cy = (minY + maxY) / 2
  }

  /** World-space rectangle currently visible, for culling. */
  visibleBounds(vp: Viewport): [minX: number, minY: number, maxX: number, maxY: number] {
    const hw = vp.w / 2 / this.scale
    const hh = vp.h / 2 / this.scale
    return [this.cx - hw, this.cy - hh, this.cx + hw, this.cy + hh]
  }

  snapshot() { return { cx: this.cx, cy: this.cy, scale: this.scale } }
  restore(s: { cx: number; cy: number; scale: number }) {
    this.cx = s.cx; this.cy = s.cy; this.scale = clamp(s.scale, MIN_SCALE, MAX_SCALE)
  }
}

export function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
