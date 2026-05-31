import { useState } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { SeasonSelector } from '../components/common/SeasonSelector';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Season } from '../types/game';

const BASE = import.meta.env.BASE_URL;

// ── Static festival data ──────────────────────────────────────────────────────

interface Festival {
  name: string;
  emoji: string;
  /** day numbers (1-indexed) the festival occupies */
  days: number[];
}

const FESTIVALS: Record<Season, Festival[]> = {
  spring: [
    { name: 'Egg Festival',     emoji: '🥚', days: [13] },
    { name: 'Desert Festival',  emoji: '🌵', days: [15, 16, 17] },
    { name: 'Flower Dance',     emoji: '💐', days: [24] },
  ],
  summer: [
    { name: 'Luau',                        emoji: '🌺', days: [11] },
    { name: 'Trout Derby',                 emoji: '🎣', days: [20, 21] },
    { name: 'Dance of the Moonlight Jellies', emoji: '🌙', days: [28] },
  ],
  fall: [
    { name: "Stardew Valley Fair", emoji: '🎡', days: [16] },
    { name: "Spirit's Eve",        emoji: '🎃', days: [27] },
  ],
  winter: [
    { name: 'Festival of Ice',         emoji: '⛸', days: [8] },
    { name: 'Squid Fest',              emoji: '🦑', days: [12, 13] },
    { name: 'Night Market',            emoji: '🌟', days: [15, 16, 17] },
    { name: 'Feast of the Winter Star',emoji: '🎁', days: [25] },
  ],
};

/** Last planting day = 28 - growDays, min 1. Planted day does not count as a growth day. */
function lastPlantDay(growDays: number): number {
  return Math.max(1, 28 - growDays);
}

