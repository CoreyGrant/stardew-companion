import { useScheduleViewer } from '../hooks/useScheduleViewer';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { PortraitImg } from '../components/common/PortraitImg';
import { GameLink } from '../components/common/GameLink';
import { usePageTitle } from '../hooks/usePageTitle';

const BASE = import.meta.env.BASE_URL;

// ── Timeline constants ─────────────────────────────────────────────────────────
// 20 one-hour columns from 6 am (600) to 2 am next day (2600)

const RANGE_START = 600;
const RANGE_END   = 2600;
const RANGE       = RANGE_END - RANGE_START; // 2000 SDV time units

// Hour boundaries for grid lines (21 marks = 20 columns)
const GRID_HOURS = Array.from({ length: 21 }, (_, i) => RANGE_START + i * 100);

// Every-2-hour labels shown in the header
const LABEL_HOURS = GRID_HOURS.filter((_, i) => i % 2 === 0); // 6am 8am … 2am

/** Clamp t to [RANGE_START, RANGE_END] then convert to a % position. */
function pct(t: number): number {
  return (Math.max(RANGE_START, Math.min(RANGE_END, t)) - RANGE_START) / RANGE * 100;
}

/** Format an SDV time value as a short 12h string (no minutes for whole hours). */
function formatHour(t: number): string {
  let h = Math.floor(t / 100);
  if (h >= 24) h -= 24;               // wrap midnight (24→0, 25→1, 26→2)
  const pm      = h >= 12;
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}${pm ? 'pm' : 'am'}`;
}

/** Format an SDV time value including minutes (for tooltip). */
function formatTime(t: number): string {
  let h = Math.floor(t / 100);
  const m = t % 100;
  if (h >= 24) h -= 24;
  const pm      = h >= 12;
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const mins    = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
  return `${display}${mins}${pm ? 'pm' : 'am'}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ScheduleViewerPage() {
  usePageTitle('Villager Schedules');
  const {
    loading,
    season, setSeason,
    day, setDay,
    weather, setWeather,
    year, setYear,
    search, setSearch,
    dayName,
    npcRows,
  } = useScheduleViewer();

  if (loading) return <div className="page-loading">Loading</div>;

  const seasonLabel = season.charAt(0).toUpperCase() + season.slice(1);

  return (
    <div className="page page--schedule">
      <h1 className="page__title">Villager Schedules</h1>
      <p className="page__subtitle">Where is everyone on a given day?</p>

      {/* ── Controls ── */}
      <div className="schedule-controls panel">
        <div className="panel__body schedule-controls__inner">
          <StardewDateInput
            season={season} day={day} year={year} weather={weather}
            onSeasonChange={setSeason} onDayChange={setDay}
            onYearChange={setYear} onWeatherChange={setWeather}
            showYear showWeather
          />
          <label className="schedule-controls__search">
            <span className="schedule-controls__search-label">Search</span>
            <input
              type="search"
              placeholder="Filter by name"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="schedule-controls__search-input"
            />
          </label>
        </div>
      </div>

      {/* ── Gantt timeline ── */}
      <div className="sched-wrap">

        {/* Sticky header row: NPC label + hour marks */}
        <div className="sched-header">
          <div className="sched-npc-col sched-npc-col--header">
            <span className="sched-header__label">Villager</span>
            <span className="sched-header__date">
              {seasonLabel} {day} — {dayName}
            </span>
          </div>
          <div className="sched-timeline sched-timeline--header" aria-hidden="true">
            {LABEL_HOURS.map(t => (
              <span
                key={t}
                className="sched-hour-label"
                style={{ left: `${pct(t)}%` }}
              >
                {formatHour(t)}
              </span>
            ))}
          </div>
        </div>

        {/* NPC rows */}
        <div className="sched-body">
          {npcRows.map(({ npc, segments, hasSchedule }) => (
            <div
              key={npc.id}
              className={`sched-row${!hasSchedule ? ' sched-row--empty' : ''}`}
            >
              {/* NPC name — sticky left */}
              <div className="sched-npc-col">
                {npc.portrait ? (
                  <PortraitImg
                    src={`${BASE}sprites/portraits/${npc.portrait}`}
                    size={24}
                    alt=""
                    className="sched-portrait"
                  />
                ) : (
                  <span className="sched-portrait-initial">{npc.name.charAt(0)}</span>
                )}
                <GameLink type="npc" id={npc.id}>{npc.name}</GameLink>
              </div>

              {/* Timeline with location bars */}
              <div className="sched-timeline">
                {segments.map((seg, i) => {
                  const barLeft  = pct(seg.startTime);
                  const barRight = pct(seg.endTime);
                  const barWidth = barRight - barLeft;
                  if (barWidth <= 0) return null;
                  return (
                    <div
                      key={i}
                      className="sched-bar"
                      style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
                      title={`${formatTime(seg.startTime)} – ${formatTime(seg.endTime)}: ${seg.location}`}
                    >
                      <span className="sched-bar__label">{seg.location}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
