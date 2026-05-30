import { useState } from 'react';
import { useUserData } from '../../contexts/UserDataContext';
import { useGameData } from '../../contexts/GameDataContext';
import { DEFAULT_SAVE_PARTIAL, DEFAULT_FARM_LAYOUT, STATIC_BUILDING_IDS } from '../../types/save';
import type { FarmType } from '../../types/save';

const FARM_TYPES: FarmType[] = [
  'standard', 'riverland', 'forest', 'hilltop',
  'wilderness', 'beach', 'four-corners', 'meadowlands',
];

export function OnboardingModal() {
  const { saves, settings, createSave, updateSettings } = useUserData();
  const { data: gameData } = useGameData();
  const [name, setName] = useState('');
  const [farmType, setFarmType] = useState<FarmType>('standard');

  if (saves.length > 0 || settings.onboardingDismissed) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const farmId = farmType.replace(/_/g, '-');
    const farmTypeDef = gameData?.farmTypes.find((f) => f.id === farmId);
    const defaultBuildings = (farmTypeDef?.staticBuildings ?? []).map((sb) => ({
      id: crypto.randomUUID(),
      buildingId: sb.buildingId,
      x: sb.x,
      y: sb.y,
      ...(sb.buildingId === 'Greenhouse' ? { repaired: false } : {}),
      ...(STATIC_BUILDING_IDS.has(sb.buildingId) ? { isStatic: true } : {}),
    }));
    createSave({
      ...DEFAULT_SAVE_PARTIAL,
      name: name.trim(),
      farmType,
      farmLayout: { ...DEFAULT_FARM_LAYOUT, buildings: defaultBuildings },
    });
    updateSettings({ tailorToSave: true, onboardingDismissed: true });
  };

  const handleSkip = () => {
    updateSettings({ onboardingDismissed: true });
  };

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <h2 className="onboarding-modal__title" id="onboarding-title">
          Welcome to Stardew Companion
        </h2>
        <p className="onboarding-modal__desc">
          Set up your farm profile to get personalised schedules, crop quality tables,
          and quest tracking for your playthrough. You can always change this later.
        </p>

        <form onSubmit={handleCreate}>
          <label className="form-field">
            Farm name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Farm"
              autoFocus
            />
          </label>

          <label className="form-field">
            Farm type
            <select
              value={farmType}
              onChange={(e) => setFarmType(e.target.value as FarmType)}
            >
              {FARM_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </label>

          <div className="onboarding-modal__actions">
            <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
              Create Profile &amp; Get Started
            </button>
            <button type="button" className="btn" onClick={handleSkip}>
              Skip for now
            </button>
          </div>
        </form>

        <p className="onboarding-modal__hint">
          Skills, year, and marriage can be set any time in Save Manager.
        </p>
      </div>
    </div>
  );
}
