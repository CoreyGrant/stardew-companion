import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { SeasonPips } from '../components/common/SeasonPips';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Item, ShopEntry } from '../types/game';

const ALL_SHOPS = [
  "Pierre's General Store", "Willy's Fish Shop", 'Clint (Blacksmith)',
  "Marnie's Ranch", 'Harvey (Clinic)', 'Saloon (Gus)', 'Sandy (Oasis)',
  'Krobus (Sewer)', 'Dwarf (mines)', 'Traveling Merchant', 'Volcano Dwarf',
  'Island Trader', 'Desert Trader', "Qi's Walnut Room",
];

const SHOP_EMOJI: Record<string, string> = {
  "Pierre's General Store": '🌱', "Willy's Fish Shop": '🎣', 'Clint (Blacksmith)': '⚒️',
  "Marnie's Ranch": '🐄', 'Harvey (Clinic)': '💊', 'Saloon (Gus)': '🍺',
  'Sandy (Oasis)': '🌵', 'Krobus (Sewer)': '👻', 'Dwarf (mines)': '⛏️',
  'Desert Trader': '🐪', "Qi's Walnut Room": '💎',
  'Traveling Merchant': '🛒', 'Volcano Dwarf': '🌋', 'Island Trader': '🏝️',
};

interface ShopItemEntry { item: Item; entry: ShopEntry; }

const SHOP_SORT_FIELDS: SortFieldDef<ShopItemEntry>[] = [
  { id: 'name',     label: 'Name',       compareFn: (a, b) => a.item.name.localeCompare(b.item.name),                                              defaultDirection: 'asc'  },
  { id: 'category', label: 'Category',   compareFn: (a, b) => a.item.category.localeCompare(b.item.category) || a.item.name.localeCompare(b.item.name), defaultDirection: 'asc' },
  { id: 'price',    label: 'Buy Price',  compareFn: (a, b) => (a.entry.price ?? 0) - (b.entry.price ?? 0),                                        defaultDirection: 'asc'  },
  { id: 'sell',     label: 'Sell Value', compareFn: (a, b) => (a.item.sellValue ?? 0) - (b.item.sellValue ?? 0),                                  defaultDirection: 'desc' },
];

const DEFAULT_SHOP_SORTS: ActiveSort[] = [{ fieldId: 'category', direction: 'asc' }];

export function ShopsPage() {
  usePageTitle('Shops & Vendors');
  const { data, loading, error } = useGameData();
  const [activeShop, setActiveShop] = useState(ALL_SHOPS[0]);
  const [search,     setSearch]     = useState('');
  const [sorts,      setSorts]      = useState<ActiveSort[]>(DEFAULT_SHOP_SORTS);

  const shopMap = useMemo((): Map<string, ShopItemEntry[]> => {
    const map = new Map<string, ShopItemEntry[]>(ALL_SHOPS.map((s) => [s, []]));
    if (!data) return map;
    for (const item of data.items) {
      if (!item.soldBy?.length) continue;
      for (const entry of item.soldBy) {
        if (map.has(entry.shop)) map.get(entry.shop)!.push({ item, entry });
      }
    }
    return map;
  }, [data]);

  const shopCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [shop, items] of shopMap.entries()) counts[shop] = items.length;
    return counts;
  }, [shopMap]);

  const filtered = useMemo(() => {
    const items = shopMap.get(activeShop) ?? [];
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(e => e.item.name.toLowerCase().includes(q));
  }, [shopMap, activeShop, search]);

  const sorted = useMultiSort(filtered, sorts, SHOP_SORT_FIELDS);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--shops">
      <h1 className="page__title">Shops &amp; Vendors</h1>
      <p className="page__subtitle">
        {data?.items.filter(i => i.soldBy?.length).length} items available across {ALL_SHOPS.length} vendors
      </p>

      <div className="shop-tabs">
        {ALL_SHOPS.map((shop) => (
          <button
            key={shop}
            className={`shop-tab${activeShop === shop ? ' shop-tab--active' : ''}`}
            onClick={() => { setActiveShop(shop); setSearch(''); }}
            title={shop}
          >
            <span className="shop-tab__emoji">{SHOP_EMOJI[shop] ?? '🏪'}</span>
            <span className="shop-tab__name">{shop.replace(' (Blacksmith)', '').replace("'s Ranch", '').replace("'s Fish Shop", '').replace("'s General Store", "'s")}</span>
            <span className="shop-tab__count">{shopCounts[shop] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="filter-bar filter-bar--top-gap">
        <input
          className="filter-bar__search"
          type="search"
          placeholder={`Search ${activeShop}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="shop-item-count">{sorted.length} item{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="fish-sort-bar">
        <MultiSort fields={SHOP_SORT_FIELDS} value={sorts} onChange={setSorts} />
      </div>

      <div className="shop-table">
        <div className="shop-table__header">
          <span className="shop-table__col-item">Item</span>
          <span className="shop-table__col-price">Cost</span>
          <span className="shop-table__col-sell">Sell Value</span>
          <span className="shop-table__col-avail">Availability</span>
        </div>

        {sorted.map(({ item, entry }, idx) => (
          <div key={`${item.id}-${idx}`} className="shop-row">
            <div className="shop-row__item">
              <span className="shop-row__sprite" aria-hidden="true">
                {item.spriteSheet && item.spriteIndex !== undefined ? (
                  <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} isBigCraftable={item.isBigCraftable} size={24} />
                ) : <span className="shop-row__sprite--fallback">?</span>}
              </span>
              <span className="shop-row__info">
                <GameLink type="item" id={item.id} className="shop-row__name">{item.name}</GameLink>
                <span className="shop-row__category">{item.category.replace('_', ' ')}</span>
              </span>
            </div>
            <div className="shop-row__price">
              {entry.price ? (
                <strong className="shop-row__gold">{entry.price.toLocaleString()}g</strong>
              ) : entry.currency ? (
                <span className="shop-row__trade">
                  {entry.currencyAmount}× {entry.currency}
                </span>
              ) : '—'}
            </div>
            <div className="shop-row__sell">
              {item.sellValue > 0 ? <span className="shop-row__sell-val">{item.sellValue}g</span> : '—'}
            </div>
            <div className="shop-row__avail">
              {entry.season && <SeasonPips seasons={entry.season.split(',').map(s => s.trim())} />}
              {(entry.day || entry.yearMin) ? (
                <span className="shop-row__avail-note">
                  {[entry.day && `${entry.day}s`, entry.yearMin && `Yr ${entry.yearMin}+`].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {!entry.season && !entry.day && !entry.yearMin && (
                <span className="shop-row__avail-always">Always</span>
              )}
            </div>
          </div>
        ))}

        {sorted.length === 0 && (
          <p className="page-empty">
            {search ? 'No items match your search.' : 'No items found for this vendor.'}
          </p>
        )}
      </div>
    </div>
  );
}
