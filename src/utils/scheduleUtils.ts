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
  if (lc.startsWith('rain'))        return 'rainy';
  if (lc === 'greenrain')           return 'stormy';
  if (lc === 'storm' || lc === 'thunder') return 'stormy';
  if (lc === 'snow' || lc === 'snowy')    return 'snowy';
  if (lc === 'wind' || lc === 'windy')    return 'windy';
  return null;
}

/**
 * Parse a schedule variant ID into conditions.
 * IDs follow the pattern: `{season}`, `{dayOfWeek}`, `{day}`, `{weather}`,
 * `{season}_{dayOfWeek}`, `{season}_{day}`, etc. — split on `_`.
 *
 * Examples:
 *   "spring"    → { season: "spring" }
 *   "Wed"       → { dayOfWeek: "Wed" }
 *   "rain"      → { weather: "rainy" }
 *   "rain2"     → { weather: "rainy" }
 *   "GreenRain" → { weather: "stormy" }
 *   "11"        → { day: 11 }
 *   "spring_4"  → { season: "spring", day: 4 }
 *   "fall_Mon"  → { season: "fall", dayOfWeek: "Mon" }
 */
export function parseConditionsFromId(id: string): ScheduleCondition {
  const result: ScheduleCondition = {};
  const parts = id.split('_');

  for (const part of parts) {
    // Season
    if (SEASONS.has(part.toLowerCase())) {
      result.season = part.toLowerCase() as Season;
      continue;
    }

    // Day of week (3-letter abbreviation, case-sensitive as game uses it)
    if (DAYS_OF_WEEK.has(part)) {
      result.dayOfWeek = part;
      continue;
    }

    // Weather
    const w = weatherFromPart(part);
    if (w) {
      result.weather = w;
      continue;
    }

    // Specific day of season (pure integer token, e.g. "6", "11", "15")
    const n = parseInt(part, 10);
    if (!isNaN(n) && String(n) === part) {
      result.day = n;
      continue;
    }

    // Unknown token (e.g. festival name, event id) — leave unhandled
  }

  return result;
}

// ── Scoring ────────────────────────────────────────────────────────────────────
//
// Priority (highest wins) mirrors the Stardew Valley schedule-key resolution:
//   specific day  > day-of-week > weather  > season  ≈ year/married
//
// Score contributions (accumulated, not exclusive):
//   season match:    +1
//   weather match:   +2
//   dayOfWeek match: +3
//   day match:       +8   (beats any combination of the others)
//   married match:   +4
//   minYear match:   +1

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
): number {
  // Merge stored conditions (extraction) with ID-derived ones.
  // Stored conditions win when set; parsed fills in when missing.
  const parsed = parseConditionsFromId(variant.id);
  const c: ScheduleCondition = {
    season:     variant.conditions.season     ?? parsed.season,
    weather:    variant.conditions.weather    ?? parsed.weather,
    minYear:    variant.conditions.minYear    ?? parsed.minYear,
    married:    variant.conditions.married    ?? parsed.married,
    dayOfWeek:  variant.conditions.dayOfWeek  ?? parsed.dayOfWeek,
    day:        variant.conditions.day        ?? parsed.day,
  };

  // Hard-fail on mismatches
  const seasonMatch  = !c.season  || (Array.isArray(c.season)  ? c.season.includes(season)   : c.season === season);
  const weatherMatch = !c.weather || (Array.isArray(c.weather) ? c.weather.includes(weather) : c.weather === weather);
  const yearMatch    = c.minYear === undefined || year >= c.minYear;
  const marriedMatch = c.married === undefined || c.married === married;
  const dowMatch     = !c.dayOfWeek || c.dayOfWeek === getDayName(day);
  const dayMatch     = c.day === undefined || c.day === day;

  if (!seasonMatch || !weatherMatch || !yearMatch || !marriedMatch || !dowMatch || !dayMatch) return -1;

  // Accumulate specificity score
  let score = 0;
  if (c.season)             score += 1;
  if (c.weather)            score += 2;
  if (c.dayOfWeek)          score += 3;
  if (c.day !== undefined)  score += 8;
  if (c.married !== undefined) score += 4;
  if (c.minYear !== undefined) score += 1;

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
): ScheduleVariant | null {
  let best: ScheduleVariant | null = null;
  let bestScore = -1;

  for (const variant of npc.schedules) {
    const score = scoreVariant(variant, season, weather, year, marriedToNpc, day);
    if (score > bestScore) {
      bestScore = score;
      best = variant;
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
): ScheduleEntry[] {
  return bestVariant(npc, season, weather, year, marriedToNpc, day)?.entries ?? [];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Returns the 3-letter day-of-week abbreviation for a given 1-based season day. */
export function getDayName(day: number): string {
  return DAY_NAMES[(day - 1) % 7];
}
