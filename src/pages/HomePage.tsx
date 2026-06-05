import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { usePageTitle } from '../hooks/usePageTitle';
import type { Season } from '../types/game';

const BASE = import.meta.env.BASE_URL;

const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter',
};

function toDayOrdinal(season: Season, day: number): number {
  return SEASONS.indexOf(season) * 28 + (day - 1);
}

function daysUntil(currentOrd: number, targetOrd: number): number {
  return (targetOrd - currentOrd + 112) % 112;
}

function nextSeason(s: Season): Season {
  return SEASONS[(SEASONS.indexOf(s) + 1) % 4];
}

const HERO_LINKS = [
  { to: '/saves',        emoji: '💾', label: 'Saves',        desc: 'Manage your playthroughs' },
  { to: '/farm-planner', emoji: '🏡', label: 'Farm Planner', desc: 'Design your farm layout'  },
  { to: '/gifts',        emoji: '🎁', label: 'Gift Guide',   desc: 'What every villager loves' },
];

export function HomePage() {
  usePageTitle('Home');
  const { activeSave } = useUserData();
  const { data }       = useGameData();

  const season: Season = activeSave?.season ?? 'spring';
  const day: number    = activeSave?.day    ?? 1;
  const year: number   = activeSave?.year   ?? 1;
  // Days remaining in the season, counting today
  const daysLeft = 28 - day + 1;

  // NPCs with birthdays in the next 7 days (inclusive of today)
  const upcomingBirthdays = useMemo(() => {
    if (!data || !activeSave) return [];
    const currentOrd = toDayOrdinal(season, day);
    return data.npcs
      .filter(n => n.birthday)
      .map(n => ({
        npc:      n,
        daysAway: daysUntil(currentOrd, toDayOrdinal(n.birthday.season, n.birthday.day)),
      }))
      .filter(b => b.daysAway <= 7)
      .sort((a, b) => a.daysAway - b.daysAway);
  }, [data, activeSave, season, day]);

  // Non-trap, non-legendary fish available this season but NOT next season
  const expiringFish = useMemo(() => {
    if (!data || !activeSave) return [];
    const next = nextSeason(season);
    return data.fish.filter(
      f => !f.trapFish && !f.legendary &&
           f.seasons.includes(season) &&
           !f.seasons.includes(next),
    );
  }, [data, activeSave, season]);

  return (
    <div className="page page--home">

      {/* ── Hero banner ── */}
      <section className="home-hero">
        <div className="home-hero__text">
          <h1 className="home-hero__title">Stardew Companion</h1>
          <p className="home-hero__tagline">Your complete Stardew Valley 1.6 companion</p>
        </div>
        <nav className="home-hero__links" aria-label="Quick links">
          {HERO_LINKS.map(l => (
            <Link key={l.to} to={l.to} className="home-hero__link">
              <span className="home-hero__link-icon" aria-hidden="true">{l.emoji}</span>
              <span className="home-hero__link-label">{l.label}</span>
              <span className="home-hero__link-desc">{l.desc}</span>
            </Link>
          ))}
        </nav>
      </section>

      {/* ── Dashboard (save loaded) ── */}
      {activeSave ? (
        <section className="home-dash" aria-label="Today's dashboard">

          {/* Today */}
          <div className={`dash-card dash-card--today dash-card--${season}`}>
            <div className="dash-card__heading">📅 Today</div>
            <div className="dash-today__date">
              {SEASON_LABEL[season]} {day}
              <span className="dash-today__year">Year {year}</span>
            </div>
            <div className="dash-today__bar-wrap" title={`Day ${day} of 28`}>
              <div
                className="dash-today__bar-fill"
                style={{ width: `${((day - 1) / 27) * 100}%` }}
              />
            </div>
            <div className="dash-today__days-left">
              {daysLeft === 1
                ? `Last day of ${SEASON_LABEL[season]}`
                : `${daysLeft} days left in ${SEASON_LABEL[season]}`}
            </div>
          </div>

          {/* Upcoming birthdays */}
          <div className="dash-card dash-card--birthdays">
            <div className="dash-card__heading">🎂 Upcoming Birthdays</div>
            {upcomingBirthdays.length === 0 ? (
              <p className="dash-empty">No birthdays in the next week.</p>
            ) : (
              <ul className="dash-bday-list">
                {upcomingBirthdays.map(({ npc, daysAway }) => {
                  const isToday     = daysAway === 0;
                  const portraitSrc = npc.portrait
                    ? `${BASE}sprites/portraits/${npc.portrait}`
                    : null;
                  return (
                    <li key={npc.id} className={`dash-bday-row${isToday ? ' dash-bday-row--today' : ''}`}>
                      {/* Portrait */}
                      <span className="dash-bday-row__portrait" aria-hidden="true">
                        {portraitSrc ? (
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
                        ) : (
                          <span className="dash-bday-row__initial">{npc.name.charAt(0)}</span>
                        )}
                      </span>
                      {/* Name → character page */}
                      <Link to={`/characters/${npc.id}`} className="dash-bday-row__name">
                        {npc.name}
                      </Link>
                      {/* Date */}
                      <span className="dash-bday-row__date">
                        {SEASON_LABEL[npc.birthday.season]} {npc.birthday.day}
                      </span>
                      {/* Countdown */}
                      <span className={`dash-bday-row__when${isToday ? ' dash-bday-row__when--today' : ''}`}>
                        {isToday ? '🎂 Today!' : daysAway === 1 ? 'Tomorrow' : `in ${daysAway}d`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Expiring / season-only fish */}
          <div className="dash-card dash-card--expiring">
            <div className="dash-card__heading">
              {daysLeft <= 7 ? '⏳ Expiring Soon' : '🎣 This Season Only'}
            </div>

            {/* Urgency banner when running low on time */}
            {daysLeft <= 7 && (
              <div className="dash-expiring__urgency">
                {daysLeft === 1 ? 'Last day!' : `${daysLeft} days left`}
                {' '}— catch these before {SEASON_LABEL[season]} ends
              </div>
            )}

            {expiringFish.length === 0 ? (
              <p className="dash-empty">All fish are available year-round.</p>
            ) : (
              <>
                <ul className="dash-expiring__list">
                  {expiringFish.slice(0, 8).map(f => (
                    <li key={f.id} className="dash-expiring__item">
                      <span className="dash-expiring__icon" aria-hidden="true">🐟</span>
                      <span className="dash-expiring__name">{f.name}</span>
                      {/* Rain-only indicator */}
                      {'weather' in f && (f as { weather: string }).weather === 'rain' && (
                        <span className="dash-expiring__weather" title="Rain only">🌧</span>
                      )}
                    </li>
                  ))}
                </ul>
                {expiringFish.length > 8 && (
                  <p className="dash-expiring__more">
                    +{expiringFish.length - 8} more —{' '}
                    <Link to="/fish">see all fish</Link>
                  </p>
                )}
                <Link to="/fish" className="dash-expiring__link">View fish guide →</Link>
              </>
            )}
          </div>

        </section>
      ) : (
        /* ── No save loaded ── */
        <section className="home-no-save" aria-label="Load a save">
          <span className="home-no-save__icon" aria-hidden="true">🌱</span>
          <div className="home-no-save__text">
            <strong>Load a save to unlock your dashboard</strong>
            <p>
              See your in-game date, upcoming birthdays and what fish are only
              catchable before the season ends — all tailored to your playthrough.
            </p>
          </div>
          <Link to="/saves" className="btn btn--primary">Open Saves →</Link>
        </section>
      )}
    </div>
  );
}
