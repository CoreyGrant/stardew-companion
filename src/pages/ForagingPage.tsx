import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { SeasonSelector } from '../components/common/SeasonSelector';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Item, Season } from '../types/game';

type SeasonTab = Season | 'all';

type LocationFilter = 'all' | 'outdoor' | 'beach' | 'cave' | 'desert' | 'island';

const LOCATION_FILTERS: { id: LocationFilter; label: string; emoji: string }[] = [
  { id: 'all',     label: 'All',      emoji: '' },
  { id: 'outdoor', label: 'Outdoor',  emoji: '🌿' },
  { id: 'beach',   label: 'Beach',    emoji: '🐚' },
  { id: 'cave',    label: 'Cave',     emoji: '🕯️' },
  { id: 'desert',  label: 'Desert',   emoji: '🌵' },
  { id: 'island',  label: 'Island',   emoji: '🌴' },
];

export const FORAGE_LOCATION_COLOR: Record<string, string> = {
  outdoor: '#4a7c59',
  beach:   '#e6a817',
  cave:    '#7c5cba',
  desert:  '#c2620a',
  island:  '#1e8ab4',
};

export const FORAGE_LOCATION_EMOJI: Record<string, string> = {
  outdoor: '🌿',
  beach:   '🐚',
  cave:    '🕯️',
  desert:  '🌵',
  island:  '🌴',
};

function SeasonPips({ item, highlight }: { item: Item; highlight?: Season }) {
  const seasons: string[] = (item.seasons as string[] | undefined) ?? [];
  const isAll = seasons.includes('all');
  return (
    <span className="forage-pips">
      {(['spring', 'summer', 'fall', 'winter'] as Season[]).map((s) => (
        <span
          key={s}
          className={[
            'season-pip',
            `season-pip--${s}`,
            (isAll || seasons.includes(s)) ? 'season-pip--on' : '',
            s === highlight && (isAll || seasons.includes(s)) ? 'season-pip--highlight' : '',
          ].filter(Boolean).join(' ')}
          title={s}
        />
      ))}
    </span>
  );
}

function ForageCard({ item, highlightSeason }: { item: Item; highlightSeason?: Season }) {
  const loc = item.forageLocation ?? 'outdoor';
  const color = FORAGE_LOCATION_COLOR[loc] ?? '#666';
  const emoji = FORAGE_LOCATION_EMOJI[loc] ?? '';
  const isYearRound = ((item.seasons as string[] | undefined) ?? []).includes('all');

  return (
    <div className="forage-card">
      <span className="forage-card__sprite" aria-hidden="true">
        {item.spriteSheet && item.spriteIndex !== undefined ? (
          <SpriteIcon
            spriteSheet={item.spriteSheet}
            spriteIndex={item.spriteIndex}
            size={24}
          />
        ) : (
          <span className="forage-card__sprite--fallback">🌿</span>
        )}
      </span>

      <span className="forage-card__body">
        <GameLink type="item" id={item.id} className="forage-card__name">
          {item.name}
        </GameLink>
        <span className="forage-card__meta">
          <span
            className="forage-card__loc"
            style={{ background: color }}
            title={`Found: ${loc}`}
          >
            {emoji} {loc.charAt(0).toUpperCase() + loc.slice(1)}
          </span>
          {isYearRound && highlightSeason && (
            <span className="forage-card__yr-badge" title="Available year-round">Year-round</span>
          )}
        </span>
      </span>

      <span className="forage-card__right">
        <SeasonPips item={item} highlight={highlightSeason} />
        <span className="forage-card__sell">{item.sellValue}g</span>
      </span>
    </div>
  );
}

export function ForagingPage() {
  usePageTitle('Foraging Guide');
  const { data, loading, error } = useGameData();

  const [seasonTab, setSeasonTab]       = useState<SeasonTab>('spring');
  const [locationFilter, setLocFilter]  = useState<LocationFilter>('all');
  const [search, setSearch]             = useState('');

  const forageItems = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((i) => i.forageLocation !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  // Counts per season (for tab badges)
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
      // Season tab filter
      if (seasonTab !== 'all') {
        const seasons: string[] = (item.seasons as string[] | undefined) ?? ['all'];
        const isAll = seasons.includes('all');
        if (!isAll && !seasons.includes(seasonTab)) return false;
      }
      // Location filter
      if (locationFilter !== 'all' && item.forageLocation !== locationFilter) return false;
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [forageItems, seasonTab, locationFilter, search]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const highlight = seasonTab === 'all' ? undefined : seasonTab as Season;

  return (
    <div className="page page--foraging">
      <h1 className="page__title">Foraging Guide</h1>
      <p className="page__subtitle">
        {forageItems.length} forageable items — wild plants, mushrooms, shells, and more
      </p>

      {/* Season selector */}
      <SeasonSelector
        value={seasonTab}
        onChange={setSeasonTab}
        counts={seasonCounts}
      />

      {/* Location + search filters */}
      <div className="filter-bar filter-bar--top-gap">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search…"
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

      {/* Result count */}
      <p className="forage-result-count" role="status" aria-live="polite">
        {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        {seasonTab !== 'all' && ` in ${seasonTab.charAt(0).toUpperCase() + seasonTab.slice(1)}`}
        {locationFilter !== 'all' && ` · ${LOCATION_FILTERS.find(l => l.id === locationFilter)?.label}`}
      </p>

      {/* Item grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>No forage items match your filters.</p>
          <button className="btn" onClick={() => { setSeasonTab('all'); setLocFilter('all'); setSearch(''); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="forage-grid">
          {filtered.map((item) => (
            <ForageCard key={item.id} item={item} highlightSeason={highlight} />
          ))}
        </div>
      )}
    </div>
  );
}
