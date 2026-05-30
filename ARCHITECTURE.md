# Stardew Valley Companion App — Architecture & Plan

## Overview

A single-page companion app for Stardew Valley with no server, deployed via GitHub Pages. Features NPC profiles, schedule viewer, item database, quest tracker, and interactive farm planner. All user data stored in localStorage. Fully mobile-first.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | SPA requirement, type safety for complex game data |
| Build | Vite | Fast dev server, single-file output via `rollupOptions` |
| Routing | React Router v6 | Client-side SPA routing |
| Styling | SASS (sass package) | Custom stylesheet, no component library |
| State | React Context only | No Redux per spec |
| Deployment | GitHub Actions → gh-pages branch | Simple automated deploy |

---

## Data Architecture

### Three Sources, One Output

```
community-dataset/           ← raw game data (items, NPCs, schedules, gifts)
  (open-source JSON from community extraction of 1.6 game files)

src/data/custom/             ← editorial layer (your content)
  npcs.json                  ← descriptions, tips, notes per NPC
  items.json                 ← descriptions, usage notes per item
  quests.json                ← walkthrough steps, tips per quest

scripts/build-data.mjs       ← merge script
  └→ public/gamedata.json    ← committed output, loaded at runtime
```

`gamedata.json` is **committed to the repo**. Regeneration is a manual `npm run data` step when a new game version ships. GitHub Actions only needs `npm run build` — no game files required in CI.

### On Reading Directly From Game Files

Stardew 1.6 stores content in XNB format (XNA binary). Extraction pipeline:

