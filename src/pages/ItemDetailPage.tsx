import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useItemDetail } from '../hooks/useItemDetail';
import { usePageTitle } from '../hooks/usePageTitle';
import { useGameData } from '../contexts/GameDataContext';
import { Panel } from '../components/common/Panel';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import type {
  Crop, CropQualityDistribution, FoodBuff, FishPondEntry,
  Item, MachineDef, MachineInputRule, PondProduceItem, PondPopGate,
} from '../types/game';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUFF_LABELS: Record<string, string> = {
  farming: 'Farming', fishing: 'Fishing', mining: 'Mining', combat: 'Combat',
  luck: 'Luck', foraging: 'Foraging', speed: 'Speed', defense: 'Defense',
  attack: 'Attack', maxStamina: 'Max Energy', magneticRadius: 'Magnet Range',
};
const BUFF_EMOJI: Record<string, string> = {
  farming: '🌾', fishing: '🎣', mining: '⛏️', combat: '⚔️', luck: '🍀',
  foraging: '🍄', speed: '👟', defense: '🛡️', attack: '💥',
  maxStamina: '⚡', magneticRadius: '🧲',
};
const QUALITY_CATS = new Set(['crop','forage','fish','animal_product','artisan','flower']);
const QUALITY_TIERS = [
  { key: 'silver',  label: 'Silver',  mult: 1.25, color: '#b0b8c8' },
  { key: 'gold',    label: 'Gold',    mult: 1.5,  color: '#daa520' },
  { key: 'iridium', label: 'Iridium', mult: 2,    color: '#a855f7' },
] as const;
const LEVEL_LABELS: Record<number, string> = {
  0:'Lv.0',1:'Lv.1',2:'Lv.2',3:'Lv.3',4:'Lv.4',
  5:'Lv.5',6:'Lv.6',7:'Lv.7',8:'Lv.8',9:'Lv.9',10:'Lv.10',
};
const ROOM_LABELS: Record<string, string> = {
  crafts_room:'Crafts Room', pantry:'Pantry', fish_tank:'Fish Tank',
  boiler_room:'Boiler Room', bulletin_board:'Bulletin Board', vault:'Vault',
};
const QUALITY_LABELS: Record<number, string> = { 1:'Silver', 2:'Gold', 4:'Iridium' };

// ── Season config ──────────────────────────────────────────────────────────────

const ALL_SEASONS = ['spring','summer','fall','winter'] as const;

// ── Crop quality formula ───────────────────────────────────────────────────────

type FertLevel = 0|1|2|3;

/**
 * Stardew Valley crop quality formula.
 * fertLevel: 0=none, 1=Basic Fertilizer, 2=Quality Fertilizer, 3=Deluxe Fertilizer
 */
function calcQuality(farmingLevel: number, fertLevel: FertLevel): CropQualityDistribution {
  const gold = 0.2*(farmingLevel/10) + 0.2*fertLevel*((farmingLevel+2)/12) + 0.01;
  const silver = Math.min(0.75, 2*gold);
  const iridium = farmingLevel >= 10 ? gold/2 : 0;
  return {
    normal: Math.max(0, 1 - silver - gold - iridium),
    silver,
    gold,
    iridium,
  };
}

const FERT_TABS: { label: string; level: FertLevel }[] = [
  { label: 'No Fert.',  level: 0 },
  { label: 'Basic',     level: 1 },
  { label: 'Quality',   level: 2 },
  { label: 'Deluxe',    level: 3 },
];

const SPEED_GROS = [
  { label: 'Speed-Gro',         emoji: '💨', bonus: 0.10 },
  { label: 'Deluxe Speed-Gro',  emoji: '💨', bonus: 0.25 },
  { label: 'Hyper Speed-Gro',   emoji: '💨', bonus: 0.33 },
];

