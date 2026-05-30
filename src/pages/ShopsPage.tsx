import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Item, ShopEntry } from '../types/game';

// All known shops in display order
const ALL_SHOPS = [
  "Pierre's General Store",
  "Willy's Fish Shop",
  'Clint (Blacksmith)',
  "Marnie's Ranch",
  'Harvey (Clinic)',
  'Saloon (Gus)',
  'Sandy (Oasis)',
  'Krobus (Sewer)',
  'Dwarf (mines)',
  'Traveling Merchant',
  'Volcano Dwarf',
  'Island Trader',
];

const SHOP_EMOJI: Record<string, string> = {
  "Pierre's General Store": '🌱',
  "Willy's Fish Shop":      '🎣',
  'Clint (Blacksmith)':     '⚒️',
  "Marnie's Ranch":         '🐄',
  'Harvey (Clinic)':        '💊',
  'Saloon (Gus)':           '🍺',
  'Sandy (Oasis)':          '🌵',
  'Krobus (Sewer)':         '👻',
  'Dwarf (mines)':          '⛏️',
  'Traveling Merchant':     '🛒',
  'Volcano Dwarf':          '🌋',
  'Island Trader':          '🏝️',
};

interface ShopItemEntry {
  item: Item;
  entry: ShopEntry;
}

function seasonLabel(season: string): string {
  return season.split(',')
    .map((s) => s.trim().charAt(0).toUpperCase() + s.trim().slice(1))
    .join(', ');
}

function availabilityNote(entry: ShopEntry): string {
  const parts: string[] = [];
  if (entry.season)  parts.push(seasonLabel(entry.season));
  if (entry.day)     parts.push(`${entry.day}s only`);
  if (entry.yearMin) parts.push(`Year ${entry.yearMin}+`);
  return parts.join(' · ');
}

export function ShopsPage() {
  usePageTitle('Shops & Vendors');
  const { data, loading, error } = useGameData();
  const [activeShop, setActiveShop] = useState(ALL_SHOPS[0]);
  const [search, setSearch]         = useState('');

  // Build shop → ShopItemEntry[] map
  const shopMap = useMemo((): Map<string, ShopItemEntry[]> => {
    const map = new Map<string, ShopItemEntry[]>(ALL_SHOPS.map((s) => [s, []]));
    if (!data) return map;
    for (const item of data.items) {
      if (!item.soldBy?.length) continue;
      for (const entry of item.soldBy) {
        if (map.has(entry.shop)) {
          map.get(entry.shop)!.push({ item, entry });
        }
      }
    }
    // Sort each shop's items by category then name
    for (const entries of map.values()) {
      entries.sort((a, b) => {
        const catCmp = a.item.category.localeCompare(b.item.category);
        return catCmp !== 0 ? catCmp : a.item.name.localeCompare(b.item.name);
      });
    }
    return map;
  }, [data]);

  const shopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [shop, items] of shopMap.entries()) counts[shop] = items.length;
    return counts;
  }, [shopMap]);

  const activeItems = useMemo(() => {
    const items = shopMap.get(activeShop) ?? [];
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((e) => e.item.name.toLowerCase().includes(q));
  }, [shopMap, activeShop, search]);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const isIslandTrader = activeShop === 'Island Trader';

  return (
    <div className="page page--shops">
      <h1 className="page__title">Shops &amp; Vendors</h1>
      <p className="page__subtitle">
        {data?.items.filter((i) => i.soldBy?.length).length} items available across {ALL_SHOPS.length} vendors
      </p>

      {/* Shop selector */}
      <div className="shop-tabs">
        {ALL_SHOPS.map((shop) => (
          <button
            key={shop}
            className={`shop-tab${activeShop === shop ? ' shop-tab--active' : ''}`}
            onClick={() => { setActiveShop(shop); setSearch(''); }}
            title={shop}
          >
            <span className="shop-tab__emoji">{SHOP_EMOJI[shop] ?? '🏪'}</span>
            <span className="shop-tab__name">{shop.replace(" (Blacksmith)", '').replace("'s Ranch", '').replace("'s Fish Shop", '').replace("'s General Store", "'s")}</span>
            <span className="shop-tab__count">{shopCounts[shop] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="filter-bar filter-bar--top-gap">
        <input
          className="filter-bar__search"
          type="search"
          placeholder={`Search ${activeShop}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="shop-item-count">
          {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isIslandTrader && (
        <p className="notice" style={{ marginBottom: 8 }}>
          Island Trader uses item-for-item barter — buy prices shown here are sell values for reference only.
        </p>
      )}

      {/* Item table */}
      <div className="shop-table">
        <div className="shop-table__header">
          <span className="shop-table__col-item">Item</span>
          <span className="shop-table__col-price">Buy Price</span>
          <span className="shop-table__col-sell">Sell Value</span>
          <span className="shop-table__col-avail">Availability</span>
        </div>

        {activeItems.map(({ item, entry }, idx) => {
          const avail = availabilityNote(entry);
          return (
            <div key={`${item.id}-${idx}`} className="shop-row">
              <div className="shop-row__item">
                <span className="shop-row__sprite" aria-hidden="true">
                  {item.spriteSheet && item.spriteIndex !== undefined ? (
                    <SpriteIcon
                      spriteSheet={item.spriteSheet}
                      spriteIndex={item.spriteIndex}
                      isBigCraftable={item.isBigCraftable}
                      size={24}
                    />
                  ) : (
                    <span className="shop-row__sprite--fallback">?</span>
                  )}
                </span>
                <span className="shop-row__info">
                  <GameLink type="item" id={item.id} className="shop-row__name">
                    {item.name}
                  </GameLink>
                  <span className="shop-row__category">
                    {item.category.replace('_', ' ')}
                  </span>
                </span>
              </div>

              <div className="shop-row__price">
                {!isIslandTrader && entry.price ? (
                  <strong className="shop-row__gold">{entry.price}g</strong>
                ) : isIslandTrader ? (
                  <span className="shop-row__barter">🔄 Barter</span>
                ) : '—'}
              </div>

              <div className="shop-row__sell">
                {item.sellValue > 0 ? (
                  <span className="shop-row__sell-val">{item.sellValue}g</span>
                ) : '—'}
              </div>

              <div className="shop-row__avail">
                {avail ? (
                  <span className="shop-row__avail-note">{avail}</span>
                ) : (
                  <span className="shop-row__avail-always">Always</span>
                )}
              </div>
            </div>
          );
        })}

        {activeItems.length === 0 && (
          <p className="page-empty">
            {search ? 'No items match your search.' : 'No items found for this vendor.'}
          </p>
        )}
      </div>
    </div>
  );
}
