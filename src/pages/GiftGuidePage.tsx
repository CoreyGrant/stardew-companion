/**
 * Gift Guide — unified "who to gift today" view.
 *
 * Shows every NPC's schedule for the selected date, their heart status,
 * and which of your chosen items they love or like.
 * Birthday NPCs always float to the top.
 */
import { useMemo, useState, useEffect } from 'react';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { StardewDateInput } from '../components/common/StardewDateInput';
import { PortraitImg } from '../components/common/PortraitImg';
import { SpriteIcon } from '../components/farm/SpriteIcon';
import { TypeaheadInput, type TypeaheadOption } from '../components/common/TypeaheadInput';
import { usePageTitle } from '../hooks/usePageTitle';
import { bestVariantEntries, locationLabel } from '../utils/scheduleUtils';
import { useScheduleFilters } from '../hooks/useScheduleFilters';
import { ScheduleFilters } from '../components/common/ScheduleFilters';
import type { Segment } from '../hooks/useScheduleViewer';
import type { NPC, ItemRef, Season, Weather } from '../types/game';
import type { FriendshipEntry } from '../types/save';

const BASE = import.meta.env.BASE_URL;

// ── Schedule / Gantt helpers ──────────────────────────────────────────────────

const GIFT_RANGE_START = 600;
const GIFT_RANGE_END   = 2600;
const GIFT_RANGE       = GIFT_RANGE_END - GIFT_RANGE_START; // 2000

// Labels every 2 hours (6am … 2am = 11 marks)
const GIFT_LABEL_HOURS = Array.from({ length: 11 }, (_, i) => GIFT_RANGE_START + i * 200);

function giftPct(t: number): number {
  return (Math.max(GIFT_RANGE_START, Math.min(GIFT_RANGE_END, t)) - GIFT_RANGE_START) / GIFT_RANGE * 100;
}

function formatGiftHour(t: number): string {
  let h = Math.floor(t / 100);
  if (h >= 24) h -= 24;
  const pm = h >= 12;
  return `${h > 12 ? h - 12 : h === 0 ? 12 : h}${pm ? 'pm' : 'am'}`;
}

