import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import type { FishPondEntry, PondProduceItem, PondPopGate, Item } from '../types/game';

function pct(chance: number): string { return `${Math.round(chance * 100)}%`; }
function spawnLabel(spawnTime: number): string {
  if (spawnTime === -1 || spawnTime <= 1) return 'Daily';
  return `Every ${spawnTime}d`;
}

const TAG_LABELS: Record<string, string> = {
  fish_legendary: 'Legendary Fish', fish_desert: 'Desert Fish', fish_semi_rare: 'Semi-Rare Fish',
  fish_carnivorous: 'Carnivorous Fish', 'fish_freshwater,fish_crab_pot': 'Freshwater Crab Pot Fish',
  'fish_ocean,fish_crab_pot': 'Ocean Crab Pot Fish', fish_ocean: 'Ocean Fish',
  fish_river: 'River Fish', fish_lake: 'Lake Fish', category_fish: 'All Other Fish (default)',
};
function tagLabel(tags: string[]): string {
  const key = tags.join(',');
  if (TAG_LABELS[key]) return TAG_LABELS[key];
  return tags.map(t => t.replace(/^fish_|^category_/, '').replace(/_/g, ' ')).join(', ');
}

function ProduceTable({ produce, itemMap }: { produce: PondProduceItem[]; itemMap: Map<string, Item> }) {
  if (produce.length === 0) return <p className="pond-empty">No special produce data.</p>;
  return (
    <div className="pond-produce">
      <div className="pond-produce__header">
        <span>Population</span><span>Item</span>
        <span className="pond-produce__col-chance">Chance</span><span>Qty</span>
      </div>
      {produce.map((p, i) => {
        const item = itemMap.get(p.itemId);
        const qtyLabel = p.minStack === p.maxStack ? String(p.minStack) : `${p.minStack}–${p.maxStack}`;
        return (
          <div key={i} className="pond-produce__row">
            <span className="pond-produce__pop">{p.minPop === 0 ? 'Any' : `${p.minPop}+`}</span>
            <span className="pond-produce__item">
              {item?.spriteSheet && item.spriteIndex !== undefined && (
                <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} size={16} />
              )}
              <GameLink type="item" id={item?.id ?? p.itemId}>{p.itemName}</GameLink>
            </span>
            <span className="pond-produce__col-chance">
              <span className="pond-produce__chance-bar" style={{ '--pct': pct(p.chance) } as React.CSSProperties} />
              <span className="pond-produce__chance-label">{pct(p.chance)}</span>
            </span>
            <span className="pond-produce__qty">{qtyLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function GateList({ gates, itemMap }: { gates: PondPopGate[]; itemMap: Map<string, Item> }) {
  if (gates.length === 0) return <p className="pond-empty">No population quests.</p>;
  return (
    <ul className="pond-gates">
      {gates.map((gate) => (
        <li key={gate.population} className="pond-gate">
          <span className="pond-gate__pop">Pop. {gate.population}</span>
          <span className="pond-gate__arrow">→</span>
          <span className="pond-gate__items">
            {gate.items.map((gi, idx) => {
              const item = itemMap.get(gi.itemId);
              return (
                <span key={idx} className="pond-gate__item">
                  {gi.quantity > 1 && <span className="pond-gate__qty">{gi.quantity}×</span>}
                  {item?.spriteSheet && item.spriteIndex !== undefined && (
                    <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} size={16} />
                  )}
                  <GameLink type="item" id={item?.id ?? gi.itemId}>{gi.itemName}</GameLink>
                  {idx < gate.items.length - 1 && <span className="pond-gate__sep">,</span>}
                </span>
              );
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface PondCardProps {
  entry: FishPondEntry; itemMap: Map<string, Item>; fishItemMap: Map<string, Item>;
  expanded: boolean; onToggle: () => void;
}
function PondCard({ entry, itemMap, fishItemMap, expanded, onToggle }: PondCardProps) {
  const isSpecific  = entry.fishItemIds.length > 0;
  const primaryFish = isSpecific ? fishItemMap.get(entry.fishItemIds[0]) : null;
  const displayName = isSpecific ? entry.fishNames.join(' / ') : tagLabel(entry.requiredTags);
  return (
    <div className={`pond-card${expanded ? ' pond-card--open' : ''}`}>
      <button className="pond-card__head" onClick={onToggle} aria-expanded={expanded}>
        <div className="pond-card__fish">
          {primaryFish?.spriteSheet && primaryFish.spriteIndex !== undefined ? (
            <SpriteIcon spriteSheet={primaryFish.spriteSheet} spriteIndex={primaryFish.spriteIndex} size={24} />
          ) : (
            <span className="pond-card__fish-emoji" aria-hidden="true">🐟</span>
          )}
          <span className="pond-card__name">
            {isSpecific
              ? <GameLink type="item" id={primaryFish?.id ?? entry.fishItemIds[0]}>{displayName}</GameLink>
              : <span className="pond-card__generic-label">{displayName}</span>}
          </span>
        </div>
        <div className="pond-card__meta">
          <span className="pond-card__badge">Max pop: {entry.maxPopulation}</span>
          <span className="pond-card__badge">Produce: {spawnLabel(entry.spawnTime)}</span>
          <span className="pond-card__badge pond-card__badge--chance">
            {pct(entry.minProduceChance)}–{pct(entry.maxProduceChance)} base
          </span>
        </div>
        <span className="pond-card__chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="pond-card__body">
          <div className="pond-card__section">
            <h3 className="pond-card__section-title">Produce</h3>
            <ProduceTable produce={entry.produce} itemMap={itemMap} />
          </div>
          <div className="pond-card__section">
            <h3 className="pond-card__section-title">Population Quests</h3>
            <GateList gates={entry.populationGates} itemMap={itemMap} />
          </div>
        </div>
      )}
    </div>
  );
}

type ViewMode = 'specific' | 'generic';

const FISH_POND_SORT_FIELDS: SortFieldDef<FishPondEntry>[] = [
  { id: 'name',    label: 'Name',           compareFn: (a, b) => (a.fishNames[0] ?? a.id).localeCompare(b.fishNames[0] ?? b.id), defaultDirection: 'asc'  },
  { id: 'maxPop',  label: 'Max Population', compareFn: (a, b) => a.maxPopulation - b.maxPopulation,                              defaultDirection: 'desc' },
  { id: 'produce', label: 'Produce Count',  compareFn: (a, b) => a.produce.length - b.produce.length,                            defaultDirection: 'desc' },
  { id: 'spawn',   label: 'Spawn Frequency',compareFn: (a, b) => {
    const ta = a.spawnTime <= 0 ? 1 : a.spawnTime;
    const tb = b.spawnTime <= 0 ? 1 : b.spawnTime;
    return ta - tb;
  }, defaultDirection: 'asc' },
];

const DEFAULT_POND_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

export function FishPondPage() {
  usePageTitle('Fish Pond Guide');
  const { data } = useGameData();
  const [query,    setQuery]    = useState('');
  const [view,     setView]     = useState<ViewMode>('specific');
  const [sorts,    setSorts]    = useState<ActiveSort[]>(DEFAULT_POND_SORTS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Non-BC only — BigCraftables share numeric cheatIds with Objects and would
  // overwrite them, producing wrong sprites for pond produce and gate items.
  const itemMap = useMemo(() => {
    if (!data) return new Map<string, Item>();
    return new Map(data.items.filter(i => !i.isBigCraftable).map(i => [i.cheatId, i]));
  }, [data]);

  const { specific, generic } = useMemo(() => {
    if (!data) return { specific: [], generic: [] };
    const specific: FishPondEntry[] = [];
    const generic:  FishPondEntry[] = [];
    for (const e of data.fishPondData) {
      if (e.fishItemIds.length > 0) specific.push(e);
      else generic.push(e);
    }
    return { specific, generic };
  }, [data]);

  const filtered = useMemo(() => {
    const list = view === 'specific' ? specific : generic;
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(e =>
      e.fishNames.some(n => n.toLowerCase().includes(q)) ||
      e.produce.some(p => p.itemName.toLowerCase().includes(q)) ||
      e.id.toLowerCase().includes(q),
    );
  }, [view, specific, generic, query]);

  const sorted = useMultiSort(filtered, sorts, FISH_POND_SORT_FIELDS);

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!data) return <div className="page-loading">Loading</div>;

  return (
    <div className="page page--fish-pond">
      <h1 className="page__title">Fish Pond Guide</h1>
      <p className="page__subtitle">
        What each fish produces in a pond, and the quests needed to increase population.
      </p>

      <div className="pond-toolbar">
        <div className="filter-bar">
          <input
            type="search"
            className="filter-bar__search"
            placeholder="Search fish or produce"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="pond-view-tabs">
          <button className={`pond-view-tab${view === 'specific' ? ' pond-view-tab--active' : ''}`} onClick={() => setView('specific')}>
            Named Fish ({specific.length})
          </button>
          <button className={`pond-view-tab${view === 'generic' ? ' pond-view-tab--active' : ''}`} onClick={() => setView('generic')}>
            Fish Groups ({generic.length})
          </button>
        </div>
      </div>

      <div className="fish-sort-bar">
        <MultiSort fields={FISH_POND_SORT_FIELDS} value={sorts} onChange={setSorts} />
      </div>

      <div className="pond-list">
        {sorted.length === 0 && <p className="pond-empty">No matches.</p>}
        {sorted.map(entry => (
          <PondCard
            key={entry.id}
            entry={entry}
            itemMap={itemMap}
            fishItemMap={itemMap}
            expanded={expanded.has(entry.id)}
            onToggle={() => toggle(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}
