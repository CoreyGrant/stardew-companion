import { Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import type { QuestType } from '../types/game';

const QUEST_TYPES: Array<QuestType | 'all'> = [
  'all', 'story', 'community_center', 'special_order', 'joja', 'misc',
];

const TYPE_LABELS: Record<QuestType, string> = {
  story: 'Story',
  community_center: 'Community Center',
  special_order: 'Special Order',
  joja: 'Joja Route',
  misc: 'Misc',
};

export function QuestListPage() {
  usePageTitle('Quests');
  const { data, loading, error } = useGameData();
  const [filter, setFilter] = useState<QuestType | 'all'>('all');
  const [search, setSearch] = useState('');

  const quests = useMemo(() => {
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

  if (loading) return <div className="page-loading">Loading quests</div>;
  if (error) return <div className="page-error">{error}</div>;

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

      <div className="quest-list">
        {quests.map((quest) => (
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
        {quests.length === 0 && (
          <div className="empty-state">
            <p>No quests match your filters.</p>
            <button className="btn" onClick={() => { setFilter('all'); setSearch(''); }}>
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
