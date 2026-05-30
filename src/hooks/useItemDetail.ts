import { useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { Bundle, Crop, FishPondEntry, Item, MachineDef, NPC, Recipe } from '../types/game';

interface BundleRef {
  bundle: Bundle;
  quantity: number;
  quality?: number;
}

export interface MachineProductionRef {
  machine: MachineDef;
  /** Rule ID relevant to this item */
  ruleId: string;
  /** Human-readable output/input descriptor */
  outputLabel: string;
  minutesUntilReady: number;
  /** Input label when showing "produced by" direction */
  inputLabel?: string;
}

interface ItemDetailState {
  item: Item | null;
  crop: Crop | null;
  seedItem: Item | null;
  lovedByNPCs: NPC[];
  likedByNPCs: NPC[];
  usedInRecipes: Recipe[];
  neededInBundles: BundleRef[];
  /** Machines that accept this item as a specific input (what does it produce?) */
  machineProduction: MachineProductionRef[];
  /** Machines that output this item (what produces it?) */
  machineSource: MachineProductionRef[];
  /** Fish pond entry for this fish, if one exists */
  fishPondEntry: FishPondEntry | null;
  farmingLevel: number;
  loading: boolean;
  error: string | null;
}

export function useItemDetail(id: string | undefined): ItemDetailState {
  const { data, loading, error } = useGameData();
  const { activeSave, settings } = useUserData();

  const item = useMemo(
    () => (id ? (data?.items.find((i) => i.id === id) ?? null) : null),
    [data, id]
  );

  const crop = useMemo(
    () => (id ? (data?.crops.find((c) => c.harvestItemId === id || c.seedItemId === id) ?? null) : null),
    [data, id]
  );

  const seedItem = useMemo(
    () => (crop ? (data?.items.find((i) => i.id === crop.seedItemId) ?? null) : null),
    [data, crop]
  );

  const lovedByNPCs = useMemo(
    () => (id ? (data?.npcs.filter((n) => n.gifts.loved.some((r) => r.id === id)) ?? []) : []),
    [data, id]
  );

  const likedByNPCs = useMemo(
    () => (id ? (data?.npcs.filter((n) => n.gifts.liked.some((r) => r.id === id)) ?? []) : []),
    [data, id]
  );

  const farmingLevel = settings.tailorToSave ? (activeSave?.skills.farming ?? 0) : 0;

  /** Recipes that use this item as a specific ingredient (not category ingredients) */
  const usedInRecipes = useMemo(() => {
    if (!item || !data?.recipes) return [];
    return data.recipes.filter(r =>
      r.ingredients.some(ing => ing.itemId === item.cheatId),
    );
  }, [data, item]);

  /** Community Center bundles that need this item */
  const neededInBundles = useMemo<BundleRef[]>(() => {
    if (!item || !data?.bundles) return [];
    const refs: BundleRef[] = [];
    for (const bundle of data.bundles) {
      for (const bi of bundle.items) {
        if (bi.itemId === item.cheatId) {
          refs.push({ bundle, quantity: bi.quantity, quality: bi.quality });
          break; // one ref per bundle (same item may appear multiple times via slotId)
        }
      }
    }
    return refs;
  }, [data, item]);

  /** Machines that accept this item as a specific (non-category) input */
  const machineProduction = useMemo<MachineProductionRef[]>(() => {
    if (!item || !data?.machineDefs) return [];
    const refs: MachineProductionRef[] = [];
    for (const machine of data.machineDefs) {
      for (const rule of machine.rules) {
        if (rule.inputItemId !== item.cheatId) continue;
        let outputLabel = '—';
        if (rule.specialBehavior === 'seed_maker') {
          outputLabel = 'Matching Seeds (1–4×)';
        } else if (rule.specialBehavior === 'cask') {
          outputLabel = 'Quality Upgrade';
        } else if (rule.isRandomOutput) {
          outputLabel = rule.outputItems?.map(o => o.itemName).join(' / ') ?? '?';
        } else if (rule.flavoredOutput) {
          outputLabel = rule.flavoredOutput;
        } else {
          outputLabel = rule.outputItemName ?? '?';
        }
        refs.push({
          machine,
          ruleId:           rule.ruleId,
          outputLabel,
          minutesUntilReady: rule.minutesUntilReady,
        });
      }
    }
    return refs;
  }, [data, item]);

  /** Machines that produce this item as output */
  const machineSource = useMemo<MachineProductionRef[]>(() => {
    if (!item || !data?.machineDefs) return [];
    const refs: MachineProductionRef[] = [];
    for (const machine of data.machineDefs) {
      for (const rule of machine.rules) {
        if (rule.outputItemId !== item.cheatId) continue;
        const inputLabel = rule.inputCategoryLabel ?? rule.inputItemName ?? '?';
        const countStr = rule.inputCount > 1 ? `${rule.inputCount}× ` : '';
        refs.push({
          machine,
          ruleId:           rule.ruleId,
          outputLabel:      item.name,
          inputLabel:       `${countStr}${inputLabel}`,
          minutesUntilReady: rule.minutesUntilReady,
        });
      }
    }
    return refs;
  }, [data, item]);

  /** Fish pond entry for fish items */
  const fishPondEntry = useMemo<FishPondEntry | null>(() => {
    if (!item || !data?.fishPondData) return null;
    return data.fishPondData.find(e => e.fishItemIds.includes(item.cheatId)) ?? null;
  }, [data, item]);

  return {
    item, crop, seedItem, lovedByNPCs, likedByNPCs,
    usedInRecipes, neededInBundles, machineProduction, machineSource,
    fishPondEntry, farmingLevel, loading, error,
  };
}
