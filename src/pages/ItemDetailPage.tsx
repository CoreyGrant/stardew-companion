import { useParams, Link } from 'react-router-dom';
import { useItemDetail } from '../hooks/useItemDetail';
import { usePageTitle } from '../hooks/usePageTitle';
import { Panel } from '../components/common/Panel';
import { GameLink } from '../components/common/GameLink';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import type { FoodBuff, FishPondEntry, PondProduceItem, PondPopGate } from '../types/game';

const BUFF_LABELS: Record<string, string> = {
  farming:       'Farming',
  fishing:       'Fishing',
  mining:        'Mining',
  combat:        'Combat',
  luck:          'Luck',
  foraging:      'Foraging',
  speed:         'Speed',
  defense:       'Defense',
  attack:        'Attack',
  maxStamina:    'Max Energy',
  magneticRadius:'Magnet Range',
};

const BUFF_EMOJI: Record<string, string> = {
  farming:       '🌾',
  fishing:       '🎣',
  mining:        '⛏️',
  combat:        '⚔️',
  luck:          '🍀',
  foraging:      '🍄',
  speed:         '👟',
  defense:       '🛡️',
  attack:        '💥',
  maxStamina:    '⚡',
  magneticRadius:'🧲',
};

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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

// ── Fish Pond inline panel ────────────────────────────────────────────────────

