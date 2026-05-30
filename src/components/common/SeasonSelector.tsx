import type { Season } from '../../types/game';

export type SeasonValue = Season | 'all';

interface SeasonOption {
  value: SeasonValue;
  emoji: string;
  label: string;
}

const ALL_OPTIONS: SeasonOption[] = [
  { value: 'all',    emoji: '🗓️', label: 'All'    },
  { value: 'spring', emoji: '🌸', label: 'Spring' },
  { value: 'summer', emoji: '☀️', label: 'Summer' },
  { value: 'fall',   emoji: '🍂', label: 'Fall'   },
  { value: 'winter', emoji: '❄️', label: 'Winter' },
];

const SEASON_OPTIONS: SeasonOption[] = ALL_OPTIONS.slice(1);

interface SeasonSelectorProps {
  value: SeasonValue;
  onChange: (v: SeasonValue) => void;
  /** Include an "All" option (default true) */
  includeAll?: boolean;
  /** Optional count badge shown next to each label */
  counts?: Record<string, number>;
}

/**
 * Emoji-based season filter selector — uses the same look as StardewDateInput's
 * season buttons (.sdi__season) so all season pickers share one visual style.
 */
export function SeasonSelector({
  value,
  onChange,
  includeAll = true,
  counts,
}: SeasonSelectorProps) {
  const options = includeAll ? ALL_OPTIONS : SEASON_OPTIONS;

  return (
    <div className="season-selector">
      {options.map(({ value: v, emoji, label }) => (
        <button
          key={v}
          type="button"
          className={`sdi__season sdi__season--${v}${value === v ? ' sdi__season--active' : ''}`}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
        >
          <span className="sdi__season-emoji" aria-hidden="true">{emoji}</span>
          <span className="sdi__season-label">{label}</span>
          {counts !== undefined && (
            <span className="season-selector__count">{counts[v] ?? 0}</span>
          )}
        </button>
      ))}
    </div>
  );
}
