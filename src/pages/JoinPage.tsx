import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { syncApi, SyncApiError } from '../utils/syncApi';
import { mergeSyncData } from '../utils/saveSync';
import { useUserData } from '../contexts/UserDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import type { JoinData } from '../utils/syncApi';
import type { SaveFile } from '../types/save';
import { DEFAULT_FARM_LAYOUT, DEFAULT_SKILLS } from '../types/save';

export function JoinPage() {
  usePageTitle('Join Room');
  const { charCode: routeCode } = useParams<{ charCode?: string }>();
  const navigate = useNavigate();
  const { createSave } = useUserData();

  const [code,       setCode]       = useState(routeCode ?? '');
  const [joinData,   setJoinData]   = useState<JoinData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [joining,    setJoining]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [joined,     setJoined]     = useState(false);

  // Auto-fetch if code is in the URL
  useEffect(() => {
    if (routeCode) fetchCode(routeCode);
  }, [routeCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchCode(c: string) {
    setError(null);
    setJoinData(null);
    setLoading(true);
    try {
      const data = await syncApi.joinByCode(c.trim());
      setJoinData(data);
    } catch (e) {
      setError(e instanceof SyncApiError ? e.message : 'Failed to look up code.');
    } finally {
      setLoading(false);
    }
  }

  function handleManualLookup() {
    if (!code.trim()) return;
    fetchCode(code.trim());
  }

  function handleJoin() {
    if (!joinData) return;
    setJoining(true);
    try {
      // Build a skeleton SaveFile and merge the sync data into it
      const skeleton: SaveFile = {
        id:          '',        // assigned by createSave
        createdAt:   0,         // assigned by createSave
        name:        `${joinData.roomName} (${joinData.charName})`,
        farmType:    'standard',
        skills:      { ...DEFAULT_SKILLS },
        marriedTo:   null,
        year:        1,
        questProgress:  {},
        bundleProgress: {},
        farmLayout:  { ...DEFAULT_FARM_LAYOUT },
        charCode:    code.trim() || (routeCode ?? ''),
        charSlotIndex: joinData.slotIndex,
      };
      const merged = mergeSyncData(skeleton, joinData.sharedBlob, joinData.characterBlob);
      createSave(merged);
      setJoined(true);
      setTimeout(() => navigate('/'), 1500);
    } catch {
      setError('Failed to create save profile. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="page">
      <div className="join-page">
        <div className="join-page__card">
          {/* Manual code entry — always visible */}
          {!joinData && (
            <>
              <div className="join-page__icon">☁</div>
              <p className="join-page__farm">Join a Multiplayer Room</p>
              <p className="join-page__hint">
                Enter the 8-character code your friend shared with you.
              </p>

              <div className="join-page__manual-row">
                <input
                  className="join-page__code-input"
                  type="text"
                  maxLength={8}
                  placeholder="ABC12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value.slice(0, 8))}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
                  aria-label="Invite code"
                  autoFocus={!routeCode}
                />
                <button
                  className="btn btn--primary"
                  onClick={handleManualLookup}
                  disabled={loading || code.trim().length < 8}
                >
                  {loading ? 'Looking up' : 'Look up'}
                </button>
              </div>

              {error && <p className="join-page__error">{error}</p>}
            </>
          )}

          {/* Preview / confirm */}
          {joinData && !joined && (
            <>
              <div className="join-page__icon">🌿</div>
              <p className="join-page__farm">{joinData.roomName}</p>
              <p className="join-page__char">
                You will join as <strong>{joinData.charName}</strong>
              </p>
              <p className="join-page__hint">
                Your data will stay in sync with the host's save file.
                All shared farm data (layout, bundles, museum) will match the host.
                Your character data (skills, hearts, quests) is specific to you.
              </p>
              {error && <p className="join-page__error">{error}</p>}
              <div className="join-page__actions">
                <button
                  className="btn btn--primary"
                  onClick={handleJoin}
                  disabled={joining}
                >
                  {joining ? 'Joining' : 'Join Room'}
                </button>
                <button
                  className="btn"
                  onClick={() => { setJoinData(null); setCode(''); }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Success */}
          {joined && (
            <>
              <div className="join-page__icon">✓</div>
              <p className="join-page__farm">Joined!</p>
              <p className="join-page__hint">Taking you to the app now.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
