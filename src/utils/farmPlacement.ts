import type { ZoneType, BuildingDef } from '../types/game';
import type { FarmLayout } from '../types/save';

// Zones where non-building items (scarecrows, torches, etc.) and paths can be placed.
// Sand is passable — sprinkler restriction is enforced separately via zoneMap.
const ITEM_PASSABLE: ZoneType[] = ['farmable', 'grass', 'path', 'sand'];

// Zones where crop zones can be drawn (farmable + sand — both are diggable).
const CROP_ZONE_TYPES: ZoneType[] = ['farmable', 'sand'];

function tileZone(x: number, y: number, zoneMap: Map<string, ZoneType>, baseType: ZoneType): ZoneType {
  return zoneMap.get(`${x},${y}`) ?? baseType;
}

export function getBuildingOccupancy(
  buildings: FarmLayout['buildings'],
  defMap: Map<string, BuildingDef>,
  excludeId?: string,
): Set<string> {
  const occupied = new Set<string>();
  for (const b of buildings) {
    if (b.id === excludeId) continue;
    const def = defMap.get(b.buildingId);
    if (!def) continue;
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        occupied.add(`${b.x + dx},${b.y + dy}`);
      }
    }
  }
  return occupied;
}

/**
 * Can a Robin building be placed at (x,y) with dimensions (w,h)?
 *
 * Uses zone-type heuristic: buildings are allowed on any tile that is not
 * water, impassable, an existing building footprint, or a bridge.
 * This matches the game's actual Robin placement rules (farmable, grass, sand,
 * path tiles all accept buildings).
 *
 * The `buildableSet` parameter (TMX buildable:t tiles) is accepted for API
 * compatibility but is intentionally ignored — it only covers ~100–400 tiles
 * per farm type (mostly permanent-building pads), not the full buildable area,
 * so restricting to it incorrectly blocked most of the farm.
 */
export function canPlaceBuilding(
  x: number, y: number, w: number, h: number,
  zoneMap: Map<string, ZoneType>, baseType: ZoneType,
  gridW: number, gridH: number,
  buildingOccupancy: Set<string>,
  _buildableSet?: Set<string>,  // unused — see comment above
): boolean {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) return false;
      if (buildingOccupancy.has(`${tx},${ty}`)) return false;
      const zone = tileZone(tx, ty, zoneMap, baseType);
      if (zone === 'water' || zone === 'impassable' || zone === 'building' || zone === 'bridge') return false;
    }
  }
  return true;
}

/**
 * Can an item (scarecrow, torch, etc.) be placed at (x,y)?
 * Pass isSprinkler=true to additionally block sand tiles.
 */
export function canPlaceItem(
  x: number, y: number,
  zoneMap: Map<string, ZoneType>, baseType: ZoneType,
  gridW: number, gridH: number,
  buildingOccupancy: Set<string>,
  itemOccupancy: Set<string>,
  isSprinkler = false,
): boolean {
  if (x < 0 || y < 0 || x >= gridW || y >= gridH) return false;
  const zone = tileZone(x, y, zoneMap, baseType);
  if (!ITEM_PASSABLE.includes(zone)) return false;
  if (isSprinkler && zone === 'sand') return false; // sprinklers don't work on sand
  if (buildingOccupancy.has(`${x},${y}`)) return false;
  if (itemOccupancy.has(`${x},${y}`)) return false;
  return true;
}

export function canPlacePath(
  x: number, y: number,
  zoneMap: Map<string, ZoneType>, baseType: ZoneType,
  gridW: number, gridH: number,
  buildingOccupancy: Set<string>,
): boolean {
  if (x < 0 || y < 0 || x >= gridW || y >= gridH) return false;
  const zone = tileZone(x, y, zoneMap, baseType);
  if (zone === 'water' || zone === 'impassable' || zone === 'building') return false;
  if (buildingOccupancy.has(`${x},${y}`)) return false;
  return true;
}

/**
 * Can a tree be planted at (x,y)?
 * Uses treePlantSet (from TMX canplanttrees:t) when available,
 * otherwise falls back to zone-type heuristic.
 */
export function canPlaceTree(
  x: number, y: number,
  zoneMap: Map<string, ZoneType>, baseType: ZoneType,
  gridW: number, gridH: number,
  buildingOccupancy: Set<string>,
  itemOccupancy: Set<string>,
  treeOccupancy: Set<string>,
  treePlantSet?: Set<string>,
): boolean {
  if (x < 0 || y < 0 || x >= gridW || y >= gridH) return false;
  if (buildingOccupancy.has(`${x},${y}`)) return false;
  if (itemOccupancy.has(`${x},${y}`)) return false;
  if (treeOccupancy.has(`${x},${y}`)) return false;
  if (treePlantSet) {
    return treePlantSet.has(`${x},${y}`);
  }
  // Fallback: farmable or grass
  const zone = tileZone(x, y, zoneMap, baseType);
  return zone === 'farmable' || zone === 'grass';
}

export function canPlaceZone(
  x: number, y: number,
  zoneMap: Map<string, ZoneType>, baseType: ZoneType,
  gridW: number, gridH: number,
): boolean {
  if (x < 0 || y < 0 || x >= gridW || y >= gridH) return false;
  const zone = tileZone(x, y, zoneMap, baseType);
  return CROP_ZONE_TYPES.includes(zone);
}

export function getItemOccupancy(items: FarmLayout['items']): Set<string> {
  return new Set(items.map((i) => `${i.x},${i.y}`));
}

export function getTreeOccupancy(trees: FarmLayout['trees']): Set<string> {
  return new Set(trees.map((t) => `${t.x},${t.y}`));
}
