/**
 * extract-gamedata.mjs
 *
 * Reads Stardew Valley's unpacked game content and rebuilds public/gamedata.json.
 * Run:  node scripts/extract-gamedata.mjs
 * Env:  STARDEW_CONTENT  (default: Steam install path)
 *
 * Strategy
 * ─────────
 * • Items         → Objects.json (game-authoritative) + selected BigCraftables
 * • Gift tastes   → NPCGiftTastes.json
 * • Farm layouts  → per-tile tileData from Maps/Farm*.tmx
 * • Building defs → Data/Buildings.json + PNG dimensions
 * • Sprites       → copied to public/sprites/ (springobjects, Objects_2, Craftables, buildings)
 * • Crops         → Data/Crops.json (50 entries → ~44 real crops)
 * • NPCs, quests, bundles → preserved from existing gamedata.json
 *
 * Mod support: pass --mods to apply Content Patcher EditData patches.
 */

import {
  readFileSync, writeFileSync, existsSync, readdirSync,
  mkdirSync, copyFileSync, openSync, readSync, closeSync,
} from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { XMLParser } from 'fast-xml-parser';

// ── Paths ─────────────────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '..');

const STARDEW_CONTENT = (
  process.env.STARDEW_CONTENT ??
  'C:/Program Files (x86)/Steam/steamapps/common/Stardew Valley/Content (unpacked)'
).replace(/\\/g, '/');

const DATA_DIR      = join(STARDEW_CONTENT, 'Data');
const MAPS_DIR      = join(STARDEW_CONTENT, 'Maps');
const TILESHEETS    = join(STARDEW_CONTENT, 'TileSheets');
const BUILDINGS_DIR = join(STARDEW_CONTENT, 'Buildings');
const MODS_DIR      = join(STARDEW_CONTENT, '..', 'Mods');
const OUT_FILE      = join(ROOT, 'public', 'gamedata.json');
const SPRITES_DIR   = join(ROOT, 'public', 'sprites');

const APPLY_MODS = process.argv.includes('--mods');

// ── Localized string maps ─────────────────────────────────────────────────────

const STRINGS_DIR = join(STARDEW_CONTENT, 'Strings');

function loadStrings(file) {
  const p = join(STRINGS_DIR, file);
  if (!existsSync(p)) return {};
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Resolve a [LocalizedText Strings\Namespace:Key] token to its English string. */
const _stringsCache = {};
function resolveLocalizedText(token) {
  if (typeof token !== 'string' || !token.startsWith('[')) return token;
  const inner = token.slice(1, token.length - 1); // strip [ ]
  const colonIdx = inner.indexOf(':');
  if (colonIdx === -1) return '';
  const nsPath = inner.slice('LocalizedText '.length, colonIdx); // e.g. "Strings\Objects"
  const key    = inner.slice(colonIdx + 1);                       // e.g. "Parsnip_Description"
  const file   = nsPath.replace(/.*[/\\]/, '') + '.json';        // "Objects.json"
  if (!_stringsCache[file]) _stringsCache[file] = loadStrings(file);
  return _stringsCache[file][key] ?? '';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readData(file) {
  const p = join(DATA_DIR, file);
  if (!existsSync(p)) throw new Error(`Missing game data file: ${p}`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

function readMap(file) {
  const p = join(MAPS_DIR, file);
  if (!existsSync(p)) throw new Error(`Missing map file: ${p}`);
  return readFileSync(p, 'utf8');
}

/** Convert a game name to kebab-case id. */
function toId(name) {
  return name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Read only the width/height from a PNG header (no external deps). */
function readPNGSize(filePath) {
  const buf = Buffer.allocUnsafe(24);
  const fd  = openSync(filePath, 'r');
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// ── Sprite Copy (Phase 2) ─────────────────────────────────────────────────────

const TERRAIN_DIR  = join(STARDEW_CONTENT, 'TerrainFeatures');
const PORTRAITS_DIR = join(STARDEW_CONTENT, 'Portraits');
const SCHEDULES_DIR = join(STARDEW_CONTENT, 'Characters', 'schedules');

const TREE_SPRITES = [
  { file: 'tree1_spring.png', key: 'oak',       cols: 9, rows: 10 },
  { file: 'tree2_spring.png', key: 'maple',      cols: 9, rows: 10 },
  { file: 'tree3_spring.png', key: 'pine',       cols: 9, rows: 10 },
  { file: 'tree8_spring.png', key: 'mahogany',   cols: 3, rows: 10 },
  { file: 'mushroom_tree.png',key: 'mushroom',   cols: 9, rows: 10 },
  { file: 'mystic_tree.png',  key: 'magic',      cols: 3, rows: 10 },
];

// fruitTrees.png: 432×720px, 27 cols × 45 rows (16px cells)
// Each fruit tree type occupies 5 rows (80px) starting at TextureSpriteRow * 5.
// iconY = row * 5 * 16 puts us at the top of that tree's band.
// iconX = 0 shows the first growth stage (sprout); col 4 (iconX=64) = mature trunk.
const FRUIT_TREE_DEFS = [
  { key: 'cherry',      name: 'Cherry Tree',      spriteRow: 0 },
  { key: 'apricot',     name: 'Apricot Tree',     spriteRow: 1 },
  { key: 'orange',      name: 'Orange Tree',      spriteRow: 2 },
  { key: 'peach',       name: 'Peach Tree',       spriteRow: 3 },
  { key: 'pomegranate', name: 'Pomegranate Tree', spriteRow: 4 },
  { key: 'apple',       name: 'Apple Tree',       spriteRow: 5 },
  { key: 'banana',      name: 'Banana Tree',      spriteRow: 7 },
  { key: 'mango',       name: 'Mango Tree',       spriteRow: 8 },
];

function copySprites() {
  mkdirSync(join(SPRITES_DIR, 'buildings'),  { recursive: true });
  mkdirSync(join(SPRITES_DIR, 'trees'),      { recursive: true });
  mkdirSync(join(SPRITES_DIR, 'portraits'),  { recursive: true });

  // Spritesheets
  const sheets = [
    [join(MAPS_DIR,   'springobjects.png'), join(SPRITES_DIR, 'springobjects.png')],
    [join(TILESHEETS, 'Objects_2.png'),     join(SPRITES_DIR, 'Objects_2.png')],
    [join(TILESHEETS, 'Craftables.png'),    join(SPRITES_DIR, 'Craftables.png')],
    [join(TERRAIN_DIR, 'Flooring.png'),     join(SPRITES_DIR, 'Flooring.png')],
  ];
  for (const [src, dst] of sheets) {
    if (existsSync(src)) {
      copyFileSync(src, dst);
      process.stdout.write(`  ${src.split('/').pop()}  `);
    }
  }

  // Crop tilesheet
  const cropsSrc = join(TILESHEETS, 'crops.png');
  if (existsSync(cropsSrc)) {
    copyFileSync(cropsSrc, join(SPRITES_DIR, 'crops.png'));
    process.stdout.write('crops.png  ');
  }

  // Building PNGs (skip paint masks)
  const bFiles = readdirSync(BUILDINGS_DIR)
    .filter(f => f.endsWith('.png') && !f.includes('_PaintMask'));
  for (const f of bFiles) {
    copyFileSync(join(BUILDINGS_DIR, f), join(SPRITES_DIR, 'buildings', f.replace(/ /g, '_')));
  }
  console.log(`\n  ${bFiles.length} building sprites`);

  // Wild tree sprites
  for (const { file } of TREE_SPRITES) {
    const src = join(TERRAIN_DIR, file);
    if (existsSync(src)) copyFileSync(src, join(SPRITES_DIR, 'trees', file));
  }
  // Fruit tree spritesheet
  const fruitSrc = join(TILESHEETS, 'fruitTrees.png');
  if (existsSync(fruitSrc)) copyFileSync(fruitSrc, join(SPRITES_DIR, 'trees', 'fruitTrees.png'));
  console.log(`  ${TREE_SPRITES.length} wild + ${FRUIT_TREE_DEFS.length} fruit tree sprites`);

  // Portrait PNGs — main only (skip _Beach/_Winter variants)
  let portraitCount = 0;
  if (existsSync(PORTRAITS_DIR)) {
    for (const f of readdirSync(PORTRAITS_DIR)) {
      if (!f.endsWith('.png') || f.includes('_')) continue;
      copyFileSync(join(PORTRAITS_DIR, f), join(SPRITES_DIR, 'portraits', f));
      portraitCount++;
    }
  }
  console.log(`  ${portraitCount} portrait sprites`);
}

// ── Farm Layout Extraction ────────────────────────────────────────────────────

/**
 * @param {string} tmxXml
 * @param {{ skipWaterExpansion?: boolean }} [options]
 */
function parseFarmTileData(tmxXml, options = {}) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    isArray: name => ['tileset', 'tile', 'layer', 'objectgroup', 'object', 'property', 'properties'].includes(name),
    textNodeName: '_text',
    parseAttributeValue: false,
    trimValues: true,
  });

  const doc  = parser.parse(tmxXml);
  const mapEl = doc.map;
  const W = parseInt(mapEl['@width'],  10);
  const H = parseInt(mapEl['@height'], 10);

  const gidZone        = new Map();
  const gidPassable    = new Map(); // true = Buildings-layer tile is walkable (bridge plank etc.)
  const gidBuildable   = new Map(); // true = Back-layer tile accepts Robin buildings (buildable:t/true)
  const gidTreePlant   = new Map(); // true = Back-layer tile accepts fruit/wild tree planting

  for (const ts of mapEl.tileset ?? []) {
    const firstgid  = parseInt(ts['@firstgid'], 10);
    const tilecount = parseInt(ts['@tilecount'] ?? '64', 10);
    const tsName    = (ts['@name'] ?? '').toLowerCase();

    if (tsName === 'paths') {
      for (let i = 0; i < tilecount; i++) gidZone.set(firstgid + i, 'p');
    }

    for (const tile of ts.tile ?? []) {
      const gid  = firstgid + parseInt(tile['@id'], 10);
      const list = tile.properties?.[0]?.property ?? [];
      const props = {};
      for (const p of Array.isArray(list) ? list : [list]) {
        props[(p['@name'] ?? '').toLowerCase()] = (p['@value'] ?? '').toLowerCase();
      }

      const water         = props.water         === 't' || props.water         === 'true';
      const passableF     = props.passable       === 'f' || props.passable       === 'false';
      const stone         = props.type           === 'stone';
      const isGrass       = props.type           === 'grass';
      const isDirt        = props.type           === 'dirt';
      const isWood        = props.type           === 'wood';
      const diggable      = props.diggable       === 't' || props.diggable       === 'true';
      const noSprinklers  = props.nosprinklers   === 't' || props.nosprinklers   === 'true';
      const buildable     = props.buildable      === 't' || props.buildable      === 'true';
      const canPlantTrees = props.canplanttrees  === 't' || props.canplanttrees  === 'true';

      // Zone classification — order matters: nosprinklers must come before isDirt/diggable
      // since sandy beach tiles have both nosprinklers:t and type:dirt.
      let zone;
      if (water)                   zone = 'w';
      else if (passableF || stone) zone = 'i';
      else if (isGrass)            zone = 'g';
      else if (noSprinklers)       zone = 's'; // sandy soil — diggable but no sprinklers
      else if (diggable || isDirt) zone = 'f';
      else if (isWood)             zone = 'g'; // wooden surface — walkable, non-farmable
      // buildable-only or fully unclassified tiles → 'g' via the default below

      if (zone) gidZone.set(gid, zone);
      if (props.passable === 't' || props.passable === 'true') gidPassable.set(gid, true);
      if (buildable)     gidBuildable.set(gid, true);
      if (canPlantTrees) gidTreePlant.set(gid, true);
    }
  }

  const backLayer = (mapEl.layer ?? []).find(l => l['@name'] === 'Back');
  if (!backLayer) throw new Error('Farm TMX has no Back layer');

  const dataEl = Array.isArray(backLayer.data) ? backLayer.data[0] : backLayer.data;
  const csvRaw = (typeof dataEl === 'string' ? dataEl : dataEl?._text ?? '').trim();
  const gids   = csvRaw.split(/[\s,]+/).filter(Boolean).map(Number);

  if (gids.length !== W * H) {
    console.warn(`    ⚠ Expected ${W * H} tiles, got ${gids.length}`);
  }

  const tileDataArr    = [];
  const buildableArr   = [];
  const treePlantArr   = [];
  for (const gid of gids) {
    tileDataArr.push(gid === 0 ? 'i' : (gidZone.get(gid) ?? 'g'));
    buildableArr.push(gidBuildable.has(gid) ? '1' : '0');
    treePlantArr.push(gidTreePlant.has(gid) ? '1' : '0');
  }

  // Expand water into adjacent impassable tiles (shore tiles misclassified as 'i').
  // Track which tiles are promoted so we can protect them from the Buildings override —
  // shore tiles that become 'w' here should stay water; original 'w' tiles (bridges,
  // which have water:t in the Back layer) should be overrideable by Buildings.
  // Island maps have fully explicit water classification, so we skip this pass there.
  const promotedToWater = new Set();
  if (!options.skipWaterExpansion) {
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let idx = 0; idx < tileDataArr.length; idx++) {
        if (tileDataArr[idx] !== 'i') continue;
        const cx = idx % W, cy = Math.floor(idx / W);
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          if (tileDataArr[ny * W + nx] === 'w') {
            tileDataArr[idx] = 'w';
            promotedToWater.add(idx);
            changed = true;
            break;
          }
        }
      }
      if (!changed) break;
    }
  }

  // Override with Buildings layer.
  // For Back='w' tiles: only override if the Buildings tile is explicitly passable
  // (e.g. bridge planks with passable=t). Decorative rock/cliff tiles over water
  // (empty props) should leave the water visible — they are pond/shore borders.
  // For all other Back tiles: always override.
  const buildingsLayer = (mapEl.layer ?? []).find(l => l['@name'] === 'Buildings');
  if (buildingsLayer) {
    const bDataEl = Array.isArray(buildingsLayer.data) ? buildingsLayer.data[0] : buildingsLayer.data;
    const bCsvRaw = (typeof bDataEl === 'string' ? bDataEl : bDataEl?._text ?? '').trim();
    const bGids   = bCsvRaw.split(/[\s,]+/).filter(Boolean).map(Number);
    for (let i = 0; i < bGids.length && i < tileDataArr.length; i++) {
      if (bGids[i] === 0) continue;
      if (tileDataArr[i] === 'w' && !gidPassable.get(bGids[i])) continue;
      tileDataArr[i] = (tileDataArr[i] === 'w' && gidPassable.get(bGids[i])) ? 'r' : 'b';
    }
  }

  return {
    width: W, height: H,
    tileData:     tileDataArr.join(''),
    buildableData: buildableArr.join(''),
    treePlantData: treePlantArr.join(''),
  };
}

