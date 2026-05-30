import type { AppData } from '../types/save';
import type { StorageAdapter } from './StorageAdapter';

const STORAGE_KEY = 'stardew_companion_v1';

const DEFAULT_DATA: AppData = {
  version: '1',
  activeSaveId: null,
  saves: [],
  settings: { tailorToSave: false, onboardingDismissed: false },
};

export class LocalStorageAdapter implements StorageAdapter {
  load(): AppData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_DATA);
      const parsed = JSON.parse(raw) as Partial<AppData>;
      return { ...DEFAULT_DATA, ...parsed };
    } catch {
      return structuredClone(DEFAULT_DATA);
    }
  }

  save(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}