1. Install `StardewXNBHack` (C# CLI tool)
2. Run against `<Steam>/steamapps/common/Stardew Valley/Content/`
3. Pipe extracted JSONs into `scripts/fetch-game-data.mjs`
4. Run `npm run data` to merge with custom data

This is documented as an optional local step for regenerating on new game versions. The community dataset is used as the baseline for v1.

### Game Data Types

```typescript
interface GameData {
  version: string;
  npcs: NPC[];
  items: Item[];
  crops: Crop[];
  quests: Quest[];
  bundles: Bundle[];
  farmTypes: FarmTypeDefinition[];
}

interface NPC {
  id: string;
  name: string;
  birthday: { season: Season; day: number };
  marriageable: boolean;
  homeLocation: string;
  description: string;         // from custom data
  gifts: {
    loved: ItemRef[];
    liked: ItemRef[];
    neutral: ItemRef[];
    disliked: ItemRef[];
    hated: ItemRef[];
  };
  schedules: ScheduleVariant[]; // see Schedule section
}

interface ScheduleVariant {
  conditions: ScheduleCondition; // season, weather, year, married, etc.
  entries: ScheduleEntry[];      // time → location pairs
}

interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  sellValue: number;
  description: string;          // from custom data
  cheatId: number;              // [id] bracket cheat code
  energy?: number;
  health?: number;
  likedBy: string[];            // NPC ids
  lovedBy: string[];            // NPC ids
}

interface Crop {
  id: string;
  seedItemId: string;
  harvestItemId: string;
  seasons: Season[];
  growDays: number;
  regrowDays: number | null;
  harvestCount: { min: number; max: number };
  qualityByFarmingLevel: Record<number, CropQuality>; // 0–10 → quality distribution
}

interface Quest {
  id: string;
  name: string;
  giver: string;                 // NPC id or null
  type: QuestType;               // 'story' | 'community_center' | 'special_order' | 'joja'
  reward: string;
  description: string;
  steps: QuestStep[];
}

interface QuestStep {
  id: string;
  text: string;
  tip?: string;
  linkedItems: ItemRef[];
  linkedNPCs: string[];
}

interface Bundle {
  id: string;
  room: CommunityRoom;
  name: string;
  reward: string;
  items: BundleItem[];
}
```

---

## Storage Architecture

### Single localStorage Key: `stardew_companion_v1`

```typescript
interface AppData {
  version: string;
  activeSaveId: string | null;
  saves: SaveFile[];
  settings: AppSettings;
}

interface SaveFile {
  id: string;
  name: string;
  createdAt: number;
  farmType: FarmType;
  skills: Record<Skill, number>;         // 0–10 each
  marriedTo: string | null;              // NPC id
  year: number;
  questProgress: Record<string, string[]>;   // questId → completed step ids
  bundleProgress: Record<string, string[]>;  // bundleId → completed item ids
  farmLayout: FarmLayout;
}

interface AppSettings {
  tailorToSave: boolean;   // when true, personalise app with active save data
}

type FarmType =
  | 'standard' | 'riverland' | 'forest' | 'hilltop'
  | 'wilderness' | 'beach' | 'four_corners' | 'meadowlands';

type Skill = 'farming' | 'mining' | 'foraging' | 'fishing' | 'combat';
```

### DataService (Central Data Access Class)

All localStorage reads/writes go through `DataService`. To add a server later, implement a new `StorageAdapter` and swap it in.

```typescript
interface StorageAdapter {
  load(): AppData;
  save(data: AppData): void;
}

class LocalStorageAdapter implements StorageAdapter {
  private readonly KEY = 'stardew_companion_v1';
  load(): AppData { ... }
  save(data: AppData): void { ... }
}

class DataService {
  constructor(private adapter: StorageAdapter) {}

  getSaves(): SaveFile[]
  getActiveSave(): SaveFile | null
  setActiveSave(id: string): void
  createSave(save: Omit<SaveFile, 'id' | 'createdAt'>): SaveFile
  updateSave(save: SaveFile): void
  deleteSave(id: string): void
  getSettings(): AppSettings
  updateSettings(settings: Partial<AppSettings>): void
  updateQuestProgress(saveId: string, questId: string, stepIds: string[]): void
  updateBundleProgress(saveId: string, bundleId: string, itemIds: string[]): void
  updateFarmLayout(saveId: string, layout: FarmLayout): void
}
```

---

## Context / State Model

```
<DataServiceContext.Provider>   ← DataService instance
  <GameDataContext.Provider>    ← fetched gamedata.json, loaded once
    <UserDataContext.Provider>  ← active save, all saves, settings
      <Router>
        <AppShell />
      </Router>
    </UserDataContext.Provider>
  </GameDataContext.Provider>
</DataServiceContext.Provider>
```

Each page imports **exactly one custom hook** that combines context access:

```typescript
// Page component has no direct context imports
function NPCDetailPage() {
  const { npc, scheduleForDate, gifts, userHeartLevel } = useNPCDetail(id);
  // ...
}
```

---

## Routing

| Path | Page |
|---|---|
| `/` | Home dashboard — quick links, active save summary |
| `/characters` | NPC list — filterable by type, birthday season |
| `/characters/:id` | NPC detail — profile, gifts, schedules |
| `/schedule` | Schedule quick-viewer — date/weather input |
| `/items` | Item database — filterable by category |
| `/items/:id` | Item detail — description, crop data, liked-by NPCs |
| `/quests` | Quest list — community center / story / special orders / Joja |
| `/quests/:id` | Quest walkthrough + interactive checklist |
| `/farm-planner` | Interactive grid farm planner |
| `/saves` | Save file manager — create, edit, switch, delete |

---

## Feature Specifications

### NPC List (`/characters`)

- Grid of NPC cards: portrait, name, birthday, marriageable badge
- Filter by: season of birthday, marriageable only, NPC type (villager / special)
- Sort by: name, birthday

### NPC Detail (`/characters/:id`)

- Portrait, name, birthday, home, marriageable status
- Description (from custom data)
- Heart events summary — spoiler-togglable
- **Gift preferences table:** Loved / Liked / Neutral / Disliked / Hated
  - Each item name is a `<GameLink type="item">` → item page
- **Schedule section:** all variants in collapsible panels
  - Variants: season × weather × year × married/unmarried
  - Each entry shows time slot → location

### Schedule Quick-Viewer (`/schedule`)

- **Inputs:** Season, Day (1–28), Weather (sunny/rainy/stormy/snowy), Year (1 / 2+)
- Day of week auto-derived from day number
- If "tailor to save" is on: marriage status pulled from active save automatically
- Output: each NPC row with their location at 6am, 10am, 12pm, 3pm, 6pm, 8pm
- Inline loved/liked gift icons per NPC row (cheatsheet mode)
- Filter by NPC name

### Item List (`/items`)

- Filterable by category: crops, seeds, food, equipment, minerals, artisan goods, fish, forage, etc.
- Each card: sprite, name, sell value, category badge
- Search by name

### Item Detail (`/items/:id`)

- Name, category, description, sell value, item ID (bracket cheat)
- Energy/health values for food items
- **For seeds:**
  - Growth time per season, regrow behaviour, harvest count range
  - Crop quality breakdown by Farming level (0–10) — active save pre-fills the level if "tailor to save" is on
  - Link to crop item page
- **For crops:**
  - Artisan goods it produces (wine, juice, pickles, etc.)
  - "Loved by" / "Liked by" NPC section — each NPC as `<GameLink type="npc">`
- **For equipment:** stats, how to obtain
- "Obtain from" section: shop prices, foraging locations, monster drops, etc.

### Quest Tracker (`/quests/:id`)

- Quest name, giver (linked NPC), reward
- Step-by-step prose walkthrough with tips (from custom data)
- Each step has a checkbox — state saved per save file in localStorage
- Progress bar at top
- All referenced items and NPCs are `<GameLink>` components

### Community Center (`/quests/community-center`)

- Special layout: 6 rooms → bundles → item checklists
- Bundle completion tracked per save file
- Reward shown per bundle and per room
- Item names link to item pages

### Farm Planner (`/farm-planner`)

- Farm type selector — shows the correct terrain map for each of the 8 farm types
- **Rendering:** CSS Grid (not canvas) — each cell is a tile, better for mobile and accessibility
- **Layers (rendered in order):**
  1. Terrain (read-only per farm type — water, house, roads)
  2. Crops (placed by user, seasonal colour coding)
  3. Buildings/structures (shed, coop, barn, greenhouse, fish pond, etc.)
  4. Paths / flooring
  5. Sprinkler range overlay (toggleable)
- **Toolbar:** crop picker (filtered by season), building picker, eraser, select tool
- **Sprinkler overlay:** highlights cells covered by placed sprinklers
  - Basic: cross pattern (4 cells)
  - Quality: 8 surrounding cells
  - Iridium: 24 surrounding cells (5×5 minus corners)
- **Seasonal view:** spring / summer / fall / winter — dims crops not in that season
- **Undo / redo:** 20-step history stack in `useFarmPlanner`
- Layout auto-saved to active save file in localStorage

### Save Manager (`/saves`)

- List of save files: name, farm type icon, skill levels, married NPC
- "Active save" indicator + one-click switch
- Create / edit (inline form) / delete (with confirmation)
- **"Tailor app to this save" toggle:** when on, the app uses save data throughout:
  - Schedule viewer auto-fills marriage status
  - Item pages show crop quality for user's Farming level
  - Quest tracker shows progress from this save
- Multiple saves supported, switch freely

---

## Cross-Linking

All references between game objects use a single `<GameLink>` component:

```tsx
<GameLink type="npc" id="abigail">Abigail</GameLink>
<GameLink type="item" id="diamond">Diamond</GameLink>
<GameLink type="quest" id="community_center">Community Center</GameLink>
```

This generates the correct internal route and renders as a styled anchor. No hardcoded paths in data or components.

---

## Hooks (One Per Page/Feature)

| Hook | Used by |
|---|---|
| `useNPCList` | `/characters` |
| `useNPCDetail(id)` | `/characters/:id` |
| `useScheduleViewer` | `/schedule` |
| `useItemList` | `/items` |
| `useItemDetail(id)` | `/items/:id` |
| `useQuestDetail(id)` | `/quests/:id` |
| `useBundles` | `/quests/community-center` |
| `useFarmPlanner` | `/farm-planner` |
| `useSaves` | `/saves` |

---

## SASS Structure

```
src/styles/
  _variables.scss      ← colour palette, pixel fonts, spacing scale, breakpoints
  _mixins.scss         ← panel-frame mixin, pixel-border mixin, mobile-first helpers
  _reset.scss
  _layout.scss         ← app shell, nav bar, page containers
  _typography.scss
  _components.scss     ← GameLink, Panel, GiftTag, ProgressBar, etc.
  _npc.scss
  _schedule.scss
  _items.scss
  _quests.scss
  _farm-planner.scss
  _saves.scss
  main.scss            ← @use all partials
```

### Visual System

- **Font:** `DotGothic16` (Google Fonts) for headings — pixel style, free
- **Body font:** system sans-serif for readability on mobile
- **Palette:**
  - Green: `#4a7c59`
  - Brown: `#8B4513`
  - Gold: `#DAA520`
  - Sky: `#87CEEB`
  - Dark panel: `#2d1b0e`
  - Light parchment: `#f5e6c8`
- **Panel style:** hard box-shadow + inner border mimicking the game's UI windows
- **No border-radius** — pixel art is sharp-edged
- **Mobile-first:** every layout designed at 375px, desktop is the `@media (min-width: 768px)` enhancement

---

## Build & Deployment

### NPM Scripts

```
npm run dev      → Vite dev server (hot reload)
npm run build    → TypeScript check + Vite build → dist/
npm run data     → scripts/build-data.mjs → public/gamedata.json
npm run deploy   → manual deploy to gh-pages (or use GitHub Actions)
```

### Output Structure (dist/)

```
dist/
  index.html
  app.js           ← single bundle (rollup code-splitting disabled)
  app.css          ← single stylesheet
  images/
    sprites/
    portraits/
```

Vite `rollupOptions.output` configured to emit a single entry chunk. Expected bundle size: ~500–800KB gzipped — acceptable for a companion app.

### GitHub Actions

On push to `main`:

```yaml
- npm ci
- npm run build
- Deploy dist/ to gh-pages branch
```

`gamedata.json` is committed so no data build step is needed in CI.

---

## File Structure

```
stardew-companion/
├── public/
│   ├── gamedata.json              ← built by npm run data, committed
│   └── images/
│       ├── sprites/
│       └── portraits/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/
│   │   ├── game.ts                ← NPC, Item, Quest, Schedule, Crop, Bundle, etc.
│   │   └── save.ts                ← SaveFile, FarmLayout, AppData, etc.
│   ├── data/
│   │   ├── DataService.ts
│   │   ├── StorageAdapter.ts
│   │   ├── LocalStorageAdapter.ts
│   │   └── custom/
│   │       ├── npcs.json
│   │       ├── items.json
│   │       └── quests.json
│   ├── contexts/
│   │   ├── DataServiceContext.tsx
│   │   ├── GameDataContext.tsx
│   │   └── UserDataContext.tsx
│   ├── hooks/
│   │   ├── useNPCList.ts
│   │   ├── useNPCDetail.ts
│   │   ├── useScheduleViewer.ts
│   │   ├── useItemList.ts
│   │   ├── useItemDetail.ts
│   │   ├── useQuestDetail.ts
│   │   ├── useBundles.ts
│   │   ├── useFarmPlanner.ts
│   │   └── useSaves.ts
│   ├── components/
│   │   ├── common/
│   │   │   ├── GameLink.tsx       ← universal cross-link component
│   │   │   ├── Panel.tsx          ← reusable game-UI-style panel wrapper
│   │   │   ├── GiftTag.tsx        ← loved/liked/disliked badge
│   │   │   └── ProgressBar.tsx
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   └── Nav.tsx
│   │   ├── npc/
│   │   │   ├── NPCList.tsx
│   │   │   ├── NPCCard.tsx
│   │   │   ├── NPCDetail.tsx
│   │   │   ├── GiftTable.tsx
│   │   │   └── SchedulePanel.tsx
│   │   ├── schedule/
│   │   │   └── ScheduleViewer.tsx
│   │   ├── items/
│   │   │   ├── ItemList.tsx
│   │   │   ├── ItemCard.tsx
│   │   │   ├── ItemDetail.tsx
│   │   │   └── CropQualityTable.tsx
│   │   ├── quests/
│   │   │   ├── QuestList.tsx
│   │   │   ├── QuestDetail.tsx
│   │   │   └── BundleTracker.tsx
│   │   ├── farm-planner/
│   │   │   ├── FarmPlanner.tsx
│   │   │   ├── FarmGrid.tsx
│   │   │   ├── FarmTile.tsx
│   │   │   ├── PlacementToolbar.tsx
│   │   │   └── SprinklerOverlay.tsx
│   │   └── saves/
│   │       ├── SaveList.tsx
│   │       ├── SaveCard.tsx
│   │       └── SaveEditor.tsx
│   └── styles/
│       ├── main.scss
│       ├── _variables.scss
│       ├── _mixins.scss
│       ├── _reset.scss
│       ├── _layout.scss
│       ├── _typography.scss
│       ├── _components.scss
│       ├── _npc.scss
│       ├── _schedule.scss
│       ├── _items.scss
│       ├── _quests.scss
│       ├── _farm-planner.scss
│       └── _saves.scss
├── scripts/
│   ├── build-data.mjs             ← entry point: fetch + merge
│   └── fetch-community-data.mjs   ← downloads/copies community dataset
├── .github/
│   └── workflows/
│       └── deploy.yml
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Implementation Order

| Phase | Work |
|---|---|
| 1 | Scaffold: Vite + React + TypeScript + SASS + React Router, GitHub Actions, deploy to gh-pages |
| 2 | Data layer: `StorageAdapter`, `DataService`, all three Contexts, `gamedata.json` build script |
| 3 | Design system: SASS variables, `Panel`, `GameLink`, mobile nav, pixel aesthetic baseline |
| 4 | NPC list + detail pages — core content, establishes cross-link pattern |
| 5 | Schedule quick-viewer — builds on NPC data |
| 6 | Item list + detail pages — crop quality maths with save profile integration |
| 7 | Quest tracker + Community Center — save progress tracking |
| 8 | Save manager — polish the profile personalisation flow |
| 9 | Farm planner — largest feature, last because save file shape must be stable |
