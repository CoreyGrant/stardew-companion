import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import type { Item, ItemCategory } from '../types/game';

export type ItemSortKey = 'name' | 'value' | 'energy';

interface ItemListState {
  items: Item[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (v: string) => void;
  category: ItemCategory | 'all';
  setCategory: (v: ItemCategory | 'all') => void;
  sort: ItemSortKey;
  setSort: (v: ItemSortKey) => void;
  /** True when any item in current result set has energy data */
  hasEnergy: boolean;
}

export function useItemList(): ItemListState {
  const { data, loading, error } = useGameData();
  const [search, setSearch]     = useState('');
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [sort, setSort]         = useState<ItemSortKey>('name');

  const items = useMemo(() => {
    if (!data) return [];
    const filtered = data.items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'value')  return (b.sellValue ?? 0) - (a.sellValue ?? 0);
      if (sort === 'energy') return (b.energy ?? -Infinity) - (a.energy ?? -Infinity);
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [data, search, category, sort]);

  const hasEnergy = items.some((i) => i.energy !== undefined);

  return { items, loading, error, search, setSearch, category, setCategory, sort, setSort, hasEnergy };
}
