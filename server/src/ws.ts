import type { ServerWebSocket } from 'bun';

// ── WebSocket hub ─────────────────────────────────────────────────────────────
// Maps roomId → Set of connected guest sockets.
// Each socket's userData carries the roomId + slotIndex.

export interface WsData {
  roomId: string;
  slotIndex: number;
}

const rooms = new Map<string, Set<ServerWebSocket<WsData>>>();

export function wsOpen(ws: ServerWebSocket<WsData>): void {
  const { roomId } = ws.data;
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId)!.add(ws);
}

export function wsClose(ws: ServerWebSocket<WsData>): void {
  const { roomId } = ws.data;
  const set = rooms.get(roomId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) rooms.delete(roomId);
}

/**
 * Broadcast a sync update to all guests connected to a room.
 * Each guest only receives their own character blob.
 */
export function broadcastSync(
  roomId: string,
  sharedBlob: string,
  charactersBlob: string,
): void {
  const set = rooms.get(roomId);
  if (!set || set.size === 0) return;

  // Parse characters once — it's an array, guests index into it by slotIndex
  let characters: unknown[];
  try {
    characters = JSON.parse(charactersBlob);
  } catch {
    return;
  }

  for (const ws of set) {
    const { slotIndex } = ws.data;
    const characterBlob = JSON.stringify(characters[slotIndex] ?? null);
    ws.send(JSON.stringify({
      type: 'sync_updated',
      sharedBlob,
      characterBlob,
    }));
  }
}

export function connectedCount(roomId: string): number {
  return rooms.get(roomId)?.size ?? 0;
}
