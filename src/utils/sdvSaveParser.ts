/**
 * Stardew Valley 1.6 save file parser.
 *
 * Accepts the raw XML text of a SDV save file (the extension-less file inside
 * the save folder) and returns a partial SaveFile ready for createSave().
 *
 * All processing is synchronous on the main thread; callers should show a
 * loading indicator before invoking and hide it afterwards.
 */

import type { Crop, GameData } from '../types/game';
import type {
  CropZone,
  FarmLayout,
  FarmType,
  InteriorLayout,
  PathType,
  PlacedBuilding,
  PlacedItem,
  PlacedPath,
  PlacedTree,
  SaveFile,
  Skill,
  TapperType,
  TreeType,
} from '../types/save';
import type { CharacterSaveData } from './saveSync';
import { DEFAULT_FARM_LAYOUT, STATIC_BUILDING_IDS } from '../types/save';
import type { Season } from '../types/game';

// ── Mapping tables ────────────────────────────────────────────────────────────

/** SDV bundle integer IDs → our bundle IDs (from gamedata.json) */
const SDV_BUNDLE_ID_MAP: Record<number, string> = {
  0:  'spring-foraging',
  1:  'summer-foraging',
  2:  'fall-foraging',
  3:  'winter-foraging',
  4:  'construction',
  5:  'exotic-foraging',
  6:  'blacksmiths',
  7:  'geologists',
  8:  'adventurers',
  9:  'crab-pot',
  10: 'river-fish',
  11: 'lake-fish',
  12: 'ocean-fish',
  13: 'spring-crops',
  14: 'summer-crops',
  15: 'fall-crops',
  16: 'quality-crops',
  17: 'animal',
  19: 'artisan',
  20: 'chefs',
  21: 'dye',
  22: 'field-research',
  23: 'fodder',
  24: 'enchanters',
  25: 'vault-2500',
  26: 'vault-5000',
  27: 'vault-10000',
  28: 'vault-25000',
  31: 'night-fishing',
  32: 'specialty-fish',
};

const FARM_TYPE_MAP: Record<number, FarmType> = {
  0: 'standard',
  1: 'riverland',
  2: 'forest',
  3: 'hilltop',
  4: 'wilderness',
  5: 'four-corners',
  6: 'beach',
  7: 'meadowlands',
};

/** SDV Flooring.whichFloor → our PathType */
const FLOOR_TO_PATH: Record<number, PathType> = {
  0:  'wood_plank',
  1:  'stone',
  2:  'straw',
  3:  'crystal',
  4:  'straw',
  5:  'gravel',
  6:  'wood',
  7:  'crystal',
  8:  'cobblestone',
  9:  'stepping_stone',
  10: 'cobblestone',
  11: 'dirt',
  12: 'wood_plank',
};

/** SDV fence object name → our PathType */
const FENCE_NAME_MAP: Record<string, PathType> = {
  'Wood Fence':     'fence_wood',
  'Stone Fence':    'fence_stone',
  'Iron Fence':     'fence_iron',
  'Hardwood Fence': 'fence_hardwood',
  'Gate':           'gate',
};

/** SDV wild Tree.treeType integer → our TreeType (sourced from Data/WildTrees.json) */
const WILD_TREE_MAP: Record<number, TreeType> = {
  1:  'oak',
  2:  'maple',
  3:  'pine',
  6:  'palm',       // tree_palm.png  — short island palm
  7:  'mushroom',
  8:  'mahogany',
  9:  'palm2',      // tree_palm2.png — tall island palm (treeType 9, not 17)
  10: 'oak',        // Green Rain oak  (mossy variant; use base sprite)
  11: 'maple',      // Green Rain maple
  12: 'pine',       // Green Rain pine
  13: 'magic',      // mystic_tree.png — the Mystic Tree (MysticTreeSeed)
};

/** BigCraftable cheatId → TapperType for overlaidItem detection */
const TAPPER_ITEM_IDS: Record<string, TapperType> = {
  '105': 'tapper',
  '264': 'heavy-tapper',
};

/**
 * SDV FruitTree sapling item ID → our TreeType.
 * Used in 1.6+ saves where <treeId> is an integer sapling ID (most common format).
 *   628 = Cherry Sapling   629 = Apricot Sapling  630 = Orange Sapling
 *   631 = Peach Sapling    632 = Pomegranate       633 = Apple Sapling
 *    69 = Banana Sapling   835 = Mango Sapling
 */
const FRUIT_TREE_SAPLING_MAP: Record<string, TreeType> = {
  '628': 'cherry',
  '629': 'apricot',
  '630': 'orange',
  '631': 'peach',
  '632': 'pomegranate',
  '633': 'apple',
  '69':  'banana',
  '835': 'mango',
};

/**
 * SDV FruitTree fruit item cheatId → our TreeType.
 * Fallback for older pre-1.6 saves that store <indexOfFruit> (fruit item ID)
 * or the legacy <itemId> field.
 */
const FRUIT_TREE_CHEAT_MAP: Record<string, TreeType> = {
  '638': 'cherry',
  '634': 'apricot',
  '635': 'orange',
  '636': 'peach',
  '637': 'pomegranate',
  '613': 'apple',
  '91':  'banana',
  '834': 'mango',
};

/** XP required for each skill level 0–10 */
const XP_TABLE = [0, 100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10_000, 15_000];

// ── Result type ───────────────────────────────────────────────────────────────

export interface SdvParseResult {
  save: Omit<SaveFile, 'id' | 'createdAt'>;
  /**
   * Per-character data for all players in the save.
   * Index 0 is always the host (matches `save`'s character data).
   * Index 1+ are farmhands (co-op players) if this is a multiplayer save.
   */
  characters: CharacterSaveData[];
  warnings: string[];
}

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Read xsi:type attribute, trying both prefixed and namespaced forms. */
function xsiType(el: Element): string {
  return (
    el.getAttribute('xsi:type') ??
    el.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type') ??
    ''
  );
}

/** First direct child with the given tag name. */
function ch(el: Element | null | undefined, tag: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) {
    if (c.tagName === tag) return c;
  }
  return null;
}

