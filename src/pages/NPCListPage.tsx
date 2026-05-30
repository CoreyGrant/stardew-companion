import { Link } from 'react-router-dom';
import { useNPCList, type NPCSortBy } from '../hooks/useNPCList';
import { usePageTitle } from '../hooks/usePageTitle';

const BASE = import.meta.env.BASE_URL;

const SORT_OPTIONS: { value: NPCSortBy; label: string }[] = [
  { value: 'name',         label: 'A – Z'             },
  { value: 'birthday',     label: 'Birthday'          },
  { value: 'marriageable', label: 'Marriageable first' },
];

export function NPCListPage() {
  usePageTitle('Characters');
  const { npcs, loading, error, filters, setSearch, setMarriageableOnly, setSortBy } =
    useNPCList();

  if (loading) return <div className="page-loading">Loading characters…</div>;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page page--npc-list">
      <h1 className="page__title">Characters</h1>
      <p className="page__subtitle">All Stardew Valley villagers — birthdays, gifts, schedules, and marriage candidates.</p>

      <div className="filter-bar">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search by name…"
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
        <div className="filter-bar__sorts" role="group" aria-label="Sort order">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`sort-btn${filters.sortBy === opt.value ? ' sort-btn--active' : ''}`}
              onClick={() => setSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {npcs.length === 0 ? (
        <p className="empty-state">No characters match your filters.</p>
      ) : (
        <div className="npc-grid">
          {npcs.map((npc) => (
            <Link key={npc.id} to={`/characters/${npc.id}`} className="npc-card">
              <div className="npc-card__portrait" aria-hidden="true">
                {npc.portrait ? (
                  <img
                    src={`${BASE}sprites/portraits/${npc.portrait}`}
                    alt=""
                    style={{
                      width: 64,
                      height: 64,
                      imageRendering: 'pixelated',
                      objectFit: 'none',
                      objectPosition: '0 0',
                    }}
                  />
                ) : (
                  npc.name.charAt(0)
                )}
              </div>
              <div className="npc-card__info">
                <span className="npc-card__name">{npc.name}</span>
                <span className="npc-card__birthday">
                  <span aria-hidden="true">🎂</span>{' '}
                  {npc.birthday.season.charAt(0).toUpperCase() + npc.birthday.season.slice(1)}{' '}
                  {npc.birthday.day}
                </span>
                {npc.marriageable && (
                  <span className="npc-card__badge">Marriageable</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
