import { deflateSync, inflateSync } from 'fflate';
import type { SaveFile } from '../types/save';

// ── Binary ↔ base64 (browser-safe, no Buffer) ─────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encode a SaveFile to a compact base64 string.
 * Pipeline: JSON → UTF-8 bytes → deflate (level 9) → base64.
 */
export function encodeSave(save: SaveFile): string {
  const json  = JSON.stringify(save);
  const raw   = new TextEncoder().encode(json);
  const compressed = deflateSync(raw, { level: 9 });
  return uint8ToBase64(compressed);
}

/**
 * Decode a base64 export code back into save data ready for `createSave()`.
 * Strips `id` and `createdAt` — a fresh pair will be assigned on import.
 *
 * Throws a human-readable `Error` if the code is malformed or missing fields.
 */
export function decodeSave(code: string): Omit<SaveFile, 'id' | 'createdAt'> {
  // Strip whitespace that may appear from copy-paste line-wrapping
  const trimmed = code.replace(/\s/g, '');

  let compressed: Uint8Array;
  try {
    compressed = base64ToUint8(trimmed);
  } catch {
    throw new Error('Not a valid base64 code.');
  }

  let raw: Uint8Array;
  try {
    raw = inflateSync(compressed);
  } catch {
    throw new Error('Could not decompress — code may be corrupted or truncated.');
  }

  let json: string;
  try {
    json = new TextDecoder().decode(raw);
  } catch {
    throw new Error('Could not decode text from decompressed data.');
  }

  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error('Decompressed data is not valid JSON.');
  }

  if (!obj || typeof obj !== 'object') {
    throw new Error('Save data has an unexpected format.');
  }
  const s = obj as Record<string, unknown>;
  if (typeof s.name !== 'string' || !s.name) {
    throw new Error('Save data is missing a name field.');
  }
  if (typeof s.farmType !== 'string') {
    throw new Error('Save data is missing a farmType field.');
  }

  // Drop id + createdAt — the store will assign fresh ones
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _ts, ...rest } = s as unknown as SaveFile;
  return rest as Omit<SaveFile, 'id' | 'createdAt'>;
}