/** All direct children with the given tag name. */
function chs(el: Element | null | undefined, tag: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter(c => c.tagName === tag);
}

/** Trimmed text content of the first direct child with the given tag. */
function txt(el: Element | null | undefined, tag: string): string {
  return ch(el, tag)?.textContent?.trim() ?? '';
}

/** Navigate a chain of child elements and return trimmed text at the end. */
function deep(el: Element | null | undefined, ...tags: string[]): string {
  let cur: Element | null | undefined = el;
  for (const tag of tags) cur = ch(cur, tag);
  return cur?.textContent?.trim() ?? '';
}

/**
 * Unwrap a serialized dictionary <value> element.
 *
 * SDV's XmlSerializer wraps each dictionary value in a plain <value> element
 * whose first (and only) child is the actual typed element, e.g.:
 *   <value><TerrainFeature xsi:type="Tree">…</TerrainFeature></value>
 *   <value><Object xsi:type="Chest">…</Object></value>
 *
 * Returns that inner element, or null if the wrapper is missing/empty.
 */
function dictVal(valueEl: Element | null | undefined): Element | null {
  if (!valueEl) return null;
  return Array.from(valueEl.children)[0] ?? null;
}

/** Parse a <Vector2><X>…</X><Y>…</Y></Vector2> key element into integer coords. */
function vecCoord(keyEl: Element | null | undefined): { x: number; y: number } | null {
  const vec = ch(keyEl, 'Vector2');
  if (!vec) return null;
  const x = parseFloat(txt(vec, 'X'));
  const y = parseFloat(txt(vec, 'Y'));
  if (isNaN(x) || isNaN(y)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

/** Strip leading "(X)" qualifier from SDV 1.6 item IDs, e.g. "(O)16" → "16". */
function stripQualifier(id: string): string {
  return id.replace(/^\([A-Z]+\)/, '');
}

/** Convert a display name to kebab-case id (matches our data extraction convention). */
function nameToKebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function xpToLevel(xp: number): number {
  let level = 0;
  for (let i = 1; i < XP_TABLE.length; i++) {
    if (xp >= XP_TABLE[i]) level = i;
    else break;
  }
  return level;
}

/** Find a top-level GameLocation by xsi:type or <name> text. */
function findLocation(root: Element, typeName: string): Element | null {
  const locations = ch(root, 'locations');
  if (!locations) return null;
  for (const loc of Array.from(locations.children)) {
    if (xsiType(loc) === typeName) return loc;
    if (txt(loc, 'name') === typeName) return loc;
  }
  return null;
}

// ── Per-character parser ──────────────────────────────────────────────────────

/**
 * Extract per-character data from a <player> or <Farmer> element.
 * Used for both the host player and each co-op farmhand.
 */
function parseFarmer(
  playerEl: Element,
  gameData: GameData,
): CharacterSaveData {
  const charName = txt(playerEl, 'name') || 'Farmer';

  // Skills
  const xpEls = chs(ch(playerEl, 'experiencePoints'), 'int');
  const xpArr = xpEls.map(el => parseInt(el.textContent?.trim() ?? '0', 10));
  const skills: Record<Skill, number> = {
    farming:  xpToLevel(xpArr[0] ?? 0),
    fishing:  xpToLevel(xpArr[1] ?? 0),
    foraging: xpToLevel(xpArr[2] ?? 0),
    mining:   xpToLevel(xpArr[3] ?? 0),
    combat:   xpToLevel(xpArr[4] ?? 0),
  };

  const spouseRaw = txt(playerEl, 'spouse');
  const marriedTo = spouseRaw || null;
  const money     = parseInt(txt(playerEl, 'money') || '0', 10);

  const heartLevels           = parseFriendship(playerEl, gameData);
  const learnedCookingRecipes = parseCookingRecipes(playerEl, gameData);

  return {
    charName,
    skills,
    marriedTo,
    heartLevels,
    questProgress: {},          // manual tracking — not read from file
    learnedCookingRecipes,
    money,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function parseSdvSave(
  xmlText: string,
  gameData: GameData,
): SdvParseResult {
  const warnings: string[] = [];

  // 1. Parse XML ──────────────────────────────────────────────────────────────
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    const msg = parseError.textContent?.slice(0, 200) ?? 'XML parse error';
    throw new Error(`Invalid XML: ${msg}`);
  }

  const root = doc.documentElement;
  if (root.tagName !== 'SaveGame') {
    throw new Error(
      'This does not appear to be a Stardew Valley save file ' +
      `(root element is <${root.tagName}>, expected <SaveGame>).`,
    );
  }

  // 2. Version gate ───────────────────────────────────────────────────────────
  const gameVersion = txt(root, 'gameVersion');
  if (!gameVersion.startsWith('1.6')) {
    throw new Error(
      `Only Stardew Valley 1.6 saves are supported. ` +
      `This file is version "${gameVersion || 'unknown'}". ` +
      `Please update the game to 1.6 and re-save before importing.`,
    );
  }

  // 3. Player element ─────────────────────────────────────────────────────────
  const player = ch(root, 'player');
  if (!player) throw new Error('Save file is missing <player> data.');

  // 4. Core profile ───────────────────────────────────────────────────────────
  const farmName   = txt(player, 'farmName') || 'My Farm';
  const playerName = txt(player, 'name')     || 'Farmer';
  const name       = `${farmName} (${playerName})`;

  const money     = parseInt(txt(player, 'money')    || '0', 10);
  const spouseRaw = txt(player, 'spouse');
  const marriedTo = spouseRaw || null;

  // 5. Farm type ──────────────────────────────────────────────────────────────
  const whichFarm = parseInt(txt(root, 'whichFarm') || '0', 10);
  const farmType  = FARM_TYPE_MAP[whichFarm] ?? 'standard';

  // 6. Date ───────────────────────────────────────────────────────────────────
  const year      = Math.max(1, parseInt(txt(root, 'year')        || '1', 10));
  const seasonRaw = txt(root, 'currentSeason') as Season;
  const season: Season = (['spring', 'summer', 'fall', 'winter'] as const).includes(seasonRaw)
    ? seasonRaw : 'spring';
  const day = Math.max(1, Math.min(28, parseInt(txt(root, 'dayOfMonth') || '1', 10)));

  // 7. Skills (experiencePoints order: farming, fishing, foraging, mining, combat)
  const xpEls = chs(ch(player, 'experiencePoints'), 'int');
  const xpArr = xpEls.map(el => parseInt(el.textContent?.trim() ?? '0', 10));
  const skills: Record<Skill, number> = {
    farming:  xpToLevel(xpArr[0] ?? 0),
    fishing:  xpToLevel(xpArr[1] ?? 0),
    foraging: xpToLevel(xpArr[2] ?? 0),
    mining:   xpToLevel(xpArr[3] ?? 0),
    combat:   xpToLevel(xpArr[4] ?? 0),
  };

  // 8. Progression scalars ────────────────────────────────────────────────────
  // SDV stores mine depth as a single integer: 0–120 = normal mines,
  // >120 = mines complete + (value − 120) floors into Skull Cavern.
  const rawMineLevel        = parseInt(txt(player, 'deepestMineLevel') || '0', 10);
  const deepestMineLevel    = Math.min(rawMineLevel, 120);
  const deepestSkullCavernLevel = Math.max(0, rawMineLevel - 120);
  // goldenWalnuts may be at root or inside player depending on minor version
  const goldenWalnuts =
    parseInt(txt(root,   'goldenWalnuts') || '0', 10) ||
    parseInt(txt(player, 'goldenWalnuts') || '0', 10);

  // 9. NPC heart levels & per-character data ───────────────────────────────────
  const heartLevels = parseFriendship(player, gameData);

  // Build per-character array: host (index 0) + farmhands (index 1+)
  const hostCharacter = parseFarmer(player, gameData);
  const characters: CharacterSaveData[] = [hostCharacter];

  // Farmhands live at <SaveGame><farmhands><Farmer> (direct child of root),
  // for both local-coop and online-coop saves.
  const farmhandsEl = ch(root, 'farmhands');
  if (farmhandsEl) {
    for (const farmerEl of Array.from(farmhandsEl.children)) {
      // Skip empty/placeholder entries (SDV sometimes writes stub <Farmer> with no name)
      const fhName = txt(farmerEl, 'name');
      if (!fhName) continue;
      characters.push(parseFarmer(farmerEl, gameData));
    }
  }

  // 9b. Community Center / Joja status ───────────────────────────────────────
  const communityStatus = parseCommunityStatus(root, player);

  // 10. Bundle progress ───────────────────────────────────────────────────────
  const bundleProgress = parseBundles(root, gameData, warnings);

  // 11. Museum donations ──────────────────────────────────────────────────────
  const museumDonations = parseMuseum(root, gameData);

  // 12. Cooking recipes ───────────────────────────────────────────────────────
  const learnedCookingRecipes = parseCookingRecipes(player, gameData);

  // 13. Farm layouts ──────────────────────────────────────────────────────────
  const farmTypeDef = gameData.farmTypes.find(f => f.id === farmType);
  const mainStaticBuildings = seedStaticBuildings(farmTypeDef?.staticBuildings ?? []);
  const farmLayout = parseLayout(root, 'Farm', gameData, season, mainStaticBuildings, warnings);

  let islandFarmLayout: FarmLayout | undefined;
  if (findLocation(root, 'IslandWest')) {
    const islandStatic = seedStaticBuildings(gameData.islandFarm?.staticBuildings ?? []);
    islandFarmLayout = parseLayout(root, 'IslandWest', gameData, season, islandStatic, warnings);
  }

  return {
    save: {
      name,
      farmType,
      skills,
      marriedTo,
      year,
      season,
      day,
      questProgress:  {},
      bundleProgress,
      museumDonations,
      farmLayout,
      islandFarmLayout,
      heartLevels,
      learnedCookingRecipes,
      money,
      deepestMineLevel,
      deepestSkullCavernLevel,
      goldenWalnuts,
      communityStatus,
    },
    characters,
    warnings,
  };
}

// ── Sub-parsers ───────────────────────────────────────────────────────────────

function parseFriendship(
  player: Element,
  gameData: GameData,
): Record<string, number> {
  const result: Record<string, number> = {};
  const npcByName = new Map(gameData.npcs.map(n => [n.name, n]));
  const friendshipData = ch(player, 'friendshipData');
  if (!friendshipData) return result;

  for (const item of chs(friendshipData, 'item')) {
    const npcName    = deep(item, 'key', 'string');
    const npc        = npcByName.get(npcName);
    if (!npc) continue;

    const friendship = ch(ch(item, 'value'), 'Friendship');
    const points     = parseInt(txt(friendship, 'Points') || '0', 10);
    result[npc.id]   = Math.min(Math.floor(points / 250), 14);
  }
  return result;
}

const JOJA_ROOM_FLAGS = [
  'jojaBoilerRoom', 'jojaVault', 'jojaPantry', 'jojaCraftsRoom', 'jojaFishTank',
] as const;

function parseCommunityStatus(
  root: Element,
  player: Element,
): SaveFile['communityStatus'] {
  // Read the player's mailReceived list
  const mailEl = ch(player, 'mailReceived');
  const mail   = new Set(chs(mailEl, 'string').map(el => el.textContent?.trim() ?? ''));

  const isJojaMember      = mail.has('JojaMember');
  const jojaRoomsComplete = JOJA_ROOM_FLAGS.every(f => mail.has(f));

  if (isJojaMember && jojaRoomsComplete) return 'joja-complete';
  if (isJojaMember)                       return 'joja-member';

  // Community Centre restored via bundles: all 6 areasComplete are true
  const cc      = findLocation(root, 'CommunityCenter');
  const areasEl = ch(cc, 'areasComplete');
  if (areasEl) {
    const areas = chs(areasEl, 'boolean').map(
      el => el.textContent?.trim().toLowerCase() === 'true',
    );
    if (areas.length === 6 && areas.every(Boolean)) return 'cc-restored';
  }

  return undefined;
}

function parseBundles(
  root: Element,
  gameData: GameData,
  warnings: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  const bundleById = new Map(gameData.bundles.map(b => [b.id, b]));

  // The CommunityCenter is a GameLocation inside <locations>, not a direct
  // child of <SaveGame>. Use findLocation which matches on xsi:type or <name>.
  const cc = findLocation(root, 'CommunityCenter');
  if (!cc) return result;

  // ── Shortcut: if all 6 CC areas are complete, mark every bundle complete ─────
  // This bypasses individual bundle slot parsing which can fail for certain
  // bundles (vault, fodder, enchanters) due to save-format variations in 1.6.
  const areasEl = ch(cc, 'areasComplete');
  if (areasEl) {
    const areas = chs(areasEl, 'boolean').map(
      el => el.textContent?.trim().toLowerCase() === 'true',
    );
    if (areas.length === 6 && areas.every(Boolean)) {
      for (const bundle of gameData.bundles) {
        result[bundle.id] = bundle.items.map(bi => bi.slotId ?? bi.itemId);
      }
      return result;
    }
  }

  // ── Partial completion — parse bundle by bundle ───────────────────────────────
  const bundlesEl = ch(cc, 'bundles');
  if (!bundlesEl) return result;

  for (const item of chs(bundlesEl, 'item')) {
    // Support both <int> and <int64> key variants (SDV 1.6 uses int for all
    // bundle IDs, but fall back to int64 for robustness)
    const sdvId = parseInt(
      deep(item, 'key', 'int') || deep(item, 'key', 'int64') || '-1',
      10,
    );
    if (sdvId < 0) continue;

    const ourId = SDV_BUNDLE_ID_MAP[sdvId];
    if (!ourId) continue;

    const ourBundle = bundleById.get(ourId);
    if (!ourBundle) continue;

    const valueEl     = ch(item, 'value');
    const arrayOfBool = ch(valueEl, 'ArrayOfBoolean');
    if (!arrayOfBool) continue;

    const slots = chs(arrayOfBool, 'boolean').map(
      el => el.textContent?.trim().toLowerCase() === 'true',
    );

    // If a multi-item bundle has only 1 boolean slot = true, treat as
    // "entire bundle complete" (some 1.6 save variants write a single
    // completion flag instead of per-slot booleans)
    if (slots.length === 1 && slots[0] && ourBundle.items.length > 1) {
      result[ourId] = ourBundle.items.map(bi => bi.slotId ?? bi.itemId);
      continue;
    }

    const completed: string[] = [];
    for (let i = 0; i < Math.min(slots.length, ourBundle.items.length); i++) {
      if (slots[i]) {
        const bi = ourBundle.items[i];
        completed.push(bi.slotId ?? bi.itemId);
      }
    }
    if (completed.length > 0) result[ourId] = completed;
  }

  if (Object.keys(result).length === 0 && bundlesEl.children.length > 0) {
    warnings.push('Bundle data was found but could not be fully matched — check for mod bundles.');
  }
  return result;
}

function parseMuseum(
  root: Element,
  gameData: GameData,
): string[] {
  // Only artifacts, minerals, and gems are museum-donatable
  const cheatIdToItem = new Map(
    gameData.items
      .filter(i => i.category === 'artifact' || i.category === 'mineral' || i.category === 'gem')
      .map(i => [i.cheatId, i]),
  );

  const museumLoc = findLocation(root, 'LibraryMuseum');
  if (!museumLoc) return [];

  const museumPieces = ch(museumLoc, 'museumPieces');
  if (!museumPieces) return [];

  const donated: string[] = [];
  for (const item of chs(museumPieces, 'item')) {
    const valueEl  = ch(item, 'value');
    // In 1.6, value is <string>(O)NNN</string>; in some versions it may be <int>NNN</int>
    const rawId    = ch(valueEl, 'string')?.textContent?.trim()
                  ?? ch(valueEl, 'int')?.textContent?.trim()
                  ?? valueEl?.textContent?.trim()
                  ?? '';
    const cheatId  = stripQualifier(rawId);
    const gameItem = cheatIdToItem.get(cheatId);
    if (gameItem) donated.push(gameItem.id);
  }
  return [...new Set(donated)];
}

function parseCookingRecipes(
  player: Element,
  gameData: GameData,
): string[] {
  const recipeByKebab = new Map(
    gameData.recipes.map(r => [nameToKebab(r.name), r.id]),
  );
  const learned: string[] = [];

  const cookingEl = ch(player, 'cookingRecipes');
  if (!cookingEl) return learned;

  for (const item of chs(cookingEl, 'item')) {
    const sdvName  = deep(item, 'key', 'string');
    const recipeId = recipeByKebab.get(nameToKebab(sdvName));
    if (recipeId) learned.push(recipeId);
  }
  return learned;
}

// ── Farm layout ───────────────────────────────────────────────────────────────

/** Build the PlacedBuilding[] for a farm's static/permanent structures. */
function seedStaticBuildings(
  statics: Array<{ buildingId: string; x: number; y: number }>,
): PlacedBuilding[] {
  return statics.map(sb => ({
    id:         crypto.randomUUID(),
    buildingId: sb.buildingId,
    x:          sb.x,
    y:          sb.y,
    ...(sb.buildingId === 'Greenhouse'          ? { repaired: false } : {}),
    ...(STATIC_BUILDING_IDS.has(sb.buildingId)  ? { isStatic: true  } : {}),
  }));
}

/**
 * Parse objects from a location element into planner items and fence paths.
 *
 * plannerBcIds  — cheatIds of BigCraftable items we want to capture (Seed Maker, Bee House, etc.)
 * plannerObjIds — cheatIds of regular Object items we want to capture (sprinklers: 599/621/645)
 *
 * The two sets are kept separate so that a regular Object with the same numeric ID as a
 * BigCraftable is not misidentified — e.g. Stone (itemId 25, bigCraftable=false) vs
 * Seed Maker (itemId 25, bigCraftable=true).  We confirm the match against the
 * <bigCraftable> flag stored on every object in the save XML.
 */
function parseLocationObjects(
  locEl: Element,
  plannerBcIds: Set<string>,
  plannerObjIds: Set<string>,
): { items: PlacedItem[]; paths: PlacedPath[] } {
  const items: PlacedItem[] = [];
  const paths: PlacedPath[] = [];

  for (const item of chs(ch(locEl, 'objects'), 'item')) {
    const coord  = vecCoord(ch(item, 'key'));
    // SDV wraps each dict value as <value><Object ...>fields</Object></value>
    const objEl  = dictVal(ch(item, 'value'));
    if (!coord || !objEl) continue;

    // Fences → path
    const objName  = txt(objEl, 'name');
    const pathType = FENCE_NAME_MAP[objName];
    if (pathType) {
      paths.push({ x: coord.x, y: coord.y, pathType });
      continue;
    }

    // Planner-relevant items (BigCraftables + sprinklers)
    const rawItemId = txt(objEl, 'itemId');
    if (!rawItemId) continue;
    const cheatId      = stripQualifier(rawItemId);
    const isBigInXml   = txt(objEl, 'bigCraftable').toLowerCase() === 'true';
    const isMatch      = isBigInXml ? plannerBcIds.has(cheatId) : plannerObjIds.has(cheatId);
    if (!isMatch) continue;

    // Iridium Sprinkler + Pressure Nozzle attachment → treat as qi-sprinkler
    // The Pressure Nozzle is stored as <heldObject> on the sprinkler Object element.
    let effectiveId = cheatId;
    if (cheatId === '645') {
      const heldObj = ch(objEl, 'heldObject');
      if (heldObj) {
        const heldName  = txt(heldObj, 'name');
        const heldId    = stripQualifier(txt(heldObj, 'itemId'));
        if (heldName === 'Pressure Nozzle' || heldId === '915') effectiveId = 'qi-sprinkler';
      }
    }

    // Crystalarium: read the gem from <heldObject>
    let gemId: string | undefined;
    if (cheatId === '21') {
      const heldObj = ch(objEl, 'heldObject');
      if (heldObj) {
        const rawHeldId = txt(heldObj, 'itemId') || txt(heldObj, 'parentSheetIndex');
        if (rawHeldId) gemId = stripQualifier(rawHeldId);
      }
    }

    items.push({ id: crypto.randomUUID(), itemId: effectiveId, x: coord.x, y: coord.y, ...(gemId ? { gemId } : {}) });
  }

  return { items, paths };
}

/**
 * Interior origin offsets: subtract these from save-file coordinates to get
 * 0-based planner coordinates.
 *
 * SDV stores interior object coordinates in full-map space. Most buildings
 * (Coop, Barn, Slime Hutch) have their Back-layer origin at (0, 0) so no
 * adjustment is needed. Sheds have a 1-tile left wall and a 4-tile
 * ceiling/roof area above the usable floor, so every object is stored 1 tile
 * too far right and 4 tiles too far down relative to the planner's (0, 0).
 */
const INTERIOR_ORIGIN: Record<string, { x: number; y: number }> = {
  'Shed':     { x: 1, y: 4 },
  'Big Shed': { x: 1, y: 4 },
};

/** Parse the interior (indoors element) of a building into an InteriorLayout. */
function parseInteriorLayout(
  indoorsEl: Element,
  plannerBcIds: Set<string>,
  plannerObjIds: Set<string>,
  buildingType: string,
  cropByHarvestId?: Map<string, Crop>,
): InteriorLayout {
  const origin = INTERIOR_ORIGIN[buildingType] ?? { x: 0, y: 0 };
  const { items, paths } = parseLocationObjects(indoorsEl, plannerBcIds, plannerObjIds);
  const trees: PlacedTree[] = [];
  const isGreenhouse = buildingType === 'Greenhouse';
  const hoeDirtByCropId = new Map<string, { cropId: string; cropName: string; seasons: Season[]; tiles: { x: number; y: number }[] }>();

  // Interior terrain features: flooring + trees (greenhouse only)
  for (const item of chs(ch(indoorsEl, 'terrainFeatures'), 'item')) {
    const coord = vecCoord(ch(item, 'key'));
    const tfEl  = dictVal(ch(item, 'value'));
    if (!coord || !tfEl) continue;

    const type = xsiType(tfEl);

    if (type === 'Flooring') {
      const floorIdx = parseInt(txt(tfEl, 'whichFloor') || '0', 10);
      const pathType = FLOOR_TO_PATH[floorIdx];
      if (pathType) paths.push({ x: coord.x, y: coord.y, pathType });
      continue;
    }

    // Wild and fruit trees — only meaningful inside the greenhouse
    if (isGreenhouse) {
      if (type === 'Tree') {
        const growthStage = parseInt(txt(tfEl, 'growthStage') || '0', 10);
        if (growthStage < 5) continue;
        const treeTypeInt = parseInt(txt(tfEl, 'treeType') || '0', 10);
        const treeType    = WILD_TREE_MAP[treeTypeInt];
        if (!treeType) continue;

        let tapper: TapperType | undefined;
        const overlaidEl = ch(tfEl, 'overlaidItem');
        if (overlaidEl) {
          const rawId = stripQualifier(txt(overlaidEl, 'itemId') || txt(overlaidEl, 'parentSheetIndex'));
          tapper = TAPPER_ITEM_IDS[rawId];
          if (!tapper) {
            const n = txt(overlaidEl, 'name');
            if (n === 'Tapper') tapper = 'tapper';
            else if (n === 'Heavy Tapper') tapper = 'heavy-tapper';
          }
        }
        trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType, ...(tapper ? { tapper } : {}) });
        continue;
      }

      if (type === 'FruitTree') {
        const growthStage = parseInt(txt(tfEl, 'growthStage') || '0', 10);
        if (growthStage < 4) continue;

        const rawTreeId = txt(tfEl, 'treeId');
        if (rawTreeId) {
          // Format A: integer sapling ID (most common in 1.6 saves)
          const saplingType = FRUIT_TREE_SAPLING_MAP[rawTreeId];
          if (saplingType) {
            trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType: saplingType });
            continue;
          }
          // Format B: string "(FT)cherry"
          const withoutPrefix = rawTreeId.replace(/^\(FT\)/i, '').toLowerCase() as TreeType;
          const VALID_FRUIT_TYPES: TreeType[] = ['cherry', 'apricot', 'orange', 'peach', 'pomegranate', 'apple', 'banana', 'mango'];
          if (VALID_FRUIT_TYPES.includes(withoutPrefix)) {
            trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType: withoutPrefix });
            continue;
          }
        }
        // Format C: older saves — <indexOfFruit> (fruit item ID) with no <treeId>
        const rawItemId = txt(tfEl, 'indexOfFruit') || txt(tfEl, 'itemId');
        const cheatId   = rawItemId ? stripQualifier(rawItemId) : '';
        const treeType  = FRUIT_TREE_CHEAT_MAP[cheatId];
        if (treeType) trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType });
        continue;
      }

      // HoeDirt with an active crop → group for CropZone creation (greenhouse only)
      if (type === 'HoeDirt' && isGreenhouse && cropByHarvestId) {
        const cropEl = ch(tfEl, 'crop');
        if (!cropEl) continue;
        const harvestId = txt(cropEl, 'indexOfHarvest');
        if (!harvestId || harvestId === '-1' || harvestId === '0') continue;
        const cropDef = cropByHarvestId.get(harvestId);
        if (!cropDef) continue;

        const existing = hoeDirtByCropId.get(cropDef.id);
        if (existing) {
          existing.tiles.push({ x: coord.x, y: coord.y });
        } else {
          hoeDirtByCropId.set(cropDef.id, {
            cropId:   cropDef.id,
            cropName: cropDef.name,
            seasons:  cropDef.seasons,
            tiles:    [{ x: coord.x, y: coord.y }],
          });
        }
        continue;
      }
    }
  }

  // Garden pots (IndoorPot = BC 62) with planted crops → CropZones for any interior
  if (cropByHarvestId) {
    for (const item of chs(ch(indoorsEl, 'objects'), 'item')) {
      const coord = vecCoord(ch(item, 'key'));
      const objEl = dictVal(ch(item, 'value'));
      if (!coord || !objEl) continue;

      // Identify as IndoorPot by xsi:type or itemId
      const rawItemId = txt(objEl, 'itemId');
      if (!rawItemId) continue;
      const isIndoorPot = stripQualifier(rawItemId) === '62' || xsiType(objEl) === 'IndoorPot';
      if (!isIndoorPot) continue;

      // Navigate: <hoeDirt> (SDV 1.6 field name) or <soil> (older name)
      const hoeDirtWrapper = ch(objEl, 'hoeDirt') ?? ch(objEl, 'soil');
      if (!hoeDirtWrapper) continue;
      // The wrapper may contain a <HoeDirt> child element, or be the HoeDirt itself
      const hoeDirtEl = hoeDirtWrapper.firstElementChild ?? hoeDirtWrapper;

      const cropEl = ch(hoeDirtEl, 'crop');
      if (!cropEl) continue;
      const harvestId = txt(cropEl, 'indexOfHarvest');
      if (!harvestId || harvestId === '-1' || harvestId === '0') continue;
      const cropDef = cropByHarvestId.get(harvestId);
      if (!cropDef) continue;

      const existing = hoeDirtByCropId.get(cropDef.id);
      if (existing) {
        existing.tiles.push({ x: coord.x, y: coord.y });
      } else {
        hoeDirtByCropId.set(cropDef.id, {
          cropId:   cropDef.id,
          cropName: cropDef.name,
          seasons:  cropDef.seasons,
          tiles:    [{ x: coord.x, y: coord.y }],
        });
      }
    }
  }

  // Convert grouped HoeDirt / IndoorPot tiles into CropZones
  const zones: CropZone[] = [];
  for (const { cropId, cropName, seasons: cropSeasons, tiles } of hoeDirtByCropId.values()) {
    const crops: Partial<Record<Season, string>> = {};
    for (const s of cropSeasons) crops[s] = cropId;
    zones.push({
      id:    crypto.randomUUID(),
      name:  cropName,
      rects: tiles.map(t => ({ x: t.x - origin.x, y: t.y - origin.y, w: 1, h: 1 })),
      crops,
    });
  }

  // Translate save-file map-space coordinates → 0-based planner coordinates
  const ox = origin.x;
  const oy = origin.y;

  const result: InteriorLayout = {
    items: items.map(i => ({ ...i, x: i.x - ox, y: i.y - oy })),
    paths: paths.map(p => ({ ...p, x: p.x - ox, y: p.y - oy })),
  };
  if (trees.length > 0) {
    result.trees = trees.map(t => ({ ...t, x: t.x - ox, y: t.y - oy }));
  }
  if (zones.length > 0) {
    result.zones = zones;
  }
  return result;
}

