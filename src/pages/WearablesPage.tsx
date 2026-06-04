import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import { usePageTitle } from '../hooks/usePageTitle';
import type { WeaponDef, BootsDef, HatDef, ClothingDef } from '../types/game';

const BASE = import.meta.env.BASE_URL;

// ── Sprite helpers ─────────────────────────────────────────────────────────────

/** Render a 16×16 tile from weapons.png (8 tiles per row) */
function WeaponSprite({ idx, size = 32 }: { idx: number; size?: number }) {
  const col = idx % 8, row = Math.floor(idx / 8);
  return (
    <svg width={size} height={size} viewBox={`${col * 16} ${row * 16} 16 16`} style={{ display: 'block' }}>
      <image href={`${BASE}sprites/weapons.png`} x={0} y={0} imageRendering="pixelated" />
    </svg>
  );
}

/** Render a 20×20 tile from hats.png (12 tiles per row) */
function HatSprite({ idx, size = 32 }: { idx: number; size?: number }) {
  const col = idx % 12, row = Math.floor(idx / 12);
  return (
    <svg width={size} height={size} viewBox={`${col * 20} ${row * 20} 20 20`} style={{ display: 'block' }}>
      <image href={`${BASE}sprites/hats.png`} x={0} y={0} imageRendering="pixelated" />
    </svg>
  );
}

/** Render a 16×16 tile from springobjects.png (24 tiles per row) — used for boots */
function BootSprite({ idx, size = 32 }: { idx: number; size?: number }) {
  const col = idx % 24, row = Math.floor(idx / 24);
  return (
    <svg width={size} height={size} viewBox={`${col * 16} ${row * 16} 16 16`} style={{ display: 'block' }}>
      <image href={`${BASE}sprites/springobjects.png`} x={0} y={0} imageRendering="pixelated" />
    </svg>
  );
}

// ── Sort field definitions ─────────────────────────────────────────────────────

const WEAPON_SORT_FIELDS: SortFieldDef<WeaponDef>[] = [
  { id: 'name',    label: 'Name',       compareFn: (a, b) => a.name.localeCompare(b.name),                                  defaultDirection: 'asc'  },
  { id: 'type',    label: 'Type',       compareFn: (a, b) => a.weaponType.localeCompare(b.weaponType),                      defaultDirection: 'asc'  },
  { id: 'damage',  label: 'Damage',     compareFn: (a, b) => a.maxDamage - b.maxDamage,                                     defaultDirection: 'desc' },
  { id: 'speed',   label: 'Speed',      compareFn: (a, b) => a.speed - b.speed,                                             defaultDirection: 'desc' },
  { id: 'defense', label: 'Defense',    compareFn: (a, b) => a.defense - b.defense,                                         defaultDirection: 'desc' },
];

const BOOTS_SORT_FIELDS: SortFieldDef<BootsDef>[] = [
  { id: 'name',     label: 'Name',      compareFn: (a, b) => a.name.localeCompare(b.name),          defaultDirection: 'asc'  },
  { id: 'defense',  label: 'Defense',   compareFn: (a, b) => a.defense - b.defense,                 defaultDirection: 'desc' },
  { id: 'immunity', label: 'Immunity',  compareFn: (a, b) => a.immunity - b.immunity,               defaultDirection: 'desc' },
];

const HATS_SORT_FIELDS: SortFieldDef<HatDef>[] = [
  { id: 'name', label: 'Name', compareFn: (a, b) => a.name.localeCompare(b.name), defaultDirection: 'asc' },
];

const CLOTHING_SORT_FIELDS: SortFieldDef<ClothingDef>[] = [
  { id: 'name',  label: 'Name',  compareFn: (a, b) => a.name.localeCompare(b.name),                                         defaultDirection: 'asc'  },
  { id: 'type',  label: 'Type',  compareFn: (a, b) => a.type.localeCompare(b.type),                                          defaultDirection: 'asc'  },
  { id: 'price', label: 'Price', compareFn: (a, b) => a.price - b.price,                                                     defaultDirection: 'asc'  },
];

// ── Cost helper ────────────────────────────────────────────────────────────────

