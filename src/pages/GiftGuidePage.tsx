/**
 * Gift Guide — unified "who to gift today" view.
 *
 * Shows every NPC's schedule for the selected date, their heart status,
 * and which of your chosen items they love or like.
 * Birthday NPCs always float to the top.
 */
import { useMemo, useState, useRef, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { PortraitImg } from '../components/common/PortraitImg';
import { usePageTitle } from '../hooks/usePageTitle';
import { bestVariantEntries } from '../utils/scheduleUtils';
import type { NPC, ItemRef, Season, Weather } from '../types/game';
import type { FriendshipEntry } from '../types/save';

const BASE = import.meta.env.BASE_URL;

// ── Schedule helpers ──────────────────────────────────────────────────────────

const SLOT_TIMES  = [600, 1000, 1200, 1500, 1800, 2000];
const SLOT_LABELS = ['6am', '10am', '12pm', '3pm', '6pm', '8pm'];

function locationAtTime(
  entries: ReturnType<typeof bestVariantEntries>,
  time: number,
): string {
  let loc = entries[0]?.location ?? '—';
  for (const e of entries) {
    if (e.time <= time) loc = e.location;
    else break;
  }
  return loc || '—';
}

// ── Gift helpers ──────────────────────────────────────────────────────────────

function friendshipCap(npc: NPC, fd?: FriendshipEntry): number {
  if (!fd) return npc.marriageable ? 8 : 10;
  const s = fd.status;
  if (s === 'Married')                   return 14;
  if (s === 'Dating' || s === 'Engaged') return 10;
  if (!npc.marriageable)                 return 10;
  return 8;
}

// ── Row type ──────────────────────────────────────────────────────────────────

interface GiftRow {
  npc: NPC;
  isBirthday: boolean;
  heartLevel: number;
  cap: number;
  isMaxed: boolean;
  /** true when we have saves data */
  hasSave: boolean;
  giftsThisWeek: number;
  /** Can give at least one more gift this week */
  canGift: boolean;
  lovedMatches: ItemRef[];
  likedMatches: ItemRef[];
  /** location string for each SLOT_TIMES entry */
  locations: string[];
  /** 0=birthday 1=loved+canGift 2=liked+canGift 3=canGift 4=giftedOut 5=maxed */
  priority: number;
}

// ── Item picker ───────────────────────────────────────────────────────────────

interface ItemPickerProps {
  allItems: ItemRef[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

function ItemPicker({ allItems, selected, onAdd, onRemove }: ItemPickerProps) {
  const [query,      setQuery]      = useState('');
  const [dropOpen,   setDropOpen]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dropOpen]);

  const selectedSet = new Set(selected);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems
      .filter(i => !selectedSet.has(i.id) && i.name.toLowerCase().includes(q))
      .slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, query, selected]);

  function pick(id: string) {
    onAdd(id);
    setQuery('');
    setDropOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="gift-picker">
      <span className="gift-picker__label">Items in hand:</span>
      <div className="gift-picker__tags">
        {selected.map(id => {
          const item = allItems.find(i => i.id === id);
          return item ? (
            <span key={id} className="gift-picker__tag">
              {item.name}
              <button className="gift-picker__tag-remove" onClick={() => onRemove(id)} aria-label={`Remove ${item.name}`}>×</button>
            </span>
          ) : null;
        })}
        <div className="gift-picker__input-wrap" ref={wrapRef}>
          <input
            ref={inputRef}
            className="gift-picker__input"
            type="search"
            placeholder="+ Add item…"
            value={query}
            autoComplete="off"
            onChange={e => { setQuery(e.target.value); setDropOpen(true); }}
            onFocus={() => { if (query.trim()) setDropOpen(true); }}
          />
          {dropOpen && results.length > 0 && (
            <ul className="gift-picker__dropdown">
              {results.map(i => (
                <li key={i.id}>
                  <button className="gift-picker__dropdown-item" onMouseDown={() => pick(i.id)}>
                    {i.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GiftGuidePage() {
  usePageTitle('Gift Guide');
  const { data, loading, error } = useGameData();
  const { activeSave, settings }  = useUserData();

  // ── Date / weather state ────────────────────────────────────────────────────
  const [season,  setSeason]  = useState<Season>(() => (activeSave?.season as Season) ?? 'spring');
  const [day,     setDay]     = useState<number>(() => activeSave?.day ?? 1);
  const [year,    setYear]    = useState<number>(1);
  const [weather, setWeather] = useState<Weather>('sunny');

  // Sync with active save on profile switch
  useEffect(() => {
    if (activeSave?.season) setSeason(activeSave.season as Season);
    if (activeSave?.day)    setDay(activeSave.day);
  }, [activeSave?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Item selection ──────────────────────────────────────────────────────────
  const [myItemIds, setMyItemIds] = useState<string[]>([]);

  // All giftable items (universal + NPC-specific, deduplicated)
  const allItems = useMemo<ItemRef[]>(() => {
    const seen = new Set<string>();
    const result: ItemRef[] = [];
    const push = (item: ItemRef) => {
      if (!seen.has(item.id)) { seen.add(item.id); result.push(item); }
    };
    [...(data?.universalGifts?.loved ?? []), ...(data?.universalGifts?.liked ?? [])].forEach(push);
    (data?.npcs ?? []).forEach(npc => {
      [...(npc.gifts?.loved ?? []), ...(npc.gifts?.liked ?? [])].forEach(push);
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const myItems = useMemo<ItemRef[]>(
    () => myItemIds.map(id => allItems.find(i => i.id === id)).filter((x): x is ItemRef => !!x),
    [myItemIds, allItems],
  );

  // ── Row computation ─────────────────────────────────────────────────────────
  const marriedTo = settings.tailorToSave ? (activeSave?.marriedTo ?? null) : null;

  const rows = useMemo<GiftRow[]>(() => {
    if (!data) return [];
    const univLovedIds = new Set((data.universalGifts?.loved ?? []).map(u => u.id));
    const univLikedIds = new Set((data.universalGifts?.liked ?? []).map(u => u.id));

    return data.npcs.map(npc => {
      const fd         = activeSave?.friendshipData?.[npc.id];
      const heartLevel = activeSave?.heartLevels?.[npc.id] ?? 0;
      const cap        = friendshipCap(npc, fd);
      const isMaxed    = heartLevel >= cap;
      const hasSave    = Boolean(activeSave);
      const giftsThisWeek = fd?.giftsThisWeek ?? 0;
      const isBirthday = npc.birthday.season === season && npc.birthday.day === day;
      // On birthday they can always receive a gift (counts triple), otherwise max 2/week
      const canGift    = !isMaxed && (isBirthday || giftsThisWeek < 2);

      // Gift matches
      const lovedMatches = myItems.filter(item =>
        univLovedIds.has(item.id) || npc.gifts?.loved?.some(g => g.id === item.id),
      );
      const likedMatches = myItems.filter(item => {
        if (lovedMatches.some(l => l.id === item.id)) return false;
        return univLikedIds.has(item.id) || npc.gifts?.liked?.some(g => g.id === item.id);
      });

      // Schedule locations
      const entries   = bestVariantEntries(npc, season, weather, year, npc.id === marriedTo, day);
      const locations = SLOT_TIMES.map(t => locationAtTime(entries, t));

      // Priority
      let priority: number;
      if (isBirthday)                                 priority = 0;
      else if (canGift && lovedMatches.length > 0)    priority = 1;
      else if (canGift && likedMatches.length > 0)    priority = 2;
      else if (canGift)                               priority = 3;
      else if (!isMaxed)                              priority = 4; // gifted out this week
      else                                            priority = 5; // maxed

      return { npc, isBirthday, heartLevel, cap, isMaxed, hasSave, giftsThisWeek, canGift, lovedMatches, likedMatches, locations, priority };
    }).sort((a, b) => a.priority - b.priority || a.npc.name.localeCompare(b.npc.name));
  }, [data, activeSave, season, day, year, weather, myItems, marriedTo, settings]);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const birthdays = rows.filter(r => r.isBirthday);

  return (
    <div className="page page--gift-guide">
      <h1 className="page__title">Gift Guide</h1>
      <p className="page__subtitle">
        Who to gift today — schedule, heart status, and which items to bring.
        {birthdays.length > 0 && (
          <span className="gift-guide__birthday-hint">
            {' '}🎂 Birthday{birthdays.length > 1 ? 's' : ''}: {birthdays.map(r => r.npc.name).join(', ')}
          </span>
        )}
      </p>

      {/* ── Controls ── */}
      <div className="gift-controls">
        <div className="gift-controls__date">
          <StardewDateInput
            season={season} day={day} year={year} weather={weather}
            onSeasonChange={setSeason} onDayChange={setDay}
            onYearChange={setYear}    onWeatherChange={setWeather}
            showYear showWeather
          />
        </div>
        <ItemPicker
          allItems={allItems}
          selected={myItemIds}
          onAdd={id => setMyItemIds(prev => prev.includes(id) ? prev : [...prev, id])}
          onRemove={id => setMyItemIds(prev => prev.filter(i => i !== id))}
        />
      </div>

      {!activeSave && (
        <p className="gift-guide__no-save">
          💡 <a href="/saves">Load a save</a> to see heart levels, gifts remaining, and have the date pre-filled.
        </p>
      )}

      {/* ── Table ── */}
      <div className="gift-table-wrap">
        <div className="gift-table">

          {/* Header */}
          <div className="gift-table__head">
            <span className="gift-col--npc">Character</span>
            <span className="gift-col--hearts">Hearts</span>
            <span className="gift-col--gifts">Gift match</span>
            {SLOT_LABELS.map((l, i) => (
              <span key={i} className="gift-col--time">{l}</span>
            ))}
          </div>

          {/* Rows */}
          {rows.map(row => {
            const { npc, isBirthday, heartLevel, cap, isMaxed, hasSave, giftsThisWeek, canGift, lovedMatches, likedMatches, locations, priority } = row;
            const rowClass = [
              'gift-row',
              isBirthday ? 'gift-row--birthday' : '',
              isMaxed    ? 'gift-row--maxed'    : '',
              priority === 4 ? 'gift-row--gifted-out' : '',
            ].filter(Boolean).join(' ');

            return (
              <div key={npc.id} className={rowClass}>

                {/* NPC name + portrait */}
                <div className="gift-col--npc">
                  <div className="gift-npc__portrait">
                    {npc.portrait ? (
                      <PortraitImg src={`${BASE}sprites/portraits/${npc.portrait}`} size={28} />
                    ) : (
                      <span className="gift-npc__initial">{npc.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="gift-npc__info">
                    <a href={`/characters/${npc.id}`} className="gift-npc__name">{npc.name}</a>
                    {isBirthday && <span className="gift-npc__bday" title="Birthday today!">🎂</span>}
                  </div>
                </div>

                {/* Hearts */}
                <div className="gift-col--hearts">
                  {hasSave ? (
                    <>
                      <div className="gift-hearts">
                        {Array.from({ length: cap }, (_, i) => (
                          <span key={i} className={`gift-heart${i < heartLevel ? ' gift-heart--filled' : ''}`}>♥</span>
                        ))}
                      </div>
                      <span className={`gift-status ${isMaxed ? 'gift-status--maxed' : canGift ? 'gift-status--ok' : 'gift-status--out'}`}>
                        {isMaxed ? 'Max' : canGift ? `${2 - giftsThisWeek} left` : 'Gifted out'}
                      </span>
                    </>
                  ) : (
                    <span className="gift-status gift-status--nosave">—</span>
                  )}
                </div>

                {/* Gift matches */}
                <div className="gift-col--gifts">
                  {myItems.length === 0 ? (
                    <span className="gift-match--empty">Add items above ↑</span>
                  ) : lovedMatches.length === 0 && likedMatches.length === 0 ? (
                    <span className="gift-match--none">—</span>
                  ) : (
                    <>
                      {lovedMatches.map(item => (
                        <span key={item.id} className="gift-match gift-match--loved" title="Loved">
                          💖 {item.name}
                        </span>
                      ))}
                      {likedMatches.map(item => (
                        <span key={item.id} className="gift-match gift-match--liked" title="Liked">
                          💛 {item.name}
                        </span>
                      ))}
                    </>
                  )}
                </div>

                {/* Schedule locations */}
                {locations.map((loc, i) => (
                  <div key={i} className="gift-col--time gift-location" title={loc}>
                    {loc}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
