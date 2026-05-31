import { useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { useUserData } from '../contexts/UserDataContext';
import { GameLink } from '../components/common/GameLink';
import { PortraitImg } from '../components/common/PortraitImg';
import { usePageTitle } from '../hooks/usePageTitle';
import type { NPC, ItemRef } from '../types/game';
import type { FriendshipEntry } from '../types/save';

const BASE = import.meta.env.BASE_URL;

type Mode = 'by-npc' | 'by-item' | 'my-plan';
const UNIVERSAL_ID = '__universal__';

// ── Helpers ───────────────────────────────────────────────────────────────────

function PortraitChip({
  npc, selected, onClick,
}: { npc: NPC; selected: boolean; onClick: () => void }) {
  return (
    <button
      className={`npc-chip${selected ? ' npc-chip--selected' : ''}`}
      onClick={onClick}
      title={npc.name}
      aria-pressed={selected}
    >
      {npc.portrait ? (
        <PortraitImg src={`${BASE}sprites/portraits/${npc.portrait}`} size={32} />
      ) : (
        <span className="npc-chip__initial">{npc.name.charAt(0)}</span>
      )}
      <span className="npc-chip__name">{npc.name}</span>
    </button>
  );
}

function GiftList({ title, items, className }: { title: string; items: ItemRef[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={`gift-guide-section ${className ?? ''}`}>
      <h3 className="gift-guide-section__title">{title}</h3>
      <ul className="gift-guide-section__list">
        {items.map((item) => (
          <li key={item.id}>
            <GameLink type="item" id={item.id}>{item.name}</GameLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Maximum heart level achievable for this NPC given current relationship status.
 * Married    → 14
 * Dating/Engaged → 10
 * Non-marriageable (no romance) → 10
 * Marriageable + no save / Friendly → 8
 */
function getFriendshipCap(npc: NPC, fd?: FriendshipEntry): number {
  if (!fd) return npc.marriageable ? 8 : 10;
  const st = fd.status;
  if (st === 'Married')             return 14;
  if (st === 'Dating' || st === 'Engaged') return 10;
  if (!npc.marriageable)            return 10;
  return 8;
}

// ── Heart bar ─────────────────────────────────────────────────────────────────

function HeartBar({ current, cap, isMaxed }: { current: number; cap: number; isMaxed: boolean }) {
  const hearts = Array.from({ length: cap }, (_, i) => i < current);
  return (
    <div className={`plan-hearts${isMaxed ? ' plan-hearts--maxed' : ''}`} title={`${current}/${cap} hearts`}>
      {hearts.map((filled, i) => (
        <span key={i} className={`plan-heart${filled ? ' plan-heart--filled' : ''}`}>♥</span>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function GiftGuidePage() {
  usePageTitle('Gift Guide');
  const { data, loading, error } = useGameData();
  const { activeSave } = useUserData();
  const [mode, setMode] = useState<Mode>('by-npc');
  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ── My Plan state ─────────────────────────────────────────────────────────
  const [myItemIds, setMyItemIds] = useState<string[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  const [planDropdownOpen, setPlanDropdownOpen] = useState(false);
  const planSearchRef = useRef<HTMLInputElement>(null);

  // Index: itemId → { loved: npc[], liked: npc[] }
  const itemIndex = useMemo(() => {
    const idx = new Map<string, { loved: NPC[]; liked: NPC[] }>();
    const ensure = (id: string) => {
      if (!idx.has(id)) idx.set(id, { loved: [], liked: [] });
      return idx.get(id)!;
    };
    (data?.npcs ?? []).forEach((npc) => {
      npc.gifts?.loved?.forEach((item) => ensure(item.id).loved.push(npc));
      npc.gifts?.liked?.forEach((item) => ensure(item.id).liked.push(npc));
    });
    return idx;
  }, [data]);

  // Item map for search (name → id + name)
  const allItems = useMemo<ItemRef[]>(() => {
    const seen = new Set<string>();
    const result: ItemRef[] = [];
    (data?.npcs ?? []).forEach((npc) => {
      [...(npc.gifts?.loved ?? []), ...(npc.gifts?.liked ?? [])].forEach((item) => {
        if (!seen.has(item.id)) { seen.add(item.id); result.push(item); }
      });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems.slice(0, 40); // show first 40 when no search
    const q = search.toLowerCase();
    return allItems.filter((i) => i.name.toLowerCase().includes(q));
  }, [allItems, search]);

  // ── My Plan computations ──────────────────────────────────────────────────

  // ItemRef lookup by id
  const itemRefById = useMemo(() => {
    const m = new Map<string, ItemRef>();
    allItems.forEach((i) => m.set(i.id, i));
    return m;
  }, [allItems]);

  // Items currently in My Plan picker
  const myItems = useMemo<ItemRef[]>(() =>
    myItemIds.map((id) => itemRefById.get(id)).filter((x): x is ItemRef => x !== undefined),
  [myItemIds, itemRefById]);

  // Plan search results (items NOT already added)
  const planSearchResults = useMemo<ItemRef[]>(() => {
    const q = planSearch.trim().toLowerCase();
    if (!q) return [];
    return allItems.filter((i) => !myItemIds.includes(i.id) && i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [allItems, myItemIds, planSearch]);

  // NPC rows for My Plan
  const planRows = useMemo(() => {
    if (!data) return [];
    return data.npcs.map((npc) => {
      const fd   = activeSave?.friendshipData?.[npc.id];
      const heartLevel = activeSave?.heartLevels?.[npc.id] ?? 0;
      const cap  = getFriendshipCap(npc, fd);
      const isMaxed    = heartLevel >= cap;
      const giftsThisWeek = fd?.giftsThisWeek ?? 0;
      const giftsToday    = fd?.giftsToday    ?? 0;
      const canGiftMore   = !isMaxed && giftsThisWeek < 2;

      // Which of my items does this NPC love/like?
      const lovedMatches = myItems.filter((item) => {
        const aff = itemIndex.get(item.id);
        const isUnivLoved = data.universalGifts.loved.some((u) => u.id === item.id);
        return isUnivLoved || aff?.loved.some((n) => n.id === npc.id);
      });
      const likedMatches = myItems.filter((item) => {
        // Exclude items already matched as loved
        if (lovedMatches.some((lv) => lv.id === item.id)) return false;
        const aff = itemIndex.get(item.id);
        const isUnivLiked = data.universalGifts.liked.some((u) => u.id === item.id);
        return isUnivLiked || aff?.liked.some((n) => n.id === npc.id);
      });

      let priority: number;
      if (canGiftMore && lovedMatches.length > 0)    priority = 0;
      else if (canGiftMore && likedMatches.length > 0) priority = 1;
      else if (canGiftMore)                           priority = 2;
      else if (!isMaxed)                              priority = 3; // gifted out this week
      else                                            priority = 4; // maxed

      return { npc, heartLevel, cap, isMaxed, canGiftMore, giftsThisWeek, giftsToday, lovedMatches, likedMatches, priority };
    }).sort((a, b) => a.priority - b.priority || a.npc.name.localeCompare(b.npc.name));
  }, [data, activeSave, myItems, itemIndex]);

  // ── Plan picker handlers ──────────────────────────────────────────────────

  function addItem(id: string) {
    if (!myItemIds.includes(id)) setMyItemIds((prev) => [...prev, id]);
    setPlanSearch('');
    setPlanDropdownOpen(false);
    planSearchRef.current?.focus();
  }

  function removeItem(id: string) {
    setMyItemIds((prev) => prev.filter((i) => i !== id));
  }

  if (loading) return <div className="page-loading">Loading</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const npcs = data!.npcs;
  const univ = data!.universalGifts;

  // Resolve selected NPC
  const selectedNPC = selectedNPCId === UNIVERSAL_ID
    ? null
    : npcs.find((n) => n.id === selectedNPCId) ?? null;
  const showUniversal = selectedNPCId === UNIVERSAL_ID;

  return (
    <div className="page page--gift-guide">
      <h1 className="page__title">Gift Guide</h1>

      {/* ── Mode tabs ── */}
      <div className="gift-guide-tabs">
        <button
          className={`gift-guide-tab${mode === 'by-npc' ? ' gift-guide-tab--active' : ''}`}
          onClick={() => setMode('by-npc')}
        >By Villager</button>
        <button
          className={`gift-guide-tab${mode === 'by-item' ? ' gift-guide-tab--active' : ''}`}
          onClick={() => setMode('by-item')}
        >By Item</button>
        <button
          className={`gift-guide-tab${mode === 'my-plan' ? ' gift-guide-tab--active' : ''}`}
          onClick={() => setMode('my-plan')}
        >My Plan</button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BY-VILLAGER MODE
      ═══════════════════════════════════════════════════════════════════════ */}
      {mode === 'by-npc' && (
        <>
          {/* NPC chip grid */}
          <div className="npc-chip-grid" role="group" aria-label="Select a villager">
            {/* Universal gifts pseudo-chip */}
            <button
              className={`npc-chip npc-chip--universal${showUniversal ? ' npc-chip--selected' : ''}`}
              onClick={() => setSelectedNPCId(selectedNPCId === UNIVERSAL_ID ? null : UNIVERSAL_ID)}
              title="Universal gifts — loved/liked by all"
              aria-pressed={showUniversal}
            >
              <span className="npc-chip__initial">★</span>
              <span className="npc-chip__name">Everyone</span>
            </button>

            {npcs.map((npc) => (
              <PortraitChip
                key={npc.id}
                npc={npc}
                selected={selectedNPCId === npc.id}
                onClick={() => setSelectedNPCId(selectedNPCId === npc.id ? null : npc.id)}
              />
            ))}
          </div>

          {/* Universal gifts panel */}
          {showUniversal && (
            <div className="gift-guide-panel">
              <div className="gift-guide-panel__header">
                <span className="gift-guide-panel__portrait gift-guide-panel__portrait--universal">★</span>
                <div className="gift-guide-panel__info">
                  <h2 className="gift-guide-panel__name">Universal Gifts</h2>
                  <p className="gift-guide-panel__desc">Loved or liked by all villagers</p>
                </div>
              </div>
              <div className="gift-guide-panel__gifts">
                <GiftList title="❤️ Loved by everyone" items={univ.loved} className="gift-guide-section--loved" />
                <GiftList title="👍 Liked by everyone" items={univ.liked} className="gift-guide-section--liked" />
              </div>
            </div>
          )}

          {/* Selected NPC gifts panel */}
          {selectedNPC && (
            <div className="gift-guide-panel">
              <div className="gift-guide-panel__header">
                <div className="gift-guide-panel__portrait">
                  {selectedNPC.portrait ? (
                    <img
                      src={`${BASE}sprites/portraits/${selectedNPC.portrait}`}
                      alt=""
                      width={64} height={64}
                      style={{ imageRendering: 'pixelated', objectFit: 'none', objectPosition: '0 0' }}
                    />
                  ) : selectedNPC.name.charAt(0)}
                </div>
                <div className="gift-guide-panel__info">
                  <h2 className="gift-guide-panel__name">
                    <Link to={`/characters/${selectedNPC.id}`}>{selectedNPC.name}</Link>
                  </h2>
                  <p className="gift-guide-panel__desc">
                    Birthday:{' '}
                    {selectedNPC.birthday.season.charAt(0).toUpperCase() + selectedNPC.birthday.season.slice(1)}{' '}
                    {selectedNPC.birthday.day}
                    {selectedNPC.marriageable && <span className="gift-guide-panel__badge">Marriageable</span>}
                  </p>
                </div>
              </div>
              <div className="gift-guide-panel__gifts">
                <GiftList title="❤️ Loved" items={selectedNPC.gifts?.loved ?? []} className="gift-guide-section--loved" />
                <GiftList title="👍 Liked" items={selectedNPC.gifts?.liked ?? []} className="gift-guide-section--liked" />
                {(!selectedNPC.gifts?.loved?.length && !selectedNPC.gifts?.liked?.length) && (
                  <p className="gift-guide-panel__empty">No specific gift preferences recorded.</p>
                )}
              </div>
              <p className="gift-guide-panel__note">
                ★ Plus all{' '}
                <button className="gift-guide-panel__univ-link" onClick={() => setSelectedNPCId(UNIVERSAL_ID)}>
                  universal gifts
                </button>
              </p>
            </div>
          )}

          {/* No selection prompt */}
          {!selectedNPCId && (
            <p className="gift-guide-prompt">
              Select a villager above to see their gift preferences.
            </p>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BY-ITEM MODE
      ═══════════════════════════════════════════════════════════════════════ */}
      {mode === 'by-item' && (
        <>
          <div className="filter-bar">
            <input
              className="filter-bar__search"
              type="search"
              placeholder="Search gifts by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>

          {!search.trim() && (
            <p className="gift-guide-prompt">Search for an item to see which villagers love or like it.</p>
          )}

          <div className="gift-item-list">
            {filteredItems.map((item) => {
              const aff = itemIndex.get(item.id);
              const isUnivLoved = univ.loved.some((u) => u.id === item.id);
              const isUnivLiked = univ.liked.some((u) => u.id === item.id);
              const lovedBy = aff?.loved ?? [];
              const likedBy = aff?.liked ?? [];
              if (!lovedBy.length && !likedBy.length && !isUnivLoved && !isUnivLiked) return null;

              return (
                <div key={item.id} className="gift-item-row">
                  <div className="gift-item-row__name">
                    <GameLink type="item" id={item.id}>{item.name}</GameLink>
                    {isUnivLoved && <span className="gift-item-row__badge gift-item-row__badge--loved">★ All love</span>}
                    {isUnivLiked && <span className="gift-item-row__badge gift-item-row__badge--liked">★ All like</span>}
                  </div>
                  {lovedBy.length > 0 && (
                    <div className="gift-item-row__npc-list gift-item-row__npc-list--loved">
                      <span className="gift-item-row__taste">❤️</span>
                      {lovedBy.map((npc) => (
                        <Link key={npc.id} to={`/characters/${npc.id}`} className="npc-mini-chip" title={npc.name}>
                          {npc.portrait ? (
                            <PortraitImg src={`${BASE}sprites/portraits/${npc.portrait}`} size={24} alt={npc.name} />
                          ) : (
                            <span className="npc-mini-chip__initial">{npc.name.charAt(0)}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                  {likedBy.length > 0 && (
                    <div className="gift-item-row__npc-list gift-item-row__npc-list--liked">
                      <span className="gift-item-row__taste">👍</span>
                      {likedBy.map((npc) => (
                        <Link key={npc.id} to={`/characters/${npc.id}`} className="npc-mini-chip" title={npc.name}>
                          {npc.portrait ? (
                            <PortraitImg src={`${BASE}sprites/portraits/${npc.portrait}`} size={24} alt={npc.name} />
                          ) : (
                            <span className="npc-mini-chip__initial">{npc.name.charAt(0)}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {search.trim() && filteredItems.length === 0 && (
              <p className="page-empty">No gift matches found for "{search}".</p>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MY PLAN MODE
      ═══════════════════════════════════════════════════════════════════════ */}
      {mode === 'my-plan' && (
        <>
          {/* Save-data notice */}
          {!activeSave && (
            <p className="plan-notice">
              No save loaded — heart levels and gift limits are not shown.{' '}
              <Link to="/saves">Load a save</Link> to unlock full save-aware recommendations.
            </p>
          )}

          {/* Item picker */}
          <div className="plan-picker">
            <div className="plan-picker__label">What gifts do you have?</div>
            <div className="plan-picker__input-wrap">
              <input
                ref={planSearchRef}
                className="plan-picker__input"
                type="search"
                placeholder="Search for a gift item…"
                value={planSearch}
                onChange={(e) => { setPlanSearch(e.target.value); setPlanDropdownOpen(true); }}
                onFocus={() => { if (planSearch.trim()) setPlanDropdownOpen(true); }}
                onBlur={() => setTimeout(() => setPlanDropdownOpen(false), 150)}
                autoComplete="off"
              />
              {planDropdownOpen && planSearchResults.length > 0 && (
                <ul className="plan-picker__dropdown">
                  {planSearchResults.map((item) => (
                    <li key={item.id}>
                      <button
                        className="plan-picker__dropdown-item"
                        onMouseDown={() => addItem(item.id)}
                      >
                        {item.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Selected item chips */}
            {myItems.length > 0 && (
              <div className="plan-picker__chips">
                {myItems.map((item) => (
                  <span key={item.id} className="plan-item-chip">
                    <GameLink type="item" id={item.id}>{item.name}</GameLink>
                    <button
                      className="plan-item-chip__remove"
                      onClick={() => removeItem(item.id)}
                      title={`Remove ${item.name}`}
                      aria-label={`Remove ${item.name}`}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {myItems.length === 0 && (
            <p className="gift-guide-prompt">
              Search for items above to see which villagers would love or like them.
            </p>
          )}

          {/* NPC rows */}
          {myItems.length > 0 && (
            <div className="plan-npc-list">
              {planRows.map(({ npc, heartLevel, cap, isMaxed, canGiftMore, giftsThisWeek, giftsToday, lovedMatches, likedMatches }) => {
                const hasMatch = lovedMatches.length > 0 || likedMatches.length > 0;
                return (
                  <div
                    key={npc.id}
                    className={[
                      'plan-npc-row',
                      isMaxed           ? 'plan-npc-row--maxed'    : '',
                      !canGiftMore && !isMaxed ? 'plan-npc-row--gifted-out' : '',
                      hasMatch && canGiftMore  ? 'plan-npc-row--match'      : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {/* Portrait */}
                    <Link to={`/characters/${npc.id}`} className="plan-npc-row__portrait" title={npc.name}>
                      {npc.portrait ? (
                        <PortraitImg src={`${BASE}sprites/portraits/${npc.portrait}`} size={32} />
                      ) : (
                        <span className="plan-npc-row__initial">{npc.name.charAt(0)}</span>
                      )}
                    </Link>

                    {/* Name + hearts */}
                    <div className="plan-npc-row__info">
                      <Link to={`/characters/${npc.id}`} className="plan-npc-row__name">{npc.name}</Link>
                      {activeSave && (
                        <HeartBar current={heartLevel} cap={cap} isMaxed={isMaxed} />
                      )}
                    </div>

                    {/* Gift status badge */}
                    <div className="plan-npc-row__status">
                      {isMaxed ? (
                        <span className="plan-badge plan-badge--maxed">Max ♥</span>
                      ) : giftsThisWeek >= 2 ? (
                        <span className="plan-badge plan-badge--gifted-out">
                          {activeSave ? 'Gifted out' : ''}
                        </span>
                      ) : giftsToday > 0 ? (
                        <span className="plan-badge plan-badge--today">Gifted today</span>
                      ) : null}
                    </div>

                    {/* Matched items */}
                    <div className="plan-npc-row__matches">
                      {lovedMatches.map((item) => (
                        <span key={item.id} className="plan-match plan-match--loved" title="Loved gift">
                          ❤️ {item.name}
                        </span>
                      ))}
                      {likedMatches.map((item) => (
                        <span key={item.id} className="plan-match plan-match--liked" title="Liked gift">
                          👍 {item.name}
                        </span>
                      ))}
                      {!hasMatch && (
                        <span className="plan-match plan-match--none">No match</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
