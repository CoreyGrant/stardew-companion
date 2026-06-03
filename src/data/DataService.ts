import type { AppData, AppSettings, FarmLayout, SaveFile } from '../types/save';
import type { StorageAdapter } from './StorageAdapter';

export class DataService {
  private data: AppData;

  constructor(private readonly adapter: StorageAdapter) {
    this.data = adapter.load();
  }

  private persist(): void {
    this.adapter.save(this.data);
  }

  // ── Saves ────────────────────────────────────────────────────────────────

  getSaves(): SaveFile[] {
    // Return a shallow copy so React's useState always receives a new reference
    // and triggers re-renders, even when the underlying array was mutated.
    return [...this.data.saves];
  }

  getActiveSave(): SaveFile | null {
    if (!this.data.activeSaveId) return null;
    return this.data.saves.find((s) => s.id === this.data.activeSaveId) ?? null;
  }

  setActiveSave(id: string): void {
    this.data.activeSaveId = id;
    this.persist();
  }

  createSave(save: Omit<SaveFile, 'id' | 'createdAt'>): SaveFile {
    const newSave: SaveFile = {
      ...save,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    // Immutable update — new array reference so React detects the change
    this.data.saves = [...this.data.saves, newSave];
    if (!this.data.activeSaveId) {
      this.data.activeSaveId = newSave.id;
    }
    this.persist();
    return newSave;
  }

  updateSave(save: SaveFile): void {
    // Immutable update — new array + new save object reference
    this.data.saves = this.data.saves.map((s) => (s.id === save.id ? save : s));
    this.persist();
  }

  deleteSave(id: string): void {
    this.data.saves = this.data.saves.filter((s) => s.id !== id);
    if (this.data.activeSaveId === id) {
      this.data.activeSaveId = this.data.saves[0]?.id ?? null;
    }
    this.persist();
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  getSettings(): AppSettings {
    return this.data.settings;
  }

  updateSettings(settings: Partial<AppSettings>): void {
    this.data.settings = { ...this.data.settings, ...settings };
    this.persist();
  }

  // ── Quest & bundle progress ───────────────────────────────────────────────

  updateQuestProgress(saveId: string, questId: string, stepIds: string[]): void {
    // Immutable update — new save object so getActiveSave() returns a new reference
    this.data.saves = this.data.saves.map((s) =>
      s.id !== saveId ? s : { ...s, questProgress: { ...s.questProgress, [questId]: stepIds } },
    );
    this.persist();
  }

  updateBundleProgress(saveId: string, bundleId: string, itemIds: string[]): void {
    this.data.saves = this.data.saves.map((s) =>
      s.id !== saveId ? s : { ...s, bundleProgress: { ...s.bundleProgress, [bundleId]: itemIds } },
    );
    this.persist();
  }

  updateMuseumDonations(saveId: string, itemIds: string[]): void {
    this.data.saves = this.data.saves.map((s) =>
      s.id !== saveId ? s : { ...s, museumDonations: itemIds },
    );
    this.persist();
  }

  // ── Farm layout ───────────────────────────────────────────────────────────

  updateFarmLayout(saveId: string, layout: FarmLayout): void {
    this.data.saves = this.data.saves.map((s) =>
      s.id !== saveId ? s : { ...s, farmLayout: layout },
    );
    this.persist();
  }

  updateIslandFarmLayout(saveId: string, layout: FarmLayout): void {
    this.data.saves = this.data.saves.map((s) =>
      s.id !== saveId ? s : { ...s, islandFarmLayout: layout },
    );
    this.persist();
  }
}