function FishPondPanel({ entry }: { entry: FishPondEntry }) {
  const pct = (c: number) => `${Math.round(c * 100)}%`;

  // Deduplicate produce rows: group by itemName, keep highest-pop entry per item
  // Then show each unique item once with the progression comment
  const uniqueItems = new Map<string, PondProduceItem[]>();
  for (const p of entry.produce) {
    if (!uniqueItems.has(p.itemName)) uniqueItems.set(p.itemName, []);
    uniqueItems.get(p.itemName)!.push(p);
  }

  return (
    <Panel title="Fish Pond">
      <div className="pond-inline-meta">
        <span className="pond-inline-badge">Max pop: {entry.maxPopulation}</span>
        <span className="pond-inline-badge">Base chance: {pct(entry.minProduceChance)}–{pct(entry.maxProduceChance)}</span>
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
                ? pct(minRow.chance)
                : `${pct(minRow.chance)}–${pct(maxRow.chance)}`;
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

const QUALITY_CATS = new Set(['crop','forage','fish','animal_product','artisan','flower']);
const QUALITY_TIERS = [
  { key: 'silver',  label: 'Silver',  mult: 1.25, color: '#b0b8c8' },
  { key: 'gold',    label: 'Gold',    mult: 1.5,  color: '#daa520' },
  { key: 'iridium', label: 'Iridium', mult: 2,    color: '#a855f7' },
] as const;

const LEVEL_LABELS: Record<number, string> = {
  0: 'Lv. 0', 1: 'Lv. 1', 2: 'Lv. 2', 3: 'Lv. 3', 4: 'Lv. 4',
  5: 'Lv. 5', 6: 'Lv. 6', 7: 'Lv. 7', 8: 'Lv. 8', 9: 'Lv. 9', 10: 'Lv. 10',
};

const ROOM_LABELS: Record<string, string> = {
  crafts_room: 'Crafts Room',
  pantry: 'Pantry',
  fish_tank: 'Fish Tank',
  boiler_room: 'Boiler Room',
  bulletin_board: 'Bulletin Board',
  vault: 'Vault',
};

const QUALITY_LABELS: Record<number, string> = { 1: 'Silver', 2: 'Gold', 4: 'Iridium' };

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item, crop, seedItem, lovedByNPCs, likedByNPCs,
          usedInRecipes, neededInBundles, machineProduction, machineSource,
          fishPondEntry, farmingLevel, loading, error } =
    useItemDetail(id);
  usePageTitle(item?.name ?? 'Item');

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error) return <div className="page-error">{error}</div>;
  if (!item) return <div className="page-error">Item not found.</div>;

  return (
    <div className="page page--item-detail">
      <Link to="/items" className="back-link">← Items</Link>

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
          <p className="item-hero__category">{item.category.replace('_', ' ')}</p>
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
              {item.health !== undefined && (
                <> · Health: <strong>+{item.health}</strong></>
              )}
            </p>
          )}
          <p className="item-hero__cheat">
            Cheat ID: <code className="cheat-code">[{item.cheatId}]</code>
          </p>
        </div>
      </div>

      {item.description && (
        <Panel title="Description">
          <p>{item.description}</p>
        </Panel>
      )}

      {item.buffs && item.buffs.length > 0 && (
        <BuffPanel buffs={item.buffs} />
      )}

      {crop && (
        <Panel title="Crop Data">
          <ul className="crop-info">
            <li>Seasons: {crop.seasons.join(', ')}</li>
            <li>Grow time: {crop.growDays} days</li>
            {crop.regrowDays && <li>Regrows every: {crop.regrowDays} days</li>}
            <li>Harvest: {crop.harvestCountMin === crop.harvestCountMax
              ? `${crop.harvestCountMin}`
              : `${crop.harvestCountMin}–${crop.harvestCountMax}`} per harvest</li>
            {crop.trellisCrop && <li>Trellis crop</li>}
            {crop.canBeGiantCrop && <li>Can grow giant</li>}
            {seedItem && (
              <li>Seed: <GameLink type="item" id={seedItem.id}>{seedItem.name}</GameLink></li>
            )}
          </ul>

          <h3 className="subsection-title">
            Crop Quality by Farming Level
            {farmingLevel > 0 && <span className="subsection-title__hint"> (your level: {farmingLevel})</span>}
          </h3>
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
                {Object.entries(crop.qualityByLevel).map(([lvl, q]) => {
                  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
                  return (
                    <tr
                      key={lvl}
                      className={Number(lvl) === farmingLevel ? 'quality-table__row--active' : ''}
                    >
                      <td>{LEVEL_LABELS[Number(lvl)]}</td>
                      <td>{pct(q.normal)}</td>
                      <td>{pct(q.silver)}</td>
                      <td>{pct(q.gold)}</td>
                      <td>{q.iridium > 0 ? pct(q.iridium) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

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

      {(item.obtainFrom?.length || item.geodeSource?.length || item.forageLocation) && (
        <Panel title="How to Obtain">
          <ul className="obtain-list">
            {item.forageLocation && (() => {
              const LOC_LABEL: Record<string, string> = {
                outdoor: 'Outdoor (fields, forests)',
                beach: 'Beach',
                cave: 'Cave / Mines',
                desert: 'Desert',
                island: 'Ginger Island',
              };
              const LOC_EMOJI: Record<string, string> = {
                outdoor: '🌿', beach: '🐚', cave: '🕯️', desert: '🌵', island: '🌴',
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

      {usedInRecipes.length > 0 && (
        <Panel title={`Used in Recipes (${usedInRecipes.length})`}>
          <ul className="recipe-ref-list">
            {usedInRecipes.map((recipe) => (
              <li key={recipe.id} className="recipe-ref-item">
                <Link to="/recipes" className="recipe-ref-item__name">
                  {recipe.name}
                </Link>
                <span className="recipe-ref-item__source">{recipe.source}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {neededInBundles.length > 0 && (
        <Panel title={`Needed in Bundles (${neededInBundles.length})`}>
          <ul className="bundle-ref-list">
            {neededInBundles.map(({ bundle, quantity, quality }) => (
              <li key={bundle.id} className="bundle-ref-item">
                <Link to="/bundles" className="bundle-ref-item__name">
                  {bundle.name}
                </Link>
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

      {machineProduction.length > 0 && (
        <Panel title={`Process in Machine (${machineProduction.length})`}>
          <ul className="machine-ref-list">
            {machineProduction.map((ref) => (
              <li key={ref.ruleId} className="machine-ref-item">
                <Link to="/machines" className="machine-ref-item__machine">
                  {ref.machine.name}
                </Link>
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

      {machineSource.length > 0 && (
        <Panel title={`Produced by Machine (${machineSource.length})`}>
          <ul className="machine-ref-list">
            {machineSource.map((ref) => (
              <li key={ref.ruleId} className="machine-ref-item">
                <Link to="/machines" className="machine-ref-item__machine">
                  {ref.machine.name}
                </Link>
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

      {fishPondEntry && (
        <FishPondPanel entry={fishPondEntry} />
      )}
    </div>
  );
}
