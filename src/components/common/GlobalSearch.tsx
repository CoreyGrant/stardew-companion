import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpriteIcon } from '../farm/SpriteIcon';
import {
  useGlobalSearch,
  RESULT_TYPE_ORDER,
  RESULT_TYPE_LABELS,
  type SearchResult,
  type SearchResultType,
} from '../../hooks/useGlobalSearch';

const MAX_PER_GROUP = 5;

interface GroupProps {
  type: SearchResultType;
  results: SearchResult[];
  cursor: number;
  flatIndex: number; // offset into the flat list where this group starts
  onSelect: (r: SearchResult) => void;
  onHover: (index: number) => void;
}

function ResultGroup({ type, results, cursor, flatIndex, onSelect, onHover }: GroupProps) {
  const shown = results.slice(0, MAX_PER_GROUP);
  const extra = results.length - shown.length;

  return (
    <div className="gsearch__group">
      <div className="gsearch__group-label">
        {RESULT_TYPE_LABELS[type]}
        {extra > 0 && <span className="gsearch__group-extra"> (+{extra} more)</span>}
      </div>
      {shown.map((r, i) => {
        const absIdx = flatIndex + i;
        return (
          <button
            key={`${r.type}-${r.id}`}
            className={`gsearch__result${cursor === absIdx ? ' gsearch__result--focused' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); onSelect(r); }}
            onMouseEnter={() => onHover(absIdx)}
            tabIndex={-1}
          >
            <div className="gsearch__result-icon" aria-hidden="true">
              {r.spriteSheet && r.spriteIndex !== undefined ? (
                <SpriteIcon
                  spriteSheet={r.spriteSheet}
                  spriteIndex={r.spriteIndex}
                  isBigCraftable={r.isBigCraftable}
                  size={18}
                  style={r.isBigCraftable ? { height: 18, overflow: 'hidden' } : undefined}
                />
              ) : (
                <span className="gsearch__result-type-icon">
                  {type === 'npc'    ? '👤'
                    : type === 'recipe' ? '🍳'
                    : type === 'quest'  ? '📜'
                    : type === 'bundle' ? '🏛'
                    : '📦'}
                </span>
              )}
            </div>
            <div className="gsearch__result-info">
              <span className="gsearch__result-name">{r.name}</span>
              {r.subtitle && (
                <span className="gsearch__result-sub">{r.subtitle}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function GlobalSearch() {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef  = useRef<HTMLInputElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const navigate  = useNavigate();

  const grouped = useGlobalSearch(query);

  // Flatten results for keyboard navigation
  const flat: SearchResult[] = [];
  for (const type of RESULT_TYPE_ORDER) {
    const results = grouped.get(type);
    if (results) flat.push(...results.slice(0, MAX_PER_GROUP));
  }

  const hasResults = grouped.size > 0;

  const handleSelect = useCallback((r: SearchResult) => {
    setQuery('');
    setOpen(false);
    setCursor(-1);
    navigate(r.route);
  }, [navigate]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCursor(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // "/" shortcut to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT'
          && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hasResults) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && cursor >= 0) {
      e.preventDefault();
      handleSelect(flat[cursor]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setCursor(-1);
      inputRef.current?.blur();
    }
  };

  // Compute flat offset for each group (for cursor matching)
  const groupOffsets: Partial<Record<SearchResultType, number>> = {};
  let offset = 0;
  for (const type of RESULT_TYPE_ORDER) {
    const results = grouped.get(type);
    if (results) {
      groupOffsets[type] = offset;
      offset += Math.min(results.length, MAX_PER_GROUP);
    }
  }

  return (
    <div className="gsearch" ref={wrapRef}>
      <div className="gsearch__input-wrap">
        <span className="gsearch__icon" aria-hidden="true">🔍</span>
        <input
          ref={inputRef}
          type="search"
          className="gsearch__input"
          placeholder="Search… (/)"
          value={query}
          aria-label="Search all game data"
          autoComplete="off"
          onChange={e => {
            setQuery(e.target.value);
            setOpen(true);
            setCursor(-1);
          }}
          onFocus={() => { if (query.length >= 2) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {open && hasResults && (
        <div className="gsearch__dropdown" role="listbox" aria-label="Search results">
          {RESULT_TYPE_ORDER.map(type => {
            const results = grouped.get(type);
            if (!results) return null;
            return (
              <ResultGroup
                key={type}
                type={type}
                results={results}
                cursor={cursor}
                flatIndex={groupOffsets[type] ?? 0}
                onSelect={handleSelect}
                onHover={setCursor}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
