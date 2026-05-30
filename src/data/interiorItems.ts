/**
 * Whitelist of game item cheatIds that are valid in specific interior contexts.
 *
 * Rules:
 * - All machines (BigCraftables) are valid everywhere (cabin-as-shed pattern)
 * - Heater (104) valid in animal buildings (coop/barn families)
 * - Auto-Petter (272) valid in animal buildings
 * - Slime Hutch gets water troughs (fixed feature, not placeable)
 */

import type { ZoneType, BuildingDef } from '../types/game';

export type InteriorContext = 'coop' | 'barn' | 'shed' | 'slime_hutch' | 'greenhouse' | 'cabin' | 'any';

/**
 * BigCraftable cheatIds that must NOT appear in building interiors.
 * Kept small — new machines are allowed by default.
 */
export const INTERIOR_EXCLUDED_IDS = new Set([
  '105', '264', // Tapper, Heavy Tapper — go on trees
  '163',        // Cask — cellar only
  '99', '101',  // Feed Hopper, Incubator — auto-placed building fixtures
]);

/** Items restricted to animal buildings (coop & barn families). */
export const ANIMAL_BUILDING_IDS = new Set<string>([
  '104', // Heater
  '272', // Auto-Petter
]);

/**
 * Returns true if the item (by cheatId) is allowed in the given interior context.
 * All BigCraftables are allowed except outdoor-only items and fixtures.
 * Some items are additionally restricted to animal buildings.
 *
 * isBigCraftable must be passed and be true — this prevents regular Object items
 * whose numeric IDs collide with BigCraftable IDs from appearing in the list.
 */
export function isItemAllowedInInterior(cheatId: string, context: InteriorContext, isBigCraftable = false): boolean {
  if (!isBigCraftable) return false;
  if (INTERIOR_EXCLUDED_IDS.has(cheatId)) return false;
  if (ANIMAL_BUILDING_IDS.has(cheatId)) {
    return context === 'coop' || context === 'barn';
  }
  return true;
}

/** Derive interior context from a building id string. */
export function getInteriorContext(buildingId: string): InteriorContext {
  const lower = buildingId.toLowerCase();
  if (lower.includes('coop')) return 'coop';
  if (lower.includes('barn')) return 'barn';
  if (lower.includes('shed')) return 'shed';
  if (lower.includes('slime')) return 'slime_hutch';
  if (lower.includes('greenhouse')) return 'greenhouse';
  if (lower.includes('cabin')) return 'cabin';
  return 'any';
}

