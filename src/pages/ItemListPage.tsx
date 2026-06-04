import { Link } from 'react-router-dom';
import { useItemList, ITEM_SORT_FIELDS } from '../hooks/useItemList';
import { MultiSort } from '../components/common/MultiSort';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { ViewToggle } from '../components/common/ViewToggle';
import { useViewMode } from '../hooks/useViewMode';
import { usePageTitle } from '../hooks/usePageTitle';
import type { ItemCategory } from '../types/game';

const CATEGORIES: Array<ItemCategory | 'all'> = [
  'all', 'crop', 'seed', 'fish', 'mineral', 'gem', 'artifact',
  'artisan', 'food', 'animal_product', 'forage', 'resource', 'machine', 'book', 'other',
];

export function ItemListPage() {
  usePageTitle('Items');
  const { items, loading, error, search, setSearch, category, setCategory,
          sorts, setSorts, hasEnergy } = useItemList();
  const [viewMode, setViewMode] = useViewMode('items', 'tile');

  // Hide energy sort field when no items in the current result set have energy data
  const visibleSortFields = hasEnergy
    ? ITEM_SORT_FIELDS
    : ITEM_SORT_FIELDS.filter((f) => f.id !== 'energy');

  if (loading) return <div className="page-loading">Loading items</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--item-list">
      <h1 className="page__title">Items</h1>
      <p className="page__subtitle">Browse every item in Stardew Valley — crops, fish, minerals, artisan goods, and more.</p>

      <div className="filter-bar">
        <input
          className="filter-bar__search"
          type="search"
          placeholder="Search items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search items"
        />
        <div className="filter-bar__categories" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`category-btn${category === c ? ' category-btn--active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c === 'all' ? 'All' : c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Sort bar */}
      <div className="fish-sort-bar">
        <MultiSort fields={visibleSortFields} value={sorts} onChange={setSorts} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No items match your filters.</p>
          <button className="btn" onClick={() => { setSearch(''); setCategory('all'); setSorts([{ fieldId: 'name', direction: 'asc' }]); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'tile' && (
            <div className="item-grid">
              {items.map((item) => (
                <Link key={item.id} to={`/items/${item.id}`} className="item-card">
                  <div className="item-card__sprite" aria-hidden="true">
                    {item.spriteSheet && item.spriteIndex !== undefined ? (
                      <SpriteIcon
                        spriteSheet={item.spriteSheet}
                        spriteIndex={item.spriteIndex}
                        isBigCraftable={item.isBigCraftable}
                        size={item.isBigCraftable ? 20 : 32}
                      />
                    ) : item.name.charAt(0)}
                  </div>
                  <div className="item-card__info">
                    <span className="item-card__name">{item.name}</span>
                    <span className="item-card__category">{item.category.replace('_', ' ')}</span>
                    <span className="item-card__value">{item.sellValue}g</span>
                    {item.energy !== undefined && (
                      <span className="item-card__energy">⚡ +{item.energy}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="item-table">
              <div className="item-table__header">
                <span>Item</span>
                <span>Category</span>
                <span>Sell Value</span>
                {hasEnergy && <span>Energy</span>}
              </div>
              {items.map((item) => (
                <Link key={item.id} to={`/items/${item.id}`} className="item-row">
                  <div className="item-row__name">
                    <div className="item-row__sprite">
                      {item.spriteSheet && item.spriteIndex !== undefined ? (
                        <SpriteIcon
                          spriteSheet={item.spriteSheet}
                          spriteIndex={item.spriteIndex}
                          isBigCraftable={item.isBigCraftable}
                          size={item.isBigCraftable ? 16 : 20}
                        />
                      ) : <span>{item.name.charAt(0)}</span>}
                    </div>
                    <span>{item.name}</span>
                  </div>
                  <span className="item-row__category">{item.category.replace('_', ' ')}</span>
                  <span className="item-row__value">{item.sellValue}g</span>
                  {hasEnergy && <span className="item-row__energy">{item.energy !== undefined ? `⚡ +${item.energy}` : '—'}</span>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
