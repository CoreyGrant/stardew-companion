import { useEffect, useMemo, useRef, useState } from 'react';
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
  busRepaired:        boolean;
  setBusRepaired:     (v: boolean) => void;
  /** Derived SaveContext ready to pass to bestVariantEntries / scoreVariant. */
  saveCtx:            SaveContext;
  /** Marriageable NPCs sorted alphabetically — for the "Married to" dropdown. */
  marriageableNpcs:   NPC[];
}

// ── Vault bundle IDs that repair the desert bus when all are complete ──────────
// Completing all four Vault room bundles restores the bus independently of
// finishing the full CC or taking the Joja route.
const VAULT_BUNDLE_IDS = ['vault-2500', 'vault-5000', 'vault-10000', 'vault-25000'];

function isBusRepairedFromSave(
  communityStatus: string | undefined,
  bundleProgress:  Record<string, string[]> | undefined,
): boolean {
  // CC restored or Joja complete always includes bus repair
  if (communityStatus === 'cc-restored' || communityStatus === 'joja-complete') return true;
  // Vault room bundles each require 1 gold donation; all four must be complete
  if (!bundleProgress) return false;
  return VAULT_BUNDLE_IDS.every(id => (bundleProgress[id]?.length ?? 0) >= 1);
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

  // ── State — each control initialises from the save on first render ────────

  const [communityStatus, setCommunityStatus] = useState<string>(() =>
    hasSave ? (activeSave?.communityStatus ?? 'none') : 'none',
  );
  const [marriedTo, setMarriedTo] = useState<string>(() =>
    hasSave ? (activeSave?.marriedTo ?? '') : '',
  );
  const [islandUnlocked, setIslandUnlocked] = useState<boolean>(() =>
    hasSave ? Boolean(activeSave?.islandFarmLayout) : false,
  );

  // Bus: initialise immediately from community status.
  // Once bundle data loads, refine by also checking vault bundle progress
  // (vault room completion repairs the bus independently of full CC/Joja).
  const [busRepaired, setBusRepaired] = useState<boolean>(() => {
    if (!hasSave) return false;
    const cs = activeSave?.communityStatus;
    return cs === 'cc-restored' || cs === 'joja-complete';
  });

  // One-shot effect: refine bus state once bundle data is available.
  // Protected by a ref so user overrides are never clobbered on re-renders.
  const busInitialized = useRef(false);
  useEffect(() => {
    if (busInitialized.current || !data || !hasSave) return;
    busInitialized.current = true;
    const computed = isBusRepairedFromSave(
      activeSave?.communityStatus,
      activeSave?.bundleProgress,
    );
    setBusRepaired(computed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]); // intentionally only re-runs when data loads, not on every save change

  // heartLevels always come from the save (needed for notFriendship variant
  // conditions but not surfaced as a UI control — too many NPCs).
  const heartLevels = hasSave ? activeSave?.heartLevels : undefined;

  const saveCtx = useMemo<SaveContext>(() => ({
    communityStatus: communityStatus === 'none' ? undefined : communityStatus,
    heartLevels,
    islandUnlocked,
    busRepaired,
  }), [communityStatus, heartLevels, islandUnlocked, busRepaired]);

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
    busRepaired,     setBusRepaired,
    saveCtx,
    marriageableNpcs,
  };
}
