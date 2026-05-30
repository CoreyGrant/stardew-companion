import { useMemo, useState } from 'react';
import { useUserData } from '../contexts/UserDataContext';
import { useGameData } from '../contexts/GameDataContext';
import type { FarmType, SaveFile, Skill } from '../types/save';
import { DEFAULT_FARM_LAYOUT, DEFAULT_SAVE_PARTIAL, STATIC_BUILDING_IDS } from '../types/save';
import type { Season } from '../types/game';

interface SaveForm {
  name: string;
  farmType: FarmType;
  skills: Record<Skill, number>;
  marriedTo: string;
  year: number;
  season: Season;
  day: number;
}

interface SavesState {
  saves: SaveFile[];
  activeSave: SaveFile | null;
  editingId: string | null;
  form: SaveForm;
  tailorToSave: boolean;
  marriageableNpcs: string[];
  startCreate: () => void;
  startEdit: (save: SaveFile) => void;
  cancelEdit: () => void;
  submitForm: () => void;
  deleteSave: (id: string) => void;
  setActiveSave: (id: string) => void;
  setTailorToSave: (v: boolean) => void;
  setFormField: <K extends keyof SaveForm>(key: K, value: SaveForm[K]) => void;
  setSkill: (skill: Skill, value: number) => void;
}

const BLANK_FORM: SaveForm = {
  name: '',
  farmType: 'standard',
  skills: { farming: 0, mining: 0, foraging: 0, fishing: 0, combat: 0 },
  marriedTo: '',
  year: 1,
  season: 'spring',
  day: 1,
};

export function useSaves(): SavesState {
  const { saves, activeSave, settings, createSave, updateSave, deleteSave, setActiveSave, updateSettings } =
    useUserData();
  const { data: gameData } = useGameData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SaveForm>(BLANK_FORM);

  const marriageableNpcs = useMemo(
    () => (gameData?.npcs ?? []).filter((n) => n.marriageable).map((n) => n.name as string).sort(),
    [gameData],
  );

  const startCreate = () => {
    setEditingId('new');
    setForm(BLANK_FORM);
  };

  const startEdit = (save: SaveFile) => {
    setEditingId(save.id);
    setForm({
      name: save.name,
      farmType: save.farmType,
      skills: { ...save.skills },
      marriedTo: save.marriedTo ?? '',
      year: save.year,
      season: save.season ?? 'spring',
      day: save.day ?? 1,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(BLANK_FORM);
  };

  const submitForm = () => {
    if (!form.name.trim()) return;

    const baseData = {
      name: form.name.trim(),
      farmType: form.farmType,
      skills: form.skills,
      marriedTo: form.marriedTo.trim() || null,
      year: form.year,
      season: form.season,
      day: Math.max(1, Math.min(28, form.day)),
    };

    if (editingId === 'new') {
      // Seed default buildings from the farm type definition
      const farmId = form.farmType.replace(/_/g, '-');
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
        ...baseData,
        farmLayout: { ...DEFAULT_FARM_LAYOUT, buildings: defaultBuildings },
      });
    } else if (editingId) {
      const existing = saves.find((s) => s.id === editingId);
      if (existing) {
        // Preserve farmLayout and other progress when editing profile metadata
        updateSave({ ...existing, ...baseData });
      }
    }
    cancelEdit();
  };

  const setFormField = <K extends keyof SaveForm>(key: K, value: SaveForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setSkill = (skill: Skill, value: number) => {
    setForm((f) => ({ ...f, skills: { ...f.skills, [skill]: value } }));
  };

  return {
    saves,
    activeSave,
    editingId,
    form,
    tailorToSave: settings.tailorToSave,
    marriageableNpcs,
    startCreate,
    startEdit,
    cancelEdit,
    submitForm,
    deleteSave,
    setActiveSave,
    setTailorToSave: (v) => updateSettings({ tailorToSave: v }),
    setFormField,
    setSkill,
  };
}