export function SeasonalCalendarPage() {
  usePageTitle('Seasonal Calendar');
  const { data, loading, error } = useGameData();
  const { activeSave } = useUserData();
  const [season, setSeason] = useState<Season>(
    (activeSave?.season as Season | undefined) ?? 'spring',
  );
  const [showCrops, setShowCrops] = useState(true);

  // Save-aware "today" day (1-28), only when season matches
  const todayDay: number | null =
    activeSave?.season === season && activeSave?.day != null
      ? activeSave.day
      : null;

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  // Build day → NPCs map for this season
  const birthdayMap = new Map<number, NonNullable<typeof data>['npcs']>();
  for (const npc of data?.npcs ?? []) {
    if (npc.birthday.season === season) {
      const day = npc.birthday.day;
      if (!birthdayMap.has(day)) birthdayMap.set(day, []);
      birthdayMap.get(day)!.push(npc);
    }
  }

  // Build day → festivals map for this season
  const festivalMap = new Map<number, Festival[]>();
  for (const fest of FESTIVALS[season]) {
    for (const d of fest.days) {
      if (!festivalMap.has(d)) festivalMap.set(d, []);
      festivalMap.get(d)!.push(fest);
    }
  }

  // Build crop last-plant-day map: day → crops that should be planted on or before that day.
  // For multi-season crops the last planting day is always day 1 of their first season
  // (they must be planted then to span across seasons). We only show them in their first season.
  const cropDeadlineMap = new Map<number, NonNullable<typeof data>['crops']>();
  if (showCrops) {
    for (const crop of data?.crops ?? []) {
      if (!crop.seasons.includes(season)) continue;
      // Skip crops that take more than a full season to grow (growDays=28 is still valid — plant Day 1)
      if (crop.growDays > 28) continue;

      const isMultiSeason = crop.seasons.length > 1;
      if (isMultiSeason) {
        // Only show in the first season they grow
        if (crop.seasons[0] !== season) continue;
        // Last planting day: must be planted early enough to finish before their LAST season ends
        // Effectively can be planted any time — but day 1 is the real answer. We still add them.
        const lpd = 1;
        if (!cropDeadlineMap.has(lpd)) cropDeadlineMap.set(lpd, []);
        cropDeadlineMap.get(lpd)!.push(crop);
      } else {
        const lpd = lastPlantDay(crop.growDays);
        if (!cropDeadlineMap.has(lpd)) cropDeadlineMap.set(lpd, []);
        cropDeadlineMap.get(lpd)!.push(crop);
      }
    }
  }

  const days = Array.from({ length: 28 }, (_, i) => i + 1);

  return (
    <div className="page page--calendar">
      <h1 className="page__title">Seasonal Calendar</h1>
      <p className="page__subtitle">Festivals, birthdays, and crop planting deadlines for every season.</p>

      {/* Season selector */}
      <div className="season-selector-row">
        <SeasonSelector
          value={season}
          onChange={(v) => setSeason(v as Season)}
          includeAll={false}
        />
        {activeSave?.season && activeSave?.day && (
          <button
            className="btn btn--sm"
            onClick={() => setSeason(activeSave.season as Season)}
            title={`Jump to ${activeSave.season} Day ${activeSave.day}`}
          >
            📅 Today
          </button>
        )}
      </div>

      {/* Options */}
      <div className="calendar-options">
        <label className="calendar-options__toggle">
          <input
            type="checkbox"
            checked={showCrops}
            onChange={e => setShowCrops(e.target.checked)}
          />
          Show last planting day for crops
        </label>
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <span className="calendar-legend__item calendar-legend__item--festival">🎉 Festival</span>
        <span className="calendar-legend__item calendar-legend__item--birthday">🎂 Birthday</span>
        {showCrops && (
          <span className="calendar-legend__item calendar-legend__item--crop">🌱 Last planting day</span>
        )}
      </div>

      {/* Calendar grid */}
      <div className="calendar-grid" data-season={season}>
        {/* Day-of-week header */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="calendar-grid__dow">{d}</div>
        ))}

        {days.map(day => {
          const npcs     = birthdayMap.get(day) ?? [];
          const fests    = festivalMap.get(day) ?? [];
          const cropDead = cropDeadlineMap.get(day) ?? [];
          const isFestival = fests.length > 0;
          const isBirthday = npcs.length > 0;
          const hasCrop    = cropDead.length > 0;

          const isToday = todayDay === day;
          return (
            <div
              key={day}
              className={[
                'cal-day',
                isFestival ? 'cal-day--festival' : '',
                isBirthday ? 'cal-day--birthday' : '',
                isToday    ? 'cal-day--today'    : '',
              ].filter(Boolean).join(' ')}
              aria-current={isToday ? 'date' : undefined}
            >
              <span className="cal-day__number">{day}</span>

              {/* Festival entries */}
              {fests.map((f, i) => (
                <div key={i} className="cal-day__event cal-day__event--festival" title={f.name}>
                  <span className="cal-day__event-emoji">{f.emoji}</span>
                  <span className="cal-day__event-name">{f.name}</span>
                </div>
              ))}

              {/* Birthday entries */}
              {npcs.map(npc => (
                <div key={npc.id} className="cal-day__event cal-day__event--birthday" title={`${npc.name}'s Birthday`}>
                  {npc.portrait ? (
                    <span
                      className="cal-day__portrait"
                      style={{
                        backgroundImage: `url(${BASE}sprites/portraits/${npc.portrait})`,
                      }}
                      aria-label={npc.name}
                    />
                  ) : (
                    <span className="cal-day__event-emoji">🎂</span>
                  )}
                  <span className="cal-day__event-name">{npc.name}</span>
                </div>
              ))}

              {/* Crop deadline entries */}
              {hasCrop && (
                <div
                  className="cal-day__event cal-day__event--crop"
                  title={`Last planting day: ${cropDead.map(c => c.name).join(', ')}`}
                >
                  <span className="cal-day__event-emoji">🌱</span>
                  <span className="cal-day__event-name">
                    {cropDead.length === 1
                      ? `Plant ${cropDead[0].name}`
                      : `Plant ${cropDead.length} crops`}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Crop deadline detail list (when showCrops) */}
      {showCrops && (
        <div className="calendar-crop-list">
          <h2 className="calendar-crop-list__title">Crop Planting Deadlines — {season.charAt(0).toUpperCase() + season.slice(1)}</h2>
          <table className="calendar-crop-list__table">
            <thead>
              <tr>
                <th>Crop</th>
                <th>Grow Days</th>
                <th>Last Planting Day</th>
                <th>Harvests Possible</th>
              </tr>
            </thead>
            <tbody>
              {(data?.crops ?? [])
                .filter(c => c.seasons.includes(season) && c.growDays < 28 &&
                  // Multi-season: only show in first season
                  (c.seasons.length === 1 || c.seasons[0] === season))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(crop => {
                  const isMulti = crop.seasons.length > 1;
                  const lpd      = isMulti ? 1 : lastPlantDay(crop.growDays);
                  const harvests = isMulti ? '—'
                    : crop.regrowDays
                      ? String(1 + Math.floor((28 - crop.growDays) / crop.regrowDays)) + '×'
                      : String(Math.floor(28 / crop.growDays)) + '×';
                  return (
                    <tr key={crop.id}>
                      <td className="calendar-crop-list__name">
                        {crop.name}
                        {isMulti && crop.seasons
                          .filter(s => s !== season)
                          .map(s => (
                            <span key={s} className={`calendar-crop-list__season-tag calendar-crop-list__season-tag--${s}`}>
                              +{s.charAt(0).toUpperCase() + s.slice(1)}
                            </span>
                          ))
                        }
                      </td>
                      <td className="calendar-crop-list__days">{crop.growDays}d{crop.regrowDays ? ` +${crop.regrowDays}d` : ''}</td>
                      <td className={`calendar-crop-list__lpd${!isMulti && lpd <= 7 ? ' calendar-crop-list__lpd--early' : ''}`}>
                        {isMulti ? 'Day 1 (plant early!)' : `Day ${lpd}`}
                      </td>
                      <td className="calendar-crop-list__harvests">{harvests}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
