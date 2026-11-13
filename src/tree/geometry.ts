/**
 * Node placement on the Atlas tree.
 *
 * Nodes sit on concentric "orbits" around a group centre. Most orbits space their
 * slots evenly, but the 16- and 40-slot orbits use irregular hand-authored angle
 * tables — getting those wrong is the classic way a reimplemented tree ends up
 * subtly crooked. The tables below match GGG's client and Path of Building.
 *
 * Lifted from `Path of Claude/src/atlas.ts:72-86`.
 */

const ORBIT_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

const ORBIT_40 = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150,
  160, 170, 180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290, 300,
  310, 315, 320, 330, 340, 350,
]

/** Per-orbit slot angles in radians, indexed `[orbit][orbitIndex]`. */
export function orbitAngles(skillsPerOrbit: number[]): number[][] {
  return skillsPerOrbit.map((n) => {
    const deg =
      n === 16 ? ORBIT_16
      : n === 40 ? ORBIT_40
      : Array.from({ length: n }, (_, i) => (360 * i) / n)
    return deg.map((d) => (d * Math.PI) / 180)
  })
}

/**
 * World position of a node.
 *
 * Note the sign convention: y grows downward in tree space, so the orbit angle is
 * measured clockwise from straight up — `sin` on x, `-cos` on y.
 */
export function nodePos(
  group: { x: number; y: number },
  orbit: number,
  orbitIndex: number,
  orbitRadii: number[],
  angles: number[][],
): [x: number, y: number] {
  const r = orbitRadii[orbit] ?? 0
  const a = angles[orbit]?.[orbitIndex] ?? 0
  // `|| 0` normalises the -0 that rounding a tiny negative produces at the
  // cardinal angles, so positions compare equal the way you would expect.
  return [
    Math.round(group.x + Math.sin(a) * r) || 0,
    Math.round(group.y - Math.cos(a) * r) || 0,
  ]
}

/**
 * Whether an edge between two nodes should be drawn as an arc along their shared
 * orbit rather than a straight line. Both ends must sit on the same orbit of the
 * same group, and orbit 0 (the single centre slot) can never arc.
 */
export function isArc(
  a: { g: number; r: number },
  b: { g: number; r: number },
): boolean {
  return a.g === b.g && a.r === b.r && a.r > 0
}

/**
 * Sweep direction for an arc, from the cross product of the two endpoints taken
 * about the group centre. Positive cross -> clockwise in canvas coordinates.
 */
export function arcSweep(
  cx: number, cy: number,
  ax: number, ay: number,
  bx: number, by: number,
): boolean {
  return (ax - cx) * (by - cy) - (ay - cy) * (bx - cx) < 0
}

/** Strip GGG's `[Internal|Display]` and `[Display]` markup from a string. */
export function cleanMarkup(s: string): string {
  return s.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2').replace(/\[([^\]]+)\]/g, '$1')
}
