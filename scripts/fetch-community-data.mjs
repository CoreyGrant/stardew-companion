#!/usr/bin/env node
/**
 * Optional helper: fetches Stardew Valley community data from the
 * stardew.app API and writes it to src/data/community-raw.json.
 * Run: node scripts/fetch-community-data.mjs
 *
 * The raw file is NOT committed — it's an intermediate step for
 * maintainers who want to regenerate gamedata.json from scratch
 * when a new game version ships.
 *
 * After running this, manually curate the output and copy relevant
 * entries into public/gamedata.json or src/data/custom/*.json patches.
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'data', 'community-raw.json');

// stardew.app exposes a public read-only JSON endpoint for its dataset
const SOURCES = [
  {
    label: 'Villagers',
    url: 'https://raw.githubusercontent.com/colecrouter/stardew-save-editor/main/public/data/villagers.json',
  },
  {
    label: 'Objects',
    url: 'https://raw.githubusercontent.com/colecrouter/stardew-save-editor/main/public/data/objects.json',
  },
];

const results = {};

for (const { label, url } of SOURCES) {
  console.log(`Fetching ${label}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    results[label] = await res.json();
    console.log(`  OK (${Object.keys(results[label]).length} entries)`);
  } catch (err) {
    console.warn(`  WARN: could not fetch ${label}: ${err.message}`);
    results[label] = null;
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 2), 'utf8');
console.log(`\nWrote src/data/community-raw.json`);
console.log('Review this file and manually incorporate relevant data into');
console.log('public/gamedata.json or src/data/custom/*.json patches.');
