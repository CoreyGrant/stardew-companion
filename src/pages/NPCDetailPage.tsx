import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNPCDetail } from '../hooks/useNPCDetail';
import { usePageTitle } from '../hooks/usePageTitle';
import { useUserData } from '../contexts/UserDataContext';
import { Panel } from '../components/common/Panel';
import { GameLink } from '../components/common/GameLink';
import { GiftTag } from '../components/common/GiftTag';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { bestVariant, bestVariantEntries } from '../utils/scheduleUtils';
import type { GiftTaste, ItemRef, Season, Weather } from '../types/game';

const GIFT_TASTES: GiftTaste[] = ['loved', 'liked'];

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const m = t % 100;
  const suffix = h >= 12 ? 'pm' : 'am';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')}${suffix}`;
}

function GiftList({ items, taste }: { items: ItemRef[]; taste: GiftTaste }) {
  if (items.length === 0) return null;
  return (
    <div className="gift-section">
      <GiftTag taste={taste} />
      <ul className="gift-section__list">
        {items.map((item) => (
          <li key={item.id}>
            <GameLink type="item" id={item.id}>{item.name}</GameLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NPCDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { npc, gifts, loading, error, isMarried } = useNPCDetail(id);
  const { activeSave } = useUserData();
  const heartLevel = npc && activeSave?.heartLevels ? activeSave.heartLevels[npc.id] : undefined;
  const base = import.meta.env.BASE_URL;
  usePageTitle(npc?.name ?? 'Character');

  // Schedule filter state — defaults to save's current date if available
  const [schedSeason, setSchedSeason] = useState<Season>(() => activeSave?.season ?? 'spring');
  const [schedDay,    setSchedDay]    = useState<number>(() => activeSave?.day    ?? 1);
  const [schedYear,   setSchedYear]   = useState(1);
  const [schedWeather, setSchedWeather] = useState<Weather>('sunny');
  const [showAllVariants, setShowAllVariants] = useState(false);

  if (loading) return <div className="page-loading">Loading…</div>;
  if (error)   return <div className="page-error">{error}</div>;
  if (!npc)    return <div className="page-error">Character not found.</div>;

  const matchedVariant = bestVariant(npc, schedSeason, schedWeather, schedYear, isMarried, schedDay);
  const matchedEntries = bestVariantEntries(npc, schedSeason, schedWeather, schedYear, isMarried, schedDay);

  return (
    <div className="page page--npc-detail">
      <Link to="/characters" className="back-link">← Characters</Link>

      <div className="npc-hero">
        <div className="npc-hero__portrait" aria-hidden="true">
          {npc.portrait ? (
            <img
              src={`${base}sprites/portraits/${npc.portrait}`}
              alt=""
              style={{ width: 64, height: 64, imageRendering: 'pixelated', objectFit: 'none', objectPosition: '0 0' }}
            />
          ) : npc.name.charAt(0)}
        </div>
        <div className="npc-hero__info">
          <h1 className="npc-hero__name">
            {npc.name}
            {isMarried && <span className="npc-hero__married-badge">Married</span>}
          </h1>
          <p className="npc-hero__birthday">
            Birthday:{' '}
            <strong>
              {npc.birthday.season.charAt(0).toUpperCase() + npc.birthday.season.slice(1)}{' '}
              {npc.birthday.day}
            </strong>
          </p>
          <p className="npc-hero__home">Lives at: {npc.address}</p>
          {heartLevel !== undefined && (
            <p className="npc-hero__hearts" aria-label={`${heartLevel} hearts`}>
              {'♥'.repeat(heartLevel)}
              {'♡'.repeat(Math.max(0, (npc.marriageable ? 10 : 8) - heartLevel))}
              <span className="npc-hero__hearts-label">{heartLevel}/{npc.marriageable ? 10 : 8}</span>
            </p>
          )}
          {npc.marriageable && <span className="badge badge--marriageable">Marriageable</span>}
        </div>
      </div>

      {npc.description && (
        <Panel title="About">
          <p>{npc.description}</p>
        </Panel>
      )}

      <Panel title="Gift Preferences">
        <div className="gift-table">
          {GIFT_TASTES.map((taste) => (
            <GiftList key={taste} items={gifts[taste]} taste={taste} />
          ))}
        </div>
      </Panel>

      {/* ── Schedule section ───────────────────────────────────────────────── */}
      <div className="schedule-section">
        <h2 className="section-title">Schedule</h2>

        {/* Date filter */}
        <div className="schedule-section__filter">
          <StardewDateInput
            season={schedSeason}
            day={schedDay}
            year={schedYear}
            weather={schedWeather}
            onSeasonChange={setSchedSeason}
            onDayChange={setSchedDay}
            onYearChange={setSchedYear}
            onWeatherChange={setSchedWeather}
            showYear
            showWeather
          />
        </div>

        {/* Best-matching schedule */}
        {matchedVariant && (
          <div className="schedule-match">
            <div className="schedule-match__label">
              Showing: <strong>{matchedVariant.label}</strong>
            </div>
            <ol className="schedule-timeline">
              {matchedEntries.map((entry) => (
                <li key={entry.time} className="schedule-timeline__entry">
                  <span className="schedule-timeline__time">{formatTime(entry.time)}</span>
                  <span className="schedule-timeline__arrow">→</span>
                  <span className="schedule-timeline__location">{entry.location}</span>
                  {entry.description && (
                    <span className="schedule-timeline__desc">{entry.description}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        {!matchedVariant && (
          <p className="schedule-section__empty">No schedule found for these conditions.</p>
        )}

        {/* All variants toggle */}
        {npc.schedules.length > 1 && (
          <details
            className="schedule-all"
            open={showAllVariants}
            onToggle={(e) => setShowAllVariants((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="schedule-all__summary">
              All variants ({npc.schedules.length})
            </summary>
            <div className="schedule-all__list">
              {npc.schedules.map((variant) => (
                <div key={variant.id} className="schedule-all__variant">
                  <div className="schedule-all__variant-label">{variant.label}</div>
                  <ol className="schedule-timeline schedule-timeline--compact">
                    {variant.entries.map((entry) => (
                      <li key={entry.time} className="schedule-timeline__entry">
                        <span className="schedule-timeline__time">{formatTime(entry.time)}</span>
                        <span className="schedule-timeline__arrow">→</span>
                        <span className="schedule-timeline__location">{entry.location}</span>
                        {entry.description && (
                          <span className="schedule-timeline__desc">{entry.description}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
