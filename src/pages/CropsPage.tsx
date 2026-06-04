import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { SeasonSelector } from '../components/common/SeasonSelector';
import { SeasonPips } from '../components/common/SeasonPips';
import { ViewToggle } from '../components/common/ViewToggle';
import { MultiSort, useMultiSort } from '../components/common/MultiSort';
import type { ActiveSort, SortFieldDef } from '../components/common/MultiSort';
import { useViewMode } from '../hooks/useViewMode';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Crop, Season } from '../types/game';

type SeasonFilter = Season | 'all';

const SEASON_DAYS = 28;

/**
 * Remaining harvests achievable from one seed planted today.
 * Returns 0 if the crop cannot be planted with enough time to harvest.
 */
function remainingHarvests(
  growDays: number,
  regrowDays: number | null | undefined,
  currentDay: number,
): number {
  const daysLeft = SEASON_DAYS - currentDay;
  if (growDays > daysLeft) return 0;
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
    const remainingDays = Math.max(0, SEASON_DAYS - growDays);
    const extraHarvests = Math.floor(remainingDays / regrowDays);
    const totalHarvests = 1 + extraHarvests;
    const seasonProfit  = sellValue * avgHarvest * totalHarvests - seedCost;
    return seasonProfit / SEASON_DAYS;
  }
  return (sellValue * avgHarvest - seedCost) / growDays;
}

const DEFAULT_CROP_SORTS: ActiveSort[] = [{ fieldId: 'name', direction: 'asc' }];

