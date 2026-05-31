import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DATABASE_PATH ?? './data/sync.db';

// Ensure parent directory exists
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

export const db = new Database(DB_PATH, { create: true });

// Enable WAL for better concurrent read performance
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ── Schema migration ───────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id            TEXT    PRIMARY KEY,
    email         TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id            TEXT    PRIMARY KEY,
    account_id    TEXT    NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS character_slots (
    id            TEXT    PRIMARY KEY,
    room_id       TEXT    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    slot_index    INTEGER NOT NULL,
    char_name     TEXT    NOT NULL,
    code          TEXT    UNIQUE NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS room_sync (
    room_id         TEXT    PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
    shared_blob     TEXT    NOT NULL,
    characters_blob TEXT    NOT NULL,
    updated_at      INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_rooms_account   ON rooms(account_id);
  CREATE INDEX IF NOT EXISTS idx_slots_room      ON character_slots(room_id);
  CREATE INDEX IF NOT EXISTS idx_slots_code      ON character_slots(code);
`);

// ── Typed query helpers ────────────────────────────────────────────────────────

export interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: number;
}

export interface RoomRow {
  id: string;
  account_id: string;
  name: string;
  created_at: number;
}

export interface SlotRow {
  id: string;
  room_id: string;
  slot_index: number;
  char_name: string;
  code: string;
  created_at: number;
}

export interface RoomSyncRow {
  room_id: string;
  shared_blob: string;
  characters_blob: string;
  updated_at: number;
}

// Prepared statements for hot paths
export const stmts = {
  // accounts
  findAccountByEmail: db.prepare<AccountRow, [string]>(
    'SELECT * FROM accounts WHERE email = ?'
  ),
  findAccountById: db.prepare<AccountRow, [string]>(
    'SELECT * FROM accounts WHERE id = ?'
  ),
  insertAccount: db.prepare(
    'INSERT INTO accounts (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ),
  deleteAccount: db.prepare(
    'DELETE FROM accounts WHERE id = ?'
  ),

  // rooms
  listRooms: db.prepare<RoomRow, [string]>(
    'SELECT * FROM rooms WHERE account_id = ? ORDER BY created_at DESC'
  ),
  findRoom: db.prepare<RoomRow, [string]>(
    'SELECT * FROM rooms WHERE id = ?'
  ),
  findRoomByOwner: db.prepare<RoomRow, [string, string]>(
    'SELECT * FROM rooms WHERE id = ? AND account_id = ?'
  ),
  insertRoom: db.prepare(
    'INSERT INTO rooms (id, account_id, name, created_at) VALUES (?, ?, ?, ?)'
  ),
  deleteRoom: db.prepare(
    'DELETE FROM rooms WHERE id = ?'
  ),

  // character_slots
  listSlots: db.prepare<SlotRow, [string]>(
    'SELECT * FROM character_slots WHERE room_id = ? ORDER BY slot_index'
  ),
  findSlotByCode: db.prepare<SlotRow, [string]>(
    'SELECT * FROM character_slots WHERE code = ?'
  ),
  insertSlot: db.prepare(
    'INSERT INTO character_slots (id, room_id, slot_index, char_name, code, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ),

  // room_sync
  findSync: db.prepare<RoomSyncRow, [string]>(
    'SELECT * FROM room_sync WHERE room_id = ?'
  ),
  upsertSync: db.prepare(
    `INSERT INTO room_sync (room_id, shared_blob, characters_blob, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(room_id) DO UPDATE SET
       shared_blob = excluded.shared_blob,
       characters_blob = excluded.characters_blob,
       updated_at = excluded.updated_at`
  ),
};
