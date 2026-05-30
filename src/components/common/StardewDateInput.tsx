import { useEffect, useState } from 'react';
import type { Season, Weather } from '../../types/game';
import { getDayName } from '../../utils/scheduleUtils';

const SEASONS = [
  { value: 'spring' as Season, emoji: '🌸', label: 'Spring' },
  { value: 'summer' as Season, emoji: '☀️', label: 'Summer' },
  { value: 'fall'   as Season, emoji: '🍂', label: 'Fall'   },
  { value: 'winter' as Season, emoji: '❄️', label: 'Winter' },
];

const WEATHERS = [
  { value: 'sunny'  as Weather, emoji: '☀️', label: 'Sunny' },
  { value: 'rainy'  as Weather, emoji: '🌧',  label: 'Rain'  },
  { value: 'stormy' as Weather, emoji: '⛈',  label: 'Storm' },
  { value: 'snowy'  as Weather, emoji: '🌨',  label: 'Snow'  },
  { value: 'windy'  as Weather, emoji: '💨',  label: 'Windy' },
];

export interface StardewDateInputProps {
  season: Season;
  day: number;
  year?: number;
  weather?: Weather;
  onSeasonChange: (s: Season) => void;
  onDayChange: (d: number) => void;
  onYearChange?: (y: number) => void;
  onWeatherChange?: (w: Weather) => void;
  /** Show the year stepper (default false) */
  showYear?: boolean;
  /** Show weather buttons (default false) */
  showWeather?: boolean;
}

export function StardewDateInput({
  season, day, year = 1, weather = 'sunny',
  onSeasonChange, onDayChange, onYearChange, onWeatherChange,
  showYear = false, showWeather = false,
}: StardewDateInputProps) {
  const clampDay  = (d: number) => Math.max(1, Math.min(28, d));
  const clampYear = (y: number) => Math.max(1, y);

  // Local string state lets users type freely without React snapping the value
  // back on every keystroke.  We sync outward on every valid parse and sync
  // back when the prop changes due to the arrow buttons.
  const [dayText, setDayText] = useState(String(day));
  useEffect(() => { setDayText(String(day)); }, [day]);

  const [yearText, setYearText] = useState(String(year));
  useEffect(() => { setYearText(String(year)); }, [year]);

  const commitDay = (raw: string) => {
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1) onDayChange(clampDay(v));
  };

  const commitYear = (raw: string) => {
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1) onYearChange?.(clampYear(v));
  };

  return (
    <div className="sdi">
      {/* Row 1: seasons */}
      <div className="sdi__seasons">
        {SEASONS.map(({ value, emoji, label }) => (
          <button
            key={value}
            type="button"
            className={`sdi__season sdi__season--${value}${season === value ? ' sdi__season--active' : ''}`}
            onClick={() => onSeasonChange(value)}
            title={label}
            aria-pressed={season === value}
          >
            <span className="sdi__season-emoji" aria-hidden="true">{emoji}</span>
            <span className="sdi__season-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Row 2: day stepper + optional year + optional weather */}
      <div className="sdi__row2">
        {/* Day stepper */}
        <div className="sdi__stepper">
          <button
            type="button"
            className="sdi__step-btn"
            onClick={() => onDayChange(clampDay(day - 1))}
            disabled={day <= 1}
            aria-label="Previous day"
          >◀</button>

          <div className="sdi__stepper-val">
            <span className="sdi__day-name">{getDayName(day)}</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="sdi__day-input"
              value={dayText}
              aria-label="Day (1–28)"
              maxLength={2}
              onChange={(e) => {
                setDayText(e.target.value);
                commitDay(e.target.value);
              }}
              onBlur={() => {
                setDayText(String(day));
              }}
            />
          </div>

          <button
            type="button"
            className="sdi__step-btn"
            onClick={() => onDayChange(clampDay(day + 1))}
            disabled={day >= 28}
            aria-label="Next day"
          >▶</button>
        </div>

        {/* Optional year stepper */}
        {showYear && onYearChange && (
          <div className="sdi__stepper sdi__stepper--year">
            <button
              type="button"
              className="sdi__step-btn"
              onClick={() => onYearChange(clampYear(year - 1))}
              disabled={year <= 1}
              aria-label="Previous year"
            >◀</button>

            <div className="sdi__stepper-val">
              <span className="sdi__day-name">Yr.</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="sdi__day-input sdi__year-input"
                value={yearText}
                aria-label="Year"
                maxLength={2}
                onChange={(e) => {
                  setYearText(e.target.value);
                  commitYear(e.target.value);
                }}
                onBlur={() => {
                  setYearText(String(year));
                }}
              />
            </div>

            <button
              type="button"
              className="sdi__step-btn"
              onClick={() => onYearChange(clampYear(year + 1))}
              aria-label="Next year"
            >▶</button>
          </div>
        )}

        {/* Optional weather buttons */}
        {showWeather && onWeatherChange && (
          <div className="sdi__weathers">
            {WEATHERS.map(({ value, emoji, label }) => (
              <button
                key={value}
                type="button"
                className={`sdi__weather${weather === value ? ' sdi__weather--active' : ''}`}
                onClick={() => onWeatherChange(value)}
                title={label}
                aria-pressed={weather === value}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
