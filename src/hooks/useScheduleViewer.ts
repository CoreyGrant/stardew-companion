import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { NPC, Season, Weather } from '../types/game';
import { bestVariantEntries, getDayName } from '../utils/scheduleUtils';

function locationAtTime(entries: ReturnType<typeof bestVariantEntries>, time: number): string {
  let location = entries[0]?.location ?? '—';
  for (const entry of entries) {
    if (entry.time <= time) location = entry.location;
    else break;
  }
  return location;
}

interface NPCRow {
  npc: NPC;
  locations: string[];
}

export const DISPLAY_TIMES = [600, 1000, 1200, 1500, 1800, 2000];

interface ScheduleViewerState {
  loading: boolean;
  season: Season;
  setSeason: (v: Season) => void;
  day: number;
  setDay: (v: number) => void;
  weather: Weather;
  setWeather: (v: Weather) => void;
  year: number;
  setYear: (v: number) => void;
  search: string;
  setSearch: (v: string) => void;
  dayName: string;
  npcRows: NPCRow[];
  displayTimes: number[];
}

export function useScheduleViewer(): ScheduleViewerState {
  const { data, loading } = useGameData();
  const { activeSave, settings } = useUserData();

  const [season, setSeason] = useState<Season>(() => activeSave?.season ?? 'spring');
  const [day, setDay]       = useState<number>(() => activeSave?.day   ?? 1);
  const [weather, setWeather] = useState<Weather>('sunny');
  const [year, setYear]     = useState(1);
  const [search, setSearch] = useState('');

  const marriedTo = settings.tailorToSave ? (activeSave?.marriedTo ?? null) : null;

  const npcRows = useMemo<NPCRow[]>(() => {
    if (!data) return [];
    return data.npcs
      .filter((npc) => !search || npc.name.toLowerCase().includes(search.toLowerCase()))
      .map((npc) => {
        const entries   = bestVariantEntries(npc, season, weather, year, npc.id === marriedTo, day);
        const locations = DISPLAY_TIMES.map((t) => locationAtTime(entries, t));
        return { npc, locations };
      });
  }, [data, season, weather, year, search, marriedTo]);

  return {
    loading,
    season, setSeason,
    day, setDay,
    weather, setWeather,
    year, setYear,
    search, setSearch,
    dayName: getDayName(day),
    npcRows,
    displayTimes: DISPLAY_TIMES,
  };
}
