import { useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { GameLink } from '../components/common/GameLink';
import { usePageTitle } from '../hooks/usePageTitle';
import type { MachineInputRule } from '../types/game';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTime(mins: number): string {
  if (mins < 0) return 'Variable';
  if (mins === 0) return 'Instant';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem   = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(mins / 1440);
  return days === 1 ? '1 day' : `${days} days`;
}

const FLAVORED_COLORS: Record<string, string> = {
  Wine:    '#7c3aed',
  Juice:   '#ea580c',
  Jelly:   '#db2777',
  Pickle:  '#16a34a',
  AgedRoe: '#0891b2',
  Caviar:  '#1e3a5f',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

interface RuleOutputProps {
  rule: MachineInputRule;
  spriteOf:     (cheatId: string) => { spriteSheet: string; spriteIndex: number } | null;
  /** Returns the item's kebab-case id for GameLink routing, or null if not found */
  itemRefOf:    (cheatId: string) => string | null;
  /** Returns the item's sell value, or 0 if not found */
  sellValueOf:  (cheatId: string) => number;
  /** Sell value of the input item (used to calculate flavored output value) */
  inputSellValue?: number;
}

/** Compute a human-readable output value string for a rule. Returns null when not applicable. */
function outputValueLabel(rule: MachineInputRule, inputSellValue?: number): string | null {
  if (rule.specialBehavior) return null; // Seed Maker / Cask — too variable
  if (rule.isRandomOutput) return null;

  if (rule.flavoredOutput) {
    if (rule.priceMultiplier != null) {
      if (inputSellValue) {
        const val = Math.floor(inputSellValue * rule.priceMultiplier) + (rule.priceBase ?? 0);
        return `${val}g`;
      }
      const base = rule.priceBase ? ` +${rule.priceBase}g` : '';
      return `${rule.priceMultiplier}× input${base}`;
    }
    return null;
  }

  if (rule.outputItemId) return null; // already shown as sell badge on the item

  return null;
}

function RuleOutput({ rule, spriteOf, itemRefOf, sellValueOf, inputSellValue }: RuleOutputProps) {
  // Special: Seed Maker
  if (rule.specialBehavior === 'seed_maker') {
    return (
      <div className="mrule__out-special">
        <span className="mrule__out-special-icon">🌱</span>
        <div>
          <div className="mrule__out-special-label">Matching Seeds (1–4×)</div>
          <div className="mrule__out-special-note">{rule.outputNote}</div>
        </div>
      </div>
    );
  }

  // Special: Cask quality upgrade
  if (rule.specialBehavior === 'cask') {
    return (
      <div className="mrule__out-special mrule__out-special--cask">
        <span className="mrule__out-special-icon">⬆</span>
        <div>
          <div className="mrule__out-special-label">Quality Upgrade</div>
          <div className="mrule__out-special-note">{rule.outputNote}</div>
        </div>
      </div>
    );
  }

  // Random output (Bone Mill)
  if (rule.isRandomOutput && rule.outputItems) {
    return (
      <div className="mrule__out-random">
        <div className="mrule__out-random-label">🎲 Random fertilizer</div>
        <ul className="mrule__out-random-list">
          {rule.outputItems.map(out => {
            const sp  = spriteOf(out.itemId);
            const ref = itemRefOf(out.itemId);
            const inner = (
              <>
                {sp && (
                  <SpriteIcon
                    spriteSheet={sp.spriteSheet}
                    spriteIndex={sp.spriteIndex}
                    size={14}
                  />
                )}
                <span className="mrule__out-random-name">{out.itemName}</span>
                <span className="mrule__out-random-qty">×{out.minStack}</span>
              </>
            );
            return (
              <li key={out.itemId} className="mrule__out-random-item">
                {ref
                  ? <GameLink type="item" id={ref} className="mrule__out-random-link">{inner}</GameLink>
                  : inner
                }
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // Flavored output (Wine, Juice, Jelly, Pickle, AgedRoe, Caviar)
  if (rule.flavoredOutput) {
    const color = FLAVORED_COLORS[rule.flavoredOutput] ?? '#5c3d1e';
    const valLabel = outputValueLabel(rule, inputSellValue);
    return (
      <div className="mrule__out-flavored">
        <span className="mrule__out-flavored-badge" style={{ background: color }}>
          {rule.flavoredOutput}
        </span>
        {valLabel && (
          <span className={`mrule__out-price-formula${inputSellValue && rule.priceMultiplier ? ' mrule__out-price-formula--calc' : ''}`}>
            {valLabel}
          </span>
        )}
      </div>
    );
  }

  // Specific output item
  if (rule.outputItemId) {
    const sp    = spriteOf(rule.outputItemId);
    const ref   = itemRefOf(rule.outputItemId);
    const sell  = sellValueOf(rule.outputItemId);
    const inner = (
      <>
        {sp && (
          <SpriteIcon
            spriteSheet={sp.spriteSheet}
            spriteIndex={sp.spriteIndex}
            size={24}
          />
        )}
        <span className="mrule__out-item-name">{rule.outputItemName}</span>
      </>
    );
    return (
      <div className="mrule__out-item">
        {ref
          ? <GameLink type="item" id={ref}>{inner}</GameLink>
          : inner
        }
        {sell > 0 && (
          <span className="mrule__out-sell">{sell}g</span>
        )}
      </div>
    );
  }

  return <span className="mrule__out-unknown">—</span>;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function MachinesPage() {
  usePageTitle('Machine Output Guide');
  const { data, loading, error } = useGameData();
  const [selectedId, setSelectedId] = useState<string>('12'); // Keg default

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error)   return <div className="page-error">{error}</div>;
  if (!data)   return null;

  const machines  = data.machineDefs;
  const machine   = machines.find(m => m.id === selectedId) ?? machines[0];

  // Quick sprite lookup by cheatId (non-BigCraftable items)
  const spriteOf = (cheatId: string) => {
    const item = data.items.find(i => i.cheatId === cheatId && !i.isBigCraftable);
    if (item?.spriteSheet && item.spriteIndex !== undefined) {
      return { spriteSheet: item.spriteSheet, spriteIndex: item.spriteIndex };
    }
    return null;
  };

  // Kebab-case item id for GameLink routing
  const itemRefOf = (cheatId: string): string | null =>
    data.items.find(i => i.cheatId === cheatId && !i.isBigCraftable)?.id ?? null;

  // Sell value lookup by cheatId
  const sellValueOf = (cheatId: string): number =>
    data.items.find(i => i.cheatId === cheatId && !i.isBigCraftable)?.sellValue ?? 0;

  return (
    <div className="page page--machines">
      <h1 className="page__title">Machine Output Guide</h1>
      <p className="page__subtitle">What every artisan machine produces, how long it takes, and how much it sells for.</p>

      {/* ── Machine tab strip ─────────────────────────────────────────────── */}
      <div className="machine-tabs">
        {machines.map(m => (
          <button
            key={m.id}
            className={`machine-tab${m.id === selectedId ? ' machine-tab--active' : ''}`}
            onClick={() => setSelectedId(m.id)}
            title={m.name}
          >
            <div className="machine-tab__sprite" aria-hidden="true">
              <SpriteIcon
                spriteSheet="Craftables"
                spriteIndex={parseInt(m.id)}
                isBigCraftable
                size={13}
              />
            </div>
            <span className="machine-tab__label">{m.name}</span>
          </button>
        ))}
      </div>

      {/* ── Machine panel ─────────────────────────────────────────────────── */}
      <div className="machine-panel">
        <div className="machine-panel__header">
          <div className="machine-panel__header-sprite" aria-hidden="true">
            <SpriteIcon
              spriteSheet="Craftables"
              spriteIndex={parseInt(machine.id)}
              isBigCraftable
              size={28}
            />
          </div>
          <div className="machine-panel__header-info">
            <h2 className="machine-panel__name">{machine.name}</h2>
            <span className="machine-panel__count">
              {machine.rules.length} rule{machine.rules.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ── Rules list ──────────────────────────────────────────────────── */}
        <div className="machine-rules">
          {machine.rules.map(rule => {
            const inputItem = rule.inputItemId
              ? data.items.find(i => i.cheatId === rule.inputItemId && !i.isBigCraftable)
              : null;
            const inputSp = inputItem?.spriteSheet && inputItem.spriteIndex !== undefined
              ? { spriteSheet: inputItem.spriteSheet, spriteIndex: inputItem.spriteIndex }
              : null;

            const inputRef = rule.inputItemId ? itemRefOf(rule.inputItemId) : null;

            return (
              <div key={rule.ruleId} className="mrule">
                {/* Input */}
                <div className="mrule__input">
                  <div className="mrule__input-sprite" aria-hidden="true">
                    {inputSp ? (
                      <SpriteIcon
                        spriteSheet={inputSp.spriteSheet}
                        spriteIndex={inputSp.spriteIndex}
                        size={24}
                      />
                    ) : (
                      <div className="mrule__input-cat-icon">
                        {rule.inputCategoryLabel?.startsWith('Any Fruit')  ? '🍎'
                          : rule.inputCategoryLabel?.startsWith('Any Veg') ? '🥦'
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
                    {rule.inputCount > 1 && (
                      <span className="mrule__qty">{rule.inputCount}×</span>
                    )}
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
                  <RuleOutput
                    rule={rule}
                    spriteOf={spriteOf}
                    itemRefOf={itemRefOf}
                    sellValueOf={sellValueOf}
                    inputSellValue={inputItem?.sellValue}
                  />
                </div>

                {/* Time */}
                <div className="mrule__time">
                  <span className="mrule__time-badge">
                    {formatTime(rule.minutesUntilReady)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
