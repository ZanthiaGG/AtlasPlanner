/**
 * Builds the shipped tree data from GGG's official export.
 *
 *   npm run fetch-tree
 *
 * Downloads `data.json` from github.com/grindinggear/atlastree-export (the one
 * game-data export GGG officially publishes), precomputes every node position,
 * tags each node with a mechanic, drops the fields the client never reads, and
 * vendors the sprite sheets locally.
 *
 * Output (both committed, so CI never has to reach out to GGG):
 *   public/tree/<version>.json
 *   public/sprites/*.webp
 *
 * To update for a new patch: bump VERSION, re-run, check the mechanic report,
 * commit the result.
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mechanicFor, iconBase } from '../src/tree/mechanics.ts'
import type { MechanicId } from '../src/tree/mechanics.ts'
import { orbitAngles, nodePos, cleanMarkup } from '../src/tree/geometry.ts'
import { Kind } from '../src/tree/types.ts'
import type { CompactNode, CompactTree, SheetKey, SpriteSheet, Variant } from '../src/tree/types.ts'

const VERSION = '3.30.0'
const REPO = 'https://raw.githubusercontent.com/grindinggear/atlastree-export/master'
const SOURCE = `${REPO}/data.json`
/**
 * The export's sprite `filename` fields point at web.poecdn.com with a cache-busting
 * query. Those 404 for a preview tree whose assets are not live on the CDN yet, so we
 * pull the identically-named files from the export repo's own `assets/` folder and
 * only fall back to the CDN url if one is missing there.
 */
const ASSETS = `${REPO}/assets`

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CACHE = join(ROOT, '.cache')
const OUT_TREE = join(ROOT, 'public', 'tree')
const OUT_SPRITES = join(ROOT, 'public', 'sprites')

/** Sheets we blit. `line` (we stroke paths instead), `background` and the 256KB
 *  single-resolution `masteryOverlay` are deliberately left out. */
const KEEP_SHEETS: SheetKey[] = [
  'normalActive', 'normalInactive',
  'notableActive', 'notableInactive',
  'keystoneActive', 'keystoneInactive',
  'wormholeActive', 'wormholeInactive',
  'mastery', 'groupBackground', 'startNode', 'frame', 'atlasBackground',
]

// ---------------------------------------------------------------- raw shapes

interface RawNode {
  skill?: number
  name?: string
  icon?: string
  stats?: string[]
  reminderText?: string[]
  flavourText?: string[]
  group?: number
  orbit?: number
  orbitIndex?: number
  out?: string[]
  in?: string[]
  isNotable?: boolean
  isKeystone?: boolean
  isMastery?: boolean
  isWormhole?: boolean
  isMultipleChoiceVariant?: boolean
  variantEffects?: { effect: number; stats: string[] }[]
}

interface RawSheet {
  filename: string
  w: number
  h: number
  coords: Record<string, { x: number; y: number; w: number; h: number }>
}

interface RawTree {
  nodes: Record<string, RawNode>
  groups: Record<string, { x: number; y: number; orbits: number[]; nodes: string[] }>
  constants: { orbitRadii: number[]; skillsPerOrbit: number[] }
  sprites: Record<string, Record<string, RawSheet>>
  imageZoomLevels: number[]
  points: { totalPoints: number }
}

// ---------------------------------------------------------------- helpers

const exists = (p: string) => access(p).then(() => true, () => false)

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
  return res.text()
}

async function fetchBinary(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
  return Buffer.from(await res.arrayBuffer())
}

/** `https://web.poecdn.com/image/passive-skill/atlas-skills-4.webp?a7c81e47` -> `atlas-skills-4.webp` */
const basename = (url: string) => (url.split('?')[0] ?? '').split('/').pop() ?? ''

function kindOf(n: RawNode, id: string, startId: string): Kind {
  if (id === startId) return Kind.Start
  if (n.isMastery) return Kind.Mastery
  if (n.isKeystone) return Kind.Keystone
  if (n.isWormhole) return Kind.Wormhole
  if (n.isNotable) return Kind.Notable
  return Kind.Small
}

// ---------------------------------------------------------------- main