function CostBadge({ soldBy }: { soldBy?: { shop: string; price?: number; currency?: string; currencyAmount?: number; minMineLevel?: number }[] }) {
  if (!soldBy?.length) return <span className="wear-cost wear-cost--none">—</span>;
  return (
    <span className="wear-cost">
      {soldBy.map((e, i) => (
        <span key={i} className="wear-cost__entry">
          {e.price ? `${e.price.toLocaleString()}g` : e.currency ? `${e.currencyAmount}× ${e.currency}` : '—'}
          {e.minMineLevel ? <span className="wear-cost__mine"> (Mine {e.minMineLevel}+)</span> : null}
          <span className="wear-cost__shop"> @ {e.shop}</span>
        </span>
      ))}
    </span>
  );
}

type Tab = 'weapons' | 'boots' | 'hats' | 'clothing';

const DEFAULT_WEAPON_SORTS: ActiveSort[] = [{ fieldId: 'damage', direction: 'desc' }];
const DEFAULT_BOOTS_SORTS:  ActiveSort[] = [{ fieldId: 'defense', direction: 'desc' }];
const DEFAULT_HATS_SORTS:   ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];
const DEFAULT_CLOTH_SORTS:  ActiveSort[] = [{ fieldId: 'type', direction: 'asc' }];

