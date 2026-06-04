import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { SeasonPips } from '../components/common/SeasonPips';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import { usePageTitle } from '../hooks/usePageTitle';
import type { ShopEntry } from '../types/game';

const BASE = import.meta.env.BASE_URL;

const ALL_SHOPS = [
  "Pierre's General Store", "Willy's Fish Shop", 'Clint (Blacksmith)',
  "Marnie's Ranch", 'Harvey (Clinic)', 'Saloon (Gus)', 'Sandy (Oasis)',
  'Krobus (Sewer)', 'Dwarf (mines)', 'Traveling Merchant', 'Volcano Dwarf',
  'Island Trader', 'Desert Trader', "Qi's Walnut Room",
  "Adventurer's Guild", 'Hat Mouse',
];

const SHOP_EMOJI: Record<string, string> = {
  "Pierre's General Store": '🌱', "Willy's Fish Shop": '🎣', 'Clint (Blacksmith)': '⚒️',
  "Marnie's Ranch": '🐄', 'Harvey (Clinic)': '💊', 'Saloon (Gus)': '🍺',
  'Sandy (Oasis)': '🌵', 'Krobus (Sewer)': '👻', 'Dwarf (mines)': '⛏️',
  'Traveling Merchant': '🛒', 'Volcano Dwarf': '🌋', 'Island Trader': '🏝️',
  'Desert Trader': '🐪', "Qi's Walnut Room": '💎',
  "Adventurer's Guild": '⚔️', 'Hat Mouse': '🎩',
};

// ── Unified shop display entry ─────────────────────────────────────────────────

interface ShopDisplayEntry {
  id: string;
  name: string;
  category: string;       // item category, weapon type, 'boots', 'hat', 'shirt', 'pants'
  statsLabel?: string;    // e.g. '60–80 dmg' or 'Def 6 · Imm 5'
  spriteType: 'item' | 'weapon' | 'hat' | 'boots';
  spriteIndex?: number;
  spriteSheet?: string;
  isBigCraftable?: boolean;
  sellValue: number;
  itemId?: string;        // set for linkable (O) items only
  entry: ShopEntry;
}

const SHOP_SORT_FIELDS: SortFieldDef<ShopDisplayEntry>[] = [
  { id: 'name',     label: 'Name',      compareFn: (a, b) => a.name.localeCompare(b.name),                                    defaultDirection: 'asc'  },
  { id: 'category', label: 'Category',  compareFn: (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name), defaultDirection: 'asc' },
  { id: 'price',    label: 'Cost',      compareFn: (a, b) => (a.entry.price ?? 0) - (b.entry.price ?? 0),                    defaultDirection: 'asc'  },
  { id: 'sell',     label: 'Sell Value',compareFn: (a, b) => a.sellValue - b.sellValue,                                       defaultDirection: 'desc' },
];

const DEFAULT_SHOP_SORTS: ActiveSort[] = [{ fieldId: 'category', direction: 'asc' }];

// Sprite helper for weapon tiles (16×16, 8 cols in weapons.png)
function WeaponSpriteInline({ idx }: { idx: number }) {
  const col = idx % 8, row = Math.floor(idx / 8);
  return (
    <svg width={24} height={24} viewBox={`${col * 16} ${row * 16} 16 16`} style={{ display: 'block' }}>
      <image href={`${BASE}sprites/weapons.png`} x={0} y={0} imageRendering="pixelated" />
    </svg>
  );
}

// Sprite helper for hat tiles (20×20, 12 cols in hats.png)
function HatSpriteInline({ idx }: { idx: number }) {
  const col = idx % 12, row = Math.floor(idx / 12);
  return (
    <svg width={24} height={24} viewBox={`${col * 20} ${row * 20} 20 20`} style={{ display: 'block' }}>
      <image href={`${BASE}sprites/hats.png`} x={0} y={0} imageRendering="pixelated" />
    </svg>
  );
}

