import { db, stmts } from './db.ts';
import { ApiError } from './auth.ts';
import { broadcastSync } from './ws.ts';
import type { AccountRow, SlotRow } from './db.ts';

// ── B62 code generation ───────────────────────────────────────────────────────

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function genCode(len = 8): string {
  const result: string[] = [];
  while (result.length < len) {
    const buf = new Uint8Array(len * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (result.length >= len) break;
      if (b < 248) result.push(B62[b % 62]); // reject 248–255 to avoid modulo bias
    }
  }
  return result.join('');
}

function uniqueCode(): string {
  for (let attempts = 0; attempts < 10; attempts++) {
    const code = genCode(8);
    if (!stmts.findSlotByCode.get(code)) return code;
  }
  throw new ApiError(500, 'Failed to generate unique code — try again.');
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CharacterInput {
  charName: string;
}

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

// ── Room CRUD ─────────────────────────────────────────────────────────────────

export function listRooms(account: AccountRow): RoomSummary[] {
  const rows = stmts.listRooms.all(account.id);
  return rows.map((room) => ({
    id: room.id,
    name: room.name,
    createdAt: room.created_at,
    slots: stmts.listSlots.all(room.id).map(slotToSummary),
  }));
}

export function createRoom(
  account: AccountRow,
  name: string,
  characters: CharacterInput[],
): { roomId: string; slots: SlotSummary[] } {
  if (!name?.trim()) throw new ApiError(400, 'Room name is required.');
  if (!Array.isArray(characters) || characters.length === 0) {
    throw new ApiError(400, 'At least one character is required.');
  }
  if (characters.length > 8) {
    throw new ApiError(400, 'Maximum 8 characters per room.');
  }

  const roomId = crypto.randomUUID();
  const now    = Date.now();

  const insertAll = db.transaction(() => {
    stmts.insertRoom.run(roomId, account.id, name.trim(), now);
    const slots: SlotSummary[] = [];
    for (let i = 0; i < characters.length; i++) {
      const charName = characters[i].charName?.trim();
      if (!charName) throw new ApiError(400, 'Each character must have a name.');
      const slotId = crypto.randomUUID();
      const code   = uniqueCode();
      stmts.insertSlot.run(slotId, roomId, i, charName, code, now);
      slots.push({ id: slotId, slotIndex: i, charName, code });
    }
    return slots;
  });

  const slots = insertAll() as SlotSummary[];
  return { roomId, slots };
}

export function deleteRoom(account: AccountRow, roomId: string): void {
  const room = stmts.findRoomByOwner.get(roomId, account.id);
  if (!room) throw new ApiError(404, 'Room not found.');
  stmts.deleteRoom.run(roomId);
}

// ── Sync push ─────────────────────────────────────────────────────────────────

export function pushSync(
  account: AccountRow,
  roomId: string,
  sharedBlob: string,
  charactersBlob: string,
): void {
  const room = stmts.findRoomByOwner.get(roomId, account.id);
  if (!room) throw new ApiError(404, 'Room not found.');

  if (typeof sharedBlob !== 'string' || typeof charactersBlob !== 'string') {
    throw new ApiError(400, 'sharedBlob and charactersBlob must be strings.');
  }

  // Validate JSON (don't store garbage)
  try { JSON.parse(sharedBlob); }    catch { throw new ApiError(400, 'sharedBlob is not valid JSON.'); }
  try { JSON.parse(charactersBlob); } catch { throw new ApiError(400, 'charactersBlob is not valid JSON.'); }

  stmts.upsertSync.run(roomId, sharedBlob, charactersBlob, Date.now());

  // Broadcast to connected guests
  broadcastSync(roomId, sharedBlob, charactersBlob);
}

// ── Join by code ──────────────────────────────────────────────────────────────

export interface JoinData {
  roomName: string;
  slotIndex: number;
  charName: string;
  sharedBlob: string;
  characterBlob: string;
}

export function joinByCode(code: string): JoinData {
  const slot = stmts.findSlotByCode.get(code);
  if (!slot) throw new ApiError(404, 'Invalid or expired invite code.');

  const room = stmts.findRoom.get(slot.room_id);
  if (!room) throw new ApiError(404, 'Room not found.');

  const sync = stmts.findSync.get(slot.room_id);
  if (!sync) throw new ApiError(404, 'No sync data yet — ask the host to press Sync first.');

  let characters: unknown[];
  try {
    characters = JSON.parse(sync.characters_blob);
  } catch {
    throw new ApiError(500, 'Sync data is corrupted.');
  }

  const characterBlob = JSON.stringify(characters[slot.slot_index] ?? null);

  return {
    roomName:      room.name,
    slotIndex:     slot.slot_index,
    charName:      slot.char_name,
    sharedBlob:    sync.shared_blob,
    characterBlob,
  };
}

// ── Pull (host fetches latest) ────────────────────────────────────────────────

export function pullSync(
  account: AccountRow,
  roomId: string,
): { sharedBlob: string; charactersBlob: string; updatedAt: number } {
  const room = stmts.findRoomByOwner.get(roomId, account.id);
  if (!room) throw new ApiError(404, 'Room not found.');

  const sync = stmts.findSync.get(roomId);
  if (!sync) throw new ApiError(404, 'No sync data yet.');

  return {
    sharedBlob:     sync.shared_blob,
    charactersBlob: sync.characters_blob,
    updatedAt:      sync.updated_at,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotToSummary(slot: SlotRow): SlotSummary {
  return {
    id:         slot.id,
    slotIndex:  slot.slot_index,
    charName:   slot.char_name,
    code:       slot.code,
  };
}
