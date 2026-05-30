import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import type { NPC } from '../types/game';

export type NPCSortBy = 'birthday' | 'name' | 'marriageable';

const SEASON_ORDER: Record<string, number> = {
  spring: 0,
  summer: 1,
  fall:   2,
  winter: 3,
};

interface Filters {
  search: string;
  marriageableOnly: boolean;
  sortBy: NPCSortBy;
}

interface NPCListState {
  npcs: NPC[];
  loading: boolean;
  error: string | null;
  filters: Filters;
  setSearch: (v: string) => void;
  setMarriageableOnly: (v: boolean) => void;
  setSortBy: (v: NPCSortBy) => void;
}

function compareNPCs(a: NPC, b: NPC, sortBy: NPCSortBy): number {
  switch (sortBy) {
    case 'birthday': {
      const seasonDiff =
        (SEASON_ORDER[a.birthday.season] ?? 0) - (SEASON_ORDER[b.birthday.season] ?? 0);
      if (seasonDiff !== 0) return seasonDiff;
      return a.birthday.day - b.birthday.day;
    }
    case 'name':
      return a.name.localeCompare(b.name);
    case 'marriageable': {
      // Marriageable first, then alphabetical within each group
      if (a.marriageable !== b.marriageable) return a.marriageable ? -1 : 1;
      return a.name.localeCompare(b.name);
    }
  }
}

export function useNPCList(): NPCListState {
  const { data, loading, error } = useGameData();
  const [search, setSearch] = useState('');
  const [marriageableOnly, setMarriageableOnly] = useState(false);
  const [sortBy, setSortBy] = useState<NPCSortBy>('name');

  const npcs = useMemo(() => {
    if (!data) return [];
    return data.npcs
      .filter((npc) => {
        if (marriageableOnly && !npc.marriageable) return false;
        if (search && !npc.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => compareNPCs(a, b, sortBy));
  }, [data, search, marriageableOnly, sortBy]);

  return {
    npcs,
    loading,
    error,
    filters: { search, marriageableOnly, sortBy },
    setSearch,
    setMarriageableOnly,
    setSortBy,
  };
}
