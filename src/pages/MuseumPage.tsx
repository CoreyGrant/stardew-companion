import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { GameLink } from '../components/common/GameLink';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import type { Item } from '../types/game';

type TabId = 'artifacts' | 'minerals';

function ProgressBar({ donated, total }: { donated: number; total: number }) {
  const pct  = total === 0 ? 0 : (donated / total) * 100;
  const full = donated === total;
  return (
    <div className={`museum-progress${full ? ' museum-progress--full' : ''}`}>
      <div className="museum-progress__track">
        <div className="museum-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="museum-progress__label">
        {donated}/{total} donated{full ? ' ✓' : ''}
      </span>
    </div>
  );
}

const GEODE_SHORT: Record<string, string> = {
  'Geode': 'G', 'Frozen Geode': 'FG', 'Magma Geode': 'MG', 'Omni Geode': 'OG', 'Golden Coconut': 'GC',
};
const GEODE_COLOR: Record<string, string> = {
  'Geode': '#8b6242', 'Frozen Geode': '#5b9bd5', 'Magma Geode': '#e05f36',
  'Omni Geode': '#7c5cba', 'Golden Coconut': '#e6a817',
};

interface ItemCardProps {
  item: Item; donated: boolean; interactive: boolean; onToggle: () => void;
}
function ItemCard({ item, donated, interactive, onToggle }: ItemCardProps) {
  return (
    <button
      className={`museum-card${donated ? ' museum-card--donated' : ''}${!interactive ? ' museum-card--readonly' : ''}`}
      onClick={interactive ? onToggle : undefined}
      title={item.description ?? item.name}
      type="button"
      aria-pressed={interactive ? donated : undefined}
    >
      <span className="museum-card__check" aria-hidden="true">{donated ? '✓' : ''}</span>
      <span className="museum-card__sprite" aria-hidden="true">
        {item.spriteSheet && item.spriteIndex !== undefined ? (
          <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} size={24} />
        ) : <span className="museum-card__sprite--fallback">?</span>}
      </span>
      <span className="museum-card__body">
        <GameLink type="item" id={item.id} className="museum-card__name" onClick={(e) => e.stopPropagation()}>
          {item.name}
        </GameLink>
        {item.geodeSource && item.geodeSource.length > 0 && (
          <span className="museum-card__geodes" aria-label={`Found in: ${item.geodeSource.join(', ')}`}>
            {item.geodeSource.filter(g => g !== 'Omni Geode').map((g) => (
              <span key={g} className="museum-card__geode-badge" style={{ background: GEODE_COLOR[g] ?? '#888' }} title={g}>
                {GEODE_SHORT[g] ?? g}
              </span>
            ))}
            {item.geodeSource.includes('Omni Geode') && (
              <span className="museum-card__geode-badge" style={{ background: GEODE_COLOR['Omni Geode'] }} title="Omni Geode">OG</span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

const DEFAULT_MUSEUM_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

export function MuseumPage() {
  usePageTitle('Museum & Donations');
  const { data, loading, error } = useGameData();
  const { activeSave, updateMuseumDonations } = useUserData();

  const [tab,            setTab]           = useState<TabId>('artifacts');
  const [donationFilter, setDonationFilter] = useState<'all' | 'donated' | 'missing'>('all');
  const [search,         setSearch]         = useState('');
  const [sorts,          setSorts]          = useState<ActiveSort[]>(DEFAULT_MUSEUM_SORTS);

  const { artifacts, minerals } = useMemo(() => {
    if (!data) return { artifacts: [], minerals: [] };
    return {
      artifacts: data.items.filter((i) => i.category === 'artifact'),
      minerals:  data.items.filter((i) => i.category === 'mineral' || i.category === 'gem'),
    };
  }, [data]);

  const donatedSet = useMemo(
    () => new Set(activeSave?.museumDonations ?? []),
    [activeSave],
  );

  // Sort fields — "donated" compareFn closes over donatedSet
  const museumSortFields = useMemo<SortFieldDef<Item>[]>(() => [
    { id: 'name',    label: 'Name',        compareFn: (a, b) => a.name.localeCompare(b.name),                                                                   defaultDirection: 'asc'  },
    { id: 'donated', label: 'Donated',     compareFn: (a, b) => (donatedSet.has(a.id) ? 1 : 0) - (donatedSet.has(b.id) ? 1 : 0),                               defaultDirection: 'asc'  }, // asc = undone first
    { id: 'geode',   label: 'Geode Count', compareFn: (a, b) => (a.geodeSource?.length ?? 0) - (b.geodeSource?.length ?? 0),                                    defaultDirection: 'desc' },
  ], [donatedSet]);

  // Filtered tab items — in useMemo so useMultiSort can be called before early returns
  const baseTabItems = useMemo(() => {
    const base = tab === 'artifacts' ? artifacts : minerals;
    let list = base;
    if (donationFilter === 'missing') list = list.filter(i => !donatedSet.has(i.id));
    if (donationFilter === 'donated') list = list.filter(i =>  donatedSet.has(i.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [tab, artifacts, minerals, donationFilter, search, donatedSet]);

  const tabItems = useMultiSort(baseTabItems, sorts, museumSortFields);

  const totalDonated = donatedSet.size;
  const totalMuseum  = artifacts.length + minerals.length;

  const toggleItem = (itemId: string) => {
    if (!activeSave) return;
    const next = donatedSet.has(itemId)
      ? [...donatedSet].filter(id => id !== itemId)
      : [...donatedSet, itemId];
    updateMuseumDonations(activeSave.id, next);
  };

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const artDonated  = artifacts.filter(i => donatedSet.has(i.id)).length;
  const minDonated  = minerals.filter(i => donatedSet.has(i.id)).length;
  const interactive = Boolean(activeSave);

  return (
    <div className="page page--museum">
      <h1 className="page__title">Museum &amp; Library</h1>
      <p className="page__subtitle">{totalMuseum} donatable items · {artifacts.length} artifacts · {minerals.length} minerals &amp; gems</p>

      {!activeSave && (
        <p className="notice"><Link to="/saves">Create a save profile</Link> to track your donations.</p>
      )}

      <ProgressBar donated={totalDonated} total={totalMuseum} />

      <div className="museum-tabs">
        <button className={`museum-tab${tab === 'artifacts' ? ' museum-tab--active' : ''}`} onClick={() => setTab('artifacts')}>
          🪨 Artifacts <span className="museum-tab__count">{artDonated}/{artifacts.length}</span>
        </button>
        <button className={`museum-tab${tab === 'minerals' ? ' museum-tab--active' : ''}`} onClick={() => setTab('minerals')}>
          💎 Minerals &amp; Gems <span className="museum-tab__count">{minDonated}/{minerals.length}</span>
        </button>
      </div>

      <ProgressBar donated={tab === 'artifacts' ? artDonated : minDonated} total={tab === 'artifacts' ? artifacts.length : minerals.length} />

      <div className="filter-bar">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {interactive && (
          <div className="filter-bar__categories" role="group" aria-label="Filter by donation status">
            {(['all', 'donated', 'missing'] as const).map(f => (
              <button
                key={f}
                className={`category-btn${donationFilter === f ? ' category-btn--active' : ''}`}
                onClick={() => setDonationFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'donated' ? '✓ Donated' : '✗ Missing'}
              </button>
            ))}
          </div>
        )}
        {interactive && (
          <button
            className="museum-select-all-btn"
            onClick={() => {
              if (!activeSave) return;
              const section = tab === 'artifacts' ? artifacts : minerals;
              const allDonated = section.every(i => donatedSet.has(i.id));
              const otherDonated = (tab === 'artifacts' ? minerals : artifacts).filter(i => donatedSet.has(i.id)).map(i => i.id);
              const next = allDonated
                ? otherDonated
                : [...new Set([...donatedSet, ...section.map(i => i.id)])];
              updateMuseumDonations(activeSave.id, next);
            }}
          >
            {(tab === 'artifacts' ? artifacts : minerals).every(i => donatedSet.has(i.id)) ? 'Unmark all' : 'Mark all donated'}
          </button>
        )}
      </div>

      <div className="fish-sort-bar">
        <MultiSort fields={museumSortFields} value={sorts} onChange={setSorts} />
      </div>

      <div className="museum-grid">
        {tabItems.map((item) => (
          <ItemCard key={item.id} item={item} donated={donatedSet.has(item.id)} interactive={interactive} onToggle={() => toggleItem(item.id)} />
        ))}
        {tabItems.length === 0 && (
          <p className="page-empty">
            {donationFilter === 'missing' ? 'All items in this section are donated!' : donationFilter === 'donated' ? 'No donated items found.' : 'No items match your search.'}
          </p>
        )}
      </div>
    </div>
  );
}
