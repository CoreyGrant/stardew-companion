import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNPCList, NPC_SORT_FIELDS, DEFAULT_NPC_SORTS } from '../hooks/useNPCList';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort } from '../components/common/MultiSort';
import { ViewToggle } from '../components/common/ViewToggle';
import { useViewMode } from '../hooks/useViewMode';
import { usePageTitle } from '../hooks/usePageTitle';
import { useUserData } from '../contexts/UserDataContext';

const BASE = import.meta.env.BASE_URL;

export function NPCListPage() {
  usePageTitle('Characters');
  const { npcs, loading, error, filters, setSearch, setMarriageableOnly } = useNPCList();
  const [sorts,    setSorts]    = useState<ActiveSort[]>(DEFAULT_NPC_SORTS);
  const [viewMode, setViewMode] = useViewMode('npcs', 'tile');
  const { activeSave } = useUserData();
  const heartLevels = activeSave?.heartLevels;

  const sorted = useMultiSort(npcs, sorts, NPC_SORT_FIELDS);

  if (loading) return <div className="page-loading">Loading characters</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--npc-list">
      <h1 className="page__title">Characters</h1>
      <p className="page__subtitle">All Stardew Valley villagers — birthdays, gifts, schedules, and marriage candidates.</p>

      <div className="filter-bar">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search by name"
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search characters"
        />
        <label className="filter-bar__checkbox">
          <input
            type="checkbox"
            checked={filters.marriageableOnly}
            onChange={(e) => setMarriageableOnly(e.target.checked)}
          />
          Marriageable only
        </label>
      </div>

      <div className="fish-sort-bar">
        <MultiSort fields={NPC_SORT_FIELDS} value={sorts} onChange={setSorts} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {sorted.length === 0 ? (
        <p className="empty-state">No characters match your filters.</p>
      ) : (
        <>
          {viewMode === 'tile' && (
            <div className="npc-grid">
              {sorted.map((npc) => (
                <Link key={npc.id} to={`/characters/${npc.id}`} className="npc-card">
                  <div className="npc-card__portrait" aria-hidden="true">
                    {npc.portrait ? (
                      <img
                        src={`${BASE}sprites/portraits/${npc.portrait}`}
                        alt=""
                        style={{ width: 64, height: 64, imageRendering: 'pixelated', objectFit: 'none', objectPosition: '0 0' }}
                      />
                    ) : npc.name.charAt(0)}
                  </div>
                  <div className="npc-card__info">
                    <span className="npc-card__name">{npc.name}</span>
                    <span className="npc-card__birthday">
                      <span aria-hidden="true">🎂</span>{' '}
                      {npc.birthday.season.charAt(0).toUpperCase() + npc.birthday.season.slice(1)}{' '}
                      {npc.birthday.day}
                    </span>
                    {npc.marriageable && <span className="npc-card__badge">Marriageable</span>}
                    {heartLevels?.[npc.id] !== undefined && (
                      <span className="npc-card__hearts" aria-label={`${heartLevels[npc.id]} hearts`}>
                        {'♥'.repeat(heartLevels[npc.id])}
                        {'♡'.repeat(Math.max(0, (npc.marriageable ? 10 : 8) - heartLevels[npc.id]))}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="npc-table">
              <div className="npc-table__header">
                <span>Name</span>
                <span>Birthday</span>
                <span>Status</span>
              </div>
              {sorted.map((npc) => (
                <Link key={npc.id} to={`/characters/${npc.id}`} className="npc-row">
                  <div className="npc-row__name">
                    <div className="npc-row__portrait">
                      {npc.portrait ? (
                        <img
                          src={`${BASE}sprites/portraits/${npc.portrait}`}
                          alt=""
                          style={{ width: 28, height: 28, imageRendering: 'pixelated', objectFit: 'none', objectPosition: '0 0' }}
                        />
                      ) : npc.name.charAt(0)}
                    </div>
                    {npc.name}
                  </div>
                  <span className="npc-row__birthday">
                    {npc.birthday.season.charAt(0).toUpperCase() + npc.birthday.season.slice(1)} {npc.birthday.day}
                  </span>
                  <span className="npc-row__status">
                    {npc.marriageable ? <span className="npc-row__badge">Marriageable</span> : '—'}
                    {heartLevels?.[npc.id] !== undefined && (
                      <span className="npc-row__hearts">{heartLevels[npc.id]}♥</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
