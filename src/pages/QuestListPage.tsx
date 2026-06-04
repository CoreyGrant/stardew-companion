import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Quest, QuestType } from '../types/game';

const QUEST_TYPES: Array<QuestType | 'all'> = [
  'all', 'story', 'community_center', 'special_order', 'joja', 'misc',
];

const TYPE_LABELS: Record<QuestType, string> = {
  story: 'Story', community_center: 'Community Center',
  special_order: 'Special Order', joja: 'Joja Route', misc: 'Misc',
};

const TYPE_ORDER: Record<QuestType, number> = {
  story: 0, community_center: 1, special_order: 2, joja: 3, misc: 4,
};

const QUEST_SORT_FIELDS: SortFieldDef<Quest>[] = [
  { id: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name),                        defaultDirection: 'asc' },
  { id: 'type', label: 'Type', compareFn: (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type],              defaultDirection: 'asc' },
];

const DEFAULT_QUEST_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

export function QuestListPage() {
  usePageTitle('Quests');
  const { data, loading, error } = useGameData();
  const [filter, setFilter] = useState<QuestType | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sorts,  setSorts]  = useState<ActiveSort[]>(DEFAULT_QUEST_SORTS);

  const filtered = useMemo(() => {
    let list = data?.quests ?? [];
    if (filter !== 'all') list = list.filter(q => q.type === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(quest =>
        quest.name.toLowerCase().includes(q) ||
        quest.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, filter, search]);

  const sorted = useMultiSort(filtered, sorts, QUEST_SORT_FIELDS);

  if (loading) return <div className="page-loading">Loading quests</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--quest-list">
      <h1 className="page__title">Quests</h1>
      <p className="page__subtitle">Story quests, Community Center bundles, special orders, and more.</p>

      <div className="filter-bar">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search quests"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search quests"
        />
        <div className="filter-bar__categories" role="group" aria-label="Filter by quest type">
          {QUEST_TYPES.map((t) => (
            <button
              key={t}
              className={`category-btn${filter === t ? ' category-btn--active' : ''}`}
              onClick={() => setFilter(t)}
            >
              {t === 'all' ? 'All' : TYPE_LABELS[t as QuestType]}
            </button>
          ))}
        </div>
      </div>

      <div className="fish-sort-bar">
        <MultiSort fields={QUEST_SORT_FIELDS} value={sorts} onChange={setSorts} />
      </div>

      <div className="quest-list">
        {sorted.map((quest) => (
          <Link key={quest.id} to={`/quests/${quest.id}`} className="quest-card">
            <span className="quest-card__name">{quest.name}</span>
            <span className={`quest-card__type quest-card__type--${quest.type}`}>
              {TYPE_LABELS[quest.type]}
            </span>
            {quest.reward && (
              <span className="quest-card__reward">Reward: {quest.reward}</span>
            )}
          </Link>
        ))}
        {sorted.length === 0 && (
          <div className="empty-state">
            <p>No quests match your filters.</p>
            <button className="btn" onClick={() => { setFilter('all'); setSearch(''); setSorts(DEFAULT_QUEST_SORTS); }}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