const FARM_MAPS = [
  { id: 'standard',     file: 'Farm.tmx' },
  { id: 'riverland',    file: 'Farm_Fishing.tmx' },
  { id: 'forest',       file: 'Farm_Foraging.tmx' },
  { id: 'hilltop',      file: 'Farm_Mining.tmx' },
  { id: 'wilderness',   file: 'Farm_Combat.tmx' },
  { id: 'beach',        file: 'Farm_Island.tmx' },
  { id: 'four-corners', file: 'Farm_FourCorners.tmx' },
  { id: 'meadowlands',  file: 'Farm_Ranching.tmx' },
];

function extractFarmLayouts(existingFarmTypes) {
  const byId = Object.fromEntries(existingFarmTypes.map(f => [f.id, f]));
  const results = [];

  for (const { id, file } of FARM_MAPS) {
    process.stdout.write(`  ${file} … `);
    let xml;
    try { xml = readMap(file); } catch { console.log('not found'); continue; }

    const { width, height, tileData, buildableData, treePlantData } = parseFarmTileData(xml);
    const base = byId[id] ?? {};
    const counts = {};
    for (const c of tileData) counts[c] = (counts[c] ?? 0) + 1;
    const bCount = buildableData.split('').filter(c => c === '1').length;
    const tCount = treePlantData.split('').filter(c => c === '1').length;
    console.log(
      `${width}×${height}  ` +
      `f:${counts.f??0} w:${counts.w??0} i:${counts.i??0} b:${counts.b??0} ` +
      `g:${counts.g??0} s:${counts.s??0} r:${counts.r??0}  ` +
      `buildable:${bCount} treePlant:${tCount}`
    );

    const staticBuildings = buildStaticBuildings(id);

    results.push({
      id,
      name:          base.name          ?? id,
      description:   base.description   ?? '',
      startingBonus: base.startingBonus,
      gridWidth:  width,
      gridHeight: height,
      tileData,
      buildableData,
      treePlantData,
      staticBuildings,
    });
  }
  return results;
}

// Default building positions from new-game save files (verified against all 8 farm types).
// buildingId must match the key in Data/Buildings.json (Title Case).
// pb = Pet Bowl (2×2), fh = Farmhouse, sb = Shipping Bin, gh = Greenhouse
const FARM_BUILDINGS = {
  standard:      { fh: [59,12], sb: [71,14], gh: [25,10], pb: [53,7]  },
  riverland:     { fh: [59,12], sb: [71,14], gh: [25,10], pb: [53,7]  },
  forest:        { fh: [59,12], sb: [71,14], gh: [25,10], pb: [53,7]  },
  hilltop:       { fh: [59,12], sb: [71,14], gh: [25,10], pb: [53,7]  },
  wilderness:    { fh: [59,12], sb: [71,14], gh: [25,10], pb: [53,7]  },
  beach:         { fh: [59,12], sb: [71,14], gh: [14,14], pb: [78,21] },
  'four-corners':{ fh: [59,12], sb: [71,14], gh: [36,29], pb: [49,40] },
  meadowlands:   { fh: [76,16], sb: [88,18], gh: [37,19], pb: [91,14] },
};

function buildStaticBuildings(farmId) {
  const pos = FARM_BUILDINGS[farmId] ?? FARM_BUILDINGS.standard;
  const buildings = [
    { buildingId: 'Farmhouse',    x: pos.fh[0], y: pos.fh[1], width: 9, height: 5 },
    { buildingId: 'Shipping Bin', x: pos.sb[0], y: pos.sb[1], width: 2, height: 1 },
    { buildingId: 'Greenhouse',   x: pos.gh[0], y: pos.gh[1], width: 7, height: 6 },
    { buildingId: 'Pet Bowl',     x: pos.pb[0], y: pos.pb[1], width: 2, height: 2 },
  ];
  if (farmId === 'meadowlands') {
    buildings.push({ buildingId: 'Coop', x: 54, y: 9, width: 6, height: 3 });
  }
  return buildings;
}

// ── Island Farm Extraction ────────────────────────────────────────────────────

// Confirmed from save-file XML: <shippingBinPosition><X>90</X><Y>39</Y></shippingBinPosition>
// Island farmhouse hut position is hardcoded in game C# (IslandWest.cs) — approximated here,
// visually verified against the Island_W.tmx tile layout.
const ISLAND_STATIC_BUILDINGS = [
  { buildingId: 'Shipping Bin', x: 90, y: 39, width: 2, height: 1 },
  // Island hut (small farmhouse): game-hardcoded position in IslandWest.cs
  { buildingId: 'Island Farmhouse', x: 14, y: 6, width: 5, height: 4 },
];

function extractIslandFarm() {
  const mapFile = 'Island_W.tmx';
  process.stdout.write(`  ${mapFile} … `);
  let xml;
  try { xml = readMap(mapFile); } catch { console.log('not found'); return null; }

  const { width, height, tileData, buildableData, treePlantData } =
    parseFarmTileData(xml, { skipWaterExpansion: true });

  const counts = {};
  for (const c of tileData) counts[c] = (counts[c] ?? 0) + 1;
  const bCount = buildableData.split('').filter(c => c === '1').length;
  const tCount = treePlantData.split('').filter(c => c === '1').length;
  console.log(
    `${width}×${height}  ` +
    `f:${counts.f??0} w:${counts.w??0} i:${counts.i??0} b:${counts.b??0} ` +
    `g:${counts.g??0} s:${counts.s??0} r:${counts.r??0}  ` +
    `buildable:${bCount} treePlant:${tCount}`,
  );

  return {
    gridWidth:  width,
    gridHeight: height,
    tileData,
    buildableData,
    treePlantData,
    staticBuildings: ISLAND_STATIC_BUILDINGS,
  };
}