export function ShopsPage() {
  usePageTitle('Shops & Vendors');
  const { data, loading, error } = useGameData();
  const [activeShop, setActiveShop] = useState(ALL_SHOPS[0]);
  const [search,     setSearch]     = useState('');
  const [sorts,      setSorts]      = useState<ActiveSort[]>(DEFAULT_SHOP_SORTS);

  const WEAPON_TYPE_LABELS: Record<string, string> = {
    sword: 'Sword', dagger: 'Dagger', club: 'Club', slingshot: 'Slingshot', other: 'Weapon',
  };

  const shopMap = useMemo((): Map<string, ShopDisplayEntry[]> => {
    const map = new Map<string, ShopDisplayEntry[]>(ALL_SHOPS.map(s => [s, []]));
    if (!data) return map;

    // Items (O)
    for (const item of data.items) {
      if (!item.soldBy?.length) continue;
      for (const entry of item.soldBy) {
        if (!map.has(entry.shop)) continue;
        map.get(entry.shop)!.push({
          id: item.id,
          name: item.name,
          category: item.category.replace('_', ' '),
          spriteType: 'item',
          spriteSheet: item.spriteSheet,
          spriteIndex: item.spriteIndex,
          isBigCraftable: item.isBigCraftable,
          sellValue: item.sellValue,
          itemId: item.id,
          entry,
        });
      }
    }
    // Weapons
    for (const w of data.weapons ?? []) {
      if (!w.soldBy?.length) continue;
      for (const entry of w.soldBy) {
        if (!map.has(entry.shop)) continue;
        map.get(entry.shop)!.push({
          id: w.id,
          name: w.name,
          category: WEAPON_TYPE_LABELS[w.weaponType] ?? 'Weapon',
          statsLabel: `${w.minDamage}–${w.maxDamage} dmg`,
          spriteType: 'weapon',
          spriteIndex: w.spriteIndex,
          sellValue: 0,
          entry,
        });
      }
    }
    // Boots
    for (const b of data.boots ?? []) {
      if (!b.soldBy?.length) continue;
      for (const entry of b.soldBy) {
        if (!map.has(entry.shop)) continue;
        map.get(entry.shop)!.push({
          id: b.id,
          name: b.name,
          category: 'Boots',
          statsLabel: `Def ${b.defense} · Imm ${b.immunity}`,
          spriteType: 'boots',
          spriteSheet: 'springobjects',
          spriteIndex: b.spriteIndex,
          sellValue: b.sellValue,
          entry,
        });
      }
    }
    // Hats
    for (const h of data.hats ?? []) {
      if (!h.soldBy?.length) continue;
      for (const entry of h.soldBy) {
        if (!map.has(entry.shop)) continue;
        map.get(entry.shop)!.push({
          id: h.id,
          name: h.name,
          category: 'Hat',
          spriteType: 'hat',
          spriteIndex: h.spriteIndex,
          sellValue: 0,
          entry,
        });
      }
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    return items.filter(e => e.name.toLowerCase().includes(q));
  }, [shopMap, activeShop, search]);

  const sorted = useMultiSort(filtered, sorts, SHOP_SORT_FIELDS);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--shops">
      <h1 className="page__title">Shops &amp; Vendors</h1>
      <p className="page__subtitle">
        {data?.items.filter(i => i.soldBy?.length).length} items + wearables across {ALL_SHOPS.length} vendors
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

        {sorted.map(({ id, name, category, statsLabel, spriteType, spriteSheet, spriteIndex, isBigCraftable, sellValue, itemId, entry }, idx) => (
          <div key={`${id}-${idx}`} className="shop-row">
            <div className="shop-row__item">
              <span className="shop-row__sprite" aria-hidden="true">
                {spriteType === 'weapon' && spriteIndex !== undefined ? (
                  <WeaponSpriteInline idx={spriteIndex} />
                ) : spriteType === 'hat' && spriteIndex !== undefined ? (
                  <HatSpriteInline idx={spriteIndex} />
                ) : spriteSheet && spriteIndex !== undefined ? (
                  <SpriteIcon spriteSheet={spriteSheet} spriteIndex={spriteIndex} isBigCraftable={isBigCraftable} size={24} />
                ) : (
                  <span className="shop-row__sprite--fallback">?</span>
                )}
              </span>
              <span className="shop-row__info">
                {itemId ? (
                  <GameLink type="item" id={itemId} className="shop-row__name">{name}</GameLink>
                ) : (
                  <span className="shop-row__name">{name}</span>
                )}
                <span className="shop-row__category">
                  {category}{statsLabel ? ` · ${statsLabel}` : ''}
                </span>
              </span>
            </div>

            <div className="shop-row__price">
              {entry.price ? (
                <strong className="shop-row__gold">{entry.price.toLocaleString()}g</strong>
              ) : entry.currency ? (
                <span className="shop-row__trade">{entry.currencyAmount}× {entry.currency}</span>
              ) : '—'}
            </div>

            <div className="shop-row__sell">
              {sellValue > 0 ? <span className="shop-row__sell-val">{sellValue}g</span> : '—'}
            </div>

            <div className="shop-row__avail">
              {entry.season && <SeasonPips seasons={entry.season.split(',').map(s => s.trim())} />}
              {(entry.day || entry.yearMin || entry.minMineLevel) ? (
                <span className="shop-row__avail-note">
                  {[
                    entry.day && `${entry.day}s`,
                    entry.yearMin && `Yr ${entry.yearMin}+`,
                    entry.minMineLevel && `Mine ${entry.minMineLevel}+`,
                  ].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {!entry.season && !entry.day && !entry.yearMin && !entry.minMineLevel && (
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
