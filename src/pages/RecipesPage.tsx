import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { GameLink } from '../components/common/GameLink';
import { usePageTitle } from '../hooks/usePageTitle';
import type { RecipeSourceType } from '../types/game';

type FilterId = RecipeSourceType | 'all';

const SOURCE_FILTERS: { id: FilterId; label: string; emoji: string }[] = [
  { id: 'all',        label: 'All',           emoji: '📋' },
  { id: 'tv',         label: 'Queen of Sauce', emoji: '📺' },
  { id: 'friendship', label: 'Friendship',     emoji: '💛' },
  { id: 'skill',      label: 'Skill',          emoji: '⭐' },
  { id: 'island',     label: 'Island',         emoji: '🌴' },
  { id: 'default',    label: 'Default',        emoji: '🍳' },
];

const SOURCE_LABELS: Record<RecipeSourceType, string> = {
  tv:         'Queen of Sauce',
  friendship: 'Friendship',
  skill:      'Skill',
  island:     'Island',
  default:    'Default',
  unknown:    'Special',
};

const SOURCE_COLORS: Record<RecipeSourceType, string> = {
  tv:         '#7c3aed',
  friendship: '#be185d',
  skill:      '#d97706',
  island:     '#0f766e',
  default:    '#4a7c59',
  unknown:    '#6b7280',
};