/** Convert PascalCase or camelCase key to Title Case with spaces: DriedFruit → Dried Fruit */
function keyToName(key) {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

// ── Item Extraction ───────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  '-2':  'gem', '-4': 'fish', '-5': 'animal_product', '-6': 'animal_product',
  '-7':  'food', '-9': 'resource', '-12': 'mineral', '-14': 'food',
  '-15': 'resource', '-16': 'resource', '-17': 'artisan', '-18': 'animal_product',
  '-19': 'resource', '-20': 'resource', '-21': 'resource', '-22': 'resource',
  '-23': 'fish', '-24': 'other', '-25': 'food', '-26': 'artisan',
  '-27': 'resource', '-28': 'resource', // -28 = monster drops (Bug Meat, Slime, Bat Wing, etc.)
  '-74': 'seed', '-75': 'crop', '-79': 'food', // -79 = fruits (Coconut, Banana, Cactus Fruit, etc.)
  '-80': 'crop', '-81': 'forage', '-96': 'flower', '-102': 'book', '-103': 'book',
  '0': 'other',
};

function normalizeSheet(texture) {
  if (!texture) return 'springobjects';
  const t = texture.replace(/\\/g, '/');
  if (t.includes('Objects_2')) return 'Objects_2';
  return 'springobjects';
}

/**
 * Extract forage season/location data from ContextTags.
 * Returns { seasons, forageLocation } or null if not a forage item.
 */
function extractForageData(obj) {
  const tags = obj.ContextTags ?? [];
  if (!tags.some(t => t === 'forage_item' || t.startsWith('forage_item_'))) return null;
  const KNOWN = new Set(['spring', 'summer', 'fall', 'winter', 'all']);
  const seasons = tags
    .filter(t => t.startsWith('season_') && !t.startsWith('season_item_'))
    .map(t => t.replace('season_', ''))
    .filter(s => KNOWN.has(s));
  // Derive location from forage sub-tags
  let forageLocation = 'outdoor';
  if (tags.includes('forage_item_beach'))  forageLocation = 'beach';
  if (tags.includes('forage_item_cave') || tags.includes('forage_item_mines')) forageLocation = 'cave';
  if (tags.includes('forage_item_desert')) forageLocation = 'desert';
  if (tags.includes('forage_item_island')) forageLocation = 'island';
  // Items with no season: treat as 'all' (year-round availability)
  return { seasons: seasons.length > 0 ? seasons : ['all'], forageLocation };
}

// Backward-compat wrapper for existing callers
function extractForageSeasons(obj) {
  const r = extractForageData(obj);
  return r ? r.seasons : null;
}

/**
 * Extract food buff data from Objects.json Buffs array.
 * Returns an array of buff objects (non-zero attributes only), or null if none.
 */
function extractFoodBuffs(obj) {
  if (!Array.isArray(obj.Buffs) || obj.Buffs.length === 0) return null;
  const ATTR_MAP = [
    ['FarmingLevel',  'farming'],
    ['FishingLevel',  'fishing'],
    ['MiningLevel',   'mining'],
    ['CombatLevel',   'combat'],
    ['LuckLevel',     'luck'],
    ['ForagingLevel', 'foraging'],
    ['Speed',         'speed'],
    ['Defense',       'defense'],
    ['Attack',        'attack'],
    ['MaxStamina',    'maxStamina'],
    ['MagneticRadius','magneticRadius'],
  ];
  const result = [];
  for (const buff of obj.Buffs) {
    const attrs = buff.CustomAttributes ?? {};
    const entry = { duration: buff.Duration ?? 0 };
    if (buff.IsDebuff) entry.isDebuff = true;
    let hasEffect = false;
    for (const [src, dst] of ATTR_MAP) {
      const val = Number(attrs[src] ?? 0);
      if (val !== 0) { entry[dst] = val; hasEffect = true; }
    }
    if (hasEffect) result.push(entry);
  }
  return result.length > 0 ? result : null;
}

function extractItems() {
  const objects = readData('Objects.json');
  const items   = [];
  // Track names from numeric IDs to detect collisions from string-keyed items
  const numericNames = new Set();

  for (const [numId, obj] of Object.entries(objects)) {
    if (!/^\d+$/.test(numId)) continue; // handle string keys separately below
    const name = obj.Name ?? '';
    if (!name || name.startsWith('[') || name === 'Error Item') continue;
    if (obj.Type === 'Litter' || String(obj.Category) === '-999') continue;

    const catKey   = String(obj.Category ?? 0);
    // Type === 'Arch' means Archaeology/Artifact item (museum donations)
    const category = obj.Type === 'Arch'
      ? 'artifact'
      : (CATEGORY_MAP[catKey] ?? 'other');
    const edibility = obj.Edibility ?? -300;
    const edible    = edibility > 0;
    const forageData = extractForageData(obj);
    const foodBuffs  = edible ? extractFoodBuffs(obj) : null;

    numericNames.add(name.toLowerCase());
    items.push({
      id:          toId(name),
      name,
      category,
      description: resolveLocalizedText(obj.Description) ?? '',
      sellValue:  obj.Price ?? 0,
      cheatId:    numId,
      energy:     edible ? Math.round(edibility * 2.5)   : undefined,
      health:     edible ? Math.round(edibility * 1.125) : undefined,
      likedBy:    [],
      lovedBy:    [],
      spriteSheet: normalizeSheet(obj.Texture),
      spriteIndex: obj.SpriteIndex ?? 0,
      ...(forageData ? { seasons: forageData.seasons, forageLocation: forageData.forageLocation } : {}),
      ...(foodBuffs  ? { buffs: foodBuffs } : {}),
    });
  }

  // String-keyed items (1.6+): derive readable name from key when Name is ambiguous
  for (const [strId, obj] of Object.entries(objects)) {
    if (/^\d+$/.test(strId)) continue;
    const rawName = obj.Name ?? '';
    if (!rawName || rawName.startsWith('[') || rawName === 'Error Item') continue;
    if (obj.Type === 'Litter' || String(obj.Category) === '-999') continue;

    // Use key-derived name if the raw name collides with an existing numeric-keyed item
    const name = numericNames.has(rawName.toLowerCase()) ? keyToName(strId) : rawName;

    const catKey   = String(obj.Category ?? 0);
    const category = CATEGORY_MAP[catKey] ?? 'other';
    const edibility = obj.Edibility ?? -300;
    const edible    = edibility > 0;
    const forageData = extractForageData(obj);
    const foodBuffs  = edible ? extractFoodBuffs(obj) : null;

    items.push({
      id:          toId(name),
      name,
      category,
      description: resolveLocalizedText(obj.Description) ?? '',
      sellValue:  obj.Price ?? 0,
      cheatId:    strId,
      energy:     edible ? Math.round(edibility * 2.5)   : undefined,
      health:     edible ? Math.round(edibility * 1.125) : undefined,
      likedBy:    [],
      lovedBy:    [],
      spriteSheet: normalizeSheet(obj.Texture),
      spriteIndex: obj.SpriteIndex ?? 0,
      ...(forageData ? { seasons: forageData.seasons, forageLocation: forageData.forageLocation } : {}),
      ...(foodBuffs  ? { buffs: foodBuffs } : {}),
    });
  }

  // Deduplicate by name: keep the entry with the numeric cheatId (lower canonical ID)
  const seen = new Map();
  const deduped = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
      deduped.push(item);
    } else {
      // Prefer numeric cheatId over string cheatId
      const existing = seen.get(key);
      if (/^\d+$/.test(item.cheatId) && !/^\d+$/.test(existing.cheatId)) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = item;
        seen.set(key, item);
      }
    }
  }

  return deduped;
}

// BigCraftables that are NOT farm-planner-relevant (exclusion list).
// Kept intentionally small — new content is included by default.
const EXCLUDED_CRAFTABLES = new Set([
  // Go on trees, not placed standalone
  '105', '264',
  // Cellar-only
  '163',
  // Auto-placed inside animal buildings — not manually positioned
  '99', '101',
  // Mine/combat item — not placed on farm
  '71',
  // World map props (rocks, doors) — not player-placed
  '78', '79', '80', '81', '82',
  '118','119','120','121','122','123','124','125', // Barrels/Crates
  '174','175','262','263',                         // more Barrels/Crates
  // Debug / unobtainable items (names start with ??)
  '155', '161', '162',
  // Litter / mob drops — not placeables
  '56',   // Slime Ball
  '96',   // Strange Capsule (event object)
  '98',   // Empty Capsule
  // Pure indoor furniture — table pieces, chairs, etc.
  '22','23','26','27',
]);

// BigCraftable IDs that get category 'decoration' instead of 'machine'
const DECORATION_CRAFTABLES = new Set(['37', '38', '39', 'TextSign']);

function extractBigCraftables() {
  const data  = readData('BigCraftables.json');
  const items = [];

  for (const [id, obj] of Object.entries(data)) {
    if (EXCLUDED_CRAFTABLES.has(id)) continue;
    const name = obj.Name ?? '';
    // Skip empty, localized-text placeholders, and error items
    if (!name || name.startsWith('[') || name === 'Error Item') continue;

    items.push({
      id:          toId(name),
      name,
      category:    DECORATION_CRAFTABLES.has(id) ? 'decoration' : 'machine',
      description: resolveLocalizedText(obj.Description) ?? '',
      sellValue:   obj.Price ?? 0,
      cheatId:     id,
      likedBy:     [],
      lovedBy:     [],
      spriteSheet:     'Craftables',
      spriteIndex:     obj.SpriteIndex ?? 0,
      isBigCraftable:  true,
    });
  }

  return items;
}

// ── Gift Taste Extraction ─────────────────────────────────────────────────────

function applyGiftTastes(items) {
  const tastes  = readData('NPCGiftTastes.json');
  const byCheat = new Map(items.map(i => [i.cheatId, i]));

  function idsFromField(raw) {
    return (raw ?? '').trim().split(/\s+/).filter(id => id && !/^-\d/.test(id));
  }

  for (const [npcKey, raw] of Object.entries(tastes)) {
    if (npcKey.startsWith('Universal_')) continue;
    const parts   = raw.split('/');
    const loveIds = idsFromField(parts[1]);
    const likeIds = idsFromField(parts[3]);
    const npcId   = toId(npcKey);

    for (const id of loveIds) {
      const item = byCheat.get(id);
      if (item && !item.lovedBy.includes(npcId)) item.lovedBy.push(npcId);
    }
    for (const id of likeIds) {
      const item = byCheat.get(id);
      if (item && !item.likedBy.includes(npcId)) item.likedBy.push(npcId);
    }
  }

  const universalGifts = {
    loved:    parseUniversal(tastes.Universal_Love    ?? '', byCheat),
    liked:    parseUniversal(tastes.Universal_Like    ?? '', byCheat),
    disliked: parseUniversal(tastes.Universal_Dislike ?? '', byCheat),
    hated:    parseUniversal(tastes.Universal_Hate    ?? '', byCheat),
  };

  return universalGifts;
}

