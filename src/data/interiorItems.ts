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

/** Machine/decoration cheatIds (BigCraftables) valid in any building interior. */
export const MACHINE_IDS = new Set([
  '9','10','12','13','15','16','17','19','20','21','24','25',
  '105','128','130','154','163','165','182','211','231','232','256','264','272',
  '104',
  'BaitMaker','BigChest','Dehydrator','FishSmoker','MushroomLog',
  '37','38','39','TextSign',  // Signs (Wood, Stone, Dark, Text)
]);

/** Items valid in animal buildings (coop & barn families). */
export const ANIMAL_BUILDING_IDS = new Set<string>([
  '104', // Heater
  '272', // Auto-Petter
]);

/**
 * Returns true if the item (by cheatId) is allowed in the given interior context.
 * Machines are always allowed. Some items are restricted to animal buildings.
 *
 * isBigCraftable must be passed and be true for machine/animal-building IDs to match —
 * this prevents regular Object items whose numeric IDs collide with BigCraftable IDs
 * from appearing in the interior item list.
 */
export function isItemAllowedInInterior(cheatId: string, context: InteriorContext, isBigCraftable = false): boolean {
  if (MACHINE_IDS.has(cheatId) && isBigCraftable) return true;
  if (ANIMAL_BUILDING_IDS.has(cheatId) && isBigCraftable) {
    return context === 'coop' || context === 'barn';
  }
  return false;
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