export function WearablesPage() {
  usePageTitle('Wearables');
  const { data, loading, error } = useGameData();

  const [tab,    setTab]    = useState<Tab>('weapons');
  const [search, setSearch] = useState('');

  const [weaponSorts,  setWeaponSorts]  = useState<ActiveSort[]>(DEFAULT_WEAPON_SORTS);
  const [bootsSorts,   setBootsSorts]   = useState<ActiveSort[]>(DEFAULT_BOOTS_SORTS);
  const [hatsSorts,    setHatsSorts]    = useState<ActiveSort[]>(DEFAULT_HATS_SORTS);
  const [clothSorts,   setClothSorts]   = useState<ActiveSort[]>(DEFAULT_CLOTH_SORTS);

  const q = search.trim().toLowerCase();

  const filteredWeapons  = useMemo(() => (data?.weapons  ?? []).filter(w => !q || w.name.toLowerCase().includes(q)), [data, q]);
  const filteredBoots    = useMemo(() => (data?.boots    ?? []).filter(b => !q || b.name.toLowerCase().includes(q)), [data, q]);
  const filteredHats     = useMemo(() => (data?.hats     ?? []).filter(h => !q || h.name.toLowerCase().includes(q)), [data, q]);
  const filteredClothing = useMemo(() => (data?.clothing ?? []).filter(c => !q || c.name.toLowerCase().includes(q)), [data, q]);

  const sortedWeapons  = useMultiSort(filteredWeapons,  weaponSorts,  WEAPON_SORT_FIELDS);
  const sortedBoots    = useMultiSort(filteredBoots,    bootsSorts,   BOOTS_SORT_FIELDS);
  const sortedHats     = useMultiSort(filteredHats,     hatsSorts,    HATS_SORT_FIELDS);
  const sortedClothing = useMultiSort(filteredClothing, clothSorts,   CLOTHING_SORT_FIELDS);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const WEAPON_TYPE_LABEL: Record<string, string> = {
    sword: 'Sword', dagger: 'Dagger', club: 'Club', slingshot: 'Slingshot', other: 'Other',
  };

  return (
    <div className="page page--wearables">
      <h1 className="page__title">Wearables</h1>
      <p className="page__subtitle">
        {data!.weapons.length} weapons · {data!.boots.length} boots · {data!.hats.length} hats · {data!.clothing.length} clothing
      </p>

      {/* Tabs */}
      <div className="wear-tabs">
        {(['weapons','boots','hats','clothing'] as Tab[]).map(t => (
          <button key={t} className={`wear-tab${tab === t ? ' wear-tab--active' : ''}`} onClick={() => setTab(t)}>
            {t === 'weapons' ? '⚔️ Weapons' : t === 'boots' ? '🥾 Boots' : t === 'hats' ? '🎩 Hats' : '👕 Clothing'}
            <span className="wear-tab__count">
              {t === 'weapons' ? data!.weapons.length : t === 'boots' ? data!.boots.length : t === 'hats' ? data!.hats.length : data!.clothing.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search + sort bar */}
      <div className="filter-bar">
        <input className="filter-bar__search" type="search" placeholder={`Search ${tab}`} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="fish-sort-bar">
        {tab === 'weapons'  && <MultiSort fields={WEAPON_SORT_FIELDS}   value={weaponSorts}  onChange={setWeaponSorts}  />}
        {tab === 'boots'    && <MultiSort fields={BOOTS_SORT_FIELDS}    value={bootsSorts}   onChange={setBootsSorts}   />}
        {tab === 'hats'     && <MultiSort fields={HATS_SORT_FIELDS}     value={hatsSorts}    onChange={setHatsSorts}    />}
        {tab === 'clothing' && <MultiSort fields={CLOTHING_SORT_FIELDS} value={clothSorts}   onChange={setClothSorts}   />}
      </div>

      {/* ── Weapons ── */}
      {tab === 'weapons' && (
        <div className="wear-table">
          <div className="wear-table__header">
            <span>Weapon</span>
            <span>Type</span>
            <span>Damage</span>
            <span>Speed</span>
            <span>Defense</span>
            <span>Crit %</span>
            <span>Cost / Source</span>
          </div>
          {sortedWeapons.map(w => (
            <div key={w.id} className="wear-row wear-row--weapon">
              <div className="wear-row__name">
                <div className="wear-row__sprite"><WeaponSprite idx={w.spriteIndex} size={24} /></div>
                <span>{w.name}</span>
              </div>
              <span className={`wear-badge wear-badge--${w.weaponType}`}>{WEAPON_TYPE_LABEL[w.weaponType]}</span>
              <span className="wear-stat"><strong>{w.minDamage}–{w.maxDamage}</strong></span>
              <span className="wear-stat">{w.speed > 0 ? '+' : ''}{w.speed}</span>
              <span className="wear-stat">{w.defense > 0 ? w.defense : '—'}</span>
              <span className="wear-stat">{Math.round(w.critChance * 100)}%</span>
              <CostBadge soldBy={w.soldBy} />
            </div>
          ))}
          {sortedWeapons.length === 0 && <p className="page-empty">No weapons match your search.</p>}
        </div>
      )}

      {/* ── Boots ── */}
      {tab === 'boots' && (
        <div className="wear-table">
          <div className="wear-table__header">
            <span>Boots</span>
            <span>Defense</span>
            <span>Immunity</span>
            <span>Cost / Source</span>
          </div>
          {sortedBoots.map(b => (
            <div key={b.id} className="wear-row wear-row--boots">
              <div className="wear-row__name">
                <div className="wear-row__sprite"><BootSprite idx={b.spriteIndex} size={24} /></div>
                <span>{b.name}</span>
              </div>
              <span className="wear-stat"><strong>{b.defense}</strong></span>
              <span className="wear-stat"><strong>{b.immunity}</strong></span>
              <CostBadge soldBy={b.soldBy} />
            </div>
          ))}
          {sortedBoots.length === 0 && <p className="page-empty">No boots match your search.</p>}
        </div>
      )}

      {/* ── Hats ── */}
      {tab === 'hats' && (
        <div className="wear-grid">
          {sortedHats.map(h => (
            <div key={h.id} className="wear-card">
              <div className="wear-card__sprite"><HatSprite idx={h.spriteIndex} size={40} /></div>
              <span className="wear-card__name">{h.name}</span>
              {h.soldBy?.length ? (
                <span className="wear-card__source">{h.soldBy[0].price?.toLocaleString() ?? `${h.soldBy[0].currencyAmount}× ${h.soldBy[0].currency}`}g @ {h.soldBy[0].shop}</span>
              ) : null}
            </div>
          ))}
          {sortedHats.length === 0 && <p className="page-empty">No hats match your search.</p>}
        </div>
      )}

      {/* ── Clothing ── */}
      {tab === 'clothing' && (
        <div className="wear-table">
          <div className="wear-table__header">
            <span>Clothing</span>
            <span>Type</span>
            <span>Price</span>
            <span>Dyeable</span>
            <span>Source</span>
          </div>
          {sortedClothing.map(c => (
            <div key={c.id} className="wear-row wear-row--clothing">
              <div className="wear-row__name"><span>{c.name}</span></div>
              <span className={`wear-badge wear-badge--${c.type}`}>{c.type === 'shirt' ? 'Shirt' : 'Pants'}</span>
              <span className="wear-stat">{c.price > 0 ? `${c.price.toLocaleString()}g` : '—'}</span>
              <span className="wear-stat">{c.canBeDyed ? '✓' : '—'}</span>
              <span className="wear-stat wear-stat--sm">
                {c.soldBy?.map(e => e.shop).join(', ') || '—'}
              </span>
            </div>
          ))}
          {sortedClothing.length === 0 && <p className="page-empty">No clothing matches your search.</p>}
        </div>
      )}
    </div>
  );
}
