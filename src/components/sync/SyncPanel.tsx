/**
 * Cloud Sync & Multiplayer panel — shown on SavesPage.
 *
 * States:
 *   1. Server not configured — show nothing (VITE_SYNC_API_URL not set)
 *   2. Logged out          — login / register form
 *   3. Logged in, no rooms — "no rooms yet" + link to import a save
 *   4. Logged in, rooms    — list rooms with character codes
 */

import { useState } from 'react';
import { useSync } from '../../contexts/SyncContext';
import { useUserData } from '../../contexts/UserDataContext';
import { SyncApiError } from '../../utils/syncApi';
import { extractCharacterData } from '../../utils/saveSync';
import { Panel } from '../common/Panel';
import type { RoomSummary } from '../../utils/syncApi';
import type { SaveFile } from '../../types/save';

// ── Auth form ─────────────────────────────────────────────────────────────────

function AuthForm() {
  const { login, register, serverAvailable } = useSync();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  if (!serverAvailable) return null;

  async function attempt(fn: (e: string, p: string) => Promise<void>) {
    setError(null);
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      await fn(email.trim(), password);
    } catch (e) {
      setError(e instanceof SyncApiError ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sync-panel__auth-form">
      <p className="sync-panel__intro">
        Sync saves across devices, or share a multiplayer farm with friends.
        Free account — no tracking.
      </p>
      <div className="sync-panel__auth-row">
        <input
          className="sync-panel__input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="sync-panel__input"
          type="password"
          placeholder="Password (8+ chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          onKeyDown={(ev) => ev.key === 'Enter' && attempt(login)}
        />
      </div>
      {error && <p className="sync-panel__error">✗ {error}</p>}
      <div className="sync-panel__auth-actions">
        <button
          className="btn btn--primary btn--sm"
          disabled={loading}
          onClick={() => attempt(login)}
        >
          Log in
        </button>
        <button
          className="btn btn--sm"
          disabled={loading}
          onClick={() => attempt(register)}
        >
          Create account
        </button>
      </div>
    </div>
  );
}

// ── Room card ─────────────────────────────────────────────────────────────────

function RoomCard({ room, onDelete }: { room: RoomSummary; onDelete: () => void }) {
  const { pullSync, lastPushed } = useSync();
  const { saves } = useUserData();
  const [deleting,  setDeleting]  = useState(false);
  const [pulling,   setPulling]   = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const save = saves.find(s => s.roomId === room.id);

  const appBase = window.location.origin + window.location.pathname;

  async function handlePull() {
    if (!save) return;
    setPulling(true);
    try {
      await pullSync(room.id, save.charSlotIndex ?? 0);
    } finally {
      setPulling(false);
    }
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  function slotIcon(slotIndex: number) {
    return slotIndex === 0 ? '★' : '👤';
  }

  return (
    <div className="room-card">
      <p className="room-card__name">🌿 {room.name}</p>

      <div className="room-card__slots">
        {room.slots.map((slot) => (
          <div key={slot.id} className="room-card__slot">
            <span className="room-card__slot-icon">{slotIcon(slot.slotIndex)}</span>
            <span className="room-card__slot-name">{slot.charName}</span>
            {slot.slotIndex === 0 ? (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>(you — host)</span>
            ) : (
              <>
                <code className="room-card__slot-code">{slot.code}</code>
                <div className="room-card__slot-actions">
                  <button
                    className="btn btn--sm"
                    title="Copy join link"
                    onClick={() => copyText(`${appBase}#/join/${slot.code}`, `link-${slot.id}`)}
                  >
                    {copiedCode === `link-${slot.id}` ? '✓ Copied' : 'Copy link'}
                  </button>
                  <button
                    className="btn btn--sm"
                    title="Copy code only"
                    onClick={() => copyText(slot.code, `code-${slot.id}`)}
                  >
                    {copiedCode === `code-${slot.id}` ? '✓' : 'Code'}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="room-card__actions">
        {save && (
          <button className="btn btn--sm" onClick={handlePull} disabled={pulling}>
            {pulling ? 'Pulling' : 'Pull latest'}
          </button>
        )}

        {deleting ? (
          <>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>Delete room?</span>
            <button className="btn btn--sm btn--danger" onClick={onDelete}>Yes, delete</button>
            <button className="btn btn--sm" onClick={() => setDeleting(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn--sm btn--danger" onClick={() => setDeleting(true)}>
            Delete room
          </button>
        )}

        {lastPushed && save?.roomId === room.id && (
          <span className="room-card__last-pushed">
            Last pushed {lastPushed.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Create-room button (rendered on a save card from SavesPage) ───────────────

interface CreateRoomButtonProps {
  save: SaveFile;
}

export function CreateRoomButton({ save }: CreateRoomButtonProps) {
  const { token, createRoom, serverAvailable } = useSync();
  const { updateSave } = useUserData();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  if (!serverAvailable || !token || save.roomId) return null;

  // Only show for saves imported from a file
  if (!save.sourceFileName) return null;

  async function handleCreate() {
    setError(null);
    setLoading(true);
    try {
      const chars = save.parsedCharacters ?? [];
      if (chars.length === 0) {
        setError('No character data found. Re-import the save file to enable room creation.');
        return;
      }
      const allCharacters = chars.map((c) => extractCharacterData(
        { ...save, skills: c.skills, marriedTo: c.marriedTo, money: c.money },
        c.charName,
      ));
      const { roomId, slots } = await createRoom(save, allCharacters);
      // Update the save with the roomId so subsequent Syncs push to the room
      const hostSlot = slots.find((s) => s.slotIndex === 0);
      updateSave({
        ...save,
        roomId,
        charSlotIndex: 0,
        charCode: hostSlot?.code,
      });
    } catch (e) {
      setError(e instanceof SyncApiError ? e.message : 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn btn--sm" onClick={handleCreate} disabled={loading}>
        {loading ? 'Creating' : '☁ Create Room'}
      </button>
      {error && <p style={{ fontSize: '0.7rem', color: 'var(--text-danger)', marginTop: 4 }}>✗ {error}</p>}
    </div>
  );
}

// ── Main sync panel ───────────────────────────────────────────────────────────

export function SyncPanel() {
  const { token, email, logout, rooms, deleteRoom, serverAvailable, refreshRooms } = useSync();

  if (!serverAvailable) return null;

  async function handleDelete(roomId: string) {
    try {
      await deleteRoom(roomId);
    } catch {
      // ignore — refreshRooms is called by deleteRoom internally
    }
  }

  return (
    <Panel title="☁ Cloud Sync & Multiplayer">
      {!token ? (
        <AuthForm />
      ) : (
        <>
          <div className="sync-panel__account-row">
            <span>Logged in as</span>
            <span className="sync-panel__email">{email}</span>
            <button className="btn btn--sm" onClick={logout}>Log out</button>
            <button className="btn btn--sm" onClick={() => refreshRooms().catch(() => {})}>
              Refresh
            </button>
          </div>

          {rooms.length === 0 ? (
            <p className="sync-panel__no-rooms">
              No rooms yet. Import a save file above, then click "☁ Create Room" on it.
            </p>
          ) : (
            rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onDelete={() => handleDelete(room.id)}
              />
            ))
          )}
        </>
      )}
    </Panel>
  );
}
