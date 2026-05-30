import type { ViewMode } from '../../hooks/useViewMode';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}

/** A compact two-button tile↔table switcher for list pages. */
export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="view-toggle" role="group" aria-label="View mode">
      <button
        className={`view-toggle__btn${mode === 'tile' ? ' view-toggle__btn--active' : ''}`}
        onClick={() => onChange('tile')}
        title="Tile view"
        aria-pressed={mode === 'tile'}
      >
        ⊞
      </button>
      <button
        className={`view-toggle__btn${mode === 'table' ? ' view-toggle__btn--active' : ''}`}
        onClick={() => onChange('table')}
        title="Table view"
        aria-pressed={mode === 'table'}
      >
        ☰
      </button>
    </div>
  );
}
