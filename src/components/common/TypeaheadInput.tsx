import { useState, useRef, useEffect, type ReactNode } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TypeaheadOption {
  id: string;
  label: string;
  sublabel?: string;
  /** Optional icon rendered in a 20×20 slot to the left of the label. */
  icon?: ReactNode;
}

interface TypeaheadInputProps {
  /** Full list of options — filtered internally by the typed query. */
  options: TypeaheadOption[];
  /** Called with the selected option's id. Input is cleared after selection. */
  onSelect: (id: string) => void;
  /** IDs to exclude from results (e.g. already-picked items). */
  excludeIds?: string[];
  placeholder?: string;
  maxResults?: number;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TypeaheadInput({
  options,
  onSelect,
  excludeIds,
  placeholder = 'Search…',
  maxResults = 8,
  className,
}: TypeaheadInputProps) {
  const [query,  setQuery]  = useState('');
  const [open,   setOpen]   = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCursor(-1);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const excluded = new Set(excludeIds ?? []);
  const q = query.trim().toLowerCase();
  const results = q
    ? options
        .filter(o => !excluded.has(o.id) && o.label.toLowerCase().includes(q))
        .slice(0, maxResults)
    : [];

  function select(id: string) {
    onSelect(id);
    setQuery('');
    setOpen(false);
    setCursor(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && results.length > 0) { setOpen(true); return; }
      setCursor(c => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      select(results[cursor].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setCursor(-1);
    }
  }

  const hasIcon = results.some(o => o.icon !== undefined);

  return (
    <div className={`typeahead${className ? ` ${className}` : ''}`} ref={wrapRef}>
      <input
        ref={inputRef}
        type="search"
        className="typeahead__input"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onChange={e => {
          setQuery(e.target.value);
          setOpen(true);
          setCursor(-1);
        }}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />

      {open && results.length > 0 && (
        <ul className="typeahead__dropdown" role="listbox">
          {results.map((opt, i) => (
            <li key={opt.id} role="option" aria-selected={cursor === i}>
              <button
                className={`typeahead__item${cursor === i ? ' typeahead__item--focused' : ''}`}
                onMouseDown={e => { e.preventDefault(); select(opt.id); }}
                onMouseEnter={() => setCursor(i)}
                tabIndex={-1}
              >
                {hasIcon && (
                  <span className="typeahead__item-icon" aria-hidden="true">
                    {opt.icon ?? null}
                  </span>
                )}
                <span className="typeahead__item-info">
                  <span className="typeahead__item-label">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="typeahead__item-sub">{opt.sublabel}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
