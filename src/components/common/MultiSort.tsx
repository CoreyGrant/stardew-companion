import { useEffect, useMemo, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

/** One active sort entry in the sort chain. */
export interface ActiveSort {
  fieldId: string;
  direction: 'asc' | 'desc';
}

/**
 * Definition of a sortable field for a specific data type T.
 * `compareFn` is the natural ascending comparator (positive = a after b).
 * The hook negates it automatically when direction is 'desc'.
 */
export interface SortFieldDef<T> {
  id: string;
  label: string;
  compareFn: (a: T, b: T) => number;
  /** Direction applied when this field is first added (default: 'asc'). */
  defaultDirection?: 'asc' | 'desc';
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Applies a multi-field sort to `data` using the current `sorts` state.
 * Fields are tried in order; the first non-zero comparator wins.
 */
export function useMultiSort<T>(
  data: T[],
  sorts: ActiveSort[],
  fields: SortFieldDef<T>[],
): T[] {
  return useMemo(() => {
    if (!sorts.length) return data;
    const map = new Map(fields.map((f) => [f.id, f]));
    return [...data].sort((a, b) => {
      for (const s of sorts) {
        const f = map.get(s.fieldId);
        if (!f) continue;
        const c = f.compareFn(a, b);
        if (c !== 0) return s.direction === 'asc' ? c : -c;
      }
      return 0;
    });
  }, [data, sorts, fields]);
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a row of active sort tags (each with a direction toggle and remove
 * button) plus an "+ Sort" dropdown to add further sort fields.
 *
 * The component itself is non-generic; pass `SortFieldDef<T>[]` directly —
 * TypeScript's structural typing accepts it since we only use id/label/defaultDirection.
 */
interface MultiSortProps {
  fields: { id: string; label: string; defaultDirection?: 'asc' | 'desc' }[];
  value: ActiveSort[];
  onChange: (sorts: ActiveSort[]) => void;
}

export function MultiSort({ fields, value, onChange }: MultiSortProps) {
  const [open,   setOpen]   = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCursor(-1);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const activeIds = new Set(value.map((s) => s.fieldId));
  const available = fields.filter((f) => !activeIds.has(f.id));
  const labelOf   = (id: string) => fields.find((f) => f.id === id)?.label ?? id;

  function add(fieldId: string) {
    const def = fields.find((f) => f.id === fieldId);
    if (!def) return;
    onChange([...value, { fieldId, direction: def.defaultDirection ?? 'asc' }]);
    setOpen(false);
    setCursor(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, available.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      add(available[cursor].id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setCursor(-1);
    }
  }

  function flip(fieldId: string) {
    onChange(value.map((s) =>
      s.fieldId === fieldId
        ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' }
        : s,
    ));
  }

  function remove(fieldId: string) {
    onChange(value.filter((s) => s.fieldId !== fieldId));
  }

  return (
    <div className="multi-sort">
      {value.map((sort) => (
        <span key={sort.fieldId} className="multi-sort__tag">
          <span className="multi-sort__tag-label">{labelOf(sort.fieldId)}</span>
          <button
            className="multi-sort__tag-dir"
            onClick={() => flip(sort.fieldId)}
            title={`Currently ${sort.direction === 'asc' ? 'ascending' : 'descending'} — click to flip`}
          >
            {sort.direction === 'asc' ? '↑' : '↓'}
          </button>
          <button
            className="multi-sort__tag-remove"
            onClick={() => remove(sort.fieldId)}
            aria-label={`Remove ${labelOf(sort.fieldId)} sort`}
          >
            ×
          </button>
        </span>
      ))}

      {available.length > 0 && (
        <div className="multi-sort__add-wrap" ref={wrapRef} onKeyDown={handleKeyDown}>
          <button
            className="multi-sort__add"
            onClick={() => { setOpen((o) => !o); setCursor(-1); }}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            + Sort
          </button>
          {open && (
            <ul className="multi-sort__dropdown" role="listbox">
              {available.map((f, idx) => (
                <li key={f.id}>
                  <button
                    className={`multi-sort__dropdown-item${cursor === idx ? ' multi-sort__dropdown-item--focused' : ''}`}
                    role="option"
                    onMouseDown={() => add(f.id)}
                    onMouseEnter={() => setCursor(idx)}
                  >
                    {f.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