function parseUniversal(raw, byCheat) {
  return raw.trim().split(/\s+/)
    .filter(id => id && !/^-\d/.test(id))
    .map(id => { const item = byCheat.get(id); return item ? { id: item.id, name: item.name } : null; })
    .filter(Boolean);
}

// ── Building Definition Extraction ───────────────────────────────────────────

const BUILDING_FAMILIES = {
  'Coop':        { familyId: 'coop', familyLevel: 0 },
  'Big Coop':    { familyId: 'coop', familyLevel: 1 },
  'Deluxe Coop': { familyId: 'coop', familyLevel: 2 },
  'Barn':        { familyId: 'barn', familyLevel: 0 },
  'Big Barn':    { familyId: 'barn', familyLevel: 1 },
  'Deluxe Barn': { familyId: 'barn', familyLevel: 2 },
  'Shed':        { familyId: 'shed', familyLevel: 0 },
  'Big Shed':    { familyId: 'shed', familyLevel: 1 },
};

const BUILDING_INTERIOR_DIMS = {
  'Coop':        { interiorWidth: 12, interiorHeight: 10 },
  'Big Coop':    { interiorWidth: 16, interiorHeight: 10 },
  'Deluxe Coop': { interiorWidth: 23, interiorHeight: 10 },
  'Barn':        { interiorWidth: 18, interiorHeight: 15 },
  'Big Barn':    { interiorWidth: 22, interiorHeight: 15 },
  'Deluxe Barn': { interiorWidth: 25, interiorHeight: 15 },
  'Shed':        { interiorWidth: 13, interiorHeight: 14 },
  'Big Shed':    { interiorWidth: 19, interiorHeight: 17 },
  'Slime Hutch': { interiorWidth: 18, interiorHeight: 14 },
  'Greenhouse':  { interiorWidth: 20, interiorHeight: 24 },
  'Cabin':       { interiorWidth: 13, interiorHeight: 14 },
};

const BUILDING_UPGRADES = {
  'Coop':     { upgradeTo: 'Big Coop' },
  'Big Coop': { upgradeFrom: 'Coop',    upgradeTo: 'Deluxe Coop' },
  'Deluxe Coop': { upgradeFrom: 'Big Coop' },
  'Barn':     { upgradeTo: 'Big Barn' },
  'Big Barn': { upgradeFrom: 'Barn',    upgradeTo: 'Deluxe Barn' },
  'Deluxe Barn': { upgradeFrom: 'Big Barn' },
  'Shed':     { upgradeTo: 'Big Shed' },
  'Big Shed': { upgradeFrom: 'Shed' },
};

const HAS_INTERIOR = new Set([
  'Coop','Big Coop','Deluxe Coop',
  'Barn','Big Barn','Deluxe Barn',
  'Shed','Big Shed','Slime Hutch','Greenhouse','Cabin',
]);

function extractBuildingDefs() {
  const data = readData('Buildings.json');
  const defs = [];

  for (const [id, b] of Object.entries(data)) {
    // Resolve sprite PNG
    let spriteName = null, spriteWidth = 0, spriteHeight = 0;
    const textureRaw = b.Texture ?? '';
    const texturePath = textureRaw.replace(/\\/g, '/');
    // Texture value is like "Buildings/Coop" — take the last segment
    const texBase = texturePath.split('/').pop();
    if (texBase) {
      const srcFile = join(BUILDINGS_DIR, texBase + '.png');
      if (existsSync(srcFile)) {
        spriteName = texBase.replace(/ /g, '_') + '.png';
        try {
          const dims = readPNGSize(srcFile);
          spriteWidth  = dims.width;
          spriteHeight = dims.height;
        } catch { /* skip bad PNG */ }
      }
    }

    const animalDoor = b.AnimalDoor && b.AnimalDoor.X >= 0
      ? { x: b.AnimalDoor.X, y: b.AnimalDoor.Y, w: b.AnimalDoor.Width ?? 1, h: b.AnimalDoor.Height ?? 1 }
      : undefined;

    // Source rect for the main building sprite (first/base stage)
    let sourceRect = undefined;
    let sourceRectRuin = undefined;
    const sr = b.SourceRect;
    if (sr && (sr.Width > 0 || sr.Height > 0)) {
      sourceRect = { x: sr.X, y: sr.Y, w: sr.Width, h: sr.Height };
    }
    // Greenhouse: ruin is at y=0, repaired is at y=160 (per SourceRect in Buildings.json)
    if (id === 'Greenhouse' && sr) {
      // Game stores repaired as SourceRect; ruin is the other one
      sourceRect     = { x: 0, y: sr.Y, w: sr.Width, h: sr.Height };  // repaired
      sourceRectRuin = { x: 0, y: 0,    w: sr.Width, h: sr.Height };  // ruin (first sprite row)
    }

    const rawName = b.Name ?? id;
    const def = {
      id,
      name:    rawName.startsWith('[') ? id : rawName,
      builder: (b.Builder ?? 'None'),
      width:   b.Size?.X ?? 1,
      height:  b.Size?.Y ?? 1,
      ...(b.HumanDoor ? { humanDoor: { x: b.HumanDoor.X, y: b.HumanDoor.Y } } : {}),
      ...(animalDoor  ? { animalDoor } : {}),
      ...(spriteName  ? { spriteName, spriteWidth, spriteHeight } : {}),
      ...(sourceRect  ? { sourceRect } : {}),
      ...(sourceRectRuin ? { sourceRectRuin } : {}),
      hasInterior: HAS_INTERIOR.has(id),
      ...(BUILDING_INTERIOR_DIMS[id] ?? {}),
      ...(BUILDING_FAMILIES[id] ?? {}),
      ...(BUILDING_UPGRADES[id] ?? {}),
    };

    defs.push(def);
  }

  return defs;
}

// ── Fish Extraction ───────────────────────────────────────────────────────────

const FISHING_LOCATION_NAMES = {
  Beach:          'Beach',
  Town:           'Town River',
  Forest:         'Cindersap Forest',
  Mountain:       'Mountain Lake',
  Backwoods:      'Backwoods',
  BusStop:        'Bus Stop',
  Railroad:       'Railroad',
  Desert:         'Desert',
  Sewer:          'Sewers',
  WitchSwamp:     "Witch's Swamp",
  BathHousePool:  'Spa Pool',
  Submarine:      'Night Market Sub',
  IslandNorth:    'Ginger Island',
  IslandWest:     'Ginger Island',
  IslandEast:     'Ginger Island',
  IslandSouth:    'Ginger Island',
  IslandSouthEast:'Ginger Island',
  Mine:           'Mines',
  UndergroundMine:'Mines',
  Woods:                'Secret Woods',
  Caldera:              'Volcano Caldera',
  BugLand:              'Mutant Bug Lair',
  IslandSouthEastCave:  'Pirate Cove',
};

// Locations where IgnoreFishDataRequirements entries are still valid fishing spots
const SPECIAL_LOCATIONS = new Set(['Submarine', 'Woods', 'Caldera', 'WitchSwamp', 'BugLand', 'IslandSouthEastCave']);

// Fish that are caught by mine floor level (not in Locations.json)
const MINE_FLOOR_FISH = {
  '158': 'Mines (floors 1–39)',   // Stonefish
  '161': 'Mines (floors 60–80)',  // Ice Pip
};

// Legendary fish (caught via special game-event locations)
const LEGENDARY_FISH_LOCATIONS = {
  '160': ['Town River'],          // Angler — Town pier, Autumn
  '159': ['Beach'],               // Crimsonfish — Beach, Summer
  '775': ['Cindersap Forest'],    // Glacierfish — Cindersap Forest south, Winter
  '163': ['Mountain Lake'],       // Legend — Mountain Lake, Spring
  '682': ['Sewers'],              // Mutant Carp — Sewers
  // Qi challenge variants — same locations as originals
  '898': ['Beach'],               // Son of Crimsonfish
  '899': ['Town River'],          // Ms. Angler
  '900': ['Mountain Lake'],       // Legend II
  '901': ['Sewers'],              // Radioactive Carp
  '902': ['Cindersap Forest'],    // Glacierfish Jr.
};

