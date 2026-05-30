import type { AppData } from '../types/save';

export interface StorageAdapter {
  load(): AppData;
  save(data: AppData): void;
}
