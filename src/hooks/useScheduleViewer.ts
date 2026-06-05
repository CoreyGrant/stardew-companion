import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { NPC, Season, Weather } from '../types/game';
import { bestVariantEntries, getDayName, locationLabel } from '../utils/scheduleUtils';
import { useScheduleFilters, type ScheduleFilterState } from './useScheduleFilters';

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single continuous block of time spent at a location. */
export type Segment = {
  startTime: number; // SDV time (600 = 6am, 2400 = midnight, 2600 = 2am)
  endTime:   number;
  location:  string; // player-friendly label
};

interface NPCRow {
  npc:         NPC;
  segments:    Segment[];
  hasSchedule: boolean;
}

export interface ScheduleViewerState extends ScheduleFilterState {
  loading:    boolean;
  season:     Season;   setSeason:  (v: Season)  => void;
  day:        number;   setDay:     (v: number)  => void;
  weather:    Weather;  setWeather: (v: Weather) => void;
  year:       number;   setYear:    (v: number)  => void;
  dayName:    string;
  npcRows:    NPCRow[];
}

// Visible time range: 6 am → 2 am (next day)
const RANGE_START = 600;
const RANGE_END   = 2600;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useScheduleViewer(): ScheduleViewerState {
  const { data, loading }  = useGameData();
  const { activeSave }     = useUserData();

  // Date / weather state
  const [season,  setSeason]  = useState<Season>(() => activeSave?.season ?? 'spring');
  const [day,     setDay]     = useState<number>(() => activeSave?.day    ?? 1);
  const [weather, setWeather] = useState<Weather>('sunny');
  const [year,    setYear]    = useState(1);

  // Game-state condition filters (community status, married to, island unlocked)
  const filters = useScheduleFilters();

  const npcRows = useMemo<NPCRow[]>(() => {
    if (!data) return [];

    const marriedToId = filters.marriedTo || null;

    return data.npcs.map(npc => {
      const entries = bestVariantEntries(
        npc, season, weather, year,
        npc.id === marriedToId,
        day,
        filters.saveCtx,
      );

      // Build time-range segments from sequential schedule entries.
      const raw = entries
        .map((entry, i) => ({
          startTime: entry.time,
          endTime:   entries[i + 1]?.time ?? RANGE_END,
          location:  locationLabel(entry.location),
        }))
        .filter(s => s.endTime > RANGE_START && s.startTime < RANGE_END);

      // Merge consecutive segments at the same location (e.g. Linus: Mountain ×4 → ×1)
      const segments: Segment[] = [];
      for (const seg of raw) {
        const last = segments[segments.length - 1];
        if (last && last.location === seg.location) {
          last.endTime = seg.endTime;
        } else {
          segments.push({ ...seg });
        }
      }

      return { npc, segments, hasSchedule: segments.length > 0 };
    });
  }, [data, season, day, weather, year, filters.marriedTo, filters.saveCtx]);

  return {
    loading,
    season, setSeason,
    day, setDay,
    weather, setWeather,
    year, setYear,
    dayName: getDayName(day),
    npcRows,
    ...filters,
  };
}
