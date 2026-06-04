import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import type { Item, ItemCategory } from '../types/game';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';

export type { ActiveSort };

// Sort fields for items — no external dependencies so defined as a constant.
export const ITEM_SORT_FIELDS: SortFieldDef<Item>[] = [
  {
    id: 'name',
    label: 'Name',
    compareFn: (a, b) => a.name.localeCompare(b.name),
    defaultDirection: 'asc',
  },
  {
    id: 'value',
    label: 'Sell Value',
    compareFn: (a, b) => (a.sellValue ?? 0) - (b.sellValue ?? 0),
    defaultDirection: 'desc',
  },
  {
    id: 'energy',
    label: 'Energy',
    compareFn: (a, b) => (a.energy ?? -Infinity) - (b.energy ?? -Infinity),
    defaultDirection: 'desc',
  },
];

const DEFAULT_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

interface ItemListState {
  items: Item[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (v: string) => void;
  category: ItemCategory | 'all';
  setCategory: (v: ItemCategory | 'all') => void;
  sorts: ActiveSort[];
  setSorts: (v: ActiveSort[]) => void;
  /** True when any item in current result set has energy data */
  hasEnergy: boolean;
}

export function useItemList(): ItemListState {
  const { data, loading, error } = useGameData();
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [sorts,    setSorts]    = useState<ActiveSort[]>(DEFAULT_SORTS);

  const fieldMap = useMemo(
    () => new Map(ITEM_SORT_FIELDS.map((f) => [f.id, f])),
    [],
  );

  const items = useMemo(() => {
    if (!data) return [];

    const filtered = data.items.filter((item) => {
      if (!item.id || item.name === '???') return false;
      if (category !== 'all' && item.category !== category) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    if (!sorts.length) return filtered;

    return [...filtered].sort((a, b) => {
      for (const s of sorts) {
        const f = fieldMap.get(s.fieldId);
        if (!f) continue;
        const c = f.compareFn(a, b);
        if (c !== 0) return s.direction === 'asc' ? c : -c;
      }
      return 0;
    });
  }, [data, search, category, sorts, fieldMap]);

  const hasEnergy = items.some((i) => i.energy !== undefined);

  return { items, loading, error, search, setSearch, category, setCategory, sorts, setSorts, hasEnergy };
}
