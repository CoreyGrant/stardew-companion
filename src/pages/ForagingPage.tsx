import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { SeasonSelector } from '../components/common/SeasonSelector';
import { SeasonPips } from '../components/common/SeasonPips';
import { ViewToggle } from '../components/common/ViewToggle';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import { useViewMode } from '../hooks/useViewMode';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Item, Season } from '../types/game';

type SeasonTab = Season | 'all';
type LocationFilter = 'all' | 'outdoor' | 'beach' | 'cave' | 'desert' | 'island';

const LOCATION_FILTERS: { id: LocationFilter; label: string; emoji: string }[] = [
  { id: 'all',     label: 'All',     emoji: '' },
  { id: 'outdoor', label: 'Outdoor', emoji: '🌿' },
  { id: 'beach',   label: 'Beach',   emoji: '🐚' },
  { id: 'cave',    label: 'Cave',    emoji: '🕯️' },
  { id: 'desert',  label: 'Desert',  emoji: '🌵' },
  { id: 'island',  label: 'Island',  emoji: '🌴' },
];

export const FORAGE_LOCATION_COLOR: Record<string, string> = {
  outdoor: '#4a7c59', beach: '#e6a817', cave: '#7c5cba', desert: '#c2620a', island: '#1e8ab4',
};
export const FORAGE_LOCATION_EMOJI: Record<string, string> = {
  outdoor: '🌿', beach: '🐚', cave: '🕯️', desert: '🌵', island: '🌴',
};

const LOCATION_ORDER: Record<string, number> = {
  outdoor: 0, beach: 1, cave: 2, desert: 3, island: 4,
};

const FORAGE_SORT_FIELDS: SortFieldDef<Item>[] = [
  { id: 'name',     label: 'Name',       compareFn: (a, b) => a.name.localeCompare(b.name),                                                                       defaultDirection: 'asc'  },
  { id: 'value',    label: 'Sell Value', compareFn: (a, b) => (a.sellValue ?? 0) - (b.sellValue ?? 0),                                                            defaultDirection: 'desc' },
  { id: 'location', label: 'Location',   compareFn: (a, b) => (LOCATION_ORDER[a.forageLocation ?? ''] ?? 9) - (LOCATION_ORDER[b.forageLocation ?? ''] ?? 9),     defaultDirection: 'asc'  },
];

const DEFAULT_FORAGE_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

function ForageCard({ item, highlightSeason }: { item: Item; highlightSeason?: Season }) {
  const loc   = item.forageLocation ?? 'outdoor';
  const color = FORAGE_LOCATION_COLOR[loc] ?? '#666';
  const emoji = FORAGE_LOCATION_EMOJI[loc] ?? '';
  const itemSeasons = (item.seasons as string[] | undefined) ?? [];
  const isYearRound = itemSeasons.includes('all');
  return (
    <div className="forage-card">
      <span className="forage-card__sprite" aria-hidden="true">
        {item.spriteSheet && item.spriteIndex !== undefined ? (
          <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} size={24} />
        ) : <span className="forage-card__sprite--fallback">🌿</span>}
      </span>
      <span className="forage-card__body">
        <GameLink type="item" id={item.id} className="forage-card__name">{item.name}</GameLink>
        <span className="forage-card__meta">
          <span className="forage-card__loc" style={{ background: color }} title={`Found: ${loc}`}>
            {emoji} {loc.charAt(0).toUpperCase() + loc.slice(1)}
          </span>
          {isYearRound && highlightSeason && (
            <span className="forage-card__yr-badge" title="Available year-round">Year-round</span>
          )}
        </span>
      </span>
      <span className="forage-card__right">
        <SeasonPips seasons={itemSeasons} highlight={highlightSeason} />
        <span className="forage-card__sell">{item.sellValue}g</span>
      </span>
    </div>
  );
}

