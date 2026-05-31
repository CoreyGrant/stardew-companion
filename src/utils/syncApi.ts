/**
 * Typed REST client for the Stardew Companion sync server.
 * Uses VITE_SYNC_API_URL if set, otherwise uses relative URLs (same-origin self-hosted).
 */

import type { CharacterSaveData } from './saveSync';

const BASE_URL = (import.meta.env.VITE_SYNC_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

// ── Error type ────────────────────────────────────────────────────────────────

export class SyncApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SyncApiError';
  }
}

// ── Response types ────────────────────────────────────────────────────────────

export interface SlotSummary {
  id: string;
  slotIndex: number;
  charName: string;
  code: string;
}

export interface RoomSummary {
  id: string;
  name: string;
  createdAt: number;
  slots: SlotSummary[];
}

export interface JoinData {
  roomName: string;
  slotIndex: number;
  charName: string;
  sharedBlob: string;
  characterBlob: string;
}

export interface PullData {
  sharedBlob: string;
  charactersBlob: string;
  updatedAt: number;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  let body: unknown;
  try { body = await res.json(); } catch { body = {}; }

  if (!res.ok) {
    const message = (body as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new SyncApiError(res.status, message);
  }

  return body as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export const syncApi = {
  async register(email: string, password: string): Promise<{ token: string }> {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async login(email: string, password: string): Promise<{ token: string }> {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async deleteAccount(token: string): Promise<void> {
    await apiFetch('/auth/account', {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  // ── Room endpoints ──────────────────────────────────────────────────────────

  async getRooms(token: string): Promise<{ rooms: RoomSummary[] }> {
    return apiFetch('/rooms', {
      headers: authHeaders(token),
    });
  },

  async createRoom(
    token: string,
    name: string,
    characters: Pick<CharacterSaveData, 'charName'>[],
  ): Promise<{ roomId: string; slots: SlotSummary[] }> {
    return apiFetch('/rooms', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name, characters }),
    });
  },

  async deleteRoom(token: string, roomId: string): Promise<void> {
    await apiFetch(`/rooms/${roomId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
  },

  async pushSync(
    token: string,
    roomId: string,
    sharedBlob: string,
    charactersBlob: string,
  ): Promise<void> {
    await apiFetch(`/rooms/${roomId}/sync`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ sharedBlob, charactersBlob }),
    });
  },

  async pullSync(token: string, roomId: string): Promise<PullData> {
    return apiFetch(`/rooms/${roomId}/sync`, {
      headers: authHeaders(token),
    });
  },

  async joinByCode(code: string): Promise<JoinData> {
    return apiFetch(`/join/${code}`);
  },
};