/** Fixed (non-moveable) interior features per building family. */
export interface FixedFeature {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export const FIXED_FEATURES: Record<string, FixedFeature[]> = {
  'Coop': [
    { label: 'Hay Hopper', x: 1, y: 1, w: 2, h: 1, color: '#c8a030' },
    { label: 'Feed Bowl', x: 3, y: 8, w: 7, h: 1, color: '#a06818' },
  ],
  'Big Coop': [
    { label: 'Hay Hopper', x: 1, y: 1, w: 2, h: 1, color: '#c8a030' },
    { label: 'Feed Bowl', x: 3, y: 8, w: 11, h: 1, color: '#a06818' },
    { label: 'Nesting Boxes', x: 13, y: 3, w: 2, h: 4, color: '#8b6914' },
  ],
  'Deluxe Coop': [
    { label: 'Hay Hopper', x: 1, y: 1, w: 2, h: 1, color: '#c8a030' },
    { label: 'Feed Bowl', x: 3, y: 8, w: 18, h: 1, color: '#a06818' },
    { label: 'Nesting Boxes', x: 20, y: 3, w: 2, h: 4, color: '#8b6914' },
  ],
  'Barn': [
    { label: 'Hay Hopper', x: 14, y: 1, w: 2, h: 2, color: '#c8a030' },
    { label: 'Feed Trough', x: 3, y: 10, w: 10, h: 1, color: '#a06818' },
  ],
  'Big Barn': [
    { label: 'Hay Hopper', x: 18, y: 1, w: 2, h: 2, color: '#c8a030' },
    { label: 'Feed Trough', x: 3, y: 10, w: 14, h: 1, color: '#a06818' },
  ],
  'Deluxe Barn': [
    { label: 'Hay Hopper', x: 21, y: 1, w: 2, h: 2, color: '#c8a030' },
    { label: 'Feed Trough', x: 3, y: 10, w: 17, h: 1, color: '#a06818' },
  ],
  'Slime Hutch': [
    { label: 'Water Trough', x: 1,  y: 11, w: 4, h: 1, color: '#2a72b8' },
    { label: 'Water Trough', x: 7,  y: 11, w: 4, h: 1, color: '#2a72b8' },
    { label: 'Water Trough', x: 13, y: 11, w: 4, h: 1, color: '#2a72b8' },
  ],
};

// ── Shed optimal layout ───────────────────────────────────────────────────────

export const SHED_DIMS: Record<string, { w: number; h: number; corridor: number; count: number }> = {
  'Shed':     { w: 11, h: 9,  corridor: 5, count: 67  },
  'Big Shed': { w: 17, h: 12, corridor: 8, count: 137 },
};

export function generateOptimalLayout(
  buildingId: string,
  machineId: string,
): Array<{ x: number; y: number; itemId: string }> {
  const d = SHED_DIMS[buildingId];
  if (!d) return [];
  const result: Array<{ x: number; y: number; itemId: string }> = [];
  for (let y = 0; y < d.h; y++) {
    const isAccess = y % 3 === 1;
    for (let x = 0; x < d.w; x++) {
      if (isAccess) {
        if (x === 0 || x === d.w - 1) result.push({ x, y, itemId: machineId });
      } else {
        if (x === d.corridor && y !== 0) continue;
        result.push({ x, y, itemId: machineId });
      }
    }
  }
  return result;
}

// ── Greenhouse tile type ──────────────────────────────────────────────────────

type GhTileType = 'wall' | 'walk' | 'water' | 'stone' | 'farm';

/**
 * Returns the zone type for a greenhouse interior tile at (x, y).
 * The full map is 20 wide × 24 tall.
 *
 * wall  – non-interactive (outer/inner brick walls)
 * walk  – walking area rows 1-6 (machines ok)
 * water – water source tiles at row 6 cols 9-10 (non-interactive)
 * stone – stone/gravel border (tree-plantable + items ok)
 * farm  – farmable soil centre (crops + items ok)
 */
function getGreenhouseTileType(x: number, y: number): GhTileType {
  // Outer walls
  if (x === 0 || x === 19 || y === 0) return 'wall';
  // Bottom row – mostly wall, entrance marker at col 10
  if (y === 23) return x === 10 ? 'stone' : 'wall';
  // Walking rows 1-5
  if (y >= 1 && y <= 5) return 'walk';
  // Row 6 – walk with water source at cols 9-10
  if (y === 6) return (x === 9 || x === 10) ? 'water' : 'walk';
  // Stone rows 7-8 (full width inside walls)
  if (y === 7 || y === 8) return 'stone';
  // Inner border rows 9 & 20: stone on sides, wall spanning middle
  if (y === 9 || y === 20) return (x <= 2 || x >= 17) ? 'stone' : 'wall';
  // Stone rows 21-22
  if (y === 21 || y === 22) return 'stone';
  // Farmable centre rows 10-19
  if (y >= 10 && y <= 19) {
    if (x <= 2 || x >= 17) return 'stone'; // side stone strips
    if (x === 3) return 'wall';            // inner left border
    if (y === 10) return x <= 14 ? 'farm' : 'wall'; // row 10: 11 farmable + wall at 15-16
    return x <= 15 ? 'farm' : 'wall';     // rows 11-19: 12 farmable
  }
  return 'wall';
}

// ── Interior zone data ────────────────────────────────────────────────────────

export interface InteriorZoneData {
  gridWidth: number;
  gridHeight: number;
  /** Default zone type for tiles not in the zoneMap. */
  farmBaseType: ZoneType;
  /** Per-tile zone overrides (tiles that differ from farmBaseType). */
  zoneMap: Map<string, ZoneType>;
  /** Whether trees can be placed in this interior (greenhouse only). */
  treesAllowed: boolean;
}

/**
 * Build the zone map and grid dimensions for a building's interior.
 *
 * Greenhouse:
 *   - farmBaseType = 'farmable'
 *   - wall tiles   → 'impassable' in zoneMap
 *   - walk tiles   → 'grass'  (machines + paths ok)
 *   - stone tiles  → 'grass'  (trees + items ok, same as walk)
 *   - water tiles  → 'water'  (nothing placeable)
 *   - farm tiles   → not in zoneMap (they match the base type)
 *   - treesAllowed = true
 *
 * All other buildings (Coop, Barn, Shed, Slime Hutch, Cabin, …):
 *   - farmBaseType = 'grass'
 *   - fixed features → 'impassable' in zoneMap
 *   - treesAllowed = false
 */
export function getInteriorZoneData(
  buildingId: string,
  buildingDef: BuildingDef | null,
): InteriorZoneData {
  const shedDims   = SHED_DIMS[buildingId] ?? null;
  const isGreenhouse = buildingId === 'Greenhouse';

  const gridWidth  = shedDims?.w ?? buildingDef?.interiorWidth  ?? 13;
  const gridHeight = shedDims?.h ?? buildingDef?.interiorHeight ?? 14;

  const zoneMap = new Map<string, ZoneType>();

  if (isGreenhouse) {
    const base: ZoneType = 'farmable';
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const tile = getGreenhouseTileType(x, y);
        let zone: ZoneType;
        switch (tile) {
          case 'wall':  zone = 'impassable'; break;
          case 'water': zone = 'water';      break;
          case 'walk':  zone = 'grass';      break;
          case 'stone': zone = 'grass';      break;
          case 'farm':  zone = base;         break;  // matches base; not added to map
          default:      zone = 'impassable'; break;
        }
        if (zone !== base) zoneMap.set(`${x},${y}`, zone);
      }
    }
    return { gridWidth, gridHeight, farmBaseType: 'farmable', zoneMap, treesAllowed: true };
  }

  // All other building types: flat floor with fixed features as impassable tiles
  const fixedFeatures = FIXED_FEATURES[buildingId] ?? [];
  for (const ff of fixedFeatures) {
    for (let fy = ff.y; fy < ff.y + ff.h; fy++) {
      for (let fx = ff.x; fx < ff.x + ff.w; fx++) {
        zoneMap.set(`${fx},${fy}`, 'impassable');
      }
    }
  }

  return { gridWidth, gridHeight, farmBaseType: 'grass', zoneMap, treesAllowed: false };
}
