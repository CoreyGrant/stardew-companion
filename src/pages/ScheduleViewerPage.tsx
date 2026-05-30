import { useScheduleViewer, DISPLAY_TIMES } from '../hooks/useScheduleViewer';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { GameLink } from '../components/common/GameLink';
import { usePageTitle } from '../hooks/usePageTitle';

function formatTime(t: number): string {
  const h = Math.floor(t / 100);
  const suffix = h >= 12 ? 'pm' : 'am';
  const displayH = h > 12 ? h - 12 : h;
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
    npcRows,
  } = useScheduleViewer();

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page page--schedule">
      <h1 className="page__title">Schedule Viewer</h1>
      <p className="page__subtitle">Find where every villager is on any given day.</p>

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
              placeholder="Filter by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="schedule-controls__search-input"
            />
          </label>
        </div>
      </div>

      <div className="schedule-cal-wrap">
        <table className="schedule-cal">
          <colgroup>
            <col className="schedule-cal__npc-col" />
            {DISPLAY_TIMES.map((t) => <col key={t} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="schedule-cal__npc-head">Villager</th>
              {DISPLAY_TIMES.map((t) => (
                <th key={t}>{formatTime(t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {npcRows.map(({ npc, locations }) => (
              <tr key={npc.id}>
                <td className="schedule-cal__npc-cell">
                  <GameLink type="npc" id={npc.id}>{npc.name}</GameLink>
                </td>
                {computeSpans(locations).map((span, i) => (
                  <td
                    key={i}
                    colSpan={span.span}
                    className="schedule-cal__block"
                  >
                    {span.location}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
