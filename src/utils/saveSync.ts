/**
 * Utilities for splitting a SaveFile into shared + per-character blobs for the
 * sync server, and merging them back into a SaveFile on receipt.
 */

import type { SaveFile, Skill } from '../types/save';

// ── Type definitions ──────────────────────────────────────────────────────────

/** Fields that are identical for every player in a room (farm/world state). */
export type SharedSaveData = Pick<SaveFile,
  | 'farmType'
  | 'year'
  | 'season'
  | 'day'
  | 'farmLayout'
  | 'islandFarmLayout'
  | 'bundleProgress'
  | 'museumDonations'
  | 'communityStatus'
  | 'goldenWalnuts'
  | 'deepestMineLevel'
  | 'deepestSkullCavernLevel'
>;

/** Fields that belong to one specific player character. */
export interface CharacterSaveData {
  /** The player's in-game name (not the compound "Farm (Player)" label). */
  charName: string;
  skills: Record<Skill, number>;
  marriedTo: string | null;
  heartLevels?: Record<string, number>;
  questProgress: Record<string, string[]>;
  learnedCookingRecipes?: string[];
  money?: number;
}

const SHARED_KEYS: (keyof SharedSaveData)[] = [
  'farmType', 'year', 'season', 'day',
  'farmLayout', 'islandFarmLayout',
  'bundleProgress', 'museumDonations', 'communityStatus',
  'goldenWalnuts', 'deepestMineLevel', 'deepestSkullCavernLevel',
];

// ── Split ─────────────────────────────────────────────────────────────────────

/**
 * Extract the shared and per-character portions of a SaveFile into JSON strings.
 *
 * @param save         The host's SaveFile (provides shared data + character 0)
 * @param allCharacters All character data (index 0 = host, 1+ = farmhands)
 */
export function splitSaveForSync(
  save: SaveFile,
  allCharacters: CharacterSaveData[],
): { sharedBlob: string; charactersBlob: string } {
  const shared: Partial<SharedSaveData> = {};
  for (const key of SHARED_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (shared as any)[key] = (save as any)[key];
  }

  return {
    sharedBlob:     JSON.stringify(shared),
    charactersBlob: JSON.stringify(allCharacters),
  };
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * Merge a received shared + character blob back into a SaveFile.
 * Preserves all app-local fields (id, createdAt, sourceFileName, roomId, charCode, etc.)
 */
export function mergeSyncData(
  existing: SaveFile,
  sharedBlob: string,
  characterBlob: string,
): SaveFile {
  const shared    = JSON.parse(sharedBlob)    as SharedSaveData;
  const character = JSON.parse(characterBlob) as CharacterSaveData;

  // Derive a compound name: "FarmName (CharName)"
  // Use the existing farm name stem if available, otherwise fall back to existing name
  const farmStem  = existing.name.replace(/\s*\(.*\)$/, '').trim() || existing.name;
  const newName   = character.charName
    ? `${farmStem} (${character.charName})`
    : existing.name;

  return {
    ...existing,
    // Apply shared fields
    ...shared,
    // Apply per-character fields
    skills:                 character.skills,
    marriedTo:              character.marriedTo,
    heartLevels:            character.heartLevels,
    questProgress:          character.questProgress,
    learnedCookingRecipes:  character.learnedCookingRecipes,
    money:                  character.money,
    // Update display name
    name: newName,
  };
}

// ── Extract character data from a SaveFile ────────────────────────────────────

/** Pull the per-character portion out of a fully-populated SaveFile. */
export function extractCharacterData(
  save: SaveFile,
  charName: string,
): CharacterSaveData {
  return {
    charName,
    skills:                save.skills,
    marriedTo:             save.marriedTo,
    heartLevels:           save.heartLevels,
    questProgress:         save.questProgress,
    learnedCookingRecipes: save.learnedCookingRecipes,
    money:                 save.money,
  };
}
