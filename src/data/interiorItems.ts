/**
 * Whitelist of game item cheatIds that are valid in specific interior contexts.
 *
 * Rules:
 * - All machines (BigCraftables) are valid everywhere (cabin-as-shed pattern)
 * - Heater (104) valid in animal buildings (coop/barn families)
 * - Auto-Petter (272) valid in animal buildings
 * - Slime Hutch gets water troughs (fixed feature, not placeable)
 */

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
