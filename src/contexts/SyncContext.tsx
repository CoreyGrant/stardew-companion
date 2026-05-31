import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { syncApi, SyncApiError } from '../utils/syncApi';
import { SyncService } from '../services/SyncService';
import { splitSaveForSync, mergeSyncData } from '../utils/saveSync';
import type { RoomSummary } from '../utils/syncApi';
import type { CharacterSaveData } from '../utils/saveSync';
import { useUserData } from './UserDataContext';
import type { SaveFile } from '../types/save';

const TOKEN_KEY = 'stardew_sync_token';

// ── Context value ─────────────────────────────────────────────────────────────

export interface SyncContextValue {
  /** Current auth token, or null if not logged in. */
  token: string | null;
  /** Email of the logged-in account (decoded from token) or null. */
  email: string | null;
  /** Whether the sync server URL is configured. */
  serverAvailable: boolean;

  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): void;

  rooms: RoomSummary[];
  refreshRooms(): Promise<void>;
  createRoom(
    save: SaveFile,
    allCharacters: CharacterSaveData[],
  ): Promise<{ roomId: string; slots: RoomSummary['slots'] }>;
  deleteRoom(roomId: string): Promise<void>;

  /** Push the current save state to the room (host only). */
  pushSync(save: SaveFile, allCharacters: CharacterSaveData[]): Promise<void>;
  /** Pull the latest snapshot from the room and merge into the local save (host cross-device). */
  pullSync(roomId: string, slotIndex: number): Promise<void>;

  lastPushed: Date | null;
  wsConnected: boolean;
}

// ── Provider ──────────────────────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue | null>(null);

function decodeEmail(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const { activeSave, saves, updateSave } = useUserData();

  const [token,      setTokenState] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY),
  );
  const [email,      setEmail]      = useState<string | null>(null);
  const [rooms,      setRooms]      = useState<RoomSummary[]>([]);
  const [lastPushed, setLastPushed] = useState<Date | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const syncServiceRef = useRef(new SyncService());

  const serverAvailable = true;

  // ── Token management ────────────────────────────────────────────────────────

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      setEmail(decodeEmail(t));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setEmail(null);
    }
  }, []);

  // Restore email from stored token on mount
  useEffect(() => {
    if (token) setEmail(decodeEmail(token));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ────────────────────────────────────────────────────────────────────

  const login = useCallback(async (emailInput: string, password: string) => {
    const { token: t } = await syncApi.login(emailInput, password);
    setToken(t);
  }, [setToken]);

  const register = useCallback(async (emailInput: string, password: string) => {
    const { token: t } = await syncApi.register(emailInput, password);
    setToken(t);
  }, [setToken]);

  const logout = useCallback(() => {
    setToken(null);
    setRooms([]);
    syncServiceRef.current.disconnect();
    setWsConnected(false);
  }, [setToken]);

  // ── Room management ─────────────────────────────────────────────────────────

  const refreshRooms = useCallback(async () => {
    if (!token) return;
    try {
      const { rooms: fetched } = await syncApi.getRooms(token);
      setRooms(fetched);
    } catch (e) {
      if (e instanceof SyncApiError && e.status === 401) { logout(); }
      throw e;
    }
  }, [token, logout]);

  // Load rooms when token is set
  useEffect(() => {
    if (token) refreshRooms().catch(() => {/* ignore on mount */});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const createRoom = useCallback(async (
    save: SaveFile,
    allCharacters: CharacterSaveData[],
  ) => {
    if (!token) throw new SyncApiError(401, 'Not logged in');
    const farmName = save.name.replace(/\s*\(.*\)$/, '').trim() || save.name;
    const result = await syncApi.createRoom(token, farmName, allCharacters);
    await refreshRooms();
    return result;
  }, [token, refreshRooms]);

  const deleteRoom = useCallback(async (roomId: string) => {
    if (!token) throw new SyncApiError(401, 'Not logged in');
    await syncApi.deleteRoom(token, roomId);
    await refreshRooms();
  }, [token, refreshRooms]);

  // ── Sync push / pull ────────────────────────────────────────────────────────

  const pushSync = useCallback(async (
    save: SaveFile,
    allCharacters: CharacterSaveData[],
  ) => {
    if (!token || !save.roomId) throw new SyncApiError(401, 'Not in a room');
    const { sharedBlob, charactersBlob } = splitSaveForSync(save, allCharacters);
    await syncApi.pushSync(token, save.roomId, sharedBlob, charactersBlob);
    setLastPushed(new Date());
  }, [token]);

  const pullSync = useCallback(async (roomId: string, slotIndex: number) => {
    if (!token) throw new SyncApiError(401, 'Not logged in');
    const data = await syncApi.pullSync(token, roomId);
    // Find the save linked to this room
    const save = saves.find(s => s.roomId === roomId);
    if (!save) return;
    const characters = JSON.parse(data.charactersBlob) as CharacterSaveData[];
    const charData = characters[slotIndex];
    if (!charData) return;
    const merged = mergeSyncData(save, data.sharedBlob, JSON.stringify(charData));
    updateSave(merged);
  }, [token, saves, updateSave]);

  // ── Auto-push when host save is updated (syncVersion bump) ────────────────
  // When a room-linked save is updated (e.g. host presses Sync button), push
  // the new data to the server automatically.
  const { syncVersion } = useUserData();
  const prevSyncVersion = useRef(syncVersion);
  useEffect(() => {
    if (prevSyncVersion.current === syncVersion) return;
    prevSyncVersion.current = syncVersion;

    if (!token || !activeSave?.roomId) return;

    // Build characters from parsedCharacters stored on the save
    const chars = activeSave.parsedCharacters ?? [];
    if (chars.length === 0) return;

    const allCharacters = chars.map((c) => ({
      charName:              c.charName,
      skills:                c.skills,
      marriedTo:             c.marriedTo ?? null,
      heartLevels:           c.heartLevels,
      questProgress:         c.questProgress ?? {},
      learnedCookingRecipes: c.learnedCookingRecipes,
      money:                 c.money,
    }));

    pushSync(activeSave, allCharacters).catch(() => {/* non-fatal */});
  }, [syncVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── WebSocket for guest saves ───────────────────────────────────────────────

  useEffect(() => {
    const svc = syncServiceRef.current;

    if (activeSave?.charCode) {
      svc.connect(
        activeSave.charCode,
        (sharedBlob, characterBlob) => {
          // Merge incoming sync data into the active save
          const current = saves.find(s => s.id === activeSave.id);
          if (!current) return;
          const merged = mergeSyncData(current, sharedBlob, characterBlob);
          updateSave(merged);
        },
        (connected) => setWsConnected(connected),
      );
    } else {
      svc.disconnect();
      setWsConnected(false);
    }

    return () => {
      // Don't disconnect on every re-render — only when charCode changes
    };
  }, [activeSave?.id, activeSave?.charCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Disconnect on unmount
  useEffect(() => () => syncServiceRef.current.disconnect(), []);

  // ── Context value ───────────────────────────────────────────────────────────

  return (
    <SyncContext.Provider value={{
      token,
      email,
      serverAvailable,
      login,
      register,
      logout,
      rooms,
      refreshRooms,
      createRoom,
      deleteRoom,
      pushSync,
      pullSync,
      lastPushed,
      wsConnected,
    }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