async function main() {
  await mkdir(CACHE, { recursive: true })
  await mkdir(OUT_TREE, { recursive: true })
  await mkdir(OUT_SPRITES, { recursive: true })

  // 1. Source data (cached — the raw export is 1.4MB and rarely changes).
  const cached = join(CACHE, `${VERSION}-atlas.json`)
  if (!(await exists(cached))) {
    console.log(`Downloading ${SOURCE}`)
    const body = await fetchText(SOURCE)
    JSON.parse(body) // never cache a broken download
    await writeFile(cached, body)
  } else {
    console.log(`Using cached ${cached}`)
  }
  const raw: RawTree = JSON.parse((await readFile(cached, 'utf8')).replace(/^﻿/, ''))

  const startId = String(raw.nodes.root?.out?.[0] ?? '')
  if (!startId) throw new Error('could not find the start node (nodes.root.out[0])')

  // 2. Geometry.
  const angles = orbitAngles(raw.constants.skillsPerOrbit)
  const groups: CompactTree['groups'] = {}
  for (const [gid, g] of Object.entries(raw.groups)) {
    groups[Number(gid)] = [g.x, g.y, Math.max(0, ...(g.orbits ?? [0]))]
  }

  // 3. Nodes.
  const nodes: CompactNode[] = []
  const unmapped = new Map<string, string[]>()
  const perMechanic = new Map<MechanicId, number>()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  for (const [id, n] of Object.entries(raw.nodes)) {
    if (id === 'root' || n.skill === undefined || n.group === undefined) continue

    const group = raw.groups[String(n.group)]
    if (!group) continue

    const [x, y] = nodePos(group, n.orbit ?? 0, n.orbitIndex ?? 0, raw.constants.orbitRadii, angles)

    const kind = kindOf(n, id, startId)
    if (kind !== Kind.Mastery) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x)
      minY = Math.min(minY, y); maxY = Math.max(maxY, y)
    }

    const mechanic = mechanicFor(n.icon, n.name)
    if (!mechanic && n.icon) {
      const base = iconBase(n.icon)
      if (!unmapped.has(base)) unmapped.set(base, [])
      unmapped.get(base)!.push(n.name ?? '(unnamed)')
    }
    const m: MechanicId = mechanic ?? 'general'
    perMechanic.set(m, (perMechanic.get(m) ?? 0) + 1)

    const node: CompactNode = {
      i: n.skill,
      x, y,
      k: kind,
      n: cleanMarkup(n.name ?? ''),
      s: cleanMarkup((n.stats ?? []).join('\n')),
      m,
      g: n.group,
      r: n.orbit ?? 0,
      ic: n.icon ?? '',
      o: (n.out ?? []).map(Number).filter((v) => Number.isFinite(v)),
    }
    if (n.variantEffects?.length) {
      node.v = n.variantEffects.map((v): Variant => [v.effect, cleanMarkup(v.stats.join('\n'))])
    }
    if (n.reminderText?.length) node.rt = cleanMarkup(n.reminderText.join('\n'))
    if (n.flavourText?.length) node.ft = cleanMarkup(n.flavourText.join('\n'))
    nodes.push(node)
  }

  // 4. Sprites: rewrite CDN urls to local filenames, download each image once.
  const sheets = {} as Record<SheetKey, SpriteSheet[]>
  const downloads = new Map<string, string>() // local filename -> cdn url

  for (const key of KEEP_SHEETS) {
    const byLevel = raw.sprites[key]
    if (!byLevel) throw new Error(`sprite sheet "${key}" missing from the export`)
    sheets[key] = raw.imageZoomLevels.map((lvl) => {
      // masteryOverlay-style single-level sheets fall back to their only entry.
      const sheet = byLevel[String(lvl)] ?? Object.values(byLevel)[0]
      if (!sheet) throw new Error(`sheet "${key}" has no data for zoom ${lvl}`)
      const file = basename(sheet.filename)
      downloads.set(file, sheet.filename)
      return { file, w: sheet.w, h: sheet.h, coords: sheet.coords }
    })
  }

  let fetched = 0
  for (const [file, cdnUrl] of downloads) {
    const dest = join(OUT_SPRITES, file)
    if (await exists(dest)) continue
    let bytes: Buffer
    try {
      bytes = await fetchBinary(`${ASSETS}/${file}`)
    } catch {
      bytes = await fetchBinary(cdnUrl)
    }
    await writeFile(dest, bytes)
    fetched++
    console.log(`  sprite ${file.padEnd(32)} ${(bytes.byteLength / 1024).toFixed(0)} KB`)
  }

  // 5. Write.
  const tree: CompactTree = {
    version: VERSION,
    totalPoints: raw.points.totalPoints,
    start: Number(startId),
    bounds: [minX, minY, maxX, maxY],
    zoomLevels: raw.imageZoomLevels,
    sheets,
    groups,
    orbitRadii: raw.constants.orbitRadii,
    nodes,
  }

  const out = join(OUT_TREE, `${VERSION}.json`)
  const json = JSON.stringify(tree)
  await writeFile(out, json)

  // 6. Report.
  const srcSize = (await readFile(cached)).byteLength
  console.log(`\n  source   ${(srcSize / 1024).toFixed(0)} KB`)
  console.log(`  output   ${(json.length / 1024).toFixed(0)} KB  ->  ${out}`)
  console.log(`  sprites  ${downloads.size} files (${fetched} newly downloaded)`)
  console.log(`  nodes    ${nodes.length}  (start node ${startId}, ${tree.totalPoints} points)`)
  console.log(`  bounds   ${tree.bounds.join(', ')}`)

  console.log('\n  mechanics:')
  for (const [m, c] of [...perMechanic].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${m.padEnd(16)} ${String(c).padStart(4)}`)
  }

  if (unmapped.size) {
    console.error(`\n  !! ${unmapped.size} unmapped icon base(s) — add them to src/tree/mechanics.ts:`)
    for (const [base, names] of unmapped) {
      console.error(`     ${base.padEnd(36)} ${[...new Set(names)].slice(0, 3).join(', ')}`)
    }
    process.exitCode = 1
  } else {
    console.log('\n  every node mapped to a mechanic.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
