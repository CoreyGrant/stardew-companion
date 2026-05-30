import type { Season } from '../../types/game';

const ALL_SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];

interface SeasonPipsProps {
  /** Array of season strings — may include 'all' to light all pips */
  seasons: string[];
  /** Season to highlight with a glow ring */
  highlight?: Season;
  className?: string;
}

/** Four coloured dots showing which seasons an item is available in. */
export function SeasonPips({ seasons, highlight, className }: SeasonPipsProps) {
  const isAll = seasons.includes('all');
  return (
    <span className={`season-pips${className ? ` ${className}` : ''}`}>
      {ALL_SEASONS.map((s) => {
        const active = isAll || seasons.includes(s);
        const glow   = active && s === highlight;
        return (
          <span
            key={s}
            className={[
              'season-pip',
              `season-pip--${s}`,
              active ? 'season-pip--on' : '',
              glow   ? 'season-pip--highlight' : '',
            ].filter(Boolean).join(' ')}
            title={s.charAt(0).toUpperCase() + s.slice(1)}
          />
        );
      })}
    </span>
  );
}