function extractFish(items) {
  const fishData  = readData('Fish.json');
  const locations = readData('Locations.json');

  // Build cheatId → item lookup (fish items only, non-BigCraftable)
  const fishItemMap = new Map(
    items
      .filter(i => i.category === 'fish' && /^\d+$/.test(i.cheatId))
      .map(i => [i.cheatId, i])
  );

  // ── Build location index: cheatId → Set<locationName> ────────────────────
  const locationIndex = new Map(); // cheatId (string) → Set<string>
  const levelIndex    = new Map(); // cheatId (string) → min fishing level

  for (const [locKey, locData] of Object.entries(locations)) {
    const displayName = FISHING_LOCATION_NAMES[locKey];
    if (!displayName || !locData.Fish) continue;

    // Special locations include IgnoreFishDataRequirements entries (they're still valid spots)
    const isSpecial = SPECIAL_LOCATIONS.has(locKey);

    for (const entry of Object.values(locData.Fish)) {
      if (entry.RequireMagicBait) continue; // magic-bait-only spot
      if (entry.IsBossFish)       continue; // legendary fish
      if (!isSpecial && entry.IgnoreFishDataRequirements) continue;

      const itemId = entry.ItemId;
      if (!itemId) continue;

      const m = itemId.match(/\(O\)(\d+)/);
      if (!m) continue;
      const cheatId = m[1];

      if (!locationIndex.has(cheatId)) locationIndex.set(cheatId, new Set());
      locationIndex.get(cheatId).add(displayName);

      const lvl = entry.MinFishingLevel ?? 0;
      if (!levelIndex.has(cheatId) || lvl < levelIndex.get(cheatId)) {
        levelIndex.set(cheatId, lvl);
      }
    }
  }

  // ── Parse Fish.json entries ───────────────────────────────────────────────
  const result = [];

  for (const [key, raw] of Object.entries(fishData)) {
    if (typeof raw !== 'string') continue;
    const parts = raw.split('/');
    if (parts.length < 4) continue;

    const name = parts[0];
    const cheatId = String(key);
    const item  = fishItemMap.get(cheatId);
    if (!item) continue; // skip non-fish items

    // ── Trap fish (Crab Pots) ── format: name/trap/chance/bait.../waterType/minLvl/maxLvl/...
    if (parts[1] === 'trap') {
      const waterType = parts[4] === 'ocean' ? 'ocean' : 'freshwater';
      const trapLoc   = waterType === 'ocean' ? 'Crab Pot (Ocean)' : 'Crab Pot (Freshwater)';
      result.push({
        id:               toId(item.name),
        itemId:           item.id,
        cheatId,
        name:             item.name,
        difficulty:       0,
        seasons:          ['all'],
        weather:          'any',
        times:            [],
        locations:        [trapLoc],
        minFishingLevel:  0,
        trapFish:         true,
      });
      continue;
    }

    // ── Standard rod fish ── format: name/difficulty/behavior/minSize/maxSize/time/season/weather/...
    if (parts.length < 8) continue;

    const difficulty = parseInt(parts[1]) || 0;
    const timeStr    = parts[5];
    const seasonStr  = parts[6];
    const weatherRaw = parts[7];

    // Time ranges (pairs of start/end)
    const timeParts = timeStr.split(' ').map(Number).filter(n => !isNaN(n));
    const times = [];
    for (let i = 0; i + 1 < timeParts.length; i += 2) {
      times.push({ start: timeParts[i], end: timeParts[i + 1] });
    }

    // Seasons
    const seasonList = seasonStr.split(' ').filter(s =>
      ['spring', 'summer', 'fall', 'winter'].includes(s)
    );
    const seasons = seasonList.length === 4 ? ['all'] : seasonList;

    // Weather
    const weather = weatherRaw === 'sunny' ? 'sunny'
                  : weatherRaw === 'rainy' ? 'rainy'
                  : 'any';

    let locs = locationIndex.has(cheatId)
      ? [...locationIndex.get(cheatId)].sort()
      : [];

    // Apply mine-floor overrides
    if (MINE_FLOOR_FISH[cheatId]) locs = [MINE_FLOOR_FISH[cheatId]];

    // Apply legendary fish location overrides
    if (LEGENDARY_FISH_LOCATIONS[cheatId]) locs = LEGENDARY_FISH_LOCATIONS[cheatId];

    result.push({
      id:               toId(item.name),
      itemId:           item.id,
      cheatId,
      name:             item.name,
      difficulty,
      seasons,
      weather,
      times,
      locations:        locs,
      minFishingLevel:  levelIndex.get(cheatId) ?? 0,
      ...(LEGENDARY_FISH_LOCATIONS[cheatId] ? { legendary: true } : {}),
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Crop Quality Distribution ─────────────────────────────────────────────────

/**
 * Pre-compute the crop quality probability distribution for farming levels 0–10.
 *
 * Game algorithm (no fertilizer): checks gold first, then silver, else normal.
 *   goldProb   = 0.01 + 0.02 × level   (capped at 1)
 *   silverProb = 0.02 + 0.04 × level   (capped at 1) — applied to remaining probability
 *   iridiumProb = 0 without Deluxe Fertilizer
 *
 * Verified against wiki: at level 10: gold=21%, silver=33%, normal=46%.
 * Values stored as fractions (0–1), 4dp precision.
 */
function computeQualityByLevel() {
  const table = {};
  for (let lvl = 0; lvl <= 10; lvl++) {
    const goldP   = Math.min(0.01 + 0.02 * lvl, 1);
    const silverP = Math.min(0.02 + 0.04 * lvl, 1);
    const gold    = goldP;
    const silver  = (1 - gold) * silverP;
    const normal  = 1 - gold - silver;
    table[lvl] = {
      normal:  Math.round(normal  * 10000) / 10000,
      silver:  Math.round(silver  * 10000) / 10000,
      gold:    Math.round(gold    * 10000) / 10000,
      iridium: 0,
    };
  }
  return table;
}

// ── Crop Extraction ───────────────────────────────────────────────────────────

// Seeds that are NOT real crops (forage packets, special seeds, etc.)
// These generate random forage items, not specific crops.
const SKIP_CROP_SEEDS = new Set([
  '495', '496', '497', '498', // Spring/Summer/Fall/Winter Seeds (forage mix)
  '885',                       // Fiber Seeds
  '890',                       // Qi Bean (handled separately; too special)
]);

// Seeds of crops that can grow into giant form
const GIANT_CROP_SEEDS = new Set([
  '474', // Cauliflower Seeds
  '479', // Melon Seeds
  '490', // Pumpkin Seeds
]);

function extractCrops(items) {
  const cropsData      = readData('Crops.json');
  const qualityByLevel = computeQualityByLevel();
  // Exclude BigCraftables (machines) from the harvest lookup — their cheatIds are from a
  // different ID space than Objects, but can collide with object IDs (e.g. cheatId "24" is
  // both the Mayonnaise Machine and a valid object ID).
  const byCheat   = new Map(items.filter(i => !i.isBigCraftable).map(i => [i.cheatId, i]));
  const crops     = [];

  for (const [seedId, c] of Object.entries(cropsData)) {
    if (SKIP_CROP_SEEDS.has(seedId)) continue;

    const seedItem    = byCheat.get(seedId);
    const harvestId   = (c.HarvestItemId ?? '').replace(/^\(O\)/, '');
    const harvestItem = byCheat.get(harvestId);

    // Skip if we can't find the harvest item (ornamental / special crops)
    if (!harvestItem) continue;

    const growDays = (c.DaysInPhase ?? []).reduce((a, b) => a + b, 0);
    const seasons  = (c.Seasons ?? []).map(s => s.toLowerCase());

    const name = harvestItem.name;
    const id   = toId(name) + '-crop';

    crops.push({
      id,
      name,
      seedItemId:    seedId,
      harvestItemId: harvestId,
      seasons,
      growDays,
      regrowDays:       c.RegrowDays > 0 ? c.RegrowDays : null,
      harvestCountMin:  c.HarvestMinStack ?? 1,
      harvestCountMax:  c.HarvestMaxStack ?? 1,
      qualityByLevel,
      canBeGiantCrop:   GIANT_CROP_SEEDS.has(seedId),
      trellisCrop:      c.IsRaised ?? false,
      ...(c.IsPaddyCrop ? { isPaddyCrop: true } : {}),
      ...(c.SpriteIndex != null ? { spriteIndex: c.SpriteIndex } : {}),
    });
  }

  // Sort by season order then alphabetical
  const SEASON_ORDER = { spring: 0, summer: 1, fall: 2, winter: 3 };
  crops.sort((a, b) => {
    const oa = Math.min(...a.seasons.map(s => SEASON_ORDER[s] ?? 4));
    const ob = Math.min(...b.seasons.map(s => SEASON_ORDER[s] ?? 4));
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name);
  });

  return crops;
}

// ── Recipe Extraction ─────────────────────────────────────────────────────────

/**
 * Negative item category codes used in cooking recipe ingredients.
 * Only -4, -5, -6 appear in CookingRecipes.json.
 */
const INGREDIENT_CATEGORIES = {
  '-4':  'Any Fish',
  '-5':  'Any Egg',
  '-6':  'Any Milk',
};

function extractRecipes(items) {
  const cookingData = readData('CookingRecipes.json');

  // Load TV/CookingChannel.json → set of recipe names aired on the Queen of Sauce
  const tvPath = join(DATA_DIR, 'TV', 'CookingChannel.json');
  const tvRecipeNames = new Set();
  if (existsSync(tvPath)) {
    const tvData = JSON.parse(readFileSync(tvPath, 'utf8'));
    for (const v of Object.values(tvData)) {
      if (typeof v === 'string') {
        const recipeName = v.split('/')[0];
        if (recipeName) tvRecipeNames.add(recipeName);
      }
    }
  }

  // Build cheatId → item map (exclude BigCraftables — different ID space)
  const byCheat = new Map(items.filter(i => !i.isBigCraftable).map(i => [i.cheatId, i]));

  const recipes = [];

  for (const [name, raw] of Object.entries(cookingData)) {
    if (typeof raw !== 'string') continue;
    const parts = raw.split('/');
    if (parts.length < 4) continue;

    const ingredientStr = parts[0];     // e.g. "-5 1 -6 1" or "20 1 22 1 419 1"
    const resultId      = parts[2];     // cheatId of result item
    const unlockStr     = (parts[3] ?? '').trim();

    const resultItem = byCheat.get(resultId);

    // ── Parse ingredients ──
    const tokens = ingredientStr.trim().split(/\s+/);
    const ingredients = [];
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const id  = tokens[i];
      const qty = parseInt(tokens[i + 1]) || 1;
      const isCategory = id.startsWith('-');
      const item = byCheat.get(id);
      ingredients.push({
        ...(isCategory ? {} : { itemId: id }),
        ...(item ? { itemRefId: item.id } : {}),
        itemName: isCategory
          ? (INGREDIENT_CATEGORIES[id] ?? `Category ${id}`)
          : (item?.name ?? `Item ${id}`),
        quantity: qty,
        ...(isCategory ? { isCategory: true } : {}),
      });
    }

    // ── Parse unlock condition ──
    let source     = 'Unknown';
    let sourceType = 'unknown';
    let queenOfSauce    = false;
    let friendshipNPC   = undefined;
    let friendshipLevel = undefined;
    let skillName       = undefined;
    let skillLevel      = undefined;

    if (unlockStr === 'default') {
      source     = 'Default recipe';
      sourceType = 'default';
    } else if (unlockStr === 'null') {
      source     = 'Special';
      sourceType = 'unknown';
    } else if (unlockStr.startsWith('f ')) {
      const fParts = unlockStr.slice(2).trim().split(' ');
      friendshipLevel = parseInt(fParts[fParts.length - 1]) || 0;
      friendshipNPC   = fParts.slice(0, -1).join(' ');
      source     = `${friendshipNPC} (${friendshipLevel}♥)`;
      sourceType = 'friendship';
    } else if (unlockStr.startsWith('s ')) {
      const sParts = unlockStr.slice(2).trim().split(' ');
      skillName  = sParts[0];
      skillLevel = parseInt(sParts[1]) || 0;
      source     = `${skillName} Lv. ${skillLevel}`;
      sourceType = 'skill';
    } else if (unlockStr.startsWith('l ')) {
      // l X recipes: check TV name list first, then fall back to Island unlock
      if (tvRecipeNames.has(name)) {
        queenOfSauce = true;
        source       = 'Queen of Sauce (TV)';
        sourceType   = 'tv';
      } else {
        // Not aired on TV (Ginger Ale, Triple Shot Espresso, Banana Pudding, Tropical Curry)
        source     = 'Island (special unlock)';
        sourceType = 'island';
      }
    }

    recipes.push({
      id:   toId(name),
      name,
      resultItemId:   resultId,
      resultItemName: resultItem?.name ?? name,
      ...(resultItem ? { resultItemRefId: resultItem.id } : {}),
      ingredients,
      source,
      sourceType,
      ...(queenOfSauce    ? { queenOfSauce: true }               : {}),
      ...(friendshipNPC   ? { friendshipNPC, friendshipLevel }    : {}),
      ...(skillName       ? { skillName, skillLevel }             : {}),
    });
  }

  return recipes.sort((a, b) => a.name.localeCompare(b.name));
}

// ── Mod Support ───────────────────────────────────────────────────────────────

function applyModPatches(items) {
  if (!existsSync(MODS_DIR)) { console.log('  Mods folder not found, skipping'); return; }
  const byId = new Map(items.map(i => [i.cheatId, i]));
  let patched = 0;

  for (const modFolder of readdirSync(MODS_DIR, { withFileTypes: true })) {
    if (!modFolder.isDirectory()) continue;
    const contentPath = join(MODS_DIR, modFolder.name, 'content.json');
    if (!existsSync(contentPath)) continue;
    let content;
    try { content = JSON.parse(readFileSync(contentPath, 'utf8')); } catch { continue; }

    for (const change of content.Changes ?? []) {
      if (change.Action !== 'EditData') continue;
      if (!change.Target?.startsWith('Data/Objects')) continue;
      for (const [id, data] of Object.entries(change.Entries ?? {})) {
        if (!byId.has(id)) continue;
        const item = byId.get(id);
        if (data.Name) { item.name = data.Name; item.id = toId(data.Name); }
        if (data.Price != null) item.sellValue = data.Price;
        patched++;
      }
    }
  }

  if (patched > 0) console.log(`  Applied ${patched} mod patches`);
}

// ── Machine Extraction ────────────────────────────────────────────────────────

/**
 * Key machines to include in the guide (BigCraftable cheatId → display name).
 * Ordered for UI display.
 */
const KEY_MACHINES = [
  { id: '12',  name: 'Keg' },
  { id: '15',  name: 'Preserves Jar' },
  { id: '16',  name: 'Cheese Press' },
  { id: '24',  name: 'Mayonnaise Machine' },
  { id: '17',  name: 'Loom' },
  { id: '19',  name: 'Oil Maker' },
  { id: '13',  name: 'Furnace' },
  { id: '114', name: 'Charcoal Kiln' },
  { id: '25',  name: 'Seed Maker' },
  { id: '163', name: 'Cask' },
  { id: '90',  name: 'Bone Mill' },
  { id: '20',  name: 'Recycling Machine' },
];

/**
 * Map item tags used in machine triggers to human-readable labels.
 * When a trigger has multiple tags, join them with ',' and look up here.
 */
const MACHINE_TAG_LABELS = {
  'category_vegetable':        'Any Vegetable',
  'category_fruits':           'Any Fruit',
  'category_fish':             'Any Fish',
  'egg_item':                  'Any Egg',
  'large_egg_item,egg_item':   'Large Egg',
  'milk_item':                 'Any Milk',
  'large_milk_item':           'Large Milk',
  'category_milk':             'Any Milk',
  // Bone Mill: any bone item except Bone Fragment (id_o_881)
  'bone_item,!id_o_881':       'Any Bone Item (not Bone Fragment)',
  // Seed Maker: any crop (anything without seedmaker_banned tag)
  '!seedmaker_banned':         'Any Crop',
  // Wool
  'wool_item':                 'Wool',
};

/**
 * Price rules for FLAVORED_ITEM output types.
 * Formula: outputPrice = floor(inputPrice × multiplier) + base
 */
const FLAVORED_PRICE_RULES = {
  'Wine':    { multiplier: 3,    base: 0 },
  'Juice':   { multiplier: 2.25, base: 0 },
  'Jelly':   { multiplier: 2,    base: 50 },
  'Pickle':  { multiplier: 2,    base: 50 },
  'AgedRoe': { multiplier: 2,    base: 0 },
};

/** Cask items and their aging time to iridium quality (in days). */
const CASK_DAYS_TO_IRIDIUM = {
  '348': { name: 'Wine',        days: 56 },
  '459': { name: 'Mead',        days: 28 },
  '303': { name: 'Pale Ale',    days: 28 },
  '346': { name: 'Beer',        days: 28 },
  '424': { name: 'Cheese',      days: 14 },
  '426': { name: 'Goat Cheese', days: 14 },
};

function extractMachineDefs(items) {
  const machinesPath = join(DATA_DIR, 'Machines.json');
  if (!existsSync(machinesPath)) return [];

  const machinesData = JSON.parse(readFileSync(machinesPath, 'utf8'));
  // Build cheatId → item map (BigCraftables only)
  const bcByCheat = new Map(items.filter(i => i.isBigCraftable).map(i => [i.cheatId, i]));
  const obByCheat = new Map(items.filter(i => !i.isBigCraftable).map(i => [i.cheatId, i]));

  const machineDefs = [];

  for (const { id, name } of KEY_MACHINES) {
    const machData = machinesData[`(BC)${id}`];
    if (!machData?.OutputRules) continue;

    const bcItem = bcByCheat.get(id);
    const rules  = [];

    for (const rule of machData.OutputRules) {
      if (!rule.Triggers?.length) continue;

      const mins = machData.OverrideMinutesUntilReady ?? rule.MinutesUntilReady ?? 60;

      // ── Determine outputs ──
      // Random-output detection:
      //  - Bone Mill pattern: UseFirstValidOutput=false, multiple outputs, no conditions
      //  - Recycling Machine pattern: UseFirstValidOutput=true, some outputs have RANDOM conditions
      const outputItems = rule.OutputItem ?? [];
      const useFirstValid = rule.UseFirstValidOutput !== false; // default true
      const hasRandomConditions = outputItems.some(o => typeof o.Condition === 'string' && o.Condition.startsWith('RANDOM'));
      const isRandom = (
        (!useFirstValid && outputItems.length > 1 && outputItems.every(o => !o.Condition)) ||
        (outputItems.length > 1 && hasRandomConditions)
      );

      let randomOutputItemList = undefined;
      if (isRandom) {
        randomOutputItemList = outputItems.map(o => {
          const m = (o.ItemId ?? '').match(/^\(O\)(\d+)$/);
          const cid = m?.[1];
          const it  = cid ? obByCheat.get(cid) : null;
          return {
            itemId:   cid ?? '',
            itemName: it?.name ?? o.ItemId ?? '?',
            minStack: o.MinStack ?? 1,
          };
        });
      }

      // ── One entry per trigger ──
      for (const trigger of rule.Triggers) {
        let inputType = 'specific';
        let inputItemId, inputItemName, inputCategoryLabel;
        const inputCount = trigger.RequiredCount ?? 1;

        if (trigger.RequiredItemId) {
          const m = trigger.RequiredItemId.match(/^\(O\)(\d+)$/);
          const cheatId = m?.[1];
          const item = cheatId ? obByCheat.get(cheatId) : null;
          inputItemId   = cheatId;
          inputItemName = item?.name ?? trigger.RequiredItemId;
        } else if (trigger.RequiredTags?.length > 0) {
          inputType = 'category';
          const tagStr = trigger.RequiredTags.join(',');
          inputCategoryLabel = MACHINE_TAG_LABELS[tagStr] ?? tagStr;
        } else {
          continue; // skip triggers with no clear input
        }

        const output = outputItems[0]; // may be undefined for special machines

        // ── Determine output kind ──
        const outItemIdRaw = output?.ItemId ?? output?.OutputMethod ?? '';
        const isSeedMaker = outItemIdRaw.includes('OutputSeedMaker');
        const isCask      = outItemIdRaw.includes('OutputCask');

        let outputType = 'specific';
        let outputItemId, outputItemName, flavoredOutput;
        let priceMultiplier, priceBase;
        let specialBehavior, outputNote;

        if (isSeedMaker) {
          specialBehavior = 'seed_maker';
          outputNote = '1–4× matching seeds for the input crop (2–4× if using Mixed Seeds)';
        } else if (isCask) {
          specialBehavior = 'cask';
          const caskInfo = CASK_DAYS_TO_IRIDIUM[inputItemId];
          outputNote = caskInfo
            ? `Upgrades quality (Silver→Gold→Iridium). ${caskInfo.days} days to Iridium.`
            : 'Upgrades quality of the input item.';
        } else if (isRandom) {
          // outputType stays 'specific', but we flag random
        } else if (outItemIdRaw.startsWith('FLAVORED_ITEM')) {
          outputType = 'flavored';
          const parts = outItemIdRaw.split(' ');
          flavoredOutput = parts[1] ?? 'Unknown';
          const pr = FLAVORED_PRICE_RULES[flavoredOutput];
          if (pr) { priceMultiplier = pr.multiplier; priceBase = pr.base; }
        } else if (outItemIdRaw) {
          const m = outItemIdRaw.match(/^\(O\)(\d+)$/);
          const cheatId = m?.[1];
          const item = cheatId ? obByCheat.get(cheatId) : null;
          outputItemId   = cheatId;
          outputItemName = item?.name ?? outItemIdRaw;
        }

        const ruleEntry = {
          ruleId: `${rule.Id}_${trigger.Id ?? inputItemId ?? inputCategoryLabel}`,
          inputType,
          ...(inputItemId       ? { inputItemId, inputItemName } : {}),
          ...(inputCategoryLabel ? { inputCategoryLabel } : {}),
          inputCount,
          outputType,
          ...(outputItemId    ? { outputItemId, outputItemName } : {}),
          ...(flavoredOutput  ? { flavoredOutput } : {}),
          ...(priceMultiplier !== undefined ? { priceMultiplier, priceBase: priceBase ?? 0 } : {}),
          minutesUntilReady: mins,
          ...(isRandom && randomOutputItemList ? { isRandomOutput: true, outputItems: randomOutputItemList } : {}),
          ...(specialBehavior ? { specialBehavior, outputNote } : {}),
        };
        rules.push(ruleEntry);
      }
    }

    if (rules.length > 0) {
      machineDefs.push({
        id,
        ...(bcItem ? { itemId: bcItem.id } : {}),
        name,
        rules,
      });
    }
  }

  return machineDefs;
}

// ── Shop Extraction ───────────────────────────────────────────────────────────

/**
 * Key shops to index for "sold by" data.
 * ShopId → display name.
 */
const KEY_SHOP_NAMES = {
  SeedShop:    "Pierre's General Store",
  FishShop:    "Willy's Fish Shop",
  Blacksmith:  'Clint (Blacksmith)',
  Saloon:      'Saloon (Gus)',
  Hospital:    'Harvey (Clinic)',
  AnimalShop:  "Marnie's Ranch",
  Sandy:       'Sandy (Oasis)',
  IslandTrade: 'Island Trader',
  Traveler:    'Traveling Merchant',
  VolcanoShop: 'Volcano Dwarf',
  Dwarf:       'Dwarf (mines)',
  ShadowShop:  'Krobus (Sewer)',
};

/**
 * Parse a shop item condition string into { season?, day?, yearMin? } parts.
 * Handles: "SEASON spring", "DAY_OF_WEEK Monday", "YEAR 2", and combinations.
 */
function parseShopCondition(condition) {
  if (!condition) return {};
  const result = {};
  // SEASON condition — extract only known season words
  const SEASON_WORDS = new Set(['spring', 'summer', 'fall', 'winter']);
  const seasonM = condition.match(/SEASON\s+([a-zA-Z,\s]+?)(?:\s*,\s*[A-Z_]+\s|\s*$)/);
  if (seasonM) {
    const seasons = seasonM[1].toLowerCase().split(/[\s,]+/).filter(s => SEASON_WORDS.has(s));
    if (seasons.length) result.season = seasons.join(',');
  }
  // YEAR condition — minimum year to appear (e.g. "YEAR 2")
  const yearM = condition.match(/\bYEAR\s+(\d+)/i);
  if (yearM) result.yearMin = Number(yearM[1]);
  // DAY_OF_WEEK condition (first occurrence)
  const dayM = condition.match(/DAY_OF_WEEK\s+(\w+)/i);
  if (dayM) {
    const d = dayM[1];
    result.day = d.charAt(0).toUpperCase() + d.slice(1).toLowerCase();
  }
  return result;
}

/**
 * Build cheatId → ShopEntry[] index from Shops.json.
 */
function buildShopIndex() {
  const shopsPath = join(DATA_DIR, 'Shops.json');
  if (!existsSync(shopsPath)) return new Map();

  const shops = JSON.parse(readFileSync(shopsPath, 'utf8'));
  const index  = new Map(); // cheatId (string) → ShopEntry[]

  for (const [shopId, displayName] of Object.entries(KEY_SHOP_NAMES)) {
    const shop = shops[shopId];
    if (!shop?.Items) continue;

    for (const entry of shop.Items) {
      const itemId = entry.ItemId ?? entry.Id;
      if (!itemId || typeof itemId !== 'string') continue;
      // Only process regular (O) items — skip BigCraftables, Furniture, Tools, recipes, random slots
      if (!itemId.startsWith('(O)')) continue;
      if (entry.IsRecipe) continue;
      if (itemId.startsWith('RANDOM')) continue; // just in case

      const cheatId = itemId.slice(3); // strip "(O)"

      const cond = parseShopCondition(entry.Condition);
      const isBarter = !!entry.TradeItemId;
      const shopEntry = {
        shop: displayName,
        ...(entry.Price > 0 ? { price: entry.Price } : {}),
        ...(isBarter         ? { _barter: true }       : {}),
        ...(cond.season  ? { season: cond.season }     : {}),
        ...(cond.day     ? { day: cond.day }           : {}),
        ...(cond.yearMin ? { yearMin: cond.yearMin }   : {}),
      };

      if (!index.has(cheatId)) index.set(cheatId, []);
      // Avoid duplicates (same shop may list the item for multiple conditions)
      const existing = index.get(cheatId);
      if (!existing.some(e => e.shop === displayName && e.season === shopEntry.season && e.day === shopEntry.day && e.yearMin === shopEntry.yearMin)) {
        existing.push(shopEntry);
      }
    }
  }

  return index;
}

// ── Schedule Extraction ───────────────────────────────────────────────────────

// Maps internal location names to display-friendly names
function friendlyLocation(loc) {
  if (!loc) return 'Unknown';
  // Handle compound names like BathHouse_MensLocker → Bath House (Men's)
  const part = loc.split('_')[0];
  // PascalCase → words
  return part
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim() || loc;
}

// Map schedule key to a human-readable label
function scheduleLabel(key) {
  const DAY_NAMES = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thu:'Thursday', Fri:'Friday', Sat:'Saturday', Sun:'Sunday' };
  const SEASON_NAMES = { spring:'Spring', summer:'Summer', fall:'Fall', winter:'Winter' };
  if (key === 'default') return 'Default';
  if (key === 'rain' || key === 'rainy') return 'Rainy Day';
  if (key === 'GreenRain') return 'Green Rain';
  if (SEASON_NAMES[key]) return SEASON_NAMES[key];
  if (DAY_NAMES[key]) return DAY_NAMES[key];
  // Date keys: summer_16 → Summer 16
  const dateMatch = key.match(/^(spring|summer|fall|winter)_(\d+)$/);
  if (dateMatch) return `${SEASON_NAMES[dateMatch[1]]} ${dateMatch[2]}`;
  // Day + friendship: Wed_6 → Wednesday (low friendship)
  const dayFriendMatch = key.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)_(\d+)$/);
  if (dayFriendMatch) return `${DAY_NAMES[dayFriendMatch[1]]} (friendship ≥${dayFriendMatch[2]})`;
  return key;
}

