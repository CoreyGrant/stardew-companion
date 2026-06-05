import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { NPC } from '../types/game';
import type { SaveContext } from '../utils/scheduleUtils';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ScheduleFilterState {
  communityStatus:    string;     // 'none' | 'cc-restored' | 'joja-member' | 'joja-complete'
  setCommunityStatus: (v: string)  => void;
  marriedTo:          string;     // '' or NPC id
  setMarriedTo:       (v: string)  => void;
  islandUnlocked:     boolean;
  setIslandUnlocked:  (v: boolean) => void;
  /** Derived SaveContext ready to pass to bestVariantEntries / scoreVariant. */
  saveCtx:            SaveContext;
  /** Marriageable NPCs sorted alphabetically — for the "Married to" dropdown. */
  marriageableNpcs:   NPC[];
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Manages the game-state conditions that affect NPC schedule selection.
 * Values pre-populate from the active save (when tailorToSave is on) but are
 * fully user-overrideable so the schedule can be previewed in different states.
 *
 * heartLevels are read from the save silently (too many NPCs to surface in UI)
 * and passed through in saveCtx for the notFriendship condition checks.
 */
export function useScheduleFilters(): ScheduleFilterState {
  const { activeSave, settings } = useUserData();
  const { data }                 = useGameData();

  const hasSave = settings.tailorToSave && Boolean(activeSave);

  // Each control initialises from the save on first render, then becomes
  // independent — user can explore different game states without affecting
  // the actual save.
  const [communityStatus, setCommunityStatus] = useState<string>(() =>
    hasSave ? (activeSave?.communityStatus ?? 'none') : 'none',
  );
  const [marriedTo, setMarriedTo] = useState<string>(() =>
    hasSave ? (activeSave?.marriedTo ?? '') : '',
  );
  const [islandUnlocked, setIslandUnlocked] = useState<boolean>(() =>
    hasSave ? Boolean(activeSave?.islandFarmLayout) : false,
  );

  // heartLevels always come from the save (needed for notFriendship variant
  // conditions but not surfaced as a UI control — too many NPCs).
  const heartLevels = hasSave ? activeSave?.heartLevels : undefined;

  const saveCtx = useMemo<SaveContext>(() => ({
    communityStatus: communityStatus === 'none' ? undefined : communityStatus,
    heartLevels,
    islandUnlocked,
  }), [communityStatus, heartLevels, islandUnlocked]);

  const marriageableNpcs = useMemo(
    () => (data?.npcs ?? [])
      .filter(n => n.marriageable)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  return {
    communityStatus, setCommunityStatus,
    marriedTo,       setMarriedTo,
    islandUnlocked,  setIslandUnlocked,
    saveCtx,
    marriageableNpcs,
  };
}
