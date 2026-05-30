# Farm Planner Redesign

## 1. Goals

Replace the current CSS Grid farm planner with a full-featured SVG-based planner that:
- Fills the browser window (full-screen, topbar only above)
- Supports pan and zoom
- Renders real game sprites for items, crops, and buildings
- Has a collapsible sidebar with all placeable categories
- Supports named farmland zones with per-season crop assignment
- Supports all Robin + Wizard buildings with correct sizes, door markers, labels, and interior layouts
- Supports path painting with all path types
- Supports all machines and sprinklers
- Has an interior modal for buildings that can be entered

---

## 2. Technology

### SVG + React (not Canvas)

An SVG viewport with a single `<g transform="translate(x,y) scale(z)">` group handles pan/zoom.
Every tile, zone, building, and path is an SVG element — makes text labels trivial, hit-testing simple,
and allows future decorative elements without re-architecting.

Performance: 80×65 = 5,200 tiles (beach farm: 12,100). At a minimum, only the zone map background
rects need to exist at all times — user-placed elements are far fewer. If performance becomes
a concern for large farms we can virtualise the background layer by only rendering tiles in viewport,
but this is unlikely to be necessary at SVG's native speeds.

### Pan/zoom

- Mouse wheel: zoom around cursor position
- Left-drag (when no tool is active) or space+drag: pan
- Touch: pinch-to-zoom + drag
- Buttons: Fit-to-view, +/- zoom buttons in toolbar
- Default: fit the whole farm into the available canvas on load

### Sprite rendering

Game sprites are 16×16 pixels in spritesheets. Within the SVG, each placed item renders:
```
<image href="/sprites/springobjects.png"
       x={tileX - spriteCol*16} y={tileY - spriteRow*16}
       width={sheetW} height={sheetH}
       clip-path="url(#clip-x-y)"
       image-rendering="pixelated" />
```
with a `<clipPath>` covering exactly one tile. `image-rendering: pixelated` preserves the pixel art style.

Buildings have individual PNGs (`/sprites/buildings/Coop.png` etc.) and are rendered as `<image>` filling their tile footprint.

---

## 3. Data Model

### New game data types (`src/types/game.ts`)

```typescript
export interface BuildingDef {
  id: string;              // 'Coop', 'Big Coop', 'Deluxe Coop', etc.
  name: string;
  builder: 'Robin' | 'Wizard' | 'None';
  width: number;           // exterior tile width
  height: number;          // exterior tile height
  humanDoor?: { x: number; y: number };
  animalDoor?: { x: number; y: number; w: number; h: number };
  spritePath: string;      // e.g. 'sprites/buildings/Coop.png'
  hasInterior: boolean;
  interiorWidth?: number;  // interior map tile width  (from TMX)
  interiorHeight?: number; // interior map tile height (from TMX)
  upgradeFrom?: string;    // building ID this upgrades from (e.g. 'Coop' → 'Big Coop')
  upgradeTo?: string;      // building ID this upgrades to
  familyId?: string;       // 'coop' | 'barn' | 'shed' — groups upgradeable buildings
  familyLevel?: number;    // 0=base, 1=upgraded, 2=deluxe
  interiorItems?: InteriorItemRule[];  // curated whitelist for interior placement
}

export interface InteriorItemRule {
  itemId: string;
  fixed?: boolean;         // true = rendered as part of floor (non-moveable: troughs, incubators)
  fixedX?: number;
  fixedY?: number;
  minLevel?: number;       // minimum family upgrade level to show/allow (0=all, 1=Big+, 2=Deluxe only)
}
```

Add `buildingDefs: BuildingDef[]` to `GameData`.

Add sprite data to items:
```typescript
export interface Item {
  // ... existing fields ...
  spriteSheet?: string;    // e.g. 'springobjects' (default) or 'Objects_2'
  spriteIndex?: number;    // index into 24-column spritesheet
}
```

### New save layout types (`src/types/save.ts`)

Replace `FarmLayout.tiles: FarmTile[]` with a structured layout:

