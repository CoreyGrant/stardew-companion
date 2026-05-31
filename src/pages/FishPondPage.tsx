import { useMemo, useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import type { FishPondEntry, PondProduceItem, PondPopGate, Item } from '../types/game';

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(chance: number): string {
  return `${Math.round(chance * 100)}%`;
}

function spawnLabel(spawnTime: number): string {
  if (spawnTime === -1 || spawnTime === 0) return 'Daily';
  if (spawnTime === 1) return 'Daily';
  return `Every ${spawnTime}d`;
}

/** Derive a label for tag-based (non-specific-fish) entries */
const TAG_LABELS: Record<string, string> = {
  fish_legendary:    'Legendary Fish',
  fish_desert:       'Desert Fish',
  fish_semi_rare:    'Semi-Rare Fish',
  fish_carnivorous:  'Carnivorous Fish',
  'fish_freshwater,fish_crab_pot': 'Freshwater Crab Pot Fish',
  'fish_ocean,fish_crab_pot':      'Ocean Crab Pot Fish',
  fish_ocean:        'Ocean Fish',
  fish_river:        'River Fish',
  fish_lake:         'Lake Fish',
  category_fish:     'All Other Fish (default)',
};

function tagLabel(tags: string[]): string {
  const key = tags.join(',');
  if (TAG_LABELS[key]) return TAG_LABELS[key];
  return tags.map(t => t.replace(/^fish_|^category_/, '').replace(/_/g, ' ')).join(', ');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface ProduceTableProps {
  produce: PondProduceItem[];
  itemMap: Map<string, Item>;
}

function ProduceTable({ produce, itemMap }: ProduceTableProps) {
  if (produce.length === 0) return <p className="pond-empty">No special produce data.</p>;

  return (
    <div className="pond-produce">
      <div className="pond-produce__header">
        <span>Population</span>
        <span>Item</span>
        <span className="pond-produce__col-chance">Chance</span>
        <span>Qty</span>
      </div>
      {produce.map((p, i) => {
        const item = itemMap.get(p.itemId);
        const qtyLabel = p.minStack === p.maxStack
          ? String(p.minStack)
          : `${p.minStack}–${p.maxStack}`;
        return (
          <div key={i} className="pond-produce__row">
            <span className="pond-produce__pop">
              {p.minPop === 0 ? 'Any' : `${p.minPop}+`}
            </span>
            <span className="pond-produce__item">
              {item && item.spriteSheet && item.spriteIndex !== undefined && (
                <SpriteIcon
                  spriteSheet={item.spriteSheet}
                  spriteIndex={item.spriteIndex}
                  size={16}
                />
              )}
              <GameLink type="item" id={item?.id ?? p.itemId}>{p.itemName}</GameLink>
            </span>
            <span className="pond-produce__col-chance">
              <span
                className="pond-produce__chance-bar"
                style={{ '--pct': pct(p.chance) } as React.CSSProperties}
              />
              <span className="pond-produce__chance-label">{pct(p.chance)}</span>
            </span>
            <span className="pond-produce__qty">{qtyLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

interface GateListProps {
  gates: PondPopGate[];
  itemMap: Map<string, Item>;
}

function GateList({ gates, itemMap }: GateListProps) {
  if (gates.length === 0) {
    return <p className="pond-empty">No population quests.</p>;
  }
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
                  {item && item.spriteSheet && item.spriteIndex !== undefined && (
                    <SpriteIcon
                      spriteSheet={item.spriteSheet}
                      spriteIndex={item.spriteIndex}
                      size={16}
                    />
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
  entry: FishPondEntry;
  itemMap: Map<string, Item>;
  fishItemMap: Map<string, Item>;
  expanded: boolean;
  onToggle: () => void;
}

function PondCard({ entry, itemMap, fishItemMap, expanded, onToggle }: PondCardProps) {
  const isSpecific = entry.fishItemIds.length > 0;
  const primaryFishId = isSpecific ? entry.fishItemIds[0] : null;
  const primaryFish   = primaryFishId ? fishItemMap.get(primaryFishId) : null;
  const displayName   = isSpecific
    ? entry.fishNames.join(' / ')
    : tagLabel(entry.requiredTags);

  return (
    <div className={`pond-card${expanded ? ' pond-card--open' : ''}`}>
      <button className="pond-card__head" onClick={onToggle} aria-expanded={expanded}>
        <div className="pond-card__fish">
          {primaryFish && primaryFish.spriteSheet && primaryFish.spriteIndex !== undefined ? (
            <SpriteIcon
              spriteSheet={primaryFish.spriteSheet}
              spriteIndex={primaryFish.spriteIndex}
              size={24}
            />
          ) : (
            <span className="pond-card__fish-emoji" aria-hidden="true">🐟</span>
          )}
          <span className="pond-card__name">
            {isSpecific
              ? <GameLink type="item" id={primaryFish?.id ?? entry.fishItemIds[0]}>{displayName}</GameLink>
              : <span className="pond-card__generic-label">{displayName}</span>
            }
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

// ── Page ──────────────────────────────────────────────────────────────────────

type ViewMode = 'specific' | 'generic';

export function FishPondPage() {
  usePageTitle('Fish Pond Guide');
  const { data } = useGameData();
  const [query, setQuery]     = useState('');
  const [view, setView]       = useState<ViewMode>('specific');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const itemMap = useMemo(() => {
    if (!data) return new Map<string, Item>();
    return new Map(data.items.map(i => [i.cheatId, i]));
  }, [data]);

  // For fish-icon lookup, map fishItemIds (cheat IDs) to items
  const fishItemMap = useMemo(() => {
    if (!data) return new Map<string, Item>();
    return new Map(data.items.map(i => [i.cheatId, i]));
  }, [data]);

  const { specific, generic } = useMemo(() => {
    if (!data) return { specific: [], generic: [] };
    const specific: FishPondEntry[] = [];
    const generic:  FishPondEntry[] = [];
    for (const e of data.fishPondData) {
      if (e.fishItemIds.length > 0) specific.push(e);
      else generic.push(e);
    }
    // Sort specific by fish name
    specific.sort((a, b) => a.fishNames[0]?.localeCompare(b.fishNames[0] ?? '') ?? 0);
    return { specific, generic };
  }, [data]);

  const filtered = useMemo(() => {
    const list = view === 'specific' ? specific : generic;
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(e =>
      e.fishNames.some(n => n.toLowerCase().includes(q)) ||
      e.produce.some(p => p.itemName.toLowerCase().includes(q)) ||
      e.id.toLowerCase().includes(q)
    );
  }, [view, specific, generic, query]);

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
        <input
          type="search"
          className="pond-search"
          placeholder="Search fish or produce"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="pond-view-tabs">
          <button
            className={`pond-view-tab${view === 'specific' ? ' pond-view-tab--active' : ''}`}
            onClick={() => setView('specific')}
          >
            Named Fish ({specific.length})
          </button>
          <button
            className={`pond-view-tab${view === 'generic' ? ' pond-view-tab--active' : ''}`}
            onClick={() => setView('generic')}
          >
            Fish Groups ({generic.length})
          </button>
        </div>
      </div>

      <div className="pond-list">
        {filtered.length === 0 && (
          <p className="pond-empty">No matches.</p>
        )}
        {filtered.map(entry => (
          <PondCard
            key={entry.id}
            entry={entry}
            itemMap={itemMap}
            fishItemMap={fishItemMap}
            expanded={expanded.has(entry.id)}
            onToggle={() => toggle(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}
