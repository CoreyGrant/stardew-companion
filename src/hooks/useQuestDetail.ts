import { useCallback, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import type { Quest } from '../types/game';

interface QuestDetailState {
  quest: Quest | null;
  completedStepIds: string[];
  toggleStep: (stepId: string) => void;
  completedCount: number;
  loading: boolean;
  error: string | null;
}

export function useQuestDetail(id: string | undefined): QuestDetailState {
  const { data, loading, error } = useGameData();
  const { activeSave, updateQuestProgress } = useUserData();

  const quest = useMemo(
    () => (id ? (data?.quests.find((q) => q.id === id) ?? null) : null),
    [data, id]
  );

  const completedStepIds = useMemo(
    () => (id && activeSave ? (activeSave.questProgress[id] ?? []) : []),
    [id, activeSave]
  );

  const toggleStep = useCallback(
    (stepId: string) => {
      if (!id || !activeSave) return;
      const current = activeSave.questProgress[id] ?? [];
      const next = current.includes(stepId)
        ? current.filter((s) => s !== stepId)
        : [...current, stepId];
      updateQuestProgress(activeSave.id, id, next);
    },
    [id, activeSave, updateQuestProgress]
  );

  return {
    quest,
    completedStepIds,
    toggleStep,
    completedCount: completedStepIds.length,
    loading,
    error,
  };
}
