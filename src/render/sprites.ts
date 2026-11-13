import type { SheetKey, SpriteSheet, CompactTree } from '../tree/types.ts'

/**
 * Lazy sprite-sheet loading.
 *
 * GGG publishes every sheet at five zoom levels. Loading all of them up front
 * would pull ~3 MB before the first frame, so we load only the level the camera
 * is currently near and fall back to whatever level is already decoded while a
 * better one is in flight. That keeps first paint fast and zooming seamless.
 */
export class SpriteStore {
  private images = new Map<string, HTMLImageElement>()
  private loading = new Set<string>()
  private base: string

  constructor(private tree: CompactTree, base = import.meta.env.BASE_URL, private onLoad?: () => void) {
    this.base = base
  }

  /** Index of the sheet level to draw at this camera scale. */
  levelFor(scale: number): number {
    const levels = this.tree.zoomLevels
    // Smallest published level at or above the current scale: upscaling a sheet
    // looks worse than downscaling one.
    for (let i = 0; i < levels.length; i++) if (levels[i]! >= scale) return i
    return levels.length - 1
  }

  /**
   * A drawable sheet for `key` at or below `level`, kicking off the load of the
   * requested level. Returns `null` only when nothing for that key is decoded yet.
   */
  sheet(key: SheetKey, level: number): { sheet: SpriteSheet; img: HTMLImageElement; level: number } | null {
    const want = this.tree.sheets[key]?.[level]
    if (want) this.request(want.file)

    // Prefer the exact level, else the nearest already-decoded one.
    const order = [level]
    for (let d = 1; d < this.tree.zoomLevels.length; d++) {
      if (level - d >= 0) order.push(level - d)
      if (level + d < this.tree.zoomLevels.length) order.push(level + d)
    }
    for (const i of order) {
      const s = this.tree.sheets[key]?.[i]
      if (!s) continue
      const img = this.images.get(s.file)
      if (img?.complete && img.naturalWidth) return { sheet: s, img, level: i }
    }
    return null
  }

  private request(file: string) {
    if (!file || this.images.has(file) || this.loading.has(file)) return
    this.loading.add(file)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => { this.loading.delete(file); this.onLoad?.() }
    img.onerror = () => { this.loading.delete(file) }
    img.src = `${this.base}sprites/${file}`
    this.images.set(file, img)
  }

  /** Warm the sheets needed for a first paint at `scale`. */
  preload(scale: number, keys: SheetKey[]) {
    const level = this.levelFor(scale)
    for (const k of keys) this.request(this.tree.sheets[k]?.[level]?.file ?? '')
  }
}
