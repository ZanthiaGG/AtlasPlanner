# Atlas Planner — working notes

Static Atlas passive tree planner for PoE 3.30. Vite + React + TypeScript, a
hand-rolled Canvas2D renderer, deployed to GitHub Pages. No backend, no state
server, two runtime dependencies (react, react-dom).

`npm run dev` serves at `http://localhost:5173/AtlasPlanner/` — the `base` path
matters, `/` alone 404s.

## Layout

```
scripts/fetch-tree.ts   build-time data pipeline (run by hand, output committed)
public/tree/3.30.0.json shipped tree, ~530 KB (~100 KB gzipped)
public/sprites/*.webp   vendored GGG sprite sheets, 30 files
src/tree/               data, geometry, graph, codec, search — all framework-free
src/render/             camera, sprite store, hit grid, draw loop
src/ui/                 React components
src/state/              allocation + undo/redo, localStorage, URL hash
```

Everything in `src/tree/` is deliberately free of React and DOM so it can be unit
tested directly and reused from the Node build script.

## Data

Source: GGG's official [`grindinggear/atlastree-export`](https://github.com/grindinggear/atlastree-export),
the one game-data export they publish. 3.30 shape: 1117 nodes (213 notables,
18 keystones, 149 masteries, 4 wormhole gateways, 31 multiple-choice variants),
309 groups, `totalPoints: 150`, start node `29045` (`nodes.root.out[0]`).

`league.json` is currently node-for-node identical to `data.json`, so only one
tree ships. If they diverge, `fetch-tree.ts` grows a second output and the UI a
variant switch.

**Sprite assets do not come from the CDN.** The export's `filename` fields point at
`web.poecdn.com` with a cache-busting query that 404s for a preview tree. The
script pulls the identically-named files from the export repo's own `assets/`
folder instead, falling back to the CDN only if one is missing.

### Mechanic tagging

GGG ships no "which league mechanic is this?" field. The node's `icon` path
encodes it (`AtlasTrees/AbyssNode1.png`), so `src/tree/mechanics.ts` maps ~178
icon bases onto 43 mechanics, with `NAME_OVERRIDES` for the handful of nodes
whose shared icon lies (e.g. *Thorough Exploration* uses the generic keystone
icon but is a Wildwood node). `fetch-tree.ts` exits non-zero on an unmapped base.

## Tree code format (version 6)

Verified against two independent implementations that agree exactly: the encoder
in `../Path of Claude/src/atlas.ts:223` and PathOfPathing's
`SkillTreeUrlV6Decoder`. All integers big-endian.

| offset | size | field |
|---|---|---|
| 0 | u32 | version = 6 |
| 4 | u8 | class id — 0 for atlas |
| 5 | u8 | ascendancy byte — 0 for atlas |
| 6 | u8 | nodeCount |
| 7 | nodeCount × u16 | node ids, ascending |
| … | u8 | extendedNodeCount — 0 for atlas |
| … | u8 | masteryEffectCount |
| … | n × (u16, u16) | `(effectId, nodeId)` — **effect first** |

Then base64url (`+`→`-`, `/`→`_`). Node count is one byte, so 255 is the hard cap
(the budget is 150). On the Atlas tree the mastery-effect block carries the chosen
option for "select a type of content" notables.

Export prefix: `https://www.pathofexile.com/fullscreen-atlas-skill-tree/`.

## Rendering gotchas

- **Orbit angles.** Orbits with 16 and 40 slots use irregular hand-authored angle
  tables, not even spacing. `src/tree/geometry.ts` has them. Getting this wrong
  gives a tree that looks almost right and is subtly crooked everywhere.
- **`ctx.arc` in a batched path draws a chord** from wherever the path last
  ended to the arc's start. Always `moveTo` the arc's first point first.
- **Edge dedup must be order-free.** GGG's `out` lists are directed and not always
  mirrored, so picking a canonical direction with `a.i > b.i` silently drops
  one-way edges. `load.ts` keys a Set on the unordered pair instead.
- **Wormhole-to-wormhole edges are skipped** when drawing (the gateways teleport
  across the atlas) but kept in the graph so pathfinding can route through them.
- **The first `fit` needs a real viewport**, which arrives a frame after mount via
  the ResizeObserver. `TreeCanvas` keeps a `needsFit` flag for this.
- Sprite sheets load lazily per zoom level; the store falls back to any decoded
  level while a better one is in flight, so zooming never flashes empty.

## UI shape

One sidebar, no accordions. Brand, then a filter bar (search + selected mechanic
chips + a Mechanics button), then the node list taking all remaining height.
Everything occasional lives in popovers that stay open until dismissed: the
mechanic picker from the sidebar, Summary and Plan from the top-right HUD.

This replaced four stacked collapsible panels that fought for height, where
picking a mechanic closed its own panel — so choosing three meant reopening and
re-scrolling a 43-chip grid twice. The picker now has its own filter box.

Colour is assigned per *selection*, not per mechanic: 43 fixed hues gave 46 pairs
under deltaE 14 (two were deltaE 2.9). See `SELECTION_PALETTE`.

## Things that bit us

- **`usePlan` history**: the trim must keep `HISTORY_LIMIT - 1` entries so the
  append lands on the limit. Keeping `LIMIT` grew the array past a clamped
  cursor and froze the planner on the 100th edit. `plan.test.ts` guards it.
- **Costs come from one BFS**, `distancesFrom`, not `pathTo` per node — the list
  renders hundreds of rows and the per-node version meant ~966 graph searches
  per render, which showed up as ~100ms hitches whenever the cursor crossed a
  node. Step costs are in [0.99, 1] and the tree is 21 deep, so hop count always
  wins and an unweighted BFS gives identical point costs.
- **Imports must be validated**, not just decoded: character passive trees are
  also version 6. `tree/import.ts` checks the class byte, drops ids this tree
  version lacks, and prunes to the component reachable from the start.
- **GGG icon cells are opaque squares** (corner alpha 255); the client is
  expected to round them off, so icons are circle-clipped when blitted.

## Conventions

- Dark graphite, one blue accent (`--accent: #4db5ff`). Mechanic colours are the
  only other hues, so the filter chips stay the loudest thing on screen.
- Short keys in the shipped JSON (`i`, `x`, `y`, `k`, `n`, `s`, `m`, …) because
  every visitor downloads it. `scripts/fetch-tree.ts` is the only writer.
- `Kind` is a const object, not an `enum`, so Node's type-stripping can run the
  build script directly with no compile step.
