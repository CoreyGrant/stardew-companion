import type { Season } from './game';

export type Skill = 'farming' | 'mining' | 'foraging' | 'fishing' | 'combat';

export type FarmType =
  | 'standard'
  | 'riverland'
  | 'forest'
  | 'hilltop'
  | 'wilderness'
  | 'beach'
  | 'four-corners'
  | 'meadowlands';

export type PathType =
  | 'wood' | 'stone' | 'gravel' | 'wood_plank' | 'crystal'
  | 'cobblestone' | 'stepping_stone' | 'straw' | 'dirt'
  | 'fence_wood' | 'fence_stone' | 'fence_iron' | 'fence_hardwood' | 'gate';

export type TreeType =
  // Wild trees
  | 'oak' | 'maple' | 'pine' | 'mahogany' | 'mushroom' | 'magic' | 'palm' | 'palm2'
  // Fruit trees
  | 'cherry' | 'apricot' | 'orange' | 'peach' | 'pomegranate' | 'apple' | 'banana' | 'mango';
export type TapperType = 'tapper' | 'heavy-tapper';

// ── Farm layout types ─────────────────────────────────────────────────────────

export interface TileRect { x: number; y: number; w: number; h: number; }

export interface CropZone {
  id: string;
  name: string;
  rects: TileRect[];
  crops: Partial<Record<Season, string>>;
}

export interface PlacedBuilding {
  id: string;
  buildingId: string;
  x: number;
  y: number;
  label?: string;
  repaired?: boolean;
  fishId?: string;
  /** Game-seeded permanent structure (Farmhouse, Greenhouse, Shipping Bin, Pet Bowl). Cannot be removed. */
  isStatic?: boolean;
}

export interface PlacedPath {
  x: number;
  y: number;
  pathType: PathType;
}

export interface PlacedItem {
  id: string;
  itemId: string;
  x: number;
  y: number;
  label?: string;
}

export interface PlacedTree {
  id: string;
  x: number;
  y: number;
  treeType: TreeType;
  tapper?: TapperType;
}

export interface InteriorLayout {
  items: PlacedItem[];
  paths: PlacedPath[];
  trees?: PlacedTree[];
}

export interface FarmLayout {
  season: Season;
  zones: CropZone[];
  buildings: PlacedBuilding[];
  paths: PlacedPath[];
  items: PlacedItem[];
  trees: PlacedTree[];
  interiors: Record<string, InteriorLayout>;
}

export const DEFAULT_FARM_LAYOUT: FarmLayout = {
  season: 'spring',
  zones: [],
  buildings: [],
  paths: [],
  items: [],
  trees: [],
  interiors: {},
};

// ── Save file ─────────────────────────────────────────────────────────────────

export interface SaveFile {
  id: string;
  name: string;
  createdAt: number;
  farmType: FarmType;
  skills: Record<Skill, number>;
  marriedTo: string | null;
  year: number;
  /** Current in-game season (defaults to 'spring') */
  season?: Season;
  /** Current in-game day of the season, 1–28 (defaults to 1) */
  day?: number;
  questProgress: Record<string, string[]>;
  bundleProgress: Record<string, string[]>;
  /** Item IDs (kebab-case) of items donated to the museum */
  museumDonations?: string[];
  farmLayout: FarmLayout;
  /** Ginger Island farm layout — optional, only present once the player has unlocked the island. */
  islandFarmLayout?: FarmLayout;

  // ── Fields populated by game-save import ──────────────────────────────────
  /** NPC kebab-case id → heart level (0–14). Only present when imported from a game save file. */
  heartLevels?: Record<string, number>;
  /** Kebab-case cooking recipe IDs the player has learned. */
  learnedCookingRecipes?: string[];
  /** Current gold on hand (display only). */
  money?: number;
  /** Deepest normal mine floor reached (0–120). */
  deepestMineLevel?: number;
  /** Deepest Skull Cavern floor reached (0 = never entered). */
  deepestSkullCavernLevel?: number;
  /** Golden walnuts found on Ginger Island. */
  goldenWalnuts?: number;
  /**
   * Community Center / Joja route completion status.
   * - 'cc-restored'   — all 6 rooms completed via bundles
   * - 'joja-complete' — all 5 Joja community development projects done
   * - 'joja-member'   — bought Joja membership but not all projects complete
   */
  communityStatus?: 'cc-restored' | 'joja-complete' | 'joja-member';
}

export interface AppSettings {
  tailorToSave: boolean;
  onboardingDismissed: boolean;
}

export interface AppData {
  version: string;
  activeSaveId: string | null;
  saves: SaveFile[];
  settings: AppSettings;
}

export const DEFAULT_SKILLS: Record<Skill, number> = {
  farming: 0,
  mining: 0,
  foraging: 0,
  fishing: 0,
  combat: 0,
};

export const DEFAULT_SAVE_PARTIAL: Omit<SaveFile, 'id' | 'createdAt' | 'name' | 'farmType'> = {
  skills: { ...DEFAULT_SKILLS },
  marriedTo: null,
  year: 1,
  questProgress: {},
  bundleProgress: {},
  museumDonations: [],
  farmLayout: { ...DEFAULT_FARM_LAYOUT },
};

/** Building IDs that are always permanent — cannot be removed or moved. */
export const STATIC_BUILDING_IDS = new Set([
  'Farmhouse', 'Shipping Bin', 'Greenhouse', 'Pet Bowl', 'Island Farmhouse',
]);

/** Migrate an old FarmLayout to the current format. */
export function migrateFarmLayout(raw: unknown): FarmLayout {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FARM_LAYOUT };
  const r = raw as Record<string, unknown>;
  if (!('season' in r)) {
    // Very old format: { tiles: FarmTile[] }
    const oldTiles = (r.tiles as Array<Record<string, unknown>> | undefined) ?? [];
    const items: PlacedItem[] = oldTiles
      .filter((t) => t.itemId)
      .map((t) => ({ id: crypto.randomUUID(), itemId: String(t.itemId), x: Number(t.x), y: Number(t.y) }));
    return { ...DEFAULT_FARM_LAYOUT, items };
  }
  const layout = raw as FarmLayout & { greenhouseRepaired?: boolean };
  let result: FarmLayout = { ...DEFAULT_FARM_LAYOUT, ...layout };
  // Migrate greenhouseRepaired flag into the Greenhouse PlacedBuilding
  if (layout.greenhouseRepaired) {
    const buildings = result.buildings.map((b) =>
      b.buildingId === 'Greenhouse' ? { ...b, repaired: true } : b,
    );
    const { greenhouseRepaired: _, ...rest } = result as typeof result & { greenhouseRepaired?: boolean };
    result = { ...rest, buildings };
  }
  // Stamp isStatic on any seeded permanent buildings that predate the flag
  result = {
    ...result,
    buildings: result.buildings.map((b) =>
      STATIC_BUILDING_IDS.has(b.buildingId) && !b.isStatic ? { ...b, isStatic: true } : b,
    ),
  };
  return result;
}
