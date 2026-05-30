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
    return this.data.saves;
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
    this.data.saves.push(newSave);
    if (!this.data.activeSaveId) {
      this.data.activeSaveId = newSave.id;
    }
    this.persist();
    return newSave;
  }

  updateSave(save: SaveFile): void {
    const idx = this.data.saves.findIndex((s) => s.id === save.id);
    if (idx === -1) return;
    this.data.saves[idx] = save;
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
    const save = this.data.saves.find((s) => s.id === saveId);
    if (!save) return;
    save.questProgress[questId] = stepIds;
    this.persist();
  }

  updateBundleProgress(saveId: string, bundleId: string, itemIds: string[]): void {
    const save = this.data.saves.find((s) => s.id === saveId);
    if (!save) return;
    save.bundleProgress[bundleId] = itemIds;
    this.persist();
  }

  updateMuseumDonations(saveId: string, itemIds: string[]): void {
    const save = this.data.saves.find((s) => s.id === saveId);
    if (!save) return;
    save.museumDonations = itemIds;
    this.persist();
  }

  // ── Farm layout ───────────────────────────────────────────────────────────

  updateFarmLayout(saveId: string, layout: FarmLayout): void {
    const save = this.data.saves.find((s) => s.id === saveId);
    if (!save) return;
    save.farmLayout = layout;
    this.persist();
  }

  updateIslandFarmLayout(saveId: string, layout: FarmLayout): void {
    const save = this.data.saves.find((s) => s.id === saveId);
    if (!save) return;
    save.islandFarmLayout = layout;
    this.persist();
  }
}
