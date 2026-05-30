import { useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import type { GameData } from '../types/game';

export type SearchResultType = 'item' | 'npc' | 'recipe' | 'quest' | 'bundle';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  name: string;
  /** Short context shown under the name */
  subtitle?: string;
  /** React-Router route to navigate to */
  route: string;
  spriteSheet?: string;
  spriteIndex?: number;
  isBigCraftable?: boolean;
}

export const RESULT_TYPE_ORDER: SearchResultType[] = [
  'npc', 'item', 'recipe', 'quest', 'bundle',
];

export const RESULT_TYPE_LABELS: Record<SearchResultType, string> = {
  item:    'Items',
  npc:     'Characters',
  recipe:  'Recipes',
  quest:   'Quests',
  bundle:  'Bundles',
};

const ROOM_LABELS: Record<string, string> = {
  crafts_room:    'Crafts Room',
  pantry:         'Pantry',
  fish_tank:      'Fish Tank',
  boiler_room:    'Boiler Room',
  bulletin_board: 'Bulletin Board',
  vault:          'Vault',
};

function buildIndex(data: GameData): SearchResult[] {
  const index: SearchResult[] = [];

  // ── Items (includes fish, crops, minerals, etc.) ──
  for (const item of data.items) {
    // Enrich subtitle with fish season/location or crop season
    let subtitle = item.category.replace('_', ' ');
    const fish = data.fish.find(f => f.itemId === item.id);
    if (fish) {
      const seasons = fish.seasons.join('/');
      const loc     = fish.locations[0] ?? '';
      subtitle = `${seasons} · ${loc}`;
    } else {
      const crop = data.crops.find(c => c.harvestItemId === item.cheatId);
      if (crop) subtitle = crop.seasons.join('/') + ' crop';
    }

    index.push({
      type:          'item',
      id:            item.id,
      name:          item.name,
      subtitle,
      route:         `/items/${item.id}`,
      spriteSheet:   item.spriteSheet,
      spriteIndex:   item.spriteIndex,
      isBigCraftable: item.isBigCraftable,
    });
  }

  // ── NPCs ──
  for (const npc of data.npcs) {
    const { season, day } = npc.birthday;
    const s = season.charAt(0).toUpperCase() + season.slice(1);
    index.push({
      type:     'npc',
      id:       npc.id,
      name:     npc.name,
      subtitle: `Birthday: ${s} ${day}`,
      route:    `/characters/${npc.id}`,
    });
  }

  // ── Recipes (by result item name to avoid abbreviations) ──
  const seenRecipe = new Set<string>();
  for (const recipe of data.recipes) {
    if (seenRecipe.has(recipe.resultItemName)) continue;
    seenRecipe.add(recipe.resultItemName);
    // Find result item for sprite
    const resItem = data.items.find(i => i.id === recipe.resultItemRefId);
    index.push({
      type:        'recipe',
      id:          recipe.id,
      name:        recipe.resultItemName,
      subtitle:    recipe.source,
      route:       '/recipes',
      spriteSheet: resItem?.spriteSheet,
      spriteIndex: resItem?.spriteIndex,
    });
  }

  // ── Quests ──
  for (const quest of data.quests) {
    index.push({
      type:     'quest',
      id:       quest.id,
      name:     quest.name,
      subtitle: quest.type.replace('_', ' '),
      route:    `/quests/${quest.id}`,
    });
  }

  // ── Bundles ──
  for (const bundle of data.bundles) {
    index.push({
      type:     'bundle',
      id:       bundle.id,
      name:     bundle.name,
      subtitle: ROOM_LABELS[bundle.room] ?? bundle.room,
      route:    '/bundles',
    });
  }

  return index;
}

function rankScore(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q)             return 0;
  if (n.startsWith(q))    return 1;
  return 2;
}

export function useGlobalSearch(query: string): Map<SearchResultType, SearchResult[]> {
  const { data } = useGameData();

  const index = useMemo<SearchResult[]>(() => {
    if (!data) return [];
    return buildIndex(data);
  }, [data]);

  return useMemo<Map<SearchResultType, SearchResult[]>>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return new Map();

    const matches = index
      .filter(r => r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const sa = rankScore(a.name, q);
        const sb = rankScore(b.name, q);
        if (sa !== sb) return sa - sb;
        return a.name.localeCompare(b.name);
      });

    const grouped = new Map<SearchResultType, SearchResult[]>();
    for (const type of RESULT_TYPE_ORDER) {
      const forType = matches.filter(r => r.type === type);
      if (forType.length > 0) grouped.set(type, forType);
    }

    return grouped;
  }, [index, query]);
}
