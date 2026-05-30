import { useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { GiftPreferences, Item, NPC } from '../types/game';

interface NPCDetailState {
  npc: NPC | null;
  gifts: GiftPreferences;
  lovedItems: Item[];
  likedItems: Item[];
  loading: boolean;
  error: string | null;
  isMarried: boolean;
  tailored: boolean;
}

export function useNPCDetail(id: string | undefined): NPCDetailState {
  const { data, loading, error } = useGameData();
  const { activeSave, settings } = useUserData();

  const npc = useMemo(
    () => (id ? (data?.npcs.find((n) => n.id === id) ?? null) : null),
    [data, id]
  );

  const lovedItems = useMemo(
    () => (npc ? (data?.items.filter((i) => i.lovedBy.includes(npc.id)) ?? []) : []),
    [data, npc]
  );

  const likedItems = useMemo(
    () => (npc ? (data?.items.filter((i) => i.likedBy.includes(npc.id)) ?? []) : []),
    [data, npc]
  );

  // Compute full gift preferences: NPC-specific + universal, deduped
  const gifts = useMemo<GiftPreferences>(() => {
    if (!npc || !data) return { loved: [], liked: [], neutral: [], disliked: [], hated: [] };

    const toRef = (i: Item) => ({ id: i.id, name: i.name });

    const loved = lovedItems.map(toRef);
    const liked = likedItems.map(toRef);

    const universalLoved = data.universalGifts?.loved ?? [];
    const universalLiked = data.universalGifts?.liked ?? [];

    const lovedIds = new Set(loved.map((i) => i.id));
    const likedIds = new Set(liked.map((i) => i.id));

    const allLoved = [...loved, ...universalLoved.filter((u) => !lovedIds.has(u.id))];
    const allLiked = [...liked, ...universalLiked.filter((u) => !likedIds.has(u.id) && !lovedIds.has(u.id))];

    return { loved: allLoved, liked: allLiked, neutral: [], disliked: [], hated: [] };
  }, [npc, data, lovedItems, likedItems]);

  const isMarried =
    settings.tailorToSave && activeSave?.marriedTo === id;

  return { npc, gifts, lovedItems, likedItems, loading, error, isMarried, tailored: settings.tailorToSave };
}
