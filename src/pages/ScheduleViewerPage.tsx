import { useScheduleViewer, DISPLAY_TIMES } from '../hooks/useScheduleViewer';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { PortraitImg } from '../components/common/PortraitImg';
import { GameLink } from '../components/common/GameLink';
import { usePageTitle } from '../hooks/usePageTitle';

const BASE = import.meta.env.BASE_URL;

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const suffix = h >= 12 ? 'pm' : 'am';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}${suffix}`;
}

function computeSpans(locations: string[]): Array<{ location: string; span: number }> {
  const spans: Array<{ location: string; span: number }> = [];
  for (const loc of locations) {
    const last = spans[spans.length - 1];
    if (last && last.location === loc) {
      last.span++;
    } else {
      spans.push({ location: loc, span: 1 });
    }
  }
  return spans;
}

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

  return (
    <div className="page page--schedule">
      <h1 className="page__title">Villager Schedules</h1>
      <p className="page__subtitle">Where is everyone on a given day?</p>

      <div className="schedule-controls panel">
        <div className="panel__body schedule-controls__inner">
          <StardewDateInput
            season={season}
            day={day}
            year={year}
            weather={weather}
            onSeasonChange={setSeason}
            onDayChange={setDay}
            onYearChange={setYear}
            onWeatherChange={setWeather}
            showYear
            showWeather
          />

          <label className="schedule-controls__search">
            <span className="schedule-controls__search-label">Search</span>
            <input
              type="search"
              placeholder="Filter by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="schedule-controls__search-input"
            />
          </label>
        </div>
      </div>

      {/* ── Schedule grid ── */}
      <div className="schedule-cal-wrap">
        <table className="schedule-cal">
          <colgroup>
            <col className="schedule-cal__npc-col" />
            {DISPLAY_TIMES.map((t) => <col key={t} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="schedule-cal__npc-head">
                Villager
                <span className="schedule-cal__date-label">
                  {season.charAt(0).toUpperCase() + season.slice(1)} {day} ({dayName})
                </span>
              </th>
              {DISPLAY_TIMES.map((t) => (
                <th key={t}>{formatTime(t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {npcRows.map(({ npc, locations }) => {
              const isEmpty = locations.every((l) => l === '—');
              return (
                <tr key={npc.id} className={isEmpty ? 'schedule-cal__row--empty' : ''}>
                  <td className="schedule-cal__npc-cell">
                    {npc.portrait ? (
                      <PortraitImg
                        src={`${BASE}sprites/portraits/${npc.portrait}`}
                        size={24}
                        alt=""
                        className="schedule-cal__portrait"
                      />
                    ) : (
                      <span className="schedule-cal__portrait-initial">{npc.name.charAt(0)}</span>
                    )}
                    <GameLink type="npc" id={npc.id}>{npc.name}</GameLink>
                  </td>
                  {computeSpans(locations).map((span, i) => (
                    <td
                      key={i}
                      colSpan={span.span}
                      className={`schedule-cal__block${span.location === '—' ? ' schedule-cal__block--empty' : ''}`}
                    >
                      {span.location}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
