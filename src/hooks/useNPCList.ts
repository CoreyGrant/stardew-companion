import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import type { NPC } from '../types/game';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';

// ── Sort field definitions ────────────────────────────────────────────────────

const SEASON_ORDER: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };

export const NPC_SORT_FIELDS: SortFieldDef<NPC>[] = [
  {
    id: 'name',
    label: 'Name',
    compareFn: (a, b) => a.name.localeCompare(b.name),
    defaultDirection: 'asc',
  },
  {
    id: 'birthday',
    label: 'Birthday',
    compareFn: (a, b) => {
      const sd = (SEASON_ORDER[a.birthday.season] ?? 0) - (SEASON_ORDER[b.birthday.season] ?? 0);
      return sd !== 0 ? sd : a.birthday.day - b.birthday.day;
    },
    defaultDirection: 'asc',
  },
  {
    id: 'marriageable',
    label: 'Marriageable',
    compareFn: (a, b) =>
      a.marriageable === b.marriageable ? 0 : a.marriageable ? -1 : 1,
    defaultDirection: 'asc', // asc = marriageable first
  },
];

export const DEFAULT_NPC_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

// ── Hook (filtering only — sorting handled by useMultiSort in the page) ───────

interface Filters {
  search: string;
  marriageableOnly: boolean;
}

interface NPCListState {
  npcs: NPC[];
  loading: boolean;
  error: string | null;
  filters: Filters;
  setSearch: (v: string) => void;
  setMarriageableOnly: (v: boolean) => void;
}

export function useNPCList(): NPCListState {
  const { data, loading, error } = useGameData();
  const [search,           setSearch]           = useState('');
  const [marriageableOnly, setMarriageableOnly] = useState(false);

  const npcs = useMemo(() => {
    if (!data) return [];
    return data.npcs.filter((npc) => {
      if (marriageableOnly && !npc.marriageable) return false;
      if (search && !npc.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, search, marriageableOnly]);

  return { npcs, loading, error, filters: { search, marriageableOnly }, setSearch, setMarriageableOnly };
}