function parseScheduleEntries(raw) {
  const entries = [];
  const parts = raw.split('/');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Only parse time entries (start with a number)
    if (!/^\d/.test(trimmed)) continue;
    const tokens = trimmed.split(/\s+/);
    const time = parseInt(tokens[0], 10);
    const location = friendlyLocation(tokens[1] ?? 'Home');
    if (!isNaN(time)) entries.push({ time, location });
  }
  return entries;
}

function extractSchedules(npcName) {
  const filePath = join(SCHEDULES_DIR, npcName + '.json');
  if (!existsSync(filePath)) return [];

  let raw;
  try { raw = JSON.parse(readFileSync(filePath, 'utf8')); } catch { return []; }

  const variants = [];
  const SKIP_PREFIXES = ['marriage_', 'DesertFestival_'];
  const GOTO_ONLY = /^GOTO\s/i;
  const seen = new Set();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue;
    // Skip marriage and festival variants to keep the list manageable
    if (SKIP_PREFIXES.some(p => key.startsWith(p))) continue;
    // Skip pure redirect keys
    if (GOTO_ONLY.test(value.trim())) continue;

    const label = scheduleLabel(key);
    const entries = parseScheduleEntries(value);
    if (entries.length === 0) continue;

    // Deduplicate by label
    if (seen.has(label)) continue;
    seen.add(label);

    variants.push({ id: key, label, conditions: {}, entries });
  }

  // Sort: default first, then seasons, then days, then rest
  const ORDER = ['default', 'spring', 'summer', 'fall', 'winter', 'rain', 'GreenRain',
    'Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  variants.sort((a, b) => {
    const ai = ORDER.indexOf(a.id);
    const bi = ORDER.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return  1;
    return a.id.localeCompare(b.id);
  });

  return variants;
}