const FLAVORED_COLORS: Record<string, string> = {
  Wine:'#7c3aed', Juice:'#ea580c', Jelly:'#db2777',
  Pickle:'#16a34a', AgedRoe:'#0891b2', Caviar:'#1e3a5f',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(mins: number): string {
  if (mins < 0) return 'Variable';
  if (mins === 0) return 'Instant';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? '1 day' : `${days} days`;
}

// ── Food buffs ─────────────────────────────────────────────────────────────────

function BuffPanel({ buffs }: { buffs: FoodBuff[] }) {
  return (
    <Panel title="Food Effects">
      {buffs.map((buff, i) => {
        const stats = (Object.keys(BUFF_LABELS) as (keyof FoodBuff)[])
          .filter(k => typeof buff[k] === 'number' && buff[k] !== 0);
        return (
          <div key={i} className={`buff-panel${buff.isDebuff ? ' buff-panel--debuff' : ''}`}>
            <div className="buff-panel__header">
              {buff.isDebuff ? '☠️ Debuff' : '✨ Buff'}
              {buff.duration > 0 && (
                <span className="buff-panel__duration">{formatDuration(buff.duration)}</span>
              )}
            </div>
            <ul className="buff-stat-list">
              {stats.map((k) => {
                const val = buff[k] as number;
                const sign = val > 0 ? '+' : '';
                return (
                  <li key={k} className={`buff-stat${val < 0 ? ' buff-stat--neg' : ' buff-stat--pos'}`}>
                    <span className="buff-stat__emoji" aria-hidden="true">{BUFF_EMOJI[k] ?? '•'}</span>
                    <span className="buff-stat__label">{BUFF_LABELS[k]}</span>
                    <span className="buff-stat__val">{sign}{val}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </Panel>
  );
}

// ── Fish Pond ─────────────────────────────────────────────────────────────────

function FishPondPanel({ entry }: { entry: FishPondEntry }) {
  const p = (c: number) => `${Math.round(c * 100)}%`;
  const uniqueItems = new Map<string, PondProduceItem[]>();
  for (const prod of entry.produce) {
    if (!uniqueItems.has(prod.itemName)) uniqueItems.set(prod.itemName, []);
    uniqueItems.get(prod.itemName)!.push(prod);
  }
  return (
    <Panel title="Fish Pond">
      <div className="pond-inline-meta">
        <span className="pond-inline-badge">Max pop: {entry.maxPopulation}</span>
        <span className="pond-inline-badge">Base chance: {p(entry.minProduceChance)}–{p(entry.maxProduceChance)}</span>
        <Link to="/fish-pond" className="pond-inline-link">Full pond guide →</Link>
      </div>
      {uniqueItems.size > 0 && (
        <div className="pond-inline-section">
          <div className="pond-inline-label">Produce</div>
          <ul className="pond-inline-list">
            {[...uniqueItems.entries()].map(([name, rows]) => {
              const sorted = [...rows].sort((a, b) => a.minPop - b.minPop);
              const maxRow = sorted[sorted.length - 1];
              const minRow = sorted[0];
              const chanceSummary = minRow.chance === maxRow.chance
                ? p(minRow.chance)
                : `${p(minRow.chance)}–${p(maxRow.chance)}`;
              const stackStr = maxRow.minStack === maxRow.maxStack
                ? (maxRow.minStack > 1 ? ` ×${maxRow.minStack}` : '')
                : ` ×${maxRow.minStack}–${maxRow.maxStack}`;
              return (
                <li key={name} className="pond-inline-item">
                  <span className="pond-inline-item__name">{name}{stackStr}</span>
                  <span className="pond-inline-item__chance">{chanceSummary}</span>
                  {minRow.minPop > 0 && (
                    <span className="pond-inline-item__pop">pop {minRow.minPop}+</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {entry.populationGates.length > 0 && (
        <div className="pond-inline-section">
          <div className="pond-inline-label">Population quests</div>
          <ul className="pond-inline-list">
            {entry.populationGates.map((gate: PondPopGate) => (
              <li key={gate.population} className="pond-inline-item">
                <span className="pond-inline-item__pop-badge">Pop {gate.population}</span>
                <span className="pond-inline-item__gate-items">
                  {gate.items.map((gi, i) => (
                    <span key={i}>
                      {gi.quantity > 1 ? `${gi.quantity}× ` : ''}{gi.itemName}
                      {i < gate.items.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

// ── Crop detail panel ─────────────────────────────────────────────────────────

interface CropPanelProps {
  crop: Crop;
  currentItem: Item;
  seedItem: Item | null;
  cropHarvestItem: Item | null;
  seedCost: number | null;
  farmingLevel: number;
}

function CropPanel({ crop, currentItem, seedItem, cropHarvestItem, seedCost, farmingLevel }: CropPanelProps) {
  const [fertLevel, setFertLevel] = useState<FertLevel>(0);

  const isSeedPage   = currentItem.category === 'seed';
  const harvestItem  = isSeedPage ? cropHarvestItem : currentItem;
  const theSeedItem  = isSeedPage ? currentItem : seedItem;

  // Profitability
  const avgYield   = (crop.harvestCountMin + crop.harvestCountMax) / 2;
  const sellVal    = harvestItem?.sellValue ?? 0;
  const grossFirst = avgYield * sellVal;
  const profit     = seedCost != null ? grossFirst - seedCost : null;
  const gpdFirst   = profit != null && crop.growDays > 0 ? profit / crop.growDays : null;
  const gpdRegrow  = crop.regrowDays ? (avgYield * sellVal) / crop.regrowDays : null;

  // Quality table rows
  const qualityRows = Object.entries(crop.qualityByLevel).map(([lvlStr, baseQ]) => {
    const lvl = Number(lvlStr);
    const q: CropQualityDistribution = fertLevel === 0 ? baseQ : calcQuality(lvl, fertLevel);
    return { lvl, q };
  });

  return (
    <Panel title="Growing Information">

      {/* ── Seed ↔ Harvest link row ──────────────────────────────────────── */}
      <div className="crop-link-row">
        {theSeedItem && (
          <div className={`crop-link-chip${isSeedPage ? ' crop-link-chip--current' : ''}`}>
            {theSeedItem.spriteSheet && theSeedItem.spriteIndex !== undefined && (
              <SpriteIcon spriteSheet={theSeedItem.spriteSheet} spriteIndex={theSeedItem.spriteIndex} size={20} />
            )}
            {isSeedPage
              ? <span className="crop-link-chip__name">{theSeedItem.name}</span>
              : <GameLink type="item" id={theSeedItem.id} className="crop-link-chip__name">{theSeedItem.name}</GameLink>
            }
            {seedCost != null && (
              <span className="crop-link-chip__price">{seedCost}g</span>
            )}
          </div>
        )}
        {theSeedItem && harvestItem && (
          <span className="crop-link-row__arrow" aria-hidden="true">→</span>
        )}
        {harvestItem && (
          <div className={`crop-link-chip${!isSeedPage ? ' crop-link-chip--current' : ''}`}>
            {harvestItem.spriteSheet && harvestItem.spriteIndex !== undefined && (
              <SpriteIcon spriteSheet={harvestItem.spriteSheet} spriteIndex={harvestItem.spriteIndex} size={20} />
            )}
            {!isSeedPage
              ? <span className="crop-link-chip__name">{harvestItem.name}</span>
              : <GameLink type="item" id={harvestItem.id} className="crop-link-chip__name">{harvestItem.name}</GameLink>
            }
            <span className="crop-link-chip__price">{harvestItem.sellValue}g</span>
          </div>
        )}
      </div>

      {/* ── Seasons ──────────────────────────────────────────────────────── */}
      <div className="crop-seasons-row">
        {ALL_SEASONS.map((s) => {
          const active = crop.seasons.includes(s as typeof crop.seasons[number]);
          return (
            <span key={s} className={`crop-season-chip${active ? ` crop-season-chip--${s}` : ' crop-season-chip--off'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          );
        })}
      </div>

      {/* ── Stats grid ───────────────────────────────────────────────────── */}
      <div className="crop-stat-grid">
        <div className="crop-stat">
          <span className="crop-stat__label">First harvest</span>
          <span className="crop-stat__value">{crop.growDays} days</span>
        </div>
        {crop.regrowDays ? (
          <div className="crop-stat">
            <span className="crop-stat__label">Regrows every</span>
            <span className="crop-stat__value">{crop.regrowDays} days</span>
          </div>
        ) : (
          <div className="crop-stat">
            <span className="crop-stat__label">Regrows</span>
            <span className="crop-stat__value crop-stat__value--muted">No</span>
          </div>
        )}
        <div className="crop-stat">
          <span className="crop-stat__label">Yield / harvest</span>
          <span className="crop-stat__value">
            {crop.harvestCountMin === crop.harvestCountMax
              ? crop.harvestCountMin
              : `${crop.harvestCountMin}–${crop.harvestCountMax}`}
          </span>
        </div>
        <div className="crop-stat">
          <span className="crop-stat__label">Seasons</span>
          <span className="crop-stat__value">{crop.seasons.length}</span>
        </div>
      </div>

      {/* ── Badges ───────────────────────────────────────────────────────── */}
      {(crop.trellisCrop || crop.canBeGiantCrop || crop.isPaddyCrop) && (
        <div className="crop-badges-row">
          {crop.trellisCrop   && <span className="crop-badge crop-badge--trellis">🪝 Trellis crop</span>}
          {crop.canBeGiantCrop && <span className="crop-badge crop-badge--giant">🌟 Can grow giant</span>}
          {crop.isPaddyCrop   && <span className="crop-badge crop-badge--paddy">💧 Paddy crop</span>}
        </div>
      )}

      {/* ── Profitability ─────────────────────────────────────────────────── */}
      {(gpdFirst != null || gpdRegrow != null) && (
        <div className="crop-profit-row">
          {gpdFirst != null && (
            <div className="crop-profit-chip">
              <span className="crop-profit-chip__label">
                {crop.regrowDays ? 'First harvest' : 'Profit / day'}
              </span>
              <span className={`crop-profit-chip__val${gpdFirst >= 0 ? ' crop-profit-chip__val--pos' : ' crop-profit-chip__val--neg'}`}>
                {gpdFirst >= 0 ? '+' : ''}{gpdFirst.toFixed(1)}g/day
              </span>
              {seedCost != null && profit != null && (
                <span className="crop-profit-chip__sub">
                  ({profit >= 0 ? '+' : ''}{profit.toFixed(0)}g after {seedCost}g seed)
                </span>
              )}
            </div>
          )}
          {gpdRegrow != null && (
            <div className="crop-profit-chip">
              <span className="crop-profit-chip__label">Regrow profit / day</span>
              <span className="crop-profit-chip__val crop-profit-chip__val--pos">
                +{gpdRegrow.toFixed(1)}g/day
              </span>
              <span className="crop-profit-chip__sub">
                ({(avgYield * sellVal).toFixed(0)}g / {crop.regrowDays}d cycle)
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Speed-Gro growth times ─────────────────────────────────────── */}
      <div className="crop-speed-section">
        <div className="crop-subsection-title">Growth Time with Speed-Gro</div>
        <div className="crop-speed-grid">
          <div className="crop-speed-item crop-speed-item--base">
            <span className="crop-speed-item__label">None</span>
            <span className="crop-speed-item__days">{crop.growDays}d</span>
          </div>
          {SPEED_GROS.map(({ label, bonus }) => {
            const days = Math.ceil(crop.growDays * (1 - bonus));
            const saved = crop.growDays - days;
            return (
              <div key={label} className="crop-speed-item">
                <span className="crop-speed-item__label">{label}</span>
                <span className="crop-speed-item__days">{days}d</span>
                {saved > 0 && <span className="crop-speed-item__saving">−{saved}d</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quality table ─────────────────────────────────────────────────── */}
      <div className="crop-quality-section">
        <div className="crop-subsection-title">
          Quality by Farming Level
          {farmingLevel > 0 && (
            <span className="crop-subsection-hint"> · your level: {farmingLevel}</span>
          )}
        </div>

        {/* Fertilizer selector */}
        <div className="fertilizer-selector">
          {FERT_TABS.map(({ label, level }) => (
            <button
              key={level}
              className={`fert-tab${fertLevel === level ? ' fert-tab--active' : ''}`}
              onClick={() => setFertLevel(level)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="quality-table-wrap">
          <table className="quality-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Normal</th>
                <th>Silver</th>
                <th>Gold</th>
                <th>Iridium</th>
              </tr>
            </thead>
            <tbody>
              {qualityRows.map(({ lvl, q }) => (
                <tr key={lvl} className={lvl === farmingLevel ? 'quality-table__row--active' : ''}>
                  <td>{LEVEL_LABELS[lvl]}</td>
                  <td>{pct(q.normal)}</td>
                  <td>{pct(q.silver)}</td>
                  <td>{pct(q.gold)}</td>
                  <td>{q.iridium > 0 ? pct(q.iridium) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

// ── Machine processing panel ──────────────────────────────────────────────────

interface MachineRulePanelProps {
  machineDef: MachineDef;
  items: Item[];
}

/** Resolves sprite info for a cheatId, non-bigcraftable items only. */
function spriteOf(items: Item[], cheatId: string) {
  const it = items.find(i => i.cheatId === cheatId && !i.isBigCraftable);
  if (it?.spriteSheet && it.spriteIndex !== undefined)
    return { spriteSheet: it.spriteSheet, spriteIndex: it.spriteIndex };
  return null;
}

function itemRefOf(items: Item[], cheatId: string): string | null {
  return items.find(i => i.cheatId === cheatId && !i.isBigCraftable)?.id ?? null;
}

function sellValueOf(items: Item[], cheatId: string): number {
  return items.find(i => i.cheatId === cheatId && !i.isBigCraftable)?.sellValue ?? 0;
}

function MachineRuleRow({ rule, items }: { rule: MachineInputRule; items: Item[] }) {
  const inputItem = rule.inputItemId
    ? items.find(i => i.cheatId === rule.inputItemId && !i.isBigCraftable)
    : null;
  const inputSp  = inputItem?.spriteSheet && inputItem.spriteIndex !== undefined
    ? { spriteSheet: inputItem.spriteSheet, spriteIndex: inputItem.spriteIndex }
    : null;
  const inputRef = rule.inputItemId ? itemRefOf(items, rule.inputItemId) : null;

  return (
    <div className="mrule">
      {/* Input */}
      <div className="mrule__input">
        <div className="mrule__input-sprite" aria-hidden="true">
          {inputSp ? (
            <SpriteIcon spriteSheet={inputSp.spriteSheet} spriteIndex={inputSp.spriteIndex} size={24} />
          ) : (
            <div className="mrule__input-cat-icon">
              {rule.inputCategoryLabel?.startsWith('Any Fruit')  ? '🍎'
               : rule.inputCategoryLabel?.startsWith('Any Veg')  ? '🥦'
               : rule.inputCategoryLabel?.startsWith('Any Fish') ? '🐟'
               : rule.inputCategoryLabel?.startsWith('Any Egg')  ? '🥚'
               : rule.inputCategoryLabel?.startsWith('Any Milk') ? '🥛'
               : rule.inputCategoryLabel?.startsWith('Any Crop') ? '🌾'
               : rule.inputCategoryLabel?.startsWith('Any Bone') ? '🦴'
               : rule.inputCategoryLabel?.startsWith('Wool')     ? '🧶'
               : '📦'}
            </div>
          )}
        </div>
        <div className="mrule__input-info">
          {rule.inputCount > 1 && <span className="mrule__qty">{rule.inputCount}×</span>}
          {inputRef ? (
            <GameLink type="item" id={inputRef} className="mrule__input-name">
              {rule.inputItemName ?? '?'}
            </GameLink>
          ) : (
            <span className="mrule__input-name">
              {rule.inputCategoryLabel ?? rule.inputItemName ?? '?'}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="mrule__arrow" aria-hidden="true">→</div>

      {/* Output */}
      <div className="mrule__output">
        {rule.specialBehavior === 'seed_maker' && (
          <div className="mrule__out-special">
            <span className="mrule__out-special-icon">🌱</span>
            <div>
              <div className="mrule__out-special-label">Matching Seeds (1–4×)</div>
              <div className="mrule__out-special-note">{rule.outputNote}</div>
            </div>
          </div>
        )}
        {rule.specialBehavior === 'cask' && (
          <div className="mrule__out-special mrule__out-special--cask">
            <span className="mrule__out-special-icon">⬆</span>
            <div>
              <div className="mrule__out-special-label">Quality Upgrade</div>
              <div className="mrule__out-special-note">{rule.outputNote}</div>
            </div>
          </div>
        )}
        {!rule.specialBehavior && rule.isRandomOutput && rule.outputItems && (
          <div className="mrule__out-random">
            <div className="mrule__out-random-label">🎲 Random fertilizer</div>
            <ul className="mrule__out-random-list">
              {rule.outputItems.map(out => {
                const sp  = spriteOf(items, out.itemId);
                const ref = itemRefOf(items, out.itemId);
                const inner = (
                  <>
                    {sp && <SpriteIcon spriteSheet={sp.spriteSheet} spriteIndex={sp.spriteIndex} size={14} />}
                    <span className="mrule__out-random-name">{out.itemName}</span>
                    <span className="mrule__out-random-qty">×{out.minStack}</span>
                  </>
                );
                return (
                  <li key={out.itemId} className="mrule__out-random-item">
                    {ref ? <GameLink type="item" id={ref} className="mrule__out-random-link">{inner}</GameLink> : inner}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {!rule.specialBehavior && !rule.isRandomOutput && rule.flavoredOutput && (
          <div className="mrule__out-flavored">
            <span className="mrule__out-flavored-badge" style={{ background: FLAVORED_COLORS[rule.flavoredOutput] ?? '#5c3d1e' }}>
              {rule.flavoredOutput}
            </span>
            {rule.priceMultiplier != null && inputItem && (
              <span className="mrule__out-price-formula mrule__out-price-formula--calc">
                {Math.floor(inputItem.sellValue * rule.priceMultiplier) + (rule.priceBase ?? 0)}g
              </span>
            )}
            {rule.priceMultiplier != null && !inputItem && (
              <span className="mrule__out-price-formula">
                {rule.priceMultiplier}× input{rule.priceBase ? ` +${rule.priceBase}g` : ''}
              </span>
            )}
          </div>
        )}
        {!rule.specialBehavior && !rule.isRandomOutput && !rule.flavoredOutput && rule.outputItemId && (() => {
          const sp   = spriteOf(items, rule.outputItemId);
          const ref  = itemRefOf(items, rule.outputItemId);
          const sell = sellValueOf(items, rule.outputItemId);
          const inner = (
            <>
              {sp && <SpriteIcon spriteSheet={sp.spriteSheet} spriteIndex={sp.spriteIndex} size={24} />}
              <span className="mrule__out-item-name">{rule.outputItemName}</span>
            </>
          );
          return (
            <div className="mrule__out-item">
              {ref ? <GameLink type="item" id={ref}>{inner}</GameLink> : inner}
              {sell > 0 && <span className="mrule__out-sell">{sell}g</span>}
            </div>
          );
        })()}
        {!rule.specialBehavior && !rule.isRandomOutput && !rule.flavoredOutput && !rule.outputItemId && (
          <span className="mrule__out-unknown">—</span>
        )}
      </div>

      {/* Time */}
      <div className="mrule__time">
        <span className="mrule__time-badge">{formatTime(rule.minutesUntilReady)}</span>
      </div>
    </div>
  );
}

function MachineRulesPanel({ machineDef, items }: MachineRulePanelProps) {
  return (
    <Panel title={`Processing Rules (${machineDef.rules.length})`}>
      <p className="machine-inline-desc">
        What the {machineDef.name} processes and how long each operation takes.
        <Link to="/machines" className="machine-inline-link">Full machine guide →</Link>
      </p>
      <div className="machine-rules">
        {machineDef.rules.map(rule => (
          <MachineRuleRow key={rule.ruleId} rule={rule} items={items} />
        ))}
      </div>
    </Panel>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item, crop, cropHarvestItem, seedItem, seedCost,
          lovedByNPCs, likedByNPCs,
          usedInRecipes, neededInBundles, machineProduction, machineSource,
          machineDef, fishPondEntry, farmingLevel, loading, error } =
    useItemDetail(id);
  usePageTitle(item?.name ?? 'Item');
  const { data } = useGameData();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error) return <div className="page-error">{error}</div>;
  if (!item) return <div className="page-error">Item not found.</div>;

  return (
    <div className="page page--item-detail">
      <Link to="/items" className="back-link">← Items</Link>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="item-hero">
        <div className="item-hero__sprite" aria-hidden="true">
          {item.spriteSheet && item.spriteIndex !== undefined ? (
            <SpriteIcon
              spriteSheet={item.spriteSheet}
              spriteIndex={item.spriteIndex}
              isBigCraftable={item.isBigCraftable}
              size={item.isBigCraftable ? 36 : 56}
            />
          ) : item.name.charAt(0)}
        </div>
        <div className="item-hero__info">
          <h1 className="item-hero__name">{item.name}</h1>
          <p className="item-hero__category">{item.category.replace(/_/g, ' ')}</p>
          <p className="item-hero__value">Sell value: <strong>{item.sellValue}g</strong></p>
          {QUALITY_CATS.has(item.category) && item.sellValue > 0 && (
            <div className="item-hero__quality-prices">
              {QUALITY_TIERS.map(({ key, label, mult, color }) => (
                <span key={key} className="quality-badge">
                  <span className="quality-badge__star" style={{ color }}>★</span>
                  <span className="quality-badge__label">{label}</span>
                  <span className="quality-badge__val">{Math.floor(item.sellValue * mult)}g</span>
                </span>
              ))}
            </div>
          )}
          {item.energy !== undefined && (
            <p className="item-hero__energy">
              Energy: <strong>+{item.energy}</strong>
              {item.health !== undefined && <> · Health: <strong>+{item.health}</strong></>}
            </p>
          )}
          <p className="item-hero__cheat">
            Cheat ID: <code className="cheat-code">[{item.cheatId}]</code>
          </p>
        </div>
      </div>

      {/* ── Description ──────────────────────────────────────────────────── */}
      {item.description && (
        <Panel title="Description">
          <p>{item.description}</p>
        </Panel>
      )}

      {/* ── Food buffs ───────────────────────────────────────────────────── */}
      {item.buffs && item.buffs.length > 0 && (
        <BuffPanel buffs={item.buffs} />
      )}

      {/* ── Machine processing rules (machine item pages) ─────────────────── */}
      {machineDef && data && (
        <MachineRulesPanel machineDef={machineDef} items={data.items} />
      )}

      {/* ── Growing information (seed or crop pages) ─────────────────────── */}
      {crop && (
        <CropPanel
          crop={crop}
          currentItem={item}
          seedItem={seedItem}
          cropHarvestItem={cropHarvestItem}
          seedCost={seedCost}
          farmingLevel={farmingLevel}
        />
      )}

      {/* ── Liked by villagers ───────────────────────────────────────────── */}
      {(lovedByNPCs.length > 0 || likedByNPCs.length > 0) && (
        <Panel title="Liked by Villagers">
          {lovedByNPCs.length > 0 && (
            <div className="npc-affinity-group">
              <strong>Loved by:</strong>
              <ul className="npc-affinity-list">
                {lovedByNPCs.map((n) => (
                  <li key={n.id}><GameLink type="npc" id={n.id}>{n.name}</GameLink></li>
                ))}
              </ul>
            </div>
          )}
          {likedByNPCs.length > 0 && (
            <div className="npc-affinity-group">
              <strong>Liked by:</strong>
              <ul className="npc-affinity-list">
                {likedByNPCs.map((n) => (
                  <li key={n.id}><GameLink type="npc" id={n.id}>{n.name}</GameLink></li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      )}

      {/* ── Available to buy ─────────────────────────────────────────────── */}
      {item.soldBy && item.soldBy.length > 0 && (
        <Panel title="Available to Buy">
          <ul className="obtain-list">
            {item.soldBy.map((entry, i) => (
              <li key={i}>
                <strong>{entry.shop}</strong>
                {entry.season && (
                  <span style={{ color: 'var(--color-text-light, #8b6242)', marginLeft: 8 }}>
                    ({entry.season.split(',').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}
                    {entry.yearMin ? `, Year ${entry.yearMin}+` : ''})
                  </span>
                )}
                {!entry.season && entry.yearMin && (
                  <span style={{ color: 'var(--color-text-light, #8b6242)', marginLeft: 8 }}>
                    (Year {entry.yearMin}+)
                  </span>
                )}
                {entry.day && (
                  <span style={{ color: 'var(--color-text-light, #8b6242)', marginLeft: 8 }}>
                    ({entry.day}s only)
                  </span>
                )}
                {entry.price && (
                  <span style={{ color: 'var(--color-gold, #daa520)', marginLeft: 8, fontWeight: 700 }}>
                    {entry.price}g
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── How to obtain ────────────────────────────────────────────────── */}
      {(item.obtainFrom?.length || item.geodeSource?.length || item.forageLocation) && (
        <Panel title="How to Obtain">
          <ul className="obtain-list">
            {item.forageLocation && (() => {
              const LOC_LABEL: Record<string, string> = {
                outdoor:'Outdoor (fields, forests)', beach:'Beach',
                cave:'Cave / Mines', desert:'Desert', island:'Ginger Island',
              };
              const LOC_EMOJI: Record<string, string> = {
                outdoor:'🌿', beach:'🐚', cave:'🕯️', desert:'🌵', island:'🌴',
              };
              const seasons = (item.seasons as string[] | undefined) ?? ['all'];
              const isAll = seasons.includes('all');
              const seasonStr = isAll
                ? 'Year-round'
                : seasons.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ');
              return (
                <li key="forage">
                  {LOC_EMOJI[item.forageLocation] ?? '🌿'} Forage in{' '}
                  <strong>{LOC_LABEL[item.forageLocation] ?? item.forageLocation}</strong>
                  {' '}— <span style={{ color: 'var(--color-text-light, #8b6242)' }}>{seasonStr}</span>
                </li>
              );
            })()}
            {item.obtainFrom?.map((source) => (
              <li key={source}>{source}</li>
            ))}
            {item.geodeSource?.map((geode) => (
              <li key={geode}>🪨 Crack open a <strong>{geode}</strong></li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Used in recipes ──────────────────────────────────────────────── */}
      {usedInRecipes.length > 0 && (
        <Panel title={`Used in Recipes (${usedInRecipes.length})`}>
          <ul className="recipe-ref-list">
            {usedInRecipes.map((recipe) => (
              <li key={recipe.id} className="recipe-ref-item">
                <Link to="/recipes" className="recipe-ref-item__name">{recipe.name}</Link>
                <span className="recipe-ref-item__source">{recipe.source}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Needed in bundles ────────────────────────────────────────────── */}
      {neededInBundles.length > 0 && (
        <Panel title={`Needed in Bundles (${neededInBundles.length})`}>
          <ul className="bundle-ref-list">
            {neededInBundles.map(({ bundle, quantity, quality }) => (
              <li key={bundle.id} className="bundle-ref-item">
                <Link to="/bundles" className="bundle-ref-item__name">{bundle.name}</Link>
                <span className="bundle-ref-item__meta">
                  {ROOM_LABELS[bundle.room] ?? bundle.room}
                  {quantity > 1 && ` · ×${quantity}`}
                  {quality ? ` · ${QUALITY_LABELS[quality] ?? ''} quality` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Process in machine ───────────────────────────────────────────── */}
      {machineProduction.length > 0 && (
        <Panel title={`Process in Machine (${machineProduction.length})`}>
          <ul className="machine-ref-list">
            {machineProduction.map((ref) => (
              <li key={ref.ruleId} className="machine-ref-item">
                <Link to="/machines" className="machine-ref-item__machine">{ref.machine.name}</Link>
                <span className="machine-ref-item__arrow">→</span>
                <span className="machine-ref-item__output">{ref.outputLabel}</span>
                {ref.minutesUntilReady > 0 && (
                  <span className="machine-ref-item__time">
                    {ref.minutesUntilReady < 60
                      ? `${ref.minutesUntilReady}m`
                      : ref.minutesUntilReady < 1440
                        ? `${Math.floor(ref.minutesUntilReady / 60)}h`
                        : `${Math.floor(ref.minutesUntilReady / 1440)}d`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Produced by machine ──────────────────────────────────────────── */}
      {machineSource.length > 0 && (
        <Panel title={`Produced by Machine (${machineSource.length})`}>
          <ul className="machine-ref-list">
            {machineSource.map((ref) => (
              <li key={ref.ruleId} className="machine-ref-item">
                <Link to="/machines" className="machine-ref-item__machine">{ref.machine.name}</Link>
                <span className="machine-ref-item__arrow">←</span>
                <span className="machine-ref-item__output">{ref.inputLabel}</span>
                {ref.minutesUntilReady > 0 && (
                  <span className="machine-ref-item__time">
                    {ref.minutesUntilReady < 60
                      ? `${ref.minutesUntilReady}m`
                      : ref.minutesUntilReady < 1440
                        ? `${Math.floor(ref.minutesUntilReady / 60)}h`
                        : `${Math.floor(ref.minutesUntilReady / 1440)}d`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ── Fish pond ────────────────────────────────────────────────────── */}
      {fishPondEntry && (
        <FishPondPanel entry={fishPondEntry} />
      )}
    </div>
  );
}