```typescript
export interface FarmLayout {
  season: Season;          // currently-viewed season (spring/summer/fall/winter)
  zones: CropZone[];
  buildings: PlacedBuilding[];
  paths: PlacedPath[];
  items: PlacedItem[];
  // interiors keyed by building instance id
  interiors: Record<string, InteriorLayout>;
}

export interface CropZone {
  id: string;
  name: string;            // user-editable, e.g. "Spring crops" or "Kegs field"
  rects: TileRect[];       // collection of non-overlapping rectangles
  crops: Partial<Record<Season, string>>; // itemId per season
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedBuilding {
  id: string;              // unique instance id (crypto.randomUUID)
  buildingId: string;      // current upgrade's BuildingDef.id, e.g. 'Big Coop'
  x: number;
  y: number;
  label?: string;
  // upgradeLevel is derived from buildingDef.familyLevel — no separate field needed.
  // To upgrade: update buildingId to the next family member.
}

export interface PlacedPath {
  x: number;
  y: number;
  pathType: PathType;
}

export type PathType =
  | 'wood' | 'stone' | 'gravel' | 'wood_plank' | 'crystal'
  | 'cobblestone' | 'stepping_stone' | 'straw' | 'dirt';

export interface PlacedItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  label?: string;
}

export interface InteriorLayout {
  items: PlacedItem[];
  paths: PlacedPath[];
}
```

**Migration**: When loading a save, detect the old `tiles: FarmTile[]` format and migrate it to the new structure (tiles of type 'crop' → items, type 'sprinkler' → items, season defaults to 'spring').

---

## 4. Sprite Extraction Pipeline

Extend `scripts/extract-gamedata.mjs` to add a `--sprites` flag (also run by default, can be skipped with `--no-sprites`):

### Items (springobjects + Objects_2)

```
Spritesheet: Maps/springobjects.png  → public/sprites/springobjects.png
             TileSheets/Objects_2.png → public/sprites/Objects_2.png (1.6 items)
Sheet width: 384px → 24 columns of 16px tiles
SpriteIndex → { sheet, row: floor(idx/24), col: idx%24 }
```

Each item in gamedata.json gets:
```json
"spriteSheet": "springobjects",
"spriteIndex": 276
```

Items with a custom `Texture` field in Objects.json use that sheet instead.

### Crops (growth stage icons)

```
TileSheets/crops.png → public/sprites/crops.png
```

Each crop's harvest item sprite can be used as its icon (via the item's spriteIndex).
The crops sheet can optionally be used for growth stage previews later.

### Buildings

```
Buildings/<Name>.png → public/sprites/buildings/<Name>.png
```

One PNG per building definition. The building sprite dimensions vary — the building occupies
the bottom portion of the image (shadow/season overlay above). For display in the sidebar
and on the map we can use `preserveAspectRatio="xMidYMax meet"` with the tile footprint as
the SVG image bounds, letting the building fill its footprint naturally.

### Script output

Copying ~50 PNGs (items spritesheet + crops + buildings) into `public/sprites/`.
The spritesheets are shared — no duplication. Total size: ~400KB.
Building PNGs average ~10KB each.

---

## 5. Building Catalog

Extracted from `Data/Buildings.json`. Exterior sizes are the same across all upgrade levels within a family.

### Upgrade families

| Family / Level | Building ID | Exterior | Interior | Unlock |
|---|---|---|---|---|
| Coop / 0 | Coop | 6×3 | 12×10 | Base |
| Coop / 1 | Big Coop | 6×3 | 16×10 | Upgrade from Coop |
| Coop / 2 | Deluxe Coop | 6×3 | 23×10 | Upgrade from Big Coop |
| Barn / 0 | Barn | 7×4 | 18×15 | Base |
| Barn / 1 | Big Barn | 7×4 | 22×15 | Upgrade from Barn |
| Barn / 2 | Deluxe Barn | 7×4 | 25×15 | Upgrade from Big Barn |
| Shed / 0 | Shed | 7×3 | 13×14 | Base |
| Shed / 1 | Big Shed | 7×3 | 19×17 | Upgrade from Shed |

### Non-upgradeable buildings