function parseLayout(
  root: Element,
  locationType: string,
  gameData: GameData,
  season: Season,
  staticBuildings: PlacedBuilding[],
  _warnings: string[],
): FarmLayout {
  const loc = findLocation(root, locationType);
  if (!loc) return { ...DEFAULT_FARM_LAYOUT, season, buildings: staticBuildings };

  const validBuildingIds = new Set(gameData.buildingDefs.map(b => b.id));

  // Two separate sets for planner-relevant items, kept apart to avoid ID collisions:
  //   plannerBcIds  — BigCraftable cheatIds (e.g. "25" = Seed Maker)
  //   plannerObjIds — regular Object cheatIds that we still want (sprinklers 599/621/645)
  // We confirm each XML object against its <bigCraftable> flag before including it,
  // so a Stone (itemId 25, bigCraftable=false) is never mistaken for a Seed Maker.
  const plannerBcIds = new Set(
    gameData.items.filter(i => i.isBigCraftable).map(i => i.cheatId),
  );
  const plannerObjIds = new Set(['599', '621', '645']);

  // Map from harvest item cheatId → Crop (for HoeDirt → CropZone grouping)
  const cropByHarvestId = new Map(gameData.crops.map(c => [c.harvestItemId, c]));

  // ── Buildings ──────────────────────────────────────────────────────────────
  const userBuildings: PlacedBuilding[] = [];
  const interiors: Record<string, InteriorLayout> = {};
  let greenhouseRepaired = false;

  // Build mutable copies of seeded statics so we can update their positions from XML.
  // Pet Bowl is handled separately because there can be multiple (extra pet bowls from mods
  // or multiple saves with additional pets).
  const staticByType = new Map<string, PlacedBuilding>();
  const petBowlSeeds: PlacedBuilding[] = [];
  for (const sb of staticBuildings) {
    if (sb.buildingId === 'Pet Bowl') {
      petBowlSeeds.push({ ...sb });
    } else {
      staticByType.set(sb.buildingId, { ...sb });
    }
  }
  const petBowlsFromXml: PlacedBuilding[] = [];

  for (const bEl of chs(ch(loc, 'buildings'), 'Building').concat(
    Array.from(ch(loc, 'buildings')?.children ?? []).filter(
      c => c.tagName !== 'Building' && c.tagName.endsWith('ing'),
    ),
  )) {
    // buildingType is the canonical name in 1.6; xsi:type is a fallback
    const buildingType = txt(bEl, 'buildingType') || xsiType(bEl);
    if (!buildingType) continue;

    const tileX = parseInt(txt(bEl, 'tileX') || '0', 10);
    const tileY = parseInt(txt(bEl, 'tileY') || '0', 10);

    if (buildingType === 'Greenhouse') {
      // Greenhouse interior lives in a separate GameLocation; position from XML.
      greenhouseRepaired = true;
      const s = staticByType.get('Greenhouse');
      if (s) { s.x = tileX; s.y = tileY; }
      continue;
    }

    if (buildingType === 'Pet Bowl') {
      // May have multiple: update seeds in order, then create extras.
      const idx = petBowlsFromXml.length;
      const seed = petBowlSeeds[idx];
      if (seed) {
        petBowlsFromXml.push({ ...seed, x: tileX, y: tileY });
      } else {
        petBowlsFromXml.push({
          id: crypto.randomUUID(), buildingId: 'Pet Bowl',
          x: tileX, y: tileY, isStatic: true,
        });
      }
      continue;
    }

    if (STATIC_BUILDING_IDS.has(buildingType)) {
      // Farmhouse, Shipping Bin, Island Farmhouse — update seeded position from XML.
      const s = staticByType.get(buildingType);
      if (s) { s.x = tileX; s.y = tileY; }
      continue;
    }

    if (!validBuildingIds.has(buildingType)) continue;

    // Fish Pond: read which fish species occupies the pond.
    // Save format: <fishType><int>149</int></fishType> (old) or <fishType><itemId>(O)149</itemId></fishType> (new)
    let fishId: string | undefined;
    if (buildingType === 'Fish Pond') {
      const fishTypeEl = ch(bEl, 'fishType');
      const rawFishId  = deep(fishTypeEl, 'itemId') || txt(fishTypeEl, 'int');
      if (rawFishId && rawFishId !== '-1') fishId = stripQualifier(rawFishId);
    }

    const id = crypto.randomUUID();
    userBuildings.push({ id, buildingId: buildingType, x: tileX, y: tileY, ...(fishId ? { fishId } : {}) });

    // Parse indoor contents (Shed, Barn, Coop, etc.)
    const indoorsEl = ch(bEl, 'indoors');
    if (indoorsEl) {
      const interior = parseInteriorLayout(indoorsEl, plannerBcIds, plannerObjIds, buildingType, cropByHarvestId);
      if (
        interior.items.length > 0 ||
        interior.paths.length > 0 ||
        (interior.zones?.length ?? 0) > 0
      ) {
        interiors[id] = interior;
      }
    }
  }

  // If no Pet Bowls were found in the XML, fall back to the seeded defaults.
  const effectivePetBowls = petBowlsFromXml.length > 0 ? petBowlsFromXml : petBowlSeeds;
  const updatedStatics: PlacedBuilding[] = [
    ...Array.from(staticByType.values()),
    ...effectivePetBowls,
  ];

  const buildings: PlacedBuilding[] = [
    ...updatedStatics.map(b =>
      b.buildingId === 'Greenhouse' ? { ...b, repaired: greenhouseRepaired } : b,
    ),
    ...userBuildings,
  ];

  // ── Greenhouse interior: lives in its own GameLocation, not a building indoors ──
  // The Greenhouse building element has no <indoors>; instead the game stores all
  // interior objects/terrain-features in a standalone <Greenhouse> location inside
  // <locations>.  We reuse parseInteriorLayout (which handles objects + flooring)
  // with no coordinate offset (greenhouse uses 0-based coordinates directly).
  const ghStaticBuilding = updatedStatics.find(b => b.buildingId === 'Greenhouse');
  if (ghStaticBuilding) {
    const ghLoc = findLocation(root, 'Greenhouse');
    if (ghLoc) {
      const ghInterior = parseInteriorLayout(ghLoc, plannerBcIds, plannerObjIds, 'Greenhouse', cropByHarvestId);
      if (
        ghInterior.items.length > 0 ||
        ghInterior.paths.length > 0 ||
        (ghInterior.trees?.length ?? 0) > 0 ||
        (ghInterior.zones?.length ?? 0) > 0
      ) {
        interiors[ghStaticBuilding.id] = ghInterior;
      }
    }
  }

  // ── Pre-scan objects to locate tappers ───────────────────────────────────
  // In many SDV saves the Tapper/Heavy Tapper is stored as an ordinary Object in
  // the location's objects dictionary, co-located with the tapped tree, rather
  // than as overlaidItem on the TerrainFeature.  Build a tile → TapperType map
  // now so the tree loop below can look it up.
  const tapperAtTile = new Map<string, TapperType>();
  for (const objItem of chs(ch(loc, 'objects'), 'item')) {
    const coord = vecCoord(ch(objItem, 'key'));
    const objEl = dictVal(ch(objItem, 'value'));
    if (!coord || !objEl) continue;

    // Primary: check name (stable across all save formats)
    const objName = txt(objEl, 'name');
    if (objName === 'Tapper') {
      tapperAtTile.set(`${coord.x},${coord.y}`, 'tapper');
    } else if (objName === 'Heavy Tapper') {
      tapperAtTile.set(`${coord.x},${coord.y}`, 'heavy-tapper');
    } else {
      // Fallback: itemId (with or without "(BC)" qualifier) or parentSheetIndex
      const rawId = stripQualifier(txt(objEl, 'itemId') || txt(objEl, 'parentSheetIndex'));
      const t = TAPPER_ITEM_IDS[rawId];
      if (t) tapperAtTile.set(`${coord.x},${coord.y}`, t);
    }
  }

  // ── Terrain features: flooring + trees + HoeDirt crops ────────────────────
  const paths: PlacedPath[] = [];
  const trees: PlacedTree[]  = [];
  // Accumulate HoeDirt tile coords grouped by crop ID
  const hoeDirtByCropId = new Map<string, { cropId: string; seasons: Season[]; tiles: { x: number; y: number }[] }>();
  const terrainFeaturesEl = ch(loc, 'terrainFeatures');

  if (terrainFeaturesEl) {
    for (const item of chs(terrainFeaturesEl, 'item')) {
      const coord = vecCoord(ch(item, 'key'));
      // SDV wraps each dict value as <value><TerrainFeature xsi:type="...">fields</TerrainFeature></value>
      const tfEl  = dictVal(ch(item, 'value'));
      if (!coord || !tfEl) continue;

      const type = xsiType(tfEl);

      // Flooring → path
      if (type === 'Flooring') {
        const floorIdx = parseInt(txt(tfEl, 'whichFloor') || '0', 10);
        const pathType = FLOOR_TO_PATH[floorIdx];
        if (pathType) paths.push({ x: coord.x, y: coord.y, pathType });
        continue;
      }

      // Wild tree (fully grown: stage 5)
      if (type === 'Tree') {
        const growthStage = parseInt(txt(tfEl, 'growthStage') || '0', 10);
        if (growthStage < 5) continue;
        const treeTypeInt = parseInt(txt(tfEl, 'treeType') || '0', 10);
        const treeType    = WILD_TREE_MAP[treeTypeInt];
        if (!treeType) continue;

        // Tapper detection: try overlaidItem on the tree element first (newer saves),
        // then fall back to the pre-scanned objects map (older/alternative format).
        let tapper: TapperType | undefined;
        const overlaidEl = ch(tfEl, 'overlaidItem');
        if (overlaidEl) {
          const rawId  = stripQualifier(txt(overlaidEl, 'itemId') || txt(overlaidEl, 'parentSheetIndex'));
          tapper = TAPPER_ITEM_IDS[rawId];
          if (!tapper) {
            const n = txt(overlaidEl, 'name');
            if (n === 'Tapper') tapper = 'tapper';
            else if (n === 'Heavy Tapper') tapper = 'heavy-tapper';
          }
        }
        if (!tapper) tapper = tapperAtTile.get(`${coord.x},${coord.y}`);

        trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType, ...(tapper ? { tapper } : {}) });
        continue;
      }

      // Fruit tree (mature: stage 4)
      if (type === 'FruitTree') {
        const growthStage = parseInt(txt(tfEl, 'growthStage') || '0', 10);
        if (growthStage < 4) continue;

        const rawTreeId = txt(tfEl, 'treeId');
        if (rawTreeId) {
          // Format A: integer sapling ID — most common in 1.6 saves (e.g. "632" = Pomegranate Sapling)
          const saplingType = FRUIT_TREE_SAPLING_MAP[rawTreeId];
          if (saplingType) {
            trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType: saplingType });
            continue;
          }
          // Format B: string "(FT)cherry" — future-proof string form
          const withoutPrefix = rawTreeId.replace(/^\(FT\)/i, '').toLowerCase() as TreeType;
          const VALID_FRUIT_TYPES: TreeType[] = ['cherry', 'apricot', 'orange', 'peach', 'pomegranate', 'apple', 'banana', 'mango'];
          if (VALID_FRUIT_TYPES.includes(withoutPrefix)) {
            trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType: withoutPrefix });
            continue;
          }
        }
        // Format C: older saves use <indexOfFruit> (fruit item ID) with no <treeId>
        const rawItemId = txt(tfEl, 'indexOfFruit') || txt(tfEl, 'itemId');
        const cheatId   = rawItemId ? stripQualifier(rawItemId) : '';
        const treeType  = FRUIT_TREE_CHEAT_MAP[cheatId];
        if (treeType) trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType });
        continue;
      }

      // HoeDirt with an active crop → group for CropZone creation
      if (type === 'HoeDirt') {
        const cropEl = ch(tfEl, 'crop');
        if (!cropEl) continue;
        const harvestId = txt(cropEl, 'indexOfHarvest');
        if (!harvestId || harvestId === '-1' || harvestId === '0') continue;
        const cropDef = cropByHarvestId.get(harvestId);
        if (!cropDef) continue;

        const existing = hoeDirtByCropId.get(cropDef.id);
        if (existing) {
          existing.tiles.push({ x: coord.x, y: coord.y });
        } else {
          hoeDirtByCropId.set(cropDef.id, {
            cropId:  cropDef.id,
            seasons: cropDef.seasons,
            tiles:   [{ x: coord.x, y: coord.y }],
          });
        }
        continue;
      }
    }
  }

  // Convert grouped HoeDirt tiles into CropZones (one zone per unique crop type)
  const zones: CropZone[] = [];
  for (const { cropId, seasons: cropSeasons, tiles } of hoeDirtByCropId.values()) {
    const cropDef = gameData.crops.find(c => c.id === cropId);
    const crops: Partial<Record<Season, string>> = {};
    for (const s of cropSeasons) crops[s] = cropId;
    zones.push({
      id:    crypto.randomUUID(),
      name:  cropDef?.name ?? cropId,
      rects: tiles.map(t => ({ x: t.x, y: t.y, w: 1, h: 1 })),
      crops,
    });
  }

  // ── Objects: fences + planner items ───────────────────────────────────────
  const { items, paths: objPaths } = parseLocationObjects(loc, plannerBcIds, plannerObjIds);
  paths.push(...objPaths);

  return {
    season,
    zones,
    buildings,
    paths,
    items,
    trees,
    interiors,
  };
}
