import { useCallback, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { Bundle, CommunityRoom } from '../types/game';

interface BundleWithProgress extends Bundle {
  completedItemIds: string[];
  /** Resolved required count — always a number (defaults to all items) */
  resolvedRequired: number;
  isComplete: boolean;
}

interface BundlesByRoom {
  room: CommunityRoom;
  bundles: BundleWithProgress[];
  allComplete: boolean;
  completedCount: number;
  totalCount: number;
}

interface BundlesState {
  byRoom: BundlesByRoom[];
  toggleBundleItem: (bundleId: string, itemId: string) => void;
  loading: boolean;
  error: string | null;
}

const ROOM_ORDER: CommunityRoom[] = [
  'crafts_room',
  'pantry',
  'fish_tank',
  'boiler_room',
  'bulletin_board',
  'vault',
];

const ROOM_LABELS: Record<CommunityRoom, string> = {
  crafts_room: 'Crafts Room',
  pantry: 'Pantry',
  fish_tank: 'Fish Tank',
  boiler_room: 'Boiler Room',
  bulletin_board: 'Bulletin Board',
  vault: 'Vault',
};

const ROOM_REWARDS: Record<CommunityRoom, string> = {
  crafts_room: 'Bridge to the Quarry',
  pantry: 'Greenhouse',
  fish_tank: 'Glittering Boulder Removed',
  boiler_room: 'Minecarts Repaired',
  bulletin_board: 'Community Rewards',
  vault: 'Bus to Calico Desert',
};

export { ROOM_LABELS, ROOM_REWARDS };

export function useBundles(): BundlesState {
  const { data, loading, error } = useGameData();
  const { activeSave, updateBundleProgress } = useUserData();

  const byRoom = useMemo<BundlesByRoom[]>(() => {
    if (!data) return [];
    return ROOM_ORDER.map((room) => {
      const bundles = data.bundles
        .filter((b) => b.room === room)
        .map((b) => {
          const completedItemIds = activeSave?.bundleProgress[b.id] ?? [];
          const resolvedRequired = b.requiredCount ?? b.items.length;
          return {
            ...b,
            completedItemIds,
            resolvedRequired,
            isComplete: completedItemIds.length >= resolvedRequired,
          };
        });
      const completedCount = bundles.filter((b) => b.isComplete).length;
      return {
        room,
        bundles,
        allComplete: completedCount === bundles.length,
        completedCount,
        totalCount: bundles.length,
      };
    });
  }, [data, activeSave]);

  const toggleBundleItem = useCallback(
    (bundleId: string, itemId: string) => {
      if (!activeSave) return;
      const current = activeSave.bundleProgress[bundleId] ?? [];
      const next = current.includes(itemId)
        ? current.filter((i) => i !== itemId)
        : [...current, itemId];
      updateBundleProgress(activeSave.id, bundleId, next);
    },
    [activeSave, updateBundleProgress]
  );

  return { byRoom, toggleBundleItem, loading, error };
}
