#!/usr/bin/env node
/**
 * Merges src/data/custom/*.json patches on top of the base gamedata.json.
 * Run: node scripts/build-data.mjs
 *
 * Patch format (any custom/*.json file):
 *   { "npcs": [...], "items": [...], "quests": [...] }
 * Arrays in patches are merged by id — existing entries are deep-merged,
 * new entries are appended.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASE_PATH = join(ROOT, 'public', 'gamedata.json');
const CUSTOM_DIR = join(ROOT, 'src', 'data', 'custom');
const OUT_PATH = join(ROOT, 'public', 'gamedata.json');

// ── Load base ─────────────────────────────────────────────────────────────────
if (!existsSync(BASE_PATH)) {
  console.error('Error: public/gamedata.json not found. Nothing to merge into.');
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASE_PATH, 'utf8'));
console.log(`Loaded base gamedata.json (version ${base.version})`);

// ── Load patches ──────────────────────────────────────────────────────────────
if (!existsSync(CUSTOM_DIR)) {
  console.log('No src/data/custom/ directory found — nothing to patch.');
  writeOutput(base);
  process.exit(0);
}

const patchFiles = readdirSync(CUSTOM_DIR).filter(f => f.endsWith('.json'));
if (patchFiles.length === 0) {
  console.log('No patch files in src/data/custom/ — nothing to patch.');
  writeOutput(base);
  process.exit(0);
}

// ── Apply patches ─────────────────────────────────────────────────────────────
const ARRAY_KEYS = ['npcs', 'items', 'crops', 'quests', 'bundles', 'farmTypes'];

for (const file of patchFiles) {
  const patch = JSON.parse(readFileSync(join(CUSTOM_DIR, file), 'utf8'));
  console.log(`Applying patch: ${file}`);

  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(patch[key])) continue;

    if (!Array.isArray(base[key])) base[key] = [];

    for (const patchEntry of patch[key]) {
      const idx = base[key].findIndex(e => e.id === patchEntry.id);
      if (idx >= 0) {
        base[key][idx] = deepMerge(base[key][idx], patchEntry);
      } else {
        base[key].push(patchEntry);
      }
    }
    console.log(`  ${key}: ${patch[key].length} entr${patch[key].length === 1 ? 'y' : 'ies'} patched`);
  }

  // Merge top-level scalar / object fields (e.g. universalGifts)
  for (const [k, v] of Object.entries(patch)) {
    if (ARRAY_KEYS.includes(k)) continue;
    base[k] = typeof v === 'object' && !Array.isArray(v) ? deepMerge(base[k] ?? {}, v) : v;
  }
}

writeOutput(base);

// ── Helpers ───────────────────────────────────────────────────────────────────
function deepMerge(target, source) {
  const out = Object.assign({}, target);
  for (const [k, v] of Object.entries(source)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v) &&
        typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function writeOutput(data) {
  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2), 'utf8');
  const npcs = data.npcs?.length ?? 0;
  const items = data.items?.length ?? 0;
  const quests = data.quests?.length ?? 0;
  const bundles = data.bundles?.length ?? 0;
  console.log(`\nWrote public/gamedata.json`);
  console.log(`  NPCs: ${npcs}  Items: ${items}  Quests: ${quests}  Bundles: ${bundles}`);
}