| Building | Exterior | Interior | Builder |
|---|---|---|---|
| Silo | 3×3 | — | Robin |
| Well | 3×3 | — | Robin |
| Mill | 4×2 | — | Robin |
| Fish Pond | 5×5 | — | Robin |
| Slime Hutch | 7×4 | 18×14 | Robin |
| Stable | 4×2 | — | Robin |
| Pet Bowl | 2×2 | — | Robin |
| Shipping Bin | 2×1 | — | Robin |
| Cabin | 5×3 | (uses FarmHouse map — machine-only) | Robin |
| Junimo Hut | 3×2 | — | Wizard |
| Earth Obelisk | 3×2 | — | Wizard |
| Water Obelisk | 3×2 | — | Wizard |
| Desert Obelisk | 3×2 | — | Wizard |
| Island Obelisk | 3×2 | — | Wizard |
| Gold Clock | 3×2 | — | Wizard |
| Farmhouse | 9×5 | — (excluded — beds/fridges/ovens out of scope) | None |
| Greenhouse | 7×6 | 20×24 | None |

Door positions and animal hatch positions are read from `HumanDoor` and `AnimalDoor` fields in Buildings.json.

On the SVG, doors render as a small filled rect at the correct tile position within the building footprint.
Animal hatches render as a wider rect (matching their Width/Height fields).

### Sidebar grouping and upgrade UX

Upgradeable buildings appear as a single sidebar entry (e.g. "Coop") with a small level indicator
showing the currently-selected upgrade level (Basic / Big / Deluxe). This is chosen at placement time.
After placement, the upgrade level can be changed via right-click → "Change upgrade level", which
updates the `buildingId` and resizes the interior (preserving compatible placed interior items).

Non-upgradeable buildings appear as flat entries.

### Building colours (sidebar + placement preview)

- Robin buildings: `#8B4513` (warm brown)
- Wizard buildings: `#4B0082` (indigo)
- Non-builder (Farmhouse, Greenhouse): `#2F5E3A` (dark green)

### Placement UX

1. Click a building in the sidebar → activates place mode (level picker appears inline if upgradeable)
2. Hovering the SVG canvas shows a semi-transparent preview rectangle at the hovered tile
3. Preview turns red if the footprint overlaps an impassable zone or another building
4. Click to place; Escape to cancel
5. Placed buildings can be dragged to move, or right-clicked for: Edit label / Open interior / Change upgrade level / Remove

---

## 6. UI Layout

```
┌─────────────────────── topbar (56px) ─────────────────────────────┐
│ Stardew Companion                  Farm Planner  [save name]       │
├──────────────────┬────────────────────────────────────────────────┤
│  SIDEBAR (280px) │  SVG CANVAS (fills remainder)                  │
│  ─────────────── │                                                 │
│  Season toggle   │  [farm grid with pan/zoom]                      │
│                  │                                                 │
│  ▸ Zones         │                                                 │
│  ▸ Buildings     │                                                 │
│    Robin         │                                                 │
│    Wizard        │                                                 │
│  ▸ Paths         │                                                 │
│  ▸ Sprinklers    │                                                 │
│  ▸ Machines      │                                                 │
│  ▸ Decorations   │                                                 │
│                  │                                                 │
│  [Undo] [Redo]   │                                                 │
│  [Fit view]      │                                                 │
└──────────────────┴────────────────────────────────────────────────┘
```

- Route `/farm-planner` renders at full-page height (CSS: `height: calc(100vh - topbarHeight)`)
- Sidebar scrolls independently; canvas fills with `flex: 1`
- Each sidebar section is a `<details>/<summary>` collapsible (reusing existing `<Panel>` component)
- Items within a section appear as `display: flex; flex-wrap: wrap` chips with a sprite icon + name
- Active tool chip is highlighted

---

## 7. Tool System

Tool state lives in `useFarmPlanner`. Only one tool is active at a time.

| Tool | Trigger | Behaviour |
|---|---|---|
| `pan` | Default / Space+drag | Drag to move viewport |
| `select` | Click existing element | Show handles; drag to move; right-click for context menu |
| `zone-draw` | Sidebar: Zones → New Zone / existing zone | Click+drag rect to add to selected zone |
| `zone-assign` | Sidebar: click crop chip | Assigns crop to currently-selected zone for current season |
| `building-place` | Sidebar: click building | Preview follows cursor; click to place |
| `path-draw` | Sidebar: click path type | Click+drag paints/erases path tiles |
| `item-place` | Sidebar: click machine/sprinkler | Click to place 1×1 item |
| `erase` | Sidebar: Erase button or Del key | Click/drag removes any element |

