# Stardew Companion

A fast, offline-capable companion app for Stardew Valley — no ads, no accounts, no tracking. Everything runs in the browser and saves to `localStorage`.

> **Live app:** `https://CoreyGrant.github.io/stardew-companion/`

---

## Features

| Section | What it does |
|---|---|
| **Items** | Full item database with sell values, descriptions, energy/health, buy sources, artisan outputs |
| **Crops** | Season-by-season profit table with seed cost deducted; remaining-harvests column from your save |
| **Machines** | Processing rules for Keg, Preserves Jar, Furnace, and more — with artisan sell values |
| **Recipes** | Full cooking recipe list with ingredient links and unlock sources |
| **Foraging** | Season-filtered foraging guide with item locations |
| **Shops** | All vendor inventories with prices and seasonal availability |
| **Fish Guide** | Every fish with location, season, weather, time, and difficulty — sortable and filterable |
| **Fish Pond** | Fish pond population rules and produce output guide |
| **Characters** | NPC profiles, gift preferences (Loved / Liked / Disliked / Hated), and schedules |
| **Gift Guide** | Cross-reference: find which NPCs love any item, or what to give a specific NPC |
| **Schedules** | Day/season/weather/year schedule viewer for all NPCs |
| **Calendar** | Seasonal calendar showing festivals, birthdays, and crop planting windows side by side |
| **Farm Planner** | Interactive tile-based farm planner for all 8 farm types (canvas + sprinkler overlays) |
| **Ginger Island** | Separate planner for the Ginger Island farm |
| **Bundles** | Community Center bundle tracker with room descriptions and rewards |
| **Quests** | Story and special-order quest list with interactive step checklists |
| **Museum** | Artifact and mineral donation tracker with geode sources |
| **Profiles** | Multiple save profiles: track quest/bundle progress personalised to your in-game state |
| **Themes** | Stardew, Light, and Dark themes |
| **Global Search** | Instant cross-type search across items, NPCs, crops, fish, and quests |

---

## Development

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **npm 10+** (bundled with Node 20)

### Quick start

```bash
git clone https://github.com/YOUR_USERNAME/stardew-companion.git
cd stardew-companion
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`. Hot module replacement is enabled.

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | TypeScript check + production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run data` | Rebuild `public/gamedata.json` from source data |
| `npm run deploy` | Manual deploy to GitHub Pages (requires `gh-pages` package) |

### Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Routing | React Router v6 (HashRouter — required for GitHub Pages) |
| Styling | SASS — custom BEM design system, no component library |
| State | React Context only (no Redux) |
| Storage | `localStorage` via a swappable `StorageAdapter` |
| Deployment | GitHub Actions → `gh-pages` branch |

### Project structure

```
stardew-companion/
├── public/
│   ├── gamedata.json          # Built by `npm run data`, committed to repo
│   └── sprites/               # Extracted game sprites (portraits, buildings, items)
├── src/
│   ├── contexts/              # React contexts (GameData, UserData, Theme)
│   ├── hooks/                 # One custom hook per page/feature
│   ├── components/
│   │   ├── common/            # Panel, GameLink, PortraitImg, GlobalSearch, …
│   │   └── layout/            # AppShell, Nav (inline + mobile drawer)
│   ├── pages/                 # One file per route
│   ├── styles/                # SASS partials (_variables, _layout, _components, …)
│   ├── types/                 # TypeScript interfaces (game.ts, save.ts)
│   └── data/                  # DataService, StorageAdapter, custom editorial JSON
├── scripts/
│   ├── build-data.mjs         # Merges game data + custom editorial data
│   └── extract-gamedata.mjs   # Extracts from raw XNB-unpacked game files (optional)
├── .github/workflows/
│   └── deploy.yml             # Auto-deploy on push to main
├── ARCHITECTURE.md            # Detailed architecture and design decisions
├── vite.config.ts
└── package.json
```

For full architectural detail — data model, context tree, routing table, SASS design system — see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Game data

`public/gamedata.json` is committed to the repo and loaded at runtime. **CI doesn't need game files** — the build step only compiles TypeScript and bundles assets.

### Regenerating game data

If a new version of Stardew Valley ships, you can regenerate `gamedata.json` from your local game installation:

1. Install [StardewXNBHack](https://github.com/Pathoschild/StardewXNBHack) and run it against your game's `Content/` directory to unpack XNB files.
2. Point `scripts/extract-gamedata.mjs` at the unpacked output directory.
3. Run `npm run data` to rebuild `gamedata.json`.
4. Commit the updated file.

---

## Deployment

The app deploys automatically to GitHub Pages on every push to `main` via the included GitHub Actions workflow.

**Manual deploy** (from your machine):
```bash
npm run deploy
```

**First-time setup:**
1. In the repo settings → **Pages**, set the source branch to `gh-pages`.
2. The first Actions run will publish the site.

The `base` URL in `vite.config.ts` is set to `/stardew-companion/` to match the repository name. If you rename the repo, update that constant.

---

## Credits

Game data sourced from the Stardew Valley community — item definitions, NPC schedules, and bundle contents derived from open community datasets and the game files themselves.

Stardew Valley is developed and published by [ConcernedApe](https://www.stardewvalley.net/). This project is an unofficial fan companion app and is not affiliated with or endorsed by ConcernedApe.