function formatGiftTime(t: number): string {
  let h = Math.floor(t / 100);
  const m = t % 100;
  if (h >= 24) h -= 24;
  const pm = h >= 12;
  const d  = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${d}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}${pm ? 'pm' : 'am'}`;
}

/** Build merged Gantt segments from schedule entries. */
function buildSegments(entries: ReturnType<typeof bestVariantEntries>): Segment[] {
  const raw = entries
    .map((e, i) => ({
      startTime: e.time,
      endTime:   entries[i + 1]?.time ?? GIFT_RANGE_END,
      location:  locationLabel(e.location),
    }))
    .filter(s => s.endTime > GIFT_RANGE_START && s.startTime < GIFT_RANGE_END);

  const merged: Segment[] = [];
  for (const seg of raw) {
    const last = merged[merged.length - 1];
    if (last && last.location === seg.location) {
      last.endTime = seg.endTime;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
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
  lovedMatches: TypeaheadOption[];
  likedMatches: TypeaheadOption[];
  /** Merged time-range segments for the Gantt timeline */
  segments: Segment[];
  /** 0=birthday 1=loved+canGift 2=liked+canGift 3=canGift 4=giftedOut 5=maxed */
  priority: number;
}

// ── Item picker ───────────────────────────────────────────────────────────────

interface ItemPickerProps {
  options: TypeaheadOption[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

function ItemPicker({ options, selected, onAdd, onRemove }: ItemPickerProps) {
  return (
    <div className="gift-picker">
      <span className="gift-picker__label">Items in hand:</span>
      <div className="gift-picker__tags">
        {selected.map(id => {
          const opt = options.find(o => o.id === id);
          return opt ? (
            <span key={id} className="gift-picker__tag" title={opt.sublabel}>
              <span className="gift-picker__tag-icon" aria-hidden="true">{opt.icon}</span>
              {opt.label}
              <button className="gift-picker__tag-remove" onClick={() => onRemove(id)} aria-label={`Remove ${opt.label}`}>×</button>
            </span>
          ) : null;
        })}
        <TypeaheadInput
          options={options}
          excludeIds={selected}
          onSelect={onAdd}
          placeholder="+ Add item…"
          maxResults={8}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GiftGuidePage() {
  usePageTitle('Gift Guide');
  const { data, loading, error } = useGameData();
  const { activeSave }  = useUserData();

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

  // All giftable items as TypeaheadOptions (with sprite icons + category sublabel)
  const allOptions = useMemo<TypeaheadOption[]>(() => {
    const seen    = new Set<string>();
    const opts: TypeaheadOption[] = [];
    const itemMap = new Map((data?.items ?? []).map(i => [i.id, i]));

    const push = (ref: ItemRef) => {
      if (seen.has(ref.id)) return;
      seen.add(ref.id);
      const full = itemMap.get(ref.id);
      opts.push({
        id:       ref.id,
        label:    ref.name,
        sublabel: full?.category,
        icon: full?.spriteSheet && full?.spriteIndex !== undefined ? (
          <SpriteIcon
            spriteSheet={full.spriteSheet}
            spriteIndex={full.spriteIndex}
            isBigCraftable={full.isBigCraftable}
            size={20}
          />
        ) : <span style={{ fontSize: '1.1rem' }}>📦</span>,
      });
    };

    [...(data?.universalGifts?.loved ?? []), ...(data?.universalGifts?.liked ?? [])].forEach(push);
    (data?.npcs ?? []).forEach(npc => {
      [...(npc.gifts?.loved ?? []), ...(npc.gifts?.liked ?? [])].forEach(push);
    });
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  // Selected items as TypeaheadOptions so icon + label are available in the table
  const myItems = useMemo<TypeaheadOption[]>(
    () => myItemIds
      .map(id => allOptions.find(o => o.id === id))
      .filter((o): o is TypeaheadOption => !!o),
    [myItemIds, allOptions],
  );

  // ── Game-state condition filters ────────────────────────────────────────────
  const {
    communityStatus, setCommunityStatus,
    marriedTo:    marriedToFilter, setMarriedTo,
    islandUnlocked, setIslandUnlocked,
    saveCtx,
    marriageableNpcs,
  } = useScheduleFilters();

  // Resolve marriedTo as either the filter value or null
  const marriedTo = marriedToFilter || null;

  // ── Row computation ─────────────────────────────────────────────────────────

  const rows = useMemo<GiftRow[]>(() => {
    if (!data) return [];
    const univLovedIds = new Set((data.universalGifts?.loved ?? []).map(u => u.id));
    const univLikedIds = new Set((data.universalGifts?.liked ?? []).map(u => u.id));

    const npcList = activeSave
      ? data.npcs.filter(npc => {
          const hl = activeSave.heartLevels?.[npc.id] ?? 0;
          const fd = activeSave.friendshipData?.[npc.id];
          return hl < friendshipCap(npc, fd); // only show improvable
        })
      : data.npcs;

    return npcList.map(npc => {
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

      // Schedule segments — fall back to first variant if nothing matches the date
      let entries = bestVariantEntries(npc, season, weather, year, npc.id === marriedTo, day, saveCtx);
      if (entries.length === 0 && npc.schedules.length > 0) {
        entries = npc.schedules[0].entries;
      }
      const segments = buildSegments(entries);

      // Priority
      let priority: number;
      if (isBirthday)                                 priority = 0;
      else if (canGift && lovedMatches.length > 0)    priority = 1;
      else if (canGift && likedMatches.length > 0)    priority = 2;
      else if (canGift)                               priority = 3;
      else if (!isMaxed)                              priority = 4; // gifted out this week
      else                                            priority = 5; // maxed

      return { npc, isBirthday, heartLevel, cap, isMaxed, hasSave, giftsThisWeek, canGift, lovedMatches, likedMatches, segments, priority };
    }).sort((a, b) => a.priority - b.priority || a.npc.name.localeCompare(b.npc.name));
  }, [data, activeSave, season, day, year, weather, myItems, marriedTo, saveCtx]);

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const birthdays = rows.filter(r => r.isBirthday);

  return (
    <div className="page page--gift-guide">
      <h1 className="page__title">Gift Guide</h1>
      <p className="page__subtitle">
        Who to gift today — find villagers by schedule, match items to their preferences.
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
        <ScheduleFilters
          communityStatus={communityStatus} onCommunityStatus={setCommunityStatus}
          marriedTo={marriedToFilter}       onMarriedTo={setMarriedTo}
          islandUnlocked={islandUnlocked}   onIslandUnlocked={setIslandUnlocked}
          marriageableNpcs={marriageableNpcs}
        />
        <ItemPicker
          options={allOptions}
          selected={myItemIds}
          onAdd={id => setMyItemIds(prev => prev.includes(id) ? prev : [...prev, id])}
          onRemove={id => setMyItemIds(prev => prev.filter(i => i !== id))}
        />
      </div>

      {!activeSave && (
        <p className="gift-guide__no-save">
          💡 <a href="/saves">Load a save</a> to filter out maxed relationships and pre-fill the current date.
        </p>
      )}

      {/* ── Table ── */}
      {/* gift-table-outer clips any header overflow on narrow screens (overflow-x: clip
          doesn't create a scroll container, so the header's sticky still resolves
          against the body scroll — unlike overflow: hidden which would trap it). */}
      <div className="gift-table-outer">

        {/* Header sits ABOVE the h-scroll wrapper so page-scroll sticky works */}
        <div className="gift-table__head">
          <span className="gift-col--npc">Character</span>
          <span className="gift-col--gifts">Gift match</span>
          {/* Schedule Gantt header — hour marks every 2h */}
          <span className="gift-col--sched">
            {GIFT_LABEL_HOURS.map((t, i) => {
              const isFirst = i === 0;
              const isLast  = i === GIFT_LABEL_HOURS.length - 1;
              const tx = isFirst ? '0%' : isLast ? '-100%' : '-50%';
              return (
                <span
                  key={t}
                  className="gift-sched__label"
                  style={{ left: `${giftPct(t)}%`, transform: `translate(${tx}, -50%)` }}
                >
                  {formatGiftHour(t)}
                </span>
              );
            })}
          </span>
        </div>

        <div className="gift-table-wrap">
          <div className="gift-table">

            {/* Rows */}
            {rows.map(row => {
            const { npc, isBirthday, lovedMatches, likedMatches, segments, priority } = row;
            const rowClass = [
              'gift-row',
              isBirthday  ? 'gift-row--birthday'   : '',
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

                {/* Gift matches */}
                <div className="gift-col--gifts">
                  {myItems.length === 0 ? (
                    <span className="gift-match--empty">Add items above ↑</span>
                  ) : lovedMatches.length === 0 && likedMatches.length === 0 ? (
                    <span className="gift-match--none">—</span>
                  ) : (
                    <>
                      {lovedMatches.map(item => (
                        <span key={item.id} className="gift-match gift-match--loved" title={`${item.label} (loved)`}>
                          {item.icon}
                        </span>
                      ))}
                      {likedMatches.map(item => (
                        <span key={item.id} className="gift-match gift-match--liked" title={`${item.label} (liked)`}>
                          {item.icon}
                        </span>
                      ))}
                    </>
                  )}
                </div>

                {/* Schedule Gantt */}
                <div className="gift-col--sched">
                  {segments.map((seg, i) => {
                    const left  = giftPct(seg.startTime);
                    const width = giftPct(seg.endTime) - left;
                    if (width <= 0) return null;
                    return (
                      <div
                        key={i}
                        className="gift-sched__bar"
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${formatGiftTime(seg.startTime)} – ${formatGiftTime(seg.endTime)}: ${seg.location}`}
                      >
                        <span className="gift-sched__bar-label">{seg.location}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
