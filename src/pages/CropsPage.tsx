import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { SeasonSelector } from '../components/common/SeasonSelector';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Season } from '../types/game';

type SeasonFilter = Season | 'all';
type SortKey = 'name' | 'value' | 'days' | 'gpd';

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'name',  label: 'Name' },
  { id: 'value', label: 'Sell Value' },
  { id: 'days',  label: 'Grow Days' },
  { id: 'gpd',   label: 'Gold/Day' },
];

const SEASON_DAYS = 28;

/**
 * Remaining harvests achievable if planted today.
 * Returns 0 if the crop cannot be planted with enough time to harvest.
 */
function remainingHarvests(
  growDays: number,
  regrowDays: number | null | undefined,
  currentDay: number,
): number {
  const daysLeft = SEASON_DAYS - currentDay + 1; // days remaining including today
  if (growDays > daysLeft) return 0;             // not enough time even for first harvest
  if (!regrowDays) return 1;
  return 1 + Math.floor((daysLeft - growDays) / regrowDays);
}

/**
 * Net gold/day for a crop, accounting for seed cost.
 * Regrow crops: amortize seed cost over the full season's harvests.
 * One-time crops: (revenue - seedCost) / growDays.
 */
function netGoldPerDay(
  sellValue: number,
  avgHarvest: number,
  growDays: number,
  regrowDays: number | null | undefined,
  seedCost: number,
): number {
  if (regrowDays) {
    // Number of harvests in a 28-day season starting from when it first matures
    const remainingDays = Math.max(0, SEASON_DAYS - growDays);
    const extraHarvests = Math.floor(remainingDays / regrowDays);
    const totalHarvests = 1 + extraHarvests;
    const seasonProfit = sellValue * avgHarvest * totalHarvests - seedCost;
    return seasonProfit / SEASON_DAYS;
  } else {
    return (sellValue * avgHarvest - seedCost) / growDays;
  }
}

