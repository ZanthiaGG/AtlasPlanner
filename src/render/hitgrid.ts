import type { CompactNode } from '../tree/types.ts'

/**
 * Uniform spatial hash over node positions.
 *
 * Hover runs on every mousemove and needs the node under the cursor without
 * scanning all 1100 nodes. Bucket size is a few hundred world units, so a lookup
 * touches one bucket and its eight neighbours.
 */
const CELL = 400

export class HitGrid {
  private cells = new Map<number, CompactNode[]>()

  constructor(nodes: readonly CompactNode[]) {
    for (const n of nodes) {
      const key = this.key(n.x, n.y)
      let bucket = this.cells.get(key)
      if (!bucket) this.cells.set(key, (bucket = []))
      bucket.push(n)
    }
  }

  private key(x: number, y: number) {
    // Offset keeps the packed key positive for the tree's negative coordinates.
    const cx = Math.floor(x / CELL) + 1024
    const cy = Math.floor(y / CELL) + 1024
    return cy * 4096 + cx
  }

  /**
   * Closest node whose world-space hit radius contains (x, y).
   * `radiusOf` lets the caller size hits per node kind.
   */
  pick(x: number, y: number, radiusOf: (n: CompactNode) => number): CompactNode | null {
    let best: CompactNode | null = null
    let bestD = Infinity
    const cx = Math.floor(x / CELL)
    const cy = Math.floor(y / CELL)
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const bucket = this.cells.get((gy + 1024) * 4096 + (gx + 1024))
        if (!bucket) continue
        for (const n of bucket) {
          const r = radiusOf(n)
          const dx = n.x - x, dy = n.y - y
          const d = dx * dx + dy * dy
          if (d <= r * r && d < bestD) { bestD = d; best = n }
        }
      }
    }
    return best
  }
}
