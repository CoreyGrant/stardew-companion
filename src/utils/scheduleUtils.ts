import type { NPC, ScheduleCondition, ScheduleEntry, ScheduleVariant, Season, Weather } from '../types/game';

// ── Condition parsing ──────────────────────────────────────────────────────────
//
// The extraction script stores schedule keys as the variant `id` (e.g. "spring",
// "Wed", "rain", "spring_4", "fall_Mon") but doesn't populate `conditions`.
// We derive conditions from the ID at runtime so scoring works correctly.

const SEASONS      = new Set<string>(['spring', 'summer', 'fall', 'winter']);
const DAYS_OF_WEEK = new Set<string>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

/**
 * Weather keywords that appear in schedule keys (case-sensitive as extracted).
 * "rain" and "rain2" → rainy; "GreenRain" → stormy.
 */
function weatherFromPart(part: string): Weather | null {
  const lc = part.toLowerCase();
  if (lc.startsWith('rain'))               return 'rainy';
  if (lc === 'greenrain')                  return 'stormy';
  if (lc === 'storm' || lc === 'thunder')  return 'stormy';
  if (lc === 'snow'  || lc === 'snowy')    return 'snowy';
  if (lc === 'wind'  || lc === 'windy')    return 'windy';
  return null;
}

/**
 * Parse a schedule variant ID into conditions.
 *
 * Special prefixes / whole-ID tokens:
 *   marriage_  → married: true (remainder parsed normally)
 *   marriageJob → married: true (post-marriage work schedule; Harvey/Maru/Penny)
 *   bus         → busRepaired: true (Pam's bus-driving variant)
 *   noBridge    → ignored (bridge repair has no save field)
 *   normal      → ignored (event-flag gate with no save equivalent)
 *   SquidFest / TroutDerby / DesertFestival
 *               → ignored (festival-day gates; need specific date ranges in data)
 *
 * Examples:
 *   "spring"        → { season: "spring" }
 *   "Wed"           → { dayOfWeek: "Wed" }
 *   "rain"          → { weather: "rainy" }
 *   "GreenRain"     → { weather: "stormy" }
 *   "11"            → { day: 11 }
 *   "spring_4"      → { season: "spring", day: 4 }
 *   "fall_Mon"      → { season: "fall", dayOfWeek: "Mon" }
 *   "marriage_Mon"  → { married: true, dayOfWeek: "Mon" }
 *   "marriageJob"   → { married: true }
 *   "bus"           → { busRepaired: true }
 */
export function parseConditionsFromId(id: string): ScheduleCondition {
  const result: ScheduleCondition = {};

  // marriage_ prefix: variants that only apply after the player marries this NPC.
  let workId = id;
  if (workId.startsWith('marriage_')) {
    result.married = true;
    workId = workId.slice('marriage_'.length);
  }

  // Whole-ID special cases (checked before splitting on '_')
  if (workId === 'marriageJob') { result.married = true; return result; }
  if (workId === 'bus')         { result.busRepaired = true; return result; }

  for (const part of workId.split('_')) {
    // Tokens with no save-state equivalent — skip silently
    if (part === 'noBridge' || part === 'normal') continue;
    // Festival-day gates — skip until exact dates are added to gamedata
    if (part === 'SquidFest' || part === 'TroutDerby' || part === 'DesertFestival') continue;

    if (SEASONS.has(part.toLowerCase())) {
      result.season = part.toLowerCase() as Season;
      continue;
    }

    if (DAYS_OF_WEEK.has(part)) {
      result.dayOfWeek = part;
      continue;
    }

    const w = weatherFromPart(part);
    if (w) { result.weather = w; continue; }

    // Specific day of season (pure integer token, e.g. "6", "11", "15")
    const n = parseInt(part, 10);
    if (!isNaN(n) && String(n) === part) { result.day = n; continue; }

    // Unknown token — leave unhandled
  }

  return result;
}

// ── Scoring ────────────────────────────────────────────────────────────────────
//
// Priority (highest wins) mirrors the Stardew Valley schedule-key resolution:
//   specific day  > day-of-week > weather  > season  ≈ year/married
//
// Score contributions (accumulated):
//   season match:      +1
//   weather match:     +2
//   dayOfWeek match:   +3
//   day match:         +8   (beats any combination of the others)
//   married match:     +4
//   minYear match:     +1
//   ccRestored match:  +2   (save-state gate — more specific than bare season)
//   busRepaired match: +2
//   islandUnlocked:    +2

/**
 * Extra save-state context to refine schedule selection.
 * All fields are optional — scoring degrades gracefully without them.
 */
export interface SaveContext {
  communityStatus?: string;                 // 'cc-restored' | 'joja-complete' | 'joja-member'
  heartLevels?:     Record<string, number>; // NPC id → heart level (0–14)
  islandUnlocked?:  boolean;               // true once player has island farm layout
  /**
   * Whether the desert bus is repaired. Distinct from communityStatus because
   * the Vault room bundles restore the bus independently of full CC completion
   * or Joja route completion.
   */
  busRepaired?:     boolean;
}

/**
 * Score how well a variant matches the given conditions.
 * Returns -1 if any hard condition fails; otherwise a positive specificity score.
 *
 * Conditions are taken from the stored `variant.conditions` merged with those
 * derived from parsing the variant `id` — parsed fields only fill in if the
 * stored ones are absent (handles the common case where extraction left them empty).
 */