export function CropsPage() {
  usePageTitle('Crops');
  const { data, loading, error } = useGameData();
  const { activeSave, settings } = useUserData();
  const [season, setSeason] = useState<SeasonFilter>('spring');
  const [sort, setSort]     = useState<SortKey>('name');

  // Active save context for "remaining harvests" column
  const saveContext = useMemo(() => {
    if (!settings.tailorToSave || !activeSave?.season || !activeSave.day) return null;
    return { season: activeSave.season as Season, day: activeSave.day };
  }, [activeSave, settings]);

  const itemMap = useMemo(
    () => new Map((data?.items ?? []).map((i) => [i.cheatId, i])),
    [data],
  );

  if (loading) return <div className="page-loading">Loading crops…</div>;
  if (error) return <div className="page-error">{error}</div>;

  const rawCrops = (data?.crops ?? []).filter(
    (c) => season === 'all' || c.seasons.includes(season as Season),
  );

  const crops = useMemo(() => {
    const sorted = [...rawCrops];
    sorted.sort((a, b) => {
      const aItem = itemMap.get(a.harvestItemId);
      const bItem = itemMap.get(b.harvestItemId);
      const aSeed = itemMap.get(a.seedItemId);
      const bSeed = itemMap.get(b.seedItemId);
      const aSeedCost = aSeed?.soldBy?.[0]?.price ?? 0;
      const bSeedCost = bSeed?.soldBy?.[0]?.price ?? 0;
      if (sort === 'name')  return a.name.localeCompare(b.name);
      if (sort === 'value') return (bItem?.sellValue ?? 0) - (aItem?.sellValue ?? 0);
      if (sort === 'days')  return a.growDays - b.growDays;
      if (sort === 'gpd') {
        const aAvg = (a.harvestCountMin + a.harvestCountMax) / 2;
        const bAvg = (b.harvestCountMin + b.harvestCountMax) / 2;
        const agpd = netGoldPerDay(aItem?.sellValue ?? 0, aAvg, a.growDays, a.regrowDays, aSeedCost);
        const bgpd = netGoldPerDay(bItem?.sellValue ?? 0, bAvg, b.growDays, b.regrowDays, bSeedCost);
        return bgpd - agpd;
      }
      return 0;
    });
    return sorted;
  }, [rawCrops, sort, itemMap]);

  return (
    <div className="page page--crops">
      <h1 className="page__title">Crops</h1>
      <p className="page__subtitle">Planting windows, grow times, sell values, and gold-per-day for every crop.</p>

      {/* Season selector */}
      <SeasonSelector
        value={season}
        onChange={(v) => setSeason(v as SeasonFilter)}
      />

      {/* Sort controls */}
      <div className="fish-sort-bar">
        <span className="fish-sort-bar__label">Sort:</span>
        {SORT_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            className={`fish-sort-btn${sort === id ? ' fish-sort-btn--active' : ''}`}
            onClick={() => setSort(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Crop table */}
      <div className={`crop-table${saveContext ? ' crop-table--with-harvests' : ''}`}>
        <div className="crop-table__header">
          <span className="crop-table__col-name">Crop</span>
          <span className="crop-table__col-seasons">Seasons</span>
          <span className="crop-table__col-growth">Growth (28-day season)</span>
          <span className="crop-table__col-sell">Sell</span>
          <span className="crop-table__col-gpd" title="Net gold per day (after seed cost)">g/Day*</span>
          {saveContext && (
            <span className="crop-table__col-harvests" title={`Harvests remaining in ${saveContext.season} (planted on day ${saveContext.day})`}>
              Left
            </span>
          )}
        </div>

        {crops.map((crop) => {
          const harvestItem = itemMap.get(crop.harvestItemId);
          const seedItem    = itemMap.get(crop.seedItemId);
          const growPct     = Math.min(crop.growDays / SEASON_DAYS * 100, 100);
          const regrowPct   = crop.regrowDays
            ? Math.min(crop.regrowDays / SEASON_DAYS * 100, 100)
            : 0;

          // Net gold per day (revenue minus seed cost)
          const avgHarvest = (crop.harvestCountMin + crop.harvestCountMax) / 2;
          const seedBuyPrice = seedItem?.soldBy?.[0]?.price ?? 0;
          const gpd = harvestItem
            ? netGoldPerDay(harvestItem.sellValue, avgHarvest, crop.growDays, crop.regrowDays, seedBuyPrice).toFixed(1)
            : null;

          // Remaining harvests for this season (only when save context active + matching season)
          const harvestsLeft = (saveContext && crop.seasons.includes(saveContext.season))
            ? remainingHarvests(crop.growDays, crop.regrowDays, saveContext.day)
            : null;

          // Primary season for row color (first listed season)
          const primarySeason = crop.seasons[0] ?? 'spring';

          return (
            <div key={crop.id} className={`crop-row crop-row--${primarySeason}${harvestsLeft === 0 ? ' crop-row--cant-plant' : ''}`}>

              {/* Name + badges column */}
              <div className="crop-row__name">
                {harvestItem?.spriteSheet && harvestItem.spriteIndex !== undefined ? (
                  <div className="crop-row__icon">
                    <SpriteIcon
                      spriteSheet={harvestItem.spriteSheet}
                      spriteIndex={harvestItem.spriteIndex}
                      size={28}
                    />
                  </div>
                ) : (
                  <div className="crop-row__icon crop-row__icon--placeholder">?</div>
                )}
                <div className="crop-row__name-body">
                  <Link to={`/items/${harvestItem?.id ?? crop.id}`} className="crop-row__link">
                    {crop.name}
                  </Link>
                  <div className="crop-row__meta">
                    {seedItem && (
                      <>
                        <Link to={`/items/${seedItem.id}`} className="crop-row__seed">
                          {seedItem.name}
                        </Link>
                        {seedBuyPrice > 0 && (
                          <span className="crop-row__seed-price">{seedBuyPrice}g</span>
                        )}
                      </>
                    )}
                    {crop.seasons.length > 1 && <span className="crop-badge crop-badge--multi">Multi-season</span>}
                    {crop.trellisCrop  && <span className="crop-badge crop-badge--trellis">Trellis</span>}
                    {crop.canBeGiantCrop && <span className="crop-badge crop-badge--giant">Giant</span>}
                    {crop.isPaddyCrop  && <span className="crop-badge crop-badge--paddy">Paddy</span>}
                  </div>
                </div>
              </div>

              {/* Seasons dots */}
              <div className="crop-row__seasons">
                {(['spring','summer','fall','winter'] as Season[]).map((s) => (
                  <span
                    key={s}
                    className={`season-pip season-pip--${s}${crop.seasons.includes(s) ? ' season-pip--on' : ''}`}
                    title={s}
                  />
                ))}
              </div>

              {/* Growth bar */}
              <div className="crop-row__growth">
                <div className="grow-bar">
                  <div
                    className="grow-bar__initial"
                    style={{ width: `${growPct}%` }}
                    title={`${crop.growDays} days to first harvest`}
                  />
                  {regrowPct > 0 && (
                    <div
                      className="grow-bar__regrow"
                      style={{ left: `${growPct}%`, width: `${Math.min(regrowPct, 100 - growPct)}%` }}
                      title={`Regrows every ${crop.regrowDays} days`}
                    />
                  )}
                </div>
                <span className="grow-bar__label">
                  {crop.growDays}d
                  {crop.regrowDays && ` +${crop.regrowDays}d`}
                </span>
              </div>

              {/* Sell value */}
              <div className="crop-row__sell">
                {harvestItem ? (
                  <>
                    <strong>{harvestItem.sellValue}g</strong>
                    {crop.harvestCountMin > 1 && (
                      <span className="crop-row__multi">
                        {crop.harvestCountMin === crop.harvestCountMax
                          ? ` ×${crop.harvestCountMin}`
                          : ` ×${crop.harvestCountMin}–${crop.harvestCountMax}`}
                      </span>
                    )}
                  </>
                ) : '—'}
              </div>

              {/* Gold per day */}
              <div className="crop-row__gpd">
                {gpd ? <strong>{gpd}g</strong> : '—'}
              </div>

              {/* Remaining harvests (save-aware) */}
              {saveContext && (
                <div className="crop-row__harvests">
                  {harvestsLeft === null
                    ? <span className="crop-row__harvests--na">—</span>
                    : harvestsLeft === 0
                      ? <span className="crop-row__harvests--zero">✗</span>
                      : <strong>{harvestsLeft}</strong>
                  }
                </div>
              )}
            </div>
          );
        })}

        {crops.length === 0 && (
          <p className="page-empty">No crops available this season.</p>
        )}
      </div>
    </div>
  );
}