export function RecipesPage() {
  usePageTitle('Cooking Recipes');
  const { data, loading, error } = useGameData();
  const { activeSave } = useUserData();
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const [knownOnly, setKnownOnly] = useState(false);

  const learnedSet = useMemo(
    () => new Set(activeSave?.learnedCookingRecipes ?? []),
    [activeSave],
  );

  const itemMap = useMemo(
    () => new Map((data?.items ?? []).map(i => [i.cheatId, i])),
    [data],
  );

  // NPC name → id for linking friendship-unlocked recipes
  const npcNameToId = useMemo(
    () => new Map((data?.npcs ?? []).map(n => [n.name, n.id])),
    [data],
  );

  const recipes = useMemo(() => {
    let list = data?.recipes ?? [];
    if (filter !== 'all') list = list.filter(r => r.sourceType === filter);
    if (knownOnly && learnedSet.size > 0) list = list.filter(r => learnedSet.has(r.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.resultItemName.toLowerCase().includes(q) ||
        r.ingredients.some(i => i.itemName.toLowerCase().includes(q)) ||
        (r.friendshipNPC ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, filter, search, knownOnly, learnedSet]);

  const counts = useMemo(() => {
    const all = data?.recipes ?? [];
    const map: Record<string, number> = { all: all.length };
    for (const r of all) map[r.sourceType] = (map[r.sourceType] ?? 0) + 1;
    return map;
  }, [data]);

  if (loading) return <div className="page-loading">Loading recipes</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--recipes">
      <h1 className="page__title">Cooking Recipes</h1>
      <p className="page__subtitle">All cooking recipes — learned from TV, friendship gifts, skill levels, and Ginger Island.</p>

      {/* Source filter tabs */}
      <div className="filter-bar filter-bar--wrap">
        {SOURCE_FILTERS.map(({ id, label, emoji }) => (
          counts[id] ? (
            <button
              key={id}
              className={`recipe-filter-btn${filter === id ? ' recipe-filter-btn--active' : ''}`}
              data-source={id}
              onClick={() => setFilter(id)}
            >
              <span className="recipe-filter-btn__emoji">{emoji}</span>
              {label}
              <span className="recipe-filter-btn__count">{counts[id] ?? 0}</span>
            </button>
          ) : null
        ))}
      </div>

      {/* Search + known filter */}
      <div className="recipe-search-bar">
        <input
          type="search"
          className="recipe-search-bar__input"
          placeholder="Search recipes or ingredients"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {learnedSet.size > 0 && (
          <label className="recipe-search-bar__known-toggle">
            <input
              type="checkbox"
              checked={knownOnly}
              onChange={e => setKnownOnly(e.target.checked)}
            />
            Known only ({learnedSet.size})
          </label>
        )}
      </div>

      {/* Recipe grid */}
      <div className="recipe-grid">
        {recipes.map(recipe => {
          const resultItem = itemMap.get(recipe.resultItemId);
          return (
            <div key={recipe.id} className={`recipe-card${learnedSet.has(recipe.id) ? ' recipe-card--known' : ''}`}>
              {/* Header: result item */}
              <div className="recipe-card__header">
                <div className="recipe-card__icon">
                  {resultItem?.spriteSheet && resultItem.spriteIndex !== undefined ? (
                    <SpriteIcon
                      spriteSheet={resultItem.spriteSheet}
                      spriteIndex={resultItem.spriteIndex}
                      size={32}
                    />
                  ) : (
                    <span className="recipe-card__icon--placeholder">🍽</span>
                  )}
                </div>
                <div className="recipe-card__title-block">
                  {recipe.resultItemRefId ? (
                    <Link to={`/items/${recipe.resultItemRefId}`} className="recipe-card__name">
                      {recipe.resultItemName}
                    </Link>
                  ) : (
                    <span className="recipe-card__name">{recipe.resultItemName}</span>
                  )}
                  <div className="recipe-card__badges">
                    <span
                      className="recipe-card__source-badge"
                      style={{ background: SOURCE_COLORS[recipe.sourceType] }}
                    >
                      {SOURCE_LABELS[recipe.sourceType]}
                    </span>
                    {learnedSet.has(recipe.id) && (
                      <span className="recipe-card__known-badge">✓ Known</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Source detail */}
              <div className="recipe-card__source">
                {recipe.sourceType === 'friendship' && recipe.friendshipNPC ? (
                  <span>
                    {npcNameToId.has(recipe.friendshipNPC) ? (
                      <GameLink type="npc" id={npcNameToId.get(recipe.friendshipNPC)!}>
                        {recipe.friendshipNPC}
                      </GameLink>
                    ) : (
                      <strong>{recipe.friendshipNPC}</strong>
                    )}
                    {' '}— {recipe.friendshipLevel}♥
                  </span>
                ) : recipe.sourceType === 'skill' && recipe.skillName ? (
                  <span>
                    <strong>{recipe.skillName}</strong> Lv. {recipe.skillLevel}
                  </span>
                ) : recipe.sourceType === 'tv' ? (
                  <span>Airs on TV (Queen of Sauce)</span>
                ) : recipe.sourceType === 'island' ? (
                  <span>Ginger Island unlock</span>
                ) : null}
              </div>

              {/* Ingredients */}
              <ul className="recipe-card__ingredients">
                {recipe.ingredients.map((ing, idx) => {
                  const ingItem = ing.itemId ? itemMap.get(ing.itemId) : null;
                  return (
                    <li key={idx} className="recipe-card__ingredient">
                      {ingItem?.spriteSheet && ingItem.spriteIndex !== undefined ? (
                        <span className="recipe-card__ing-icon">
                          <SpriteIcon
                            spriteSheet={ingItem.spriteSheet}
                            spriteIndex={ingItem.spriteIndex}
                            size={20}
                          />
                        </span>
                      ) : (
                        <span className="recipe-card__ing-icon recipe-card__ing-icon--cat">
                          {ing.isCategory ? '?' : '·'}
                        </span>
                      )}
                      <span className="recipe-card__ing-qty">{ing.quantity}×</span>
                      {ingItem ? (
                        <Link to={`/items/${ingItem.id}`} className="recipe-card__ing-name">
                          {ing.itemName}
                        </Link>
                      ) : (
                        <span className="recipe-card__ing-name recipe-card__ing-name--cat">
                          {ing.itemName}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {recipes.length === 0 && (
        <div className="empty-state">
          <p>No recipes match your filters.</p>
          <button className="btn" onClick={() => { setFilter('all'); setSearch(''); }}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
