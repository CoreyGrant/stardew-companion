import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import type { NPC } from '../types/game';
import type { FriendshipEntry, PerfectionManual, SaveFile } from '../types/save';

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_WALNUTS   = 130;
const TOTAL_MUSEUM    = 94;   // minerals + gems + artifacts in our data
const TOTAL_ROD_FISH  = 60;   // excludes crab-pot fish
const TOTAL_RECIPES   = 81;   // cooking recipes
const TOTAL_SKILLS    = 5;
const OBELISK_IDS     = ['Earth Obelisk', 'Water Obelisk', 'Desert Obelisk', 'Island Obelisk'] as const;
const CLOCK_ID        = 'Gold Clock';

const BUILDING_GOLD: Record<string, number> = {
  'Earth Obelisk':  500_000,
  'Water Obelisk':  500_000,
  'Desert Obelisk': 1_000_000,
  'Island Obelisk': 1_000_000,
  'Gold Clock':     10_000_000,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function friendshipCap(npc: NPC, fd?: FriendshipEntry): number {
  if (!fd) return npc.marriageable ? 8 : 10;
  const s = fd.status;
  if (s === 'Married')                 return 14;
  if (s === 'Dating' || s === 'Engaged') return 10;
  if (!npc.marriageable)               return 10;
  return 8;
}

function fmtGold(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M g`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k g`;
  return `${n} g`;
}

function clamp(v: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, v)); }

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, withWaivers }: { score: number; withWaivers: number }) {
  const pct = clamp(score, 0, 100);
  const wpct = clamp(withWaivers, 0, 100);
  const style = { '--pct': `${pct}%`, '--wpct': `${wpct}%` } as CSSProperties;
  return (
    <div className="perf-ring" style={style}>
      <div className="perf-ring__inner">
        <span className="perf-ring__number">{Math.floor(withWaivers)}</span>
        <span className="perf-ring__label">/ 100%</span>
      </div>
    </div>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? clamp(value / max, 0, 1) * 100 : 0;
  return (
    <div className="perf-bar">
      <div className="perf-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Category row ──────────────────────────────────────────────────────────────

interface CatRowProps {
  icon: string;
  label: string;
  weight: number;     // max % contribution
  earned: number;     // 0–weight
  detail: string;     // "3/4", "✓", etc.
  auto: boolean;      // true = derived from save data
  children?: React.ReactNode; // manual control
  hint?: string;
}

function CategoryRow({ icon, label, weight, earned, detail, auto, children, hint }: CatRowProps) {
  const done = earned >= weight - 0.01;
  return (
    <div className={`perf-cat${done ? ' perf-cat--done' : ''}`}>
      <span className="perf-cat__icon">{icon}</span>
      <div className="perf-cat__info">
        <span className="perf-cat__name">{label}</span>
        {hint && <span className="perf-cat__hint">{hint}</span>}
      </div>
      <div className="perf-cat__progress">
        <MiniBar value={earned} max={weight} />
        <span className="perf-cat__detail">{detail}</span>
      </div>
      <div className="perf-cat__score">
        <span className={done ? 'perf-cat__score--done' : ''}>{earned.toFixed(1)}</span>
        <span className="perf-cat__score-max">/{weight}%</span>
      </div>
      {!auto && <div className="perf-cat__manual">{children}</div>}
      {auto && <div className="perf-cat__auto-badge">auto</div>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PerfectionPage() {
  usePageTitle('Perfection Tracker');
  const { data, loading, error } = useGameData();
  const { activeSave, updateSave } = useUserData();

  const patch = (fields: Partial<SaveFile>) => {
    if (!activeSave) return;
    updateSave({ ...activeSave, ...fields });
  };
  const setManual = (field: keyof PerfectionManual, value: boolean | number) =>
    patch({ manualPerfection: { ...(activeSave?.manualPerfection ?? {}), [field]: value } });
  const setWaivers = (n: number) =>
    patch({ perfectionWaivers: clamp(Math.round(n), 0, 100) });

  // ── Per-category scores ────────────────────────────────────────────────────

  const scores = useMemo(() => {
    const save = activeSave;
    const manual = save?.manualPerfection ?? {};

    // 1. Produce shipped (15%) — manual
    const produceScore = manual.produceDone ? 15 : 0;

    // 2. Obelisks (4%) — 1% each
    const builtIds = new Set((save?.farmLayout.buildings ?? []).map((b) => b.buildingId));
    const obelisksBuilt = OBELISK_IDS.filter((id) => builtIds.has(id)).length;
    const obeliskScore = obelisksBuilt;   // 1% per obelisk

    // 3. Gold Clock (10%)
    const clockScore = builtIds.has(CLOCK_ID) ? 10 : 0;

    // 4. Monster Slayer (10%) — manual
    const monstersScore = manual.monstersDone ? 10 : 0;

    // 5. Great Friends (11%)
    const npcs = data?.npcs ?? [];
    const maxedFriends = npcs.filter((npc) => {
      const fd  = save?.friendshipData?.[npc.id];
      const hl  = save?.heartLevels?.[npc.id] ?? 0;
      return hl >= friendshipCap(npc, fd);
    }).length;
    const friendsScore = npcs.length > 0
      ? (maxedFriends / npcs.length) * 11
      : 0;

    // 6. Farmer level (5%) — all 5 skills at 10
    const skills = save?.skills ?? { farming: 0, mining: 0, foraging: 0, fishing: 0, combat: 0 };
    const maxedSkills = Object.values(skills).filter((v) => v >= 10).length;
    const skillsScore = (maxedSkills / TOTAL_SKILLS) * 5;

    // 7. Cooking recipes (10%)
    const learned = save?.learnedCookingRecipes?.length ?? 0;
    const cookingScore = Math.min(learned / TOTAL_RECIPES, 1) * 10;

    // 8. Crafting recipes (10%) — manual
    const craftingScore = manual.craftingDone ? 10 : 0;

    // 9. Fish caught (10%) — manual count
    const fishCaught = clamp(manual.fishCaught ?? 0, 0, TOTAL_ROD_FISH);
    const fishScore = (fishCaught / TOTAL_ROD_FISH) * 10;

    // 10. Golden walnuts (5%)
    const walnuts = clamp(save?.goldenWalnuts ?? 0, 0, TOTAL_WALNUTS);
    const walnutScore = (walnuts / TOTAL_WALNUTS) * 5;

    // 11. Museum (10%)
    const donated = save?.museumDonations?.length ?? 0;
    const museumScore = Math.min(donated / TOTAL_MUSEUM, 1) * 10;

    const natural = produceScore + obeliskScore + clockScore + monstersScore
      + friendsScore + skillsScore + cookingScore + craftingScore
      + fishScore + walnutScore + museumScore;

    const waivers = save?.perfectionWaivers ?? 0;
    const total = clamp(natural + waivers, 0, 100);

    return {
      produce:   { earned: produceScore,  total: 15  },
      obelisks:  { earned: obeliskScore,  total: 4,   built: obelisksBuilt },
      clock:     { earned: clockScore,    total: 10,  built: builtIds.has(CLOCK_ID) },
      monsters:  { earned: monstersScore, total: 10  },
      friends:   { earned: friendsScore,  total: 11,  maxed: maxedFriends, count: npcs.length },
      skills:    { earned: skillsScore,   total: 5,   maxed: maxedSkills },
      cooking:   { earned: cookingScore,  total: 10,  learned },
      crafting:  { earned: craftingScore, total: 10  },
      fish:      { earned: fishScore,     total: 10,  caught: fishCaught },
      walnuts:   { earned: walnutScore,   total: 5,   found: walnuts },
      museum:    { earned: museumScore,   total: 10,  donated },
      natural: Math.round(natural * 10) / 10,
      waivers,
      total: Math.round(total * 10) / 10,
    };
  }, [data, activeSave]);

  // ── Gold cost ──────────────────────────────────────────────────────────────

  const goldCost = useMemo(() => {
    const builtIds = new Set((activeSave?.farmLayout.buildings ?? []).map((b) => b.buildingId));
    const missing = [...OBELISK_IDS, CLOCK_ID]
      .filter((id) => !builtIds.has(id))
      .map((id) => ({ name: id, cost: BUILDING_GOLD[id] }));
    const total = missing.reduce((s, m) => s + m.cost, 0);
    return { missing, total };
  }, [activeSave]);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const manual = activeSave?.manualPerfection ?? {};
  const waivers = activeSave?.perfectionWaivers ?? 0;
  const waiverShortfall = Math.max(0, Math.ceil(100 - scores.natural));

  return (
    <div className="page page--perfection">
      <h1 className="page__title">Perfection Tracker</h1>
      <p className="page__subtitle">Track your progress toward 100% perfection.</p>

      {!activeSave && (
        <p className="plan-notice">
          No save loaded — manually tracked categories will not persist.{' '}
          <Link to="/saves">Load a save</Link> to enable full tracking.
        </p>
      )}

      {/* ── Score ring ── */}
      <div className="perf-header">
        <ScoreRing score={scores.natural} withWaivers={scores.total} />
        <div className="perf-header__meta">
          <div className="perf-header__natural">
            Natural score: <strong>{scores.natural}%</strong>
          </div>
          {waivers > 0 && (
            <div className="perf-header__waiver-note">
              +{waivers} waiver{waivers !== 1 ? 's' : ''} → <strong>{scores.total}%</strong>
            </div>
          )}
          {scores.total < 100 && (
            <div className="perf-header__remaining">
              {Math.ceil(100 - scores.total)}% remaining
            </div>
          )}
          {scores.total >= 100 && (
            <div className="perf-header__complete">✦ Perfect! ✦</div>
          )}
        </div>
      </div>

      {/* ── Categories ── */}
      <div className="perf-categories">

        <CategoryRow
          icon="📦" label="Produce & Forage Shipped" weight={15}
          earned={scores.produce.earned}
          detail={manual.produceDone ? '✓ Done' : 'Incomplete'}
          auto={false}
          hint="Ship every shippable item at least once"
        >
          <button
            className={`perf-toggle${manual.produceDone ? ' perf-toggle--on' : ''}`}
            onClick={() => setManual('produceDone', !manual.produceDone)}
          >{manual.produceDone ? '✓ Done' : 'Mark done'}</button>
        </CategoryRow>

        <CategoryRow
          icon="🗺️" label="Obelisks on Farm" weight={4}
          earned={scores.obelisks.earned}
          detail={`${scores.obelisks.built}/4`}
          auto={!!activeSave}
          hint="Build all 4 obelisks — 1% each (Robin's Carpenter Shop)"
        >
          <span className="perf-auto-hint">Detected from farm layout</span>
        </CategoryRow>

        <CategoryRow
          icon="🕰️" label="Gold Clock on Farm" weight={10}
          earned={scores.clock.earned}
          detail={scores.clock.built ? '✓ Built' : 'Not built'}
          auto={!!activeSave}
          hint="Build the Gold Clock (10,000,000g at Robin's)"
        >
          <span className="perf-auto-hint">Detected from farm layout</span>
        </CategoryRow>

        <CategoryRow
          icon="⚔️" label="Monster Slayer Hero" weight={10}
          earned={scores.monsters.earned}
          detail={manual.monstersDone ? '✓ Done' : 'Incomplete'}
          auto={false}
          hint="Complete all monster eradication goals (Adventurer's Guild)"
        >
          <button
            className={`perf-toggle${manual.monstersDone ? ' perf-toggle--on' : ''}`}
            onClick={() => setManual('monstersDone', !manual.monstersDone)}
          >{manual.monstersDone ? '✓ Done' : 'Mark done'}</button>
        </CategoryRow>

        <CategoryRow
          icon="💛" label="Great Friends" weight={11}
          earned={scores.friends.earned}
          detail={`${scores.friends.maxed}/${scores.friends.count} villagers`}
          auto={!!activeSave}
          hint="Max hearts with every villager (8♥ marriageable, 10♥ others, 14♥ if married)"
        >
          <span className="perf-auto-hint">Detected from friendship data</span>
        </CategoryRow>

        <CategoryRow
          icon="⭐" label="Farmer Level" weight={5}
          earned={scores.skills.earned}
          detail={`${scores.skills.maxed}/5 skills at Lv.10`}
          auto={!!activeSave}
          hint="Reach level 10 in Farming, Mining, Foraging, Fishing, and Combat"
        >
          <span className="perf-auto-hint">Detected from save data</span>
        </CategoryRow>

        <CategoryRow
          icon="🍳" label="Cooking Recipes" weight={10}
          earned={scores.cooking.earned}
          detail={`${scores.cooking.learned}/${TOTAL_RECIPES} recipes`}
          auto={!!activeSave}
          hint="Cook every cooking recipe at least once"
        >
          <span className="perf-auto-hint">Based on learned recipes</span>
        </CategoryRow>

        <CategoryRow
          icon="🔨" label="Crafting Recipes" weight={10}
          earned={scores.crafting.earned}
          detail={manual.craftingDone ? '✓ Done' : 'Incomplete'}
          auto={false}
          hint="Craft every craftable item at least once"
        >
          <button
            className={`perf-toggle${manual.craftingDone ? ' perf-toggle--on' : ''}`}
            onClick={() => setManual('craftingDone', !manual.craftingDone)}
          >{manual.craftingDone ? '✓ Done' : 'Mark done'}</button>
        </CategoryRow>

        <CategoryRow
          icon="🎣" label="Fish Caught" weight={10}
          earned={scores.fish.earned}
          detail={`${scores.fish.caught}/${TOTAL_ROD_FISH} species`}
          auto={false}
          hint="Catch every rod-catchable fish species (excludes crab pot fish)"
        >
          <div className="perf-counter">
            <button className="perf-counter__btn"
              onClick={() => setManual('fishCaught', clamp((manual.fishCaught ?? 0) - 1, 0, TOTAL_ROD_FISH))}
            >−</button>
            <input
              type="number" min={0} max={TOTAL_ROD_FISH}
              value={manual.fishCaught ?? 0}
              onChange={(e) => setManual('fishCaught', clamp(parseInt(e.target.value) || 0, 0, TOTAL_ROD_FISH))}
              className="perf-counter__input"
            />
            <button className="perf-counter__btn"
              onClick={() => setManual('fishCaught', clamp((manual.fishCaught ?? 0) + 1, 0, TOTAL_ROD_FISH))}
            >+</button>
          </div>
        </CategoryRow>

        <CategoryRow
          icon="🥜" label="Golden Walnuts" weight={5}
          earned={scores.walnuts.earned}
          detail={`${scores.walnuts.found}/${TOTAL_WALNUTS}`}
          auto={!!activeSave}
          hint="Find all 130 Golden Walnuts on Ginger Island"
        >
          <span className="perf-auto-hint">Detected from save data</span>
        </CategoryRow>

        <CategoryRow
          icon="🏛️" label="Museum Donations" weight={10}
          earned={scores.museum.earned}
          detail={`${scores.museum.donated}/${TOTAL_MUSEUM} items`}
          auto={!!activeSave}
          hint="Donate all minerals, gems, and artifacts to the museum"
        >
          <span className="perf-auto-hint">
            <Link to="/museum">View museum</Link>
          </span>
        </CategoryRow>
      </div>

      {/* ── Perfection Waivers ── */}
      <div className="perf-section perf-waivers">
        <h2 className="perf-section__title">✦ Perfection Waivers</h2>
        <p className="perf-section__desc">
          Purchasable from Qi's Walnut Room for <strong>20 Qi Gems</strong> each.
          Each waiver permanently adds <strong>+1%</strong> to your perfection score.
        </p>
        <div className="perf-waiver-row">
          <label className="perf-waiver-row__label">Waivers purchased:</label>
          <div className="perf-counter">
            <button className="perf-counter__btn" onClick={() => setWaivers(waivers - 1)}>−</button>
            <input
              type="number" min={0} max={100}
              value={waivers}
              onChange={(e) => setWaivers(parseInt(e.target.value) || 0)}
              className="perf-counter__input"
            />
            <button className="perf-counter__btn" onClick={() => setWaivers(waivers + 1)}>+</button>
          </div>
          {waivers > 0 && (
            <span className="perf-waiver-row__effect">
              +{waivers}% → score: {scores.total}%
            </span>
          )}
        </div>
        {scores.total < 100 && (
          <p className="perf-waiver-row__shortfall">
            {waiverShortfall - waivers > 0
              ? `${waiverShortfall - waivers} more waiver${waiverShortfall - waivers !== 1 ? 's' : ''} needed to reach 100% (${(waiverShortfall - waivers) * 20} Qi Gems)`
              : scores.total < 100
                ? `${Math.ceil(100 - scores.total)} more waiver${Math.ceil(100 - scores.total) !== 1 ? 's' : ''} needed`
                : ''}
          </p>
        )}
      </div>

      {/* ── Gold to complete ── */}
      <div className="perf-section perf-gold">
        <h2 className="perf-section__title">💰 Gold to Complete Buildings</h2>
        <p className="perf-section__desc">
          Obelisks and the Gold Clock are the only perfection items with a direct gold cost.
        </p>
        {goldCost.missing.length === 0 ? (
          <p className="perf-gold__complete">✓ All perfection buildings are on your farm!</p>
        ) : (
          <>
            <div className="perf-gold__list">
              {goldCost.missing.map((b) => (
                <div key={b.name} className="perf-gold__row">
                  <span className="perf-gold__name">{b.name}</span>
                  <span className="perf-gold__cost">{fmtGold(b.cost)}</span>
                </div>
              ))}
            </div>
            <div className="perf-gold__total">
              Total: <strong>{fmtGold(goldCost.total)}</strong>
              {goldCost.total >= 1_000_000 && (
                <span className="perf-gold__note"> — plus materials from Robin</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