export function CropsPage() {
  usePageTitle('Crops');
  const { data, loading, error } = useGameData();
  const { activeSave, settings } = useUserData();
  const [season,   setSeason]   = useState<SeasonFilter>('spring');
  const [sorts,    setSorts]    = useState<ActiveSort[]>(DEFAULT_CROP_SORTS);
  const [viewMode, setViewMode] = useViewMode('crops', 'table');

  const itemMap = useMemo(
    () => new Map((data?.items ?? []).map((i) => [i.cheatId, i])),
    [data],
  );

  // Sort field definitions — value/gpd comparators close over itemMap
  const cropSortFields = useMemo<SortFieldDef<Crop>[]>(() => [
    {
      id: 'name',
      label: 'Name',
      compareFn: (a, b) => a.name.localeCompare(b.name),
      defaultDirection: 'asc',
    },
    {
      id: 'value',
      label: 'Sell Value',
      compareFn: (a, b) =>
        (itemMap.get(a.harvestItemId)?.sellValue ?? 0) -
        (itemMap.get(b.harvestItemId)?.sellValue ?? 0),
      defaultDirection: 'desc',
    },
    {
      id: 'days',
      label: 'Grow Days',
      compareFn: (a, b) => a.growDays - b.growDays,
      defaultDirection: 'asc',
    },
    {
      id: 'gpd',
      label: 'Gold/Day',
      compareFn: (a, b) => {
        const calc = (c: Crop) => {
          const item = itemMap.get(c.harvestItemId);
          const seed = itemMap.get(c.seedItemId);
          const avg  = (c.harvestCountMin + c.harvestCountMax) / 2;
          return netGoldPerDay(
            item?.sellValue ?? 0, avg, c.growDays, c.regrowDays,
            seed?.soldBy?.[0]?.price ?? 0,
          );
        };
        return calc(a) - calc(b);
      },
      defaultDirection: 'desc',
    },
  ], [itemMap]);

  // Active save context for "remaining harvests" column
  const saveContext = useMemo(() => {
    if (!settings.tailorToSave || !activeSave?.season || !activeSave.day) return null;
    return { season: activeSave.season as Season, day: activeSave.day };
  }, [activeSave, settings]);

  // Filtering — in useMemo so useMultiSort can be called before early returns
  const filtered = useMemo(() => {
    const all = data?.crops ?? [];
    return all.filter((c) => season === 'all' || c.seasons.includes(season as Season));
  }, [data, season]);

  // Multi-sort — must be called before any conditional returns
  const sorted = useMultiSort(filtered, sorts, cropSortFields);

  if (loading) return <div className="page-loading">Loading crops</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page page--crops">
      <h1 className="page__title">Crops</h1>
      <p className="page__subtitle">Planting windows, grow times, sell values, and gold-per-day for every crop.</p>

      <SeasonSelector value={season} onChange={(v) => setSeason(v as SeasonFilter)} />

      {/* Sort bar */}
      <div className="fish-sort-bar">
        <MultiSort fields={cropSortFields} value={sorts} onChange={setSorts} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* ── Tile view ── */}
      {viewMode === 'tile' && (
        <div className="crop-grid">
          {sorted.map((crop) => {
            const harvestItem  = itemMap.get(crop.harvestItemId);
            const seedItem     = itemMap.get(crop.seedItemId);
            const avgHarvest   = (crop.harvestCountMin + crop.harvestCountMax) / 2;
            const seedBuyPrice = seedItem?.soldBy?.[0]?.price ?? 0;
            const gpd = harvestItem
              ? netGoldPerDay(harvestItem.sellValue, avgHarvest, crop.growDays, crop.regrowDays, seedBuyPrice).toFixed(1)
              : null;
            const primarySeason = crop.seasons[0] ?? 'spring';
            return (
              <div key={crop.id} className={`crop-tile crop-tile--${primarySeason}`}>
                <div className="crop-tile__header">
                  <div className="crop-tile__sprite">
                    {harvestItem?.spriteSheet && harvestItem.spriteIndex !== undefined ? (
                      <SpriteIcon spriteSheet={harvestItem.spriteSheet} spriteIndex={harvestItem.spriteIndex} size={28} />
                    ) : <span className="crop-tile__sprite--ph">?</span>}
                  </div>
                  <Link to={`/items/${harvestItem?.id ?? crop.id}`} className="crop-tile__name">
                    {crop.name}
                  </Link>
                </div>
                <SeasonPips seasons={crop.seasons} />
                <div className="crop-tile__stats">
                  <span className="crop-tile__days">{crop.growDays}d{crop.regrowDays ? ` +${crop.regrowDays}d` : ''}</span>
                  <span className="crop-tile__sell">{harvestItem?.sellValue ?? '—'}g</span>
                  {gpd && <span className="crop-tile__gpd">{gpd}g/d</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table view ── */}
      {viewMode === 'table' && (
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

          {sorted.map((crop) => {
            const harvestItem  = itemMap.get(crop.harvestItemId);
            const seedItem     = itemMap.get(crop.seedItemId);
            const growPct      = Math.min(crop.growDays / SEASON_DAYS * 100, 100);
            const regrowPct    = crop.regrowDays ? Math.min(crop.regrowDays / SEASON_DAYS * 100, 100) : 0;
            const avgHarvest   = (crop.harvestCountMin + crop.harvestCountMax) / 2;
            const seedBuyPrice = seedItem?.soldBy?.[0]?.price ?? 0;
            const gpd = harvestItem
              ? netGoldPerDay(harvestItem.sellValue, avgHarvest, crop.growDays, crop.regrowDays, seedBuyPrice).toFixed(1)
              : null;
            const harvestsLeft = (saveContext && crop.seasons.includes(saveContext.season))
              ? remainingHarvests(crop.growDays, crop.regrowDays, saveContext.day)
              : null;
            const primarySeason = crop.seasons[0] ?? 'spring';

            return (
              <div key={crop.id} className={`crop-row crop-row--${primarySeason}${harvestsLeft === 0 ? ' crop-row--cant-plant' : ''}`}>
                <div className="crop-row__name">
                  {harvestItem?.spriteSheet && harvestItem.spriteIndex !== undefined ? (
                    <div className="crop-row__icon">
                      <SpriteIcon spriteSheet={harvestItem.spriteSheet} spriteIndex={harvestItem.spriteIndex} size={28} />
                    </div>
                  ) : (
                    <div className="crop-row__icon crop-row__icon--placeholder">?</div>
                  )}
                  <div className="crop-row__name-body">
                    <Link to={`/items/${harvestItem?.id ?? crop.id}`} className="crop-row__link">{crop.name}</Link>
                    <div className="crop-row__meta">
                      {seedItem && (
                        <>
                          <Link to={`/items/${seedItem.id}`} className="crop-row__seed">{seedItem.name}</Link>
                          {seedBuyPrice > 0 && <span className="crop-row__seed-price">{seedBuyPrice}g</span>}
                        </>
                      )}
                      {crop.seasons.length > 1  && <span className="crop-badge crop-badge--multi">Multi-season</span>}
                      {crop.trellisCrop         && <span className="crop-badge crop-badge--trellis">Trellis</span>}
                      {crop.canBeGiantCrop      && <span className="crop-badge crop-badge--giant">Giant</span>}
                      {crop.isPaddyCrop         && <span className="crop-badge crop-badge--paddy">Paddy</span>}
                    </div>
                  </div>
                </div>

                <div className="crop-row__seasons">
                  {(['spring','summer','fall','winter'] as Season[]).map((s) => (
                    <span key={s} className={`season-pip season-pip--${s}${crop.seasons.includes(s) ? ' season-pip--on' : ''}`} title={s} />
                  ))}
                </div>

                <div className="crop-row__growth">
                  <div className="grow-bar">
                    <div className="grow-bar__initial" style={{ width: `${growPct}%` }} title={`${crop.growDays} days to first harvest`} />
                    {regrowPct > 0 && (
                      <div className="grow-bar__regrow" style={{ left: `${growPct}%`, width: `${Math.min(regrowPct, 100 - growPct)}%` }} title={`Regrows every ${crop.regrowDays} days`} />
                    )}
                  </div>
                  <span className="grow-bar__label">{crop.growDays}d{crop.regrowDays && ` +${crop.regrowDays}d`}</span>
                </div>

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

                <div className="crop-row__gpd">{gpd ? <strong>{gpd}g</strong> : '—'}</div>

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

          {sorted.length === 0 && (
            <p className="page-empty">No crops available this season.</p>
          )}
        </div>
      )}
    </div>
  );
}
