import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Season } from '../types/game';

type SeasonFilter = Season | 'all';
type WeatherFilter = 'any' | 'sunny' | 'rainy';
type SortKey = 'name' | 'difficulty' | 'level' | 'value';

const SEASON_FILTERS: { id: SeasonFilter; label: string }[] = [
  { id: 'all',    label: 'All Seasons' },
  { id: 'spring', label: 'Spring' },
  { id: 'summer', label: 'Summer' },
  { id: 'fall',   label: 'Fall' },
  { id: 'winter', label: 'Winter' },
];

const WEATHER_FILTERS: { id: WeatherFilter; label: string; icon: string }[] = [
  { id: 'any',   label: 'Any Weather', icon: '🌤️' },
  { id: 'sunny', label: 'Sunny Only',  icon: '☀️' },
  { id: 'rainy', label: 'Rainy Only',  icon: '🌧️' },
];

function formatTime(t: number): string {
  const raw = t > 2400 ? t - 2400 : t;
  const h = Math.floor(raw / 100);
  const m = raw % 100;
  const suffix = t >= 1200 && t < 2400 ? 'pm' : 'am';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}${m > 0 ? `:${m.toString().padStart(2, '0')}` : ''}${suffix}`;
}

function DifficultyBar({ value }: { value: number }) {
  const pct = Math.min(value, 100);
  const color =
    pct >= 80 ? '#e53935' :
    pct >= 60 ? '#e65100' :
    pct >= 40 ? '#f9a825' :
                '#388e3c';
  return (
    <div className="fish-difficulty" title={`Difficulty: ${value}`}>
      <div className="fish-difficulty__bar">
        <div className="fish-difficulty__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="fish-difficulty__label">{value}</span>
    </div>
  );
}

export function FishGuidePage() {
  usePageTitle('Fish Guide');
  const { data, loading, error } = useGameData();
  const [season, setSeason]   = useState<SeasonFilter>('all');
  const [weather, setWeather] = useState<WeatherFilter>('any');
  const [sort, setSort]       = useState<SortKey>('name');
  const [search, setSearch]   = useState('');
  const [showTrap, setShowTrap] = useState(true);
  const [showLegendary, setShowLegendary] = useState(true);
  const [maxLevel, setMaxLevel] = useState<number>(10); // 10 = show all

  const itemMap = useMemo(
    () => new Map((data?.items ?? []).map((i) => [i.id, i])),
    [data],
  );

  if (loading) return <div className="page-loading">Loading fish data…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const allFish = data?.fish ?? [];

  const filtered = allFish.filter((f) => {
    if (!showTrap && f.trapFish) return false;
    if (!showLegendary && f.legendary) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (maxLevel < 10 && f.minFishingLevel > maxLevel) return false;
    if (season !== 'all') {
      if (!f.seasons.includes('all' as Season) && !f.seasons.includes(season as Season)) return false;
    }
    if (weather !== 'any' && !f.trapFish) {
      if (f.weather !== 'any' && f.weather !== weather) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'difficulty') return b.difficulty - a.difficulty;
    if (sort === 'level')      return a.minFishingLevel - b.minFishingLevel;
    if (sort === 'value') {
      const av = itemMap.get(a.itemId)?.sellValue ?? 0;
      const bv = itemMap.get(b.itemId)?.sellValue ?? 0;
      return bv - av;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="page page--fish-guide">
      <h1 className="page__title">Fish Guide</h1>
      <p className="page__subtitle">{allFish.length} fish · {allFish.filter(f => !f.trapFish).length} rod fish · {allFish.filter(f => f.trapFish).length} crab pot</p>

      {/* ── Filters ── */}
      <div className="filter-bar">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search fish…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="filter-bar__checkbox">
          <input type="checkbox" checked={showTrap} onChange={(e) => setShowTrap(e.target.checked)} />
          Crab Pot
        </label>
        <label className="filter-bar__checkbox">
          <input type="checkbox" checked={showLegendary} onChange={(e) => setShowLegendary(e.target.checked)} />
          Legendary
        </label>
      </div>

      <div className="filter-bar" role="group" aria-label="Filter by season and weather">
        {SEASON_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            className={[
              'category-btn',
              id !== 'all' ? `category-btn--${id}` : '',
              season === id ? 'category-btn--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setSeason(id)}
            aria-pressed={season === id}
          >
            {label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        {WEATHER_FILTERS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`category-btn${weather === id ? ' category-btn--active' : ''}`}
            onClick={() => setWeather(id)}
            title={label}
            aria-pressed={weather === id}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Sort + Level filter ── */}
      <div className="fish-sort-bar">
        <span className="fish-sort-bar__label">Sort:</span>
        {(['name', 'difficulty', 'level', 'value'] as SortKey[]).map((k) => (
          <button
            key={k}
            className={`fish-sort-btn${sort === k ? ' fish-sort-btn--active' : ''}`}
            onClick={() => setSort(k)}
          >
            {k === 'name' ? 'Name' : k === 'difficulty' ? 'Difficulty' : k === 'level' ? 'Min Level' : 'Sell Value'}
          </button>
        ))}
        <span className="fish-sort-bar__sep" />
        <span className="fish-sort-bar__label">Max Fishing Level:</span>
        {[0,1,2,3,4,5,6,7,8,9,10].map(lvl => (
          <button
            key={lvl}
            className={`fish-sort-btn${maxLevel === lvl ? ' fish-sort-btn--active' : ''}`}
            onClick={() => setMaxLevel(lvl)}
            title={lvl === 10 ? 'Show all fish' : `Only fish catchable at level ${lvl} or below`}
          >
            {lvl === 10 ? 'All' : lvl}
          </button>
        ))}
      </div>

      {/* ── Fish table ── */}
      <div className="fish-table">
        <div className="fish-table__header">
          <span>Fish</span>
          <span>Seasons</span>
          <span>Weather</span>
          <span>Time</span>
          <span>Location</span>
          <span>Difficulty</span>
          <span>Sell</span>
        </div>

        {sorted.map((f) => {
          const item = itemMap.get(f.itemId);
          const val  = item?.sellValue ?? '—';
          const seasonsAll = f.seasons.includes('all' as Season);

          return (
            <div key={f.id} className={`fish-row${f.legendary ? ' fish-row--legendary' : ''}${f.trapFish ? ' fish-row--trap' : ''}`}>
              {/* Name + sprite */}
              <div className="fish-row__name">
                {item?.spriteIndex !== undefined && (
                  <div className="fish-row__icon">
                    <svg
                      width={24} height={24}
                      viewBox={`${(item.spriteIndex % 24) * 16} ${Math.floor(item.spriteIndex / 24) * 16} 16 16`}
                      style={{ display: 'block' }}
                    >
                      <image
                        href={`${import.meta.env.BASE_URL}sprites/springobjects.png`}
                        x={0} y={0}
                        width={24 * 16} height={39 * 16}
                        imageRendering="pixelated"
                      />
                    </svg>
                  </div>
                )}
                <div className="fish-row__name-body">
                  <GameLink type="item" id={f.itemId}>{f.name}</GameLink>
                  {f.legendary && <span className="fish-badge fish-badge--legendary">Legendary</span>}
                  {f.trapFish  && <span className="fish-badge fish-badge--trap">Crab Pot</span>}
                </div>
              </div>

              {/* Season pips */}
              <div className="fish-row__seasons">
                {(['spring','summer','fall','winter'] as Season[]).map((s) => (
                  <span
                    key={s}
                    className={`season-pip season-pip--${s}${(seasonsAll || f.seasons.includes(s)) ? ' season-pip--on' : ''}`}
                    title={s}
                  />
                ))}
              </div>

              {/* Weather */}
              <div className="fish-row__weather">
                {f.trapFish ? '—' :
                  f.weather === 'sunny' ? '☀️' :
                  f.weather === 'rainy' ? '🌧️' : '🌤️'}
              </div>

              {/* Time */}
              <div className="fish-row__time">
                {f.trapFish || !f.times?.length ? '—' :
                  f.times.map((t, i) => (
                    <span key={i} className="fish-row__time-slot">
                      {formatTime(t.start)}–{formatTime(t.end)}
                    </span>
                  ))
                }
              </div>

              {/* Location */}
              <div className="fish-row__location">
                {f.locations.length > 0
                  ? f.locations.join(', ')
                  : '—'}
              </div>

              {/* Difficulty */}
              <div className="fish-row__difficulty">
                {f.trapFish ? <span className="fish-row__trap-label">Trap</span> : <DifficultyBar value={f.difficulty} />}
              </div>

              {/* Sell value */}
              <div className="fish-row__sell">{val}g</div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <p>No fish match your filters.</p>
            <button className="btn" onClick={() => {
              setSeason('all'); setWeather('any'); setSearch('');
              setShowTrap(true); setShowLegendary(true); setMaxLevel(10);
            }}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