### Keyboard shortcuts
- `Escape`: cancel current tool, return to pan
- `Z` / `Ctrl+Z`: undo
- `Shift+Z` / `Ctrl+Shift+Z`: redo
- `Space+drag`: pan regardless of active tool
- `Delete` on selected element: remove it

---

## 8. Farmland Zone System

A **zone** is a named collection of tile rectangles. Zones can be disjointed (e.g. two separate fields
both assigned to summer melons).

### Creating/editing a zone
1. Click `+ New Zone` in sidebar → activates zone-draw tool with a new unnamed zone
2. Click+drag on the SVG canvas to add a rectangle to the zone
3. Add as many rects as needed; each new drag-rect appends to the active zone
4. Double-click an existing zone in the sidebar to re-activate its zone-draw tool (hover shows extend handles)
5. Zone rectangles can be individually deleted via right-click

### Crop assignment
- With a zone selected (highlighted), click a crop chip in the sidebar
- Crop is assigned to the currently-viewed season
- Each zone can have a different crop per season (or empty = fallow)

### Visual rendering
- Zone background: semi-transparent green tint over farmable tiles
- Zone name shown as SVG `<text>` centred over the zone's bounding box
- When a zone has a crop for the active season: the crop's sprite tiles the zone area
- When fallow: hatched fill pattern

### Season toggle
Four buttons at top of sidebar: Spring / Summer / Fall / Winter.
Switching season re-renders which crop sprites are shown on zones. Does not change zone boundaries.

---

## 9. Paths

Path types and their visual colours in the SVG:

| Type | Colour |
|---|---|
| Wood Path | `#c8a96b` |
| Stone Path | `#8a8a8a` |
| Gravel Path | `#b0a090` |
| Wood Plank | `#c4944c` |
| Crystal Path | `#a0e8e8` |
| Cobblestone | `#909060` |
| Stepping Stone | `#787878` |
| Straw | `#d4c070` |
| Dirt | `#9e7855` |

Click+drag paints; holding Shift while dragging restricts to axis-aligned lines.
Holding Ctrl while dragging draws a rectangle of paths.
Erasing paths: select Erase tool and drag over them.

---

## 10. Machines & Sprinklers

### Sprinklers (sidebar section)

All sprinklers are 1×1 tiles. Sprinkler range shown as a semi-transparent blue overlay when "Show range" is on:

| Sprinkler | Range pattern |
|---|---|
| Basic (599) | 4 tiles: up/down/left/right (cross) |
| Quality (621) | 8 tiles: 1-ring (3×3 minus corners minus self) |
| Iridium (645) | 24 tiles: 2-ring (5×5 minus corners minus self) |
| Pressure Nozzle upgrade: +1 ring to each |
| Qi Iridium upgrade (645+Qi): 48 tiles: 3-ring (7×7 minus corners minus self) |

Sprinkler range overlay is rendered as a group of `<rect>` elements with `fill-opacity: 0.25; fill: #38bdf8`.
Toggle with "Show/Hide Sprinkler Range" button.

### Machines (sidebar section, collapsible sub-groups)

All machines are 1×1 tiles with a game sprite.

**Artisan / Processing:**
Keg, Preserve Jar, Mayonnaise Machine, Cheese Press, Loom, Oil Maker, Butter Churn, Dehydrator,
Vinegar Jug, Bait Maker

**Smelting / Crafting:**
Furnace, Heavy Furnace, Recycling Machine, Wood Chipper, Geode Crusher

**Farming support:**
Bee House, Seed Maker, Mushroom Box, Mushroom Log, Solar Panel

**Misc:**
Crystalarium, Lightning Rod, Worm Bin, Crab Pot (water only), Slime Egg-Press, Tapper (on tree tile)

