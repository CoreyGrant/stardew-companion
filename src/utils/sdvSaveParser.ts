/**
 * Stardew Valley 1.6 save file parser.
 *
 * Accepts the raw XML text of a SDV save file (the extension-less file inside
 * the save folder) and returns a partial SaveFile ready for createSave().
 *
 * All processing is synchronous on the main thread; callers should show a
 * loading indicator before invoking and hide it afterwards.
 */

import type { GameData } from '../types/game';
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
  TreeType,
} from '../types/save';
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

/** SDV wild Tree.treeType integer → our TreeType */
const WILD_TREE_MAP: Record<number, TreeType> = {
  1: 'oak',
  2: 'maple',
  3: 'pine',
  7: 'mushroom',
  8: 'mahogany',
  9: 'magic',
};

/** SDV FruitTree fruit item cheatId → our TreeType */
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

  // 9. NPC heart levels ───────────────────────────────────────────────────────
  const heartLevels = parseFriendship(player, gameData);

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

  const bundlesEl = ch(cc, 'bundles');
  if (!bundlesEl) return result;

  for (const item of chs(bundlesEl, 'item')) {
    const sdvId  = parseInt(deep(item, 'key', 'int') || '-1', 10);
    if (sdvId < 0) continue;

    const ourId    = SDV_BUNDLE_ID_MAP[sdvId];
    if (!ourId) continue;

    const ourBundle = bundleById.get(ourId);
    if (!ourBundle) continue;

    const arrayOfBool = ch(ch(item, 'value'), 'ArrayOfBoolean');
    if (!arrayOfBool) continue;

    const slots = chs(arrayOfBool, 'boolean').map(
      el => el.textContent?.trim().toLowerCase() === 'true',
    );

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

/** Parse objects from a location element into planner items and fence paths. */
function parseLocationObjects(
  locEl: Element,
  plannerItemCheatIds: Set<string>,
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
    const cheatId = stripQualifier(rawItemId);
    if (plannerItemCheatIds.has(cheatId)) {
      items.push({ id: crypto.randomUUID(), itemId: cheatId, x: coord.x, y: coord.y });
    }
  }

  return { items, paths };
}

/** Parse the interior (indoors element) of a building into an InteriorLayout. */
function parseInteriorLayout(
  indoorsEl: Element,
  plannerItemCheatIds: Set<string>,
): InteriorLayout {
  const { items, paths } = parseLocationObjects(indoorsEl, plannerItemCheatIds);

  // Interior flooring
  for (const item of chs(ch(indoorsEl, 'terrainFeatures'), 'item')) {
    const coord = vecCoord(ch(item, 'key'));
    // SDV wraps each dict value as <value><TerrainFeature xsi:type="...">
    const tfEl  = dictVal(ch(item, 'value'));
    if (!coord || !tfEl) continue;
    if (xsiType(tfEl) === 'Flooring') {
      const floorIdx = parseInt(txt(tfEl, 'whichFloor') || '0', 10);
      const pathType = FLOOR_TO_PATH[floorIdx];
      if (pathType) paths.push({ x: coord.x, y: coord.y, pathType });
    }
  }

  return { items, paths };
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

  // Set of cheatIds we want to add as PlacedItems:
  //   - All curated BigCraftables (isBigCraftable: true in our data)
  //   - Sprinklers (regular objects, cheatIds 599/621/645)
  const plannerItemCheatIds = new Set(
    gameData.items
      .filter(i => i.isBigCraftable || ['599', '621', '645'].includes(i.cheatId))
      .map(i => i.cheatId),
  );

  // Map from harvest item cheatId → Crop (for HoeDirt → CropZone grouping)
  const cropByHarvestId = new Map(gameData.crops.map(c => [c.harvestItemId, c]));

  // ── Buildings ──────────────────────────────────────────────────────────────
  const userBuildings: PlacedBuilding[] = [];
  const interiors: Record<string, InteriorLayout> = {};
  let greenhouseRepaired = false;

  for (const bEl of chs(ch(loc, 'buildings'), 'Building').concat(
    Array.from(ch(loc, 'buildings')?.children ?? []).filter(
      c => c.tagName !== 'Building' && c.tagName.endsWith('ing'),
    ),
  )) {
    // buildingType is the canonical name in 1.6; xsi:type is a fallback
    const buildingType = txt(bEl, 'buildingType') || xsiType(bEl);
    if (!buildingType) continue;

    if (buildingType === 'Greenhouse') { greenhouseRepaired = true; continue; }
    if (STATIC_BUILDING_IDS.has(buildingType)) continue;
    if (!validBuildingIds.has(buildingType))    continue;

    const x   = parseInt(txt(bEl, 'tileX') || '0', 10);
    const y   = parseInt(txt(bEl, 'tileY') || '0', 10);
    const id  = crypto.randomUUID();
    userBuildings.push({ id, buildingId: buildingType, x, y });

    // Parse indoor contents (Shed, Barn, Coop, etc.)
    const indoorsEl = ch(bEl, 'indoors');
    if (indoorsEl) {
      const interior = parseInteriorLayout(indoorsEl, plannerItemCheatIds);
      if (interior.items.length > 0 || interior.paths.length > 0) {
        interiors[id] = interior;
      }
    }
  }

  const buildings: PlacedBuilding[] = [
    ...staticBuildings.map(b =>
      b.buildingId === 'Greenhouse' ? { ...b, repaired: greenhouseRepaired } : b,
    ),
    ...userBuildings,
  ];

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
        if (treeType) trees.push({ id: crypto.randomUUID(), x: coord.x, y: coord.y, treeType });
        continue;
      }

      // Fruit tree (mature: stage 4)
      if (type === 'FruitTree') {
        const growthStage = parseInt(txt(tfEl, 'growthStage') || '0', 10);
        if (growthStage < 4) continue;
        // 1.6 stores the fruit item's qualified ID in <itemId>
        const rawItemId = txt(tfEl, 'itemId');
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
  const { items, paths: objPaths } = parseLocationObjects(loc, plannerItemCheatIds);
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