export function ForagingPage() {
  usePageTitle('Foraging Guide');
  const { data, loading, error } = useGameData();

  const [seasonTab,      setSeasonTab] = useState<SeasonTab>('spring');
  const [locationFilter, setLocFilter] = useState<LocationFilter>('all');
  const [search,         setSearch]    = useState('');
  const [sorts,          setSorts]     = useState<ActiveSort[]>(DEFAULT_FORAGE_SORTS);
  const [viewMode,       setViewMode]  = useViewMode('forage', 'tile');

  const forageItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter((i) => i.forageLocation !== undefined);
  }, [data]);

  const seasonCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, spring: 0, summer: 0, fall: 0, winter: 0 };
    for (const item of forageItems) {
      counts.all++;
      const seasons: string[] = (item.seasons as string[] | undefined) ?? ['all'];
      const isAll = seasons.includes('all');
      for (const s of ['spring', 'summer', 'fall', 'winter']) {
        if (isAll || seasons.includes(s)) counts[s]++;
      }
    }
    return counts;
  }, [forageItems]);

  const filtered = useMemo(() => {
    return forageItems.filter((item) => {
      if (seasonTab !== 'all') {
        const seasons: string[] = (item.seasons as string[] | undefined) ?? ['all'];
        if (!seasons.includes('all') && !seasons.includes(seasonTab)) return false;
      }
      if (locationFilter !== 'all' && item.forageLocation !== locationFilter) return false;
      if (search.trim()) {
        if (!item.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [forageItems, seasonTab, locationFilter, search]);

  const sorted = useMultiSort(filtered, sorts, FORAGE_SORT_FIELDS);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const highlight = seasonTab === 'all' ? undefined : seasonTab as Season;

  return (
    <div className="page page--foraging">
      <h1 className="page__title">Foraging Guide</h1>
      <p className="page__subtitle">
        {forageItems.length} forageable items — wild plants, mushrooms, shells, and more
      </p>

      <SeasonSelector value={seasonTab} onChange={setSeasonTab} counts={seasonCounts} />

      <div className="filter-bar filter-bar--top-gap">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {LOCATION_FILTERS.map(({ id, label, emoji }) => (
          <button
            key={id}
            className={`forage-loc-btn${locationFilter === id ? ' forage-loc-btn--active' : ''}`}
            onClick={() => setLocFilter(id)}
            style={
              locationFilter === id && id !== 'all'
                ? { background: FORAGE_LOCATION_COLOR[id], borderColor: FORAGE_LOCATION_COLOR[id], color: '#fff' }
                : {}
            }
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      <div className="fish-sort-bar">
        <MultiSort fields={FORAGE_SORT_FIELDS} value={sorts} onChange={setSorts} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <p className="forage-result-count" role="status" aria-live="polite">
        {sorted.length} item{sorted.length !== 1 ? 's' : ''}
        {seasonTab !== 'all' && ` in ${seasonTab.charAt(0).toUpperCase() + seasonTab.slice(1)}`}
        {locationFilter !== 'all' && ` · ${LOCATION_FILTERS.find(l => l.id === locationFilter)?.label}`}
      </p>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <p>No forage items match your filters.</p>
          <button className="btn" onClick={() => { setSeasonTab('all'); setLocFilter('all'); setSearch(''); setSorts(DEFAULT_FORAGE_SORTS); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'tile' && (
            <div className="forage-grid">
              {sorted.map((item) => (
                <ForageCard key={item.id} item={item} highlightSeason={highlight} />
              ))}
            </div>
          )}
          {viewMode === 'table' && (
            <div className="forage-table">
              <div className="forage-table__header">
                <span>Item</span><span>Seasons</span><span>Location</span><span>Sell</span>
              </div>
              {sorted.map((item) => {
                const loc   = item.forageLocation ?? 'outdoor';
                const color = FORAGE_LOCATION_COLOR[loc] ?? '#666';
                const emoji = FORAGE_LOCATION_EMOJI[loc] ?? '';
                const itemSeasons = (item.seasons as string[] | undefined) ?? [];
                return (
                  <div key={item.id} className="forage-row">
                    <div className="forage-row__name">
                      {item.spriteSheet && item.spriteIndex !== undefined ? (
                        <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} size={20} />
                      ) : <span>🌿</span>}
                      <GameLink type="item" id={item.id}>{item.name}</GameLink>
                    </div>
                    <div className="forage-row__seasons"><SeasonPips seasons={itemSeasons} /></div>
                    <span className="forage-row__loc" style={{ background: color }}>
                      {emoji} {loc.charAt(0).toUpperCase() + loc.slice(1)}
                    </span>
                    <span className="forage-row__sell">{item.sellValue}g</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