// ── NPC Gift Extraction ───────────────────────────────────────────────────────

function buildNPCGifts(npcKey, tastes, byCheat) {
  const raw = tastes[npcKey];
  if (!raw) return { loved: [], liked: [], neutral: [], disliked: [], hated: [] };

  const parts = raw.split('/');
  function idsToRefs(field) {
    return (field ?? '').trim().split(/\s+/)
      .filter(id => id && !/^-\d/.test(id))  // skip category refs
      .map(id => { const item = byCheat.get(id); return item ? { id: item.id, name: item.name } : null; })
      .filter(Boolean);
  }

  return {
    loved:    idsToRefs(parts[1]),
    liked:    idsToRefs(parts[3]),
    neutral:  idsToRefs(parts[5]),
    disliked: idsToRefs(parts[7]),
    hated:    idsToRefs(parts[9]),
  };
}

// ── Fish Pond Extraction ──────────────────────────────────────────────────────

/**
 * Extract FishPondData.json into an array of FishPondEntry objects.
 * @param {Array<{cheatId: string, name: string}>} items - already-extracted items list
 */
function extractFishPondData(items) {
  const pondPath = join(DATA_DIR, 'FishPondData.json');
  if (!existsSync(pondPath)) return [];

  const raw = JSON.parse(readFileSync(pondPath, 'utf8'));

  // Build lookup maps
  const idToName  = new Map(items.map(it => [it.cheatId, it.name]));
  const tagToItem = new Map(); // e.g. 'item_lionfish' → { cheatId, name }
  for (const item of items) {
    // We need ContextTags from the raw Objects.json — but items has already lost that.
    // Derive item_XXX tag from item name instead:
    const derivedTag = 'item_' + item.name.toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!tagToItem.has(derivedTag)) tagToItem.set(derivedTag, item);
  }

  /** Resolve '(O)831' → cheatId '831', or '(O)SomeString' → look up by name */
  function resolveItemId(rawId) {
    if (!rawId) return null;
    const inner = rawId.replace(/^\(O\)/, '');
    return inner;
  }

  function resolveItemName(cheatId) {
    return idToName.get(cheatId) ?? `Item ${cheatId}`;
  }

  /** Parse a gate entry like '(O)829 3' → { cheatId, quantity } */
  function parseGateItem(s) {
    const parts = s.trim().split(/\s+/);
    const cheatId = resolveItemId(parts[0]);
    const quantity = parts[1] ? parseInt(parts[1], 10) : 1;
    return { itemId: cheatId, itemName: resolveItemName(cheatId), quantity };
  }

  const result = [];

  for (const entry of Object.values(raw)) {
    const tags = entry.RequiredTags ?? [];
    const maxPop = entry.MaxPopulation === -1 ? 10 : entry.MaxPopulation;

    // Resolve which fish match this entry
    const fishItemIds = [];
    const fishNames   = [];
    for (const tag of tags) {
      if (tag.startsWith('item_')) {
        const fish = tagToItem.get(tag);
        if (fish && !fishItemIds.includes(fish.cheatId)) {
          fishItemIds.push(fish.cheatId);
          fishNames.push(fish.name);
        }
      }
    }

    // Produce items — deduplicate same item at same population into best entry
    const rawProduce = entry.ProducedItems ?? [];
    // Group by (RequiredPopulation, itemId) keeping highest-chance entry for display
    const produceMap = new Map(); // key = `${reqPop}:${cheatId}`
    for (const p of rawProduce) {
      if (!p.ItemId) continue;
      const cheatId = resolveItemId(p.ItemId);
      const key = `${p.RequiredPopulation}:${cheatId}`;
      const existing = produceMap.get(key);
      // Keep the highest-chance entry; if same chance, prefer one with explicit stack
      if (!existing || p.Chance > existing.chance) {
        const minStack = (p.MinStack === -1 || p.MinStack == null) ? 1 : p.MinStack;
        const maxStack = (p.MaxStack === -1 || p.MaxStack == null) ? 1 : p.MaxStack;
        produceMap.set(key, {
          itemId:    cheatId,
          itemName:  resolveItemName(cheatId),
          minStack,
          maxStack,
          chance:    p.Chance,
          minPop:    p.RequiredPopulation,
        });
      }
    }
    const produce = [...produceMap.values()]
      .sort((a, b) => a.minPop - b.minPop || a.itemName.localeCompare(b.itemName));

    // Population gates
    const populationGates = Object.entries(entry.PopulationGates ?? {})
      .map(([popStr, gateItems]) => ({
        population: parseInt(popStr, 10),
        items: gateItems.map(parseGateItem),
      }))
      .sort((a, b) => a.population - b.population);

    result.push({
      id:              entry.Id ?? 'default',
      requiredTags:    tags,
      fishItemIds,
      fishNames,
      maxPopulation:   maxPop,
      spawnTime:       entry.SpawnTime ?? -1,
      minProduceChance: entry.BaseMinProduceChance ?? 0.15,
      maxProduceChance: entry.BaseMaxProduceChance ?? 0.95,
      produce,
      populationGates,
    });
  }

  console.log(`  ${result.length} fish pond entries extracted`);
  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`\nGame data not found at: ${DATA_DIR}`);
    console.error('Set STARDEW_CONTENT env var to the unpacked Content folder path.\n');
    process.exit(1);
  }
  console.log(`Content: ${STARDEW_CONTENT}\n`);

  const existing = existsSync(OUT_FILE)
    ? JSON.parse(readFileSync(OUT_FILE, 'utf8'))
    : {};

  // ── Copy sprites ──
  console.log('Copying sprites to public/sprites/ …');
  copySprites();
  console.log();

  // ── Items ──
  console.log('Extracting items from Objects.json …');
  const items = extractItems();
  console.log(`  ${items.length} items extracted`);

  console.log('Extracting machines from BigCraftables.json …');
  const machines = extractBigCraftables();
  items.push(...machines);
  console.log(`  ${machines.length} machines added (${items.length} total)\n`);

  // ── Shop sources ──
  console.log('Building shop index …');
  const shopIndex = buildShopIndex();
  let shopTagged = 0;
  for (const item of items) {
    const entries = shopIndex.get(item.cheatId);
    if (entries?.length) {
      item.soldBy = entries;
      shopTagged++;
    }
  }
  // Resolve Price=-1 entries: gold shops get price = sellValue × 2; barter shops get no price.
  let priceResolved = 0;
  for (const item of items) {
    if (!item.soldBy) continue;
    for (const entry of item.soldBy) {
      if (entry._barter) {
        delete entry._barter;   // barter trade — no gold price
      } else if (entry.price === undefined) {
        entry.price = Math.max(1, item.sellValue * 2);
        priceResolved++;
      }
    }
  }
  console.log(`  ${shopTagged} items with shop source data (${priceResolved} prices computed from sell value)\n`);

  // ── Geode sources ──
  console.log('Building geode index …');
  {
    const objectsData = JSON.parse(readFileSync(join(DATA_DIR, 'Objects.json'), 'utf8'));
    // Geode cheatId → display name
    const GEODES = [
      { id: '535', name: 'Geode' },
      { id: '536', name: 'Frozen Geode' },
      { id: '537', name: 'Magma Geode' },
      { id: '749', name: 'Omni Geode' },
      { id: '791', name: 'Golden Coconut' },
    ];
    // cheatId → geode names[]
    const geodeIndex = new Map();
    for (const { id, name } of GEODES) {
      const obj = objectsData[id];
      if (!obj?.GeodeDrops) continue;
      for (const drop of obj.GeodeDrops) {
        if (!drop.RandomItemId) continue;
        for (const itemId of drop.RandomItemId) {
          if (!itemId.startsWith('(O)')) continue;
          const cheatId = itemId.slice(3);
          if (!geodeIndex.has(cheatId)) geodeIndex.set(cheatId, []);
          const list = geodeIndex.get(cheatId);
          if (!list.includes(name)) list.push(name);
        }
      }
    }
    let geodeTagged = 0;
    for (const item of items) {
      const sources = geodeIndex.get(item.cheatId);
      if (sources?.length) {
        item.geodeSource = sources;
        geodeTagged++;
      }
    }
    console.log(`  ${geodeTagged} items with geode source data\n`);
  }

  console.log('Applying gift tastes …');
  const universalGifts = applyGiftTastes(items);
  const loved = items.filter(i => i.lovedBy.length > 0).length;
  const liked = items.filter(i => i.likedBy.length > 0).length;
  console.log(`  ${loved} items with lovedBy, ${liked} with likedBy\n`);

  if (APPLY_MODS) {
    console.log('Applying mod patches …');
    applyModPatches(items);
    console.log();
  }

  // ── Farm layouts ──
  console.log('Extracting farm layouts …');
  const farmTypes = extractFarmLayouts(existing.farmTypes ?? []);
  console.log(`  ${farmTypes.length} farm types\n`);

  // ── Island farm ──
  console.log('Extracting Ginger Island farm …');
  const islandFarm = extractIslandFarm();
  console.log();

  // ── Crops ──
  console.log('Extracting crops …');
  const crops = extractCrops(items);
  console.log(`  ${crops.length} crops extracted`);

  // ── Fish ──
  console.log('Extracting fish data …');
  const fish = extractFish(items);
  console.log(`  ${fish.length} fish extracted\n`);

  // ── Recipes ──
  console.log('Extracting cooking recipes …');
  const recipes = extractRecipes(items);
  console.log(`  ${recipes.length} recipes extracted\n`);

  // ── Machine defs ──
  console.log('Extracting machine definitions …');
  const machineDefs = extractMachineDefs(items);
  console.log(`  ${machineDefs.length} machines, ${machineDefs.reduce((n,m)=>n+m.rules.length,0)} rules\n`);

  // ── Fish pond data ──
  console.log('Extracting fish pond data …');
  const fishPondData = extractFishPondData(items);

  // ── Building defs ──
  console.log('Extracting building definitions …');
  const buildingDefs = extractBuildingDefs();
  console.log(`  ${buildingDefs.length} building definitions\n`);

  // ── Tree defs ──
  const wildTreeDefs = TREE_SPRITES.map(({ key, file, cols, rows }) => ({
    type: key,
    name: key.charAt(0).toUpperCase() + key.slice(1) + ' Tree',
    spriteFile: `trees/${file}`,
    cols,
    rows,
    // Stump icon: col=0, row=6 (compact single-tile representation)
    iconX: 0,
    iconY: 6 * 16,
  }));

  // fruitTrees.png is 432×720 → 27 cols × 45 rows at 16px/cell.
  // Each tree type occupies a band of 5 rows (80px). iconY = spriteRow * 80.
  // iconX = 64 (col 4 × 16) shows the mature trunk stage.
  const fruitTreeDefs = FRUIT_TREE_DEFS.map(({ key, name, spriteRow }) => ({
    type: key,
    name,
    spriteFile: 'trees/fruitTrees.png',
    cols: 27,
    rows: 45,
    iconX: 64,          // mature trunk column (col 4)
    iconY: spriteRow * 80,
    isFruitTree: true,
  }));

  const treeDefs = [...wildTreeDefs, ...fruitTreeDefs];

  // ── NPC enrichment: portraits + schedules + gifts ──
  const tastes = readData('NPCGiftTastes.json');
  const byCheat = new Map(items.map(i => [i.cheatId, i]));

  // NPC name → actual portrait PNG name (for NPCs whose file differs from their display name)
  const PORTRAIT_FILE_OVERRIDES = {
    'Leo': 'ParrotBoy',
  };

  // Find all available portrait files
  const portraitFiles = existsSync(PORTRAITS_DIR)
    ? new Set(readdirSync(PORTRAITS_DIR).filter(f => f.endsWith('.png') && !f.includes('_')).map(f => f.replace('.png', '')))
    : new Set();

  const npcs = (existing.npcs ?? []).map(npc => {
    // Match NPC name to portrait file, respecting overrides (e.g. Leo → ParrotBoy.png)
    const portraitBase = PORTRAIT_FILE_OVERRIDES[npc.name] ?? npc.name;
    const portraitFile = portraitFiles.has(portraitBase) ? `${portraitBase}.png` : null;
    // Extract schedule from game files
    const schedules = extractSchedules(npc.name);
    // Rebuild gifts from NPCGiftTastes.json
    const npcKey = npc.name;
    const gifts = buildNPCGifts(npcKey, tastes, byCheat);
    return {
      ...npc,
      ...(portraitFile ? { portrait: portraitFile } : {}),
      ...(schedules.length > 0 ? { schedules } : {}),
      gifts,
    };
  });
  console.log(`  ${npcs.length} NPCs enriched (portraits, schedules, gifts)\n`);

  // ── Write ──
  const output = {
    version: '1.6',
    universalGifts,
    npcs,
    items,
    crops,
    fish,
    recipes,
    machineDefs,
    fishPondData,
    quests:   existing.quests  ?? [],
    bundles:  existing.bundles ?? [],
    farmTypes,
    buildingDefs,
    treeDefs,
    ...(islandFarm ? { islandFarm } : {}),
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Wrote ${OUT_FILE}`);
  console.log(`  ${items.length} items · ${fish.length} fish · ${recipes.length} recipes · ${output.npcs.length} NPCs · ${farmTypes.length} farm types · ${buildingDefs.length} building defs · ${treeDefs.length} tree types`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
