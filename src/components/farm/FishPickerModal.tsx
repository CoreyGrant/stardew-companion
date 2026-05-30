import { useState } from 'react';
import type { Item } from '../../types/game';
import { SpriteIcon } from './SpriteIcon';

interface Props {
  fish: Item[];
  currentFishId?: string;
  onSelect: (fishId: string | null) => void;
  onClose: () => void;
}

export function FishPickerModal({ fish, currentFishId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();
  const filtered = fish.filter((f) => !q || f.name.toLowerCase().includes(q));

  return (
    <div className="fish-picker-backdrop" onClick={onClose}>
      <div className="fish-picker" onClick={(e) => e.stopPropagation()}>
        <div className="fish-picker__header">
          <span className="fish-picker__title">Select Fish</span>
          <button className="fish-picker__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <input
          className="fish-picker__search"
          type="search"
          placeholder="Search fish…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="fish-picker__grid">
          {currentFishId && (
            <button className="fish-picker__item fish-picker__item--clear" onClick={() => onSelect(null)}>
              ✕ Clear
            </button>
          )}
          {filtered.map((f) => (
            <button
              key={f.id}
              className={`fish-picker__item${f.cheatId === currentFishId ? ' fish-picker__item--active' : ''}`}
              onClick={() => onSelect(f.cheatId)}
              title={f.name}
            >
              {f.spriteSheet && f.spriteIndex !== undefined ? (
                <SpriteIcon spriteSheet={f.spriteSheet} spriteIndex={f.spriteIndex} size={24} />
              ) : null}
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
