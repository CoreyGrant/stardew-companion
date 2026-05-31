import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppSettings, SaveFile } from '../types/save';
import { useDataService } from './DataServiceContext';

interface UserDataContextValue {
  saves: SaveFile[];
  activeSave: SaveFile | null;
  settings: AppSettings;
  setActiveSave: (id: string) => void;
  createSave: (save: Omit<SaveFile, 'id' | 'createdAt'>) => SaveFile;
  updateSave: (save: SaveFile) => void;
  deleteSave: (id: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateQuestProgress: (saveId: string, questId: string, completedStepIds: string[]) => void;
  updateBundleProgress: (saveId: string, bundleId: string, completedItemIds: string[]) => void;
  updateMuseumDonations: (saveId: string, itemIds: string[]) => void;
  /** Save IDs that have an in-memory File System API handle for re-reading. */
  syncableSaveIds: ReadonlySet<string>;
  /** Store a file handle (from showOpenFilePicker) for a given save ID. */
  setFileHandle: (saveId: string, handle: FileSystemFileHandle) => void;
  /** Retrieve the stored file handle for a save ID, if any. */
  getFileHandle: (saveId: string) => FileSystemFileHandle | undefined;
}

const UserDataContext = createContext<UserDataContextValue | null>(null);

export function UserDataProvider({ children }: { children: ReactNode }) {
  const service = useDataService();

  const [saves, setSaves] = useState<SaveFile[]>(() => service.getSaves());
  const [activeSave, setActiveSaveState] = useState<SaveFile | null>(() =>
    service.getActiveSave()
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    service.getSettings()
  );

  // In-memory file handles for sync — not persisted (FileSystemFileHandle is not serialisable).
  const fileHandlesRef  = useRef(new Map<string, FileSystemFileHandle>());
  const [syncableSaveIds, setSyncableSaveIds] = useState<ReadonlySet<string>>(new Set());

  const refresh = useCallback(() => {
    setSaves(service.getSaves());
    setActiveSaveState(service.getActiveSave());
    setSettings(service.getSettings());
  }, [service]);

  const setActiveSave = useCallback(
    (id: string) => {
      service.setActiveSave(id);
      refresh();
    },
    [service, refresh]
  );

  const createSave = useCallback(
    (save: Omit<SaveFile, 'id' | 'createdAt'>) => {
      const newSave = service.createSave(save);
      refresh();
      return newSave;
    },
    [service, refresh]
  );

  const updateSave = useCallback(
    (save: SaveFile) => {
      service.updateSave(save);
      refresh();
    },
    [service, refresh]
  );

  const deleteSave = useCallback(
    (id: string) => {
      service.deleteSave(id);
      refresh();
    },
    [service, refresh]
  );

  const updateSettings = useCallback(
    (next: Partial<AppSettings>) => {
      service.updateSettings(next);
      refresh();
    },
    [service, refresh]
  );

  const updateQuestProgress = useCallback(
    (saveId: string, questId: string, completedStepIds: string[]) => {
      service.updateQuestProgress(saveId, questId, completedStepIds);
      refresh();
    },
    [service, refresh]
  );

  const updateBundleProgress = useCallback(
    (saveId: string, bundleId: string, completedItemIds: string[]) => {
      service.updateBundleProgress(saveId, bundleId, completedItemIds);
      refresh();
    },
    [service, refresh]
  );

  const updateMuseumDonations = useCallback(
    (saveId: string, itemIds: string[]) => {
      service.updateMuseumDonations(saveId, itemIds);
      refresh();
    },
    [service, refresh]
  );

  const setFileHandle = useCallback((saveId: string, handle: FileSystemFileHandle) => {
    fileHandlesRef.current.set(saveId, handle);
    setSyncableSaveIds(prev => {
      if (prev.has(saveId)) return prev;
      const next = new Set(prev);
      next.add(saveId);
      return next;
    });
  }, []);

  const getFileHandle = useCallback((saveId: string) => {
    return fileHandlesRef.current.get(saveId);
  }, []);

  return (
    <UserDataContext.Provider
      value={{
        saves,
        activeSave,
        settings,
        setActiveSave,
        createSave,
        updateSave,
        deleteSave,
        updateSettings,
        updateQuestProgress,
        updateBundleProgress,
        updateMuseumDonations,
        syncableSaveIds,
        setFileHandle,
        getFileHandle,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext);
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider');
  return ctx;
}
