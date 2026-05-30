import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../../contexts/GameDataContext';
import type { SaveFile } from '../../types/save';
import type { Season, NPC } from '../../types/game';

const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter',
};

/** Convert (season, day) to an ordinal day-of-year, 0-indexed (0 = Spring 1). */
function toDayOrdinal(season: Season, day: number): number {
  return SEASONS.indexOf(season) * 28 + (day - 1);
}

/** Days from current ordinal to target ordinal (wraps around 112-day year). */
function daysUntil(currentOrd: number, targetOrd: number): number {
  return ((targetOrd - currentOrd + 112) % 112);
}

interface UpcomingBirthday {
  npc: NPC;
  daysAway: number;
  season: Season;
  day: number;
}

/** Find NPCs whose birthdays fall in the next `windowDays` days (inclusive of today). */
function getUpcomingBirthdays(
  npcs: NPC[],
  currentSeason: Season,
  currentDay: number,
  windowDays: number,
): UpcomingBirthday[] {
  const currentOrd = toDayOrdinal(currentSeason, currentDay);
  return npcs
    .map((npc) => {
      const targetOrd = toDayOrdinal(npc.birthday.season, npc.birthday.day);
      const days = daysUntil(currentOrd, targetOrd);
      return { npc, daysAway: days, season: npc.birthday.season, day: npc.birthday.day };
    })
    .filter((b) => b.daysAway <= windowDays)
    .sort((a, b) => a.daysAway - b.daysAway);
}

interface Props {
  activeSave: SaveFile;
}

export function BirthdayWidget({ activeSave }: Props) {
  const { data } = useGameData();

  const currentSeason: Season = activeSave.season ?? 'spring';
  const currentDay: number    = activeSave.day ?? 1;

  const upcoming = useMemo(() => {
    if (!data) return [];
    return getUpcomingBirthdays(data.npcs, currentSeason, currentDay, 6);
  }, [data, currentSeason, currentDay]);

  if (upcoming.length === 0) {
    return (
      <div className="birthday-widget">
        <h3 className="birthday-widget__title">🎂 Upcoming Birthdays</h3>
        <p className="birthday-widget__empty">No birthdays in the next week.</p>
      </div>
    );
  }

  return (
    <div className="birthday-widget">
      <h3 className="birthday-widget__title">🎂 Upcoming Birthdays</h3>
      <ul className="birthday-widget__list">
        {upcoming.map(({ npc, daysAway, season, day }) => {
          const isToday = daysAway === 0;
          const portraitSrc = npc.portrait
            ? `${import.meta.env.BASE_URL}sprites/portraits/${npc.portrait}`
            : null;

          return (
            <li key={npc.id} className={`birthday-row${isToday ? ' birthday-row--today' : ''}`}>
              {portraitSrc ? (
                <span
                  className="birthday-row__portrait"
                  aria-hidden="true"
                  style={{ overflow: 'hidden', width: 24, height: 24 }}
                >
                  <img
                    src={portraitSrc}
                    alt=""
                    style={{
                      width: 64,
                      height: 64,
                      imageRendering: 'pixelated',
                      transform: 'scale(0.375)',
                      transformOrigin: '0 0',
                      display: 'block',
                    }}
                  />
                </span>
              ) : (
                <span className="birthday-row__portrait birthday-row__portrait--fallback" aria-hidden="true">
                  {npc.name.charAt(0)}
                </span>
              )}
              <Link to={`/characters/${npc.id}`} className="birthday-row__name">
                {npc.name}
              </Link>
              <span className="birthday-row__date">
                {SEASON_LABEL[season]} {day}
              </span>
              <span className={`birthday-row__countdown${isToday ? ' birthday-row__countdown--today' : ''}`}>
                {isToday ? '🎂 Today!' : daysAway === 1 ? 'Tomorrow' : `in ${daysAway}d`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