export function scoreVariant(
  variant: ScheduleVariant,
  season: Season,
  weather: Weather,
  year: number,
  married: boolean,
  day: number,
  ctx: SaveContext = {},
): number {
  // Merge stored conditions with ID-derived ones.
  // Stored conditions take precedence (explicit extraction data beats heuristic parsing).
  const stored = variant.conditions ?? {};
  const parsed = parseConditionsFromId(variant.id);

  const c: ScheduleCondition = {
    season:         stored.season         ?? parsed.season,
    weather:        stored.weather        ?? parsed.weather,
    minYear:        stored.minYear        ?? parsed.minYear,
    married:        stored.married        ?? parsed.married,
    dayOfWeek:      stored.dayOfWeek      ?? parsed.dayOfWeek,
    day:            stored.day            ?? parsed.day,
    ccRestored:     stored.ccRestored     ?? parsed.ccRestored,
    busRepaired:    stored.busRepaired    ?? parsed.busRepaired,
    islandUnlocked: stored.islandUnlocked ?? parsed.islandUnlocked,
    // notFriendship only comes from stored conditions (can't be parsed from ID)
    notFriendship:  stored.notFriendship,
  };

  // ── Hard-fail checks ──────────────────────────────────────────────────────

  const seasonMatch  = !c.season  || (Array.isArray(c.season)  ? c.season.includes(season)   : c.season  === season);
  const weatherMatch = !c.weather || (Array.isArray(c.weather) ? c.weather.includes(weather) : c.weather === weather);
  const yearMatch    = c.minYear   === undefined || year >= c.minYear;
  const marriedMatch = c.married   === undefined || c.married === married;
  const dowMatch     = !c.dayOfWeek || c.dayOfWeek === getDayName(day);
  const dayMatch     = c.day       === undefined || c.day    === day;

  if (!seasonMatch || !weatherMatch || !yearMatch || !marriedMatch || !dowMatch || !dayMatch) return -1;

  // Save-state conditions (only checked when the relevant save field is available)

  if (c.ccRestored !== undefined && ctx.communityStatus !== undefined) {
    const isRestored = ctx.communityStatus === 'cc-restored';
    if (c.ccRestored !== isRestored) return -1;
  }

  if (c.busRepaired !== undefined && ctx.busRepaired !== undefined) {
    if (c.busRepaired !== ctx.busRepaired) return -1;
  }

  if (c.islandUnlocked !== undefined && ctx.islandUnlocked !== undefined) {
    if (c.islandUnlocked !== ctx.islandUnlocked) return -1;
  }

  // notFriendship: variant only applies when player has < minHearts with the named NPC.
  // Example: Abigail day-11 variant only fires if player has < 6 hearts with Sebastian.
  if (c.notFriendship && ctx.heartLevels) {
    const npcKey   = c.notFriendship.npc.toLowerCase();
    const actual   = ctx.heartLevels[npcKey] ?? 0;
    if (actual >= c.notFriendship.minHearts) return -1;
  }

  // ── Specificity score ─────────────────────────────────────────────────────

  let score = 0;
  if (c.season)               score += 1;
  if (c.weather)              score += 2;
  if (c.dayOfWeek)            score += 3;
  if (c.day !== undefined)    score += 8;
  if (c.married !== undefined) score += 4;
  if (c.minYear !== undefined) score += 1;
  // Save-state gates add moderate specificity — more specific than a bare season,
  // less specific than a day-of-week.
  if (c.ccRestored     !== undefined) score += 2;
  if (c.busRepaired    !== undefined) score += 2;
  if (c.islandUnlocked !== undefined) score += 2;

  return score;
}

// ── Lookup helpers ─────────────────────────────────────────────────────────────

/**
 * Return the best-matching variant itself (for showing its label / conditions).
 */
export function bestVariant(
  npc: NPC,
  season: Season,
  weather: Weather,
  year: number,
  marriedToNpc: boolean,
  day: number = 1,
  ctx: SaveContext = {},
): ScheduleVariant | null {
  let best: ScheduleVariant | null = null;
  let bestScore = -1;

  for (const variant of npc.schedules) {
    const score = scoreVariant(variant, season, weather, year, marriedToNpc, day, ctx);
    if (score > bestScore) {
      bestScore = score;
      best      = variant;
    }
  }

  return best;
}

/**
 * Return the schedule entries for the best-matching variant, or [] if none matches.
 */
export function bestVariantEntries(
  npc: NPC,
  season: Season,
  weather: Weather,
  year: number,
  marriedToNpc: boolean,
  day: number = 1,
  ctx: SaveContext = {},
): ScheduleEntry[] {
  return bestVariant(npc, season, weather, year, marriedToNpc, day, ctx)?.entries ?? [];
}

// ── Location display-name mapping ─────────────────────────────────────────────
//
// SDV stores internal map names in schedule data that are not player-facing.
// Map them to the names players recognise before any UI renders them.

const LOCATION_LABELS: Record<string, string> = {
  'Josh House':          "Alex's House",      // Internal map name for George/Evelyn/Alex's home
  'Science House':       'Mountain Rd. Home', // Robin/Demetrius/Maru/Sebastian's house interior
  'The Mines (Level 5)': 'The Mines',         // Dwarf — fixed spot near entrance, never level 5
};

/** Return a player-friendly label for a raw SDV location string. */
export function locationLabel(raw: string): string {
  return LOCATION_LABELS[raw] ?? raw;
}

// ── Date helpers ───────────────────────────────────────────────────────────────

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Returns the 3-letter day-of-week abbreviation for a given 1-based season day. */
export function getDayName(day: number): string {
  return DAY_NAMES[(day - 1) % 7];
}
