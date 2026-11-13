# Atlas Planner

A fast, lightweight Atlas passive tree planner for **Path of Exile 3.30**.

**→ [zanthiagg.github.io/AtlasPlanner](https://zanthiagg.github.io/AtlasPlanner/)**

- **Click anywhere to allocate** — it routes there for you, and shows the cost before you commit.
- **The whole modifier list, always** — the sidebar lists every modifier in view with a `taken / total` count and the points to reach the nearest copy. Identical passives are grouped (966 nodes are only 371 distinct modifiers), and `+` allocates the nearest one.
- **Filter by mechanic** — open Mechanics, type to find one, and click as many as you like; the picker stays open and the list narrows live. Selected mechanics show as chips you can remove.
- **Tree summary** — one click shows what your tree actually *does*, with repeated modifiers added up: `177% increased Threads found in your Maps ×53`.
- **Search by name or stat** — `pack size`, `ritual tribute`, `quantity`. Matching options on "select a type of content" notables count too.
- **Choose options on choice notables**, so exported links carry them into the game.
- **Share anywhere** — import and export real `pathofexile.com` Atlas tree links, so plans move between this, the official site and other planners. The page URL always holds your current plan.
- **Save plans locally** and switch between them.

No account, no tracking, no backend — it is a static page.

## Keyboard

| Key | Action |
|---|---|
| `/` | focus search |
| `F` | fit the whole atlas |
| `A` | fit your allocated tree |
| `Esc` | clear search and filters |
| `Ctrl`/`Cmd` + `Z` / `Shift+Z` | undo / redo |
| `Shift` + click, or right-click | deallocate |

## Development

```bash
npm install
npm run dev        # http://localhost:5173/AtlasPlanner/
npm test
npm run build
```

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`.
Pages must be set once in the repo settings: **Settings → Pages → Source → GitHub Actions**.

## Updating for a new patch

Tree data comes from GGG's official [`grindinggear/atlastree-export`](https://github.com/grindinggear/atlastree-export).

1. Bump `VERSION` in [`scripts/fetch-tree.ts`](scripts/fetch-tree.ts).
2. `npm run fetch-tree`

That downloads the export, precomputes every node position, tags each node with a
mechanic, and vendors the sprite sheets into `public/sprites/`. It **fails loudly**
if a node's icon does not map to a known mechanic — when a league adds content,
add the new icon bases to [`src/tree/mechanics.ts`](src/tree/mechanics.ts) and re-run.

Both the generated `public/tree/<version>.json` and the sprites are committed, so
CI never has to reach out to GGG.

## How it works

| Area | Notes |
|---|---|
| `scripts/fetch-tree.ts` | Build-time data pipeline. 1.4 MB export → ~530 KB shipped JSON (~100 KB gzipped). |
| `src/tree/geometry.ts` | Node placement. Orbits 2 and 4 use irregular hand-authored angle tables — the usual source of a subtly crooked tree. |
| `src/tree/pathfind.ts` | Multi-source Dijkstra from the whole allocated set, with sub-unit tie-breaks favouring notables. Also prunes branches orphaned by a deallocation. |
| `src/tree/codec.ts` | Encoder and decoder for PoE tree-code version 6, documented byte by byte in the file header. |
| `src/render/` | Hand-rolled Canvas2D renderer: lazy per-zoom sprite sheets, viewport culling, batched edge strokes, spatial-hash hit testing. No graphics dependency. |

Runtime dependencies: React and ReactDOM. That's it.

## Credits

Fan-made and **not affiliated with Grinding Gear Games**. Atlas tree data and art
are © Grinding Gear Games, used from their officially published export.