**Statues:**
Statue of Endless Fortune, Statue of Perfection, Statue of True Perfection, Prairie King Arcade,
Junimo Kart Arcade

These are sourced from Objects.json (all have valid sprite data).

---

## 11. Interior Modal

Clicking "Open interior" on a placed building opens a full-viewport modal:

```
┌─────────────── [Building Name — Level] Interior ─── [✕ Close] ─────┐
│  SIDEBAR (same component, filtered to interior-valid items only)     │
│                                                                      │
│  SVG canvas showing the interior tile grid                          │
│  (same pan/zoom + tools; tool state is separate from exterior)      │
└──────────────────────────────────────────────────────────────────────┘
```

The sidebar upgrade level indicator is shown read-only in the interior modal header.
A "Change upgrade" button allows changing the level (same as exterior context menu).

### Interior dimensions (from TMX files)

| Building | Interior size |
|---|---|
| Coop (level 0) | 12×10 |
| Big Coop (level 1) | 16×10 |
| Deluxe Coop (level 2) | 23×10 |
| Barn (level 0) | 18×15 |
| Big Barn (level 1) | 22×15 |
| Deluxe Barn (level 2) | 25×15 |
| Shed (level 0) | 13×14 |
| Big Shed (level 1) | 19×17 |
| Slime Hutch | 18×14 |
| Greenhouse | 20×24 |
| Cabin | same as Shed (13×14) |

### Interior item whitelist (hand-curated)

**Fixed features** (rendered as part of the floor, non-moveable):
These are part of the building's interior map, not user-placed. They are rendered as visual overlays
on the interior grid so players can plan around them.

| Building | Fixed feature | Min level |
|---|---|---|
| Barn family | Hay Hopper | 0 |
| Barn family | Feed Trough (multiple) | 0 |
| Coop family | Hay Hopper | 0 |
| Coop family | Feed Trough | 0 |
| Big Coop+ | Incubator | 1 |
| Slime Hutch | Water Troughs × 4 | 0 |

Fixed feature tile positions are extracted from the interior TMX maps (AlwaysFront/Back layers).

**Player-placeable by building type:**

| Category | Items | Where allowed |
|---|---|---|
| Animal care | Heater | Coop, Barn, Slime Hutch |
| Animal care | Auto-Petter | Big Coop+, Big Barn+ |
| All machines | Keg, Preserve Jar, Mayonnaise Machine, Cheese Press, Loom, Oil Maker, Butter Churn, Dehydrator, Vinegar Jug, Bait Maker | Everywhere with interior |
| Smelting | Furnace, Heavy Furnace, Recycling Machine, Wood Chipper, Geode Crusher | Everywhere |
| Farming | Bee House, Seed Maker, Solar Panel | Everywhere |
| Storage | Chest, Big Chest, Stone Chest, Junimo Chest | Everywhere |
| Utility | Crystalarium, Worm Bin, Slime Egg-Press, Lightning Rod | Everywhere |
| Sprinklers | Basic, Quality, Iridium | Greenhouse only (suggested; allowed anywhere) |
| Paths | All path types | Everywhere |

**Explicitly excluded** from all interiors (farmhouse/cabin lifestyle items):
Bed, Double Bed, Fridge, Mini-Fridge, Oven, Fireplace, TV, Bathtub, Bookcase, Dresser,
Wallpaper, Flooring decorative items, any furniture with `category: 'furniture'`.

The whitelist is stored as a data structure in a new `src/data/interiorItems.ts` file
(not in gamedata.json — it's companion logic, not game data). Structure:

```typescript
export type InteriorContext =
  | 'coop' | 'barn' | 'shed' | 'slime_hutch' | 'greenhouse' | 'cabin' | 'everywhere';

export const INTERIOR_ITEM_WHITELIST: Record<InteriorContext, string[]> = {
  coop:        ['heater', 'auto_petter', /* + all machine IDs */],
  barn:        ['heater', 'auto_petter', /* + all machine IDs */],
  slime_hutch: ['heater', /* + all machine IDs */],
  shed:        [/* all machine IDs */],
  greenhouse:  ['sprinkler', 'quality_sprinkler', 'iridium_sprinkler', 'seed_maker', 'bee_house', /* + machines */],
  cabin:       [/* all machine IDs */],
  everywhere:  [/* all machine IDs — used as base list merged into each context */],
};
```

Interior layouts are stored in `FarmLayout.interiors[buildingInstanceId]`.

---

## 12. Implementation Phases

### Phase 1 — SVG migration + full-screen layout + pan/zoom (foundation)
- New `FarmPlannerPage` with full-screen CSS (`height: calc(100vh - topbarH)`)
- Sidebar shell with `<details>` sections (no items yet)
- `FarmCanvas` SVG component: renders zone-type background from `zoneMap` as coloured rects
- Pan/zoom: wheel event + pointer drag on canvas; fit-to-view on load
- Season toggle buttons in sidebar
- Undo/redo + keyboard shortcuts

### Phase 2 — Sprite pipeline
- Extend `extract-gamedata.mjs` to copy spritesheets and building PNGs into `public/sprites/`
- Add `spriteSheet` + `spriteIndex` to all items in gamedata.json
- Extract BuildingDef array from Data/Buildings.json, add to gamedata.json
- `SpriteIcon` React component: renders a single 16×16 sprite from a sheet using SVG `<image>` + clipPath
- Sidebar items render with `SpriteIcon` instead of coloured dots

### Phase 3 — Buildings
- Sidebar "Buildings" section with Robin/Wizard sub-groups
- Building placement tool with hover preview
- Overlap validation (impassable zones + other buildings)
- Door + animal hatch markers on placed buildings
- Label editing (click building label to edit inline)
- Move via drag; remove via right-click → Delete
- Data model: `PlacedBuilding` in `FarmLayout`

### Phase 4 — Farmland zones + crops
- "Zones" sidebar section with zone list + `+ New Zone` button
- `zone-draw` tool: click+drag adds rects to active zone
- Zone SVG rendering (tint + name label + crop sprite tiling)
- Crop assignment per season per zone
- Zone name editing (click name in sidebar)
- Season toggle re-renders crop sprites

### Phase 5 — Paths
- "Paths" sidebar section with all 9 path types
- `path-draw` tool: click+drag paints; Ctrl+drag for rectangle mode
- Path SVG rendering (coloured rects over zone background)
- Data model: `PlacedPath[]` in `FarmLayout`

### Phase 6 — Machines + Sprinklers
- "Sprinklers" sidebar section
- "Machines" sidebar section (sub-groups)
- `item-place` tool
- Sprinkler range overlay (toggle button)
- Qi iridium sprinkler range option (toggle in sprinkler section)

### Phase 7 — Interiors
- Interior modal component (same sidebar filtered)
- Shed interior grid to start
- `InteriorLayout` in save data
- Extend to Barn/Coop/Slime Hutch

---

## 13. Files Affected / Created

### Modified
- `src/types/save.ts` — expand FarmLayout, add new placement types
- `src/types/game.ts` — add BuildingDef, sprite fields on Item
- `src/pages/FarmPlannerPage.tsx` — complete rewrite
- `src/hooks/useFarmPlanner.ts` — significant expansion
- `src/styles/_farm-planner.scss` — full-screen + sidebar + SVG styles
- `scripts/extract-gamedata.mjs` — sprite copy + BuildingDef extraction
- `public/gamedata.json` — regenerated with sprite data + building defs

### New
- `src/components/farm/FarmCanvas.tsx` — SVG canvas + pan/zoom
- `src/components/farm/FarmSidebar.tsx` — collapsible tool sidebar
- `src/components/farm/SpriteIcon.tsx` — single sprite from spritesheet
- `src/components/farm/BuildingLayer.tsx` — SVG buildings overlay
- `src/components/farm/ZoneLayer.tsx` — SVG crop zones
- `src/components/farm/PathLayer.tsx` — SVG paths
- `src/components/farm/ItemLayer.tsx` — SVG machines/sprinklers
- `src/components/farm/SprinklerRangeLayer.tsx` — range overlay
- `src/components/farm/InteriorModal.tsx` — interior layout modal
- `src/hooks/usePanZoom.ts` — pan/zoom state + event handlers
- `public/sprites/` — copied game spritesheets + building PNGs
