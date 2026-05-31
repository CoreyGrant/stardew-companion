import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGameData } from '../contexts/GameDataContext';
import { GameLink } from '../components/common/GameLink';
import { PortraitImg } from '../components/common/PortraitImg';
import { usePageTitle } from '../hooks/usePageTitle';
import type { NPC, ItemRef } from '../types/game';

const BASE = import.meta.env.BASE_URL;

type Mode = 'by-npc' | 'by-item';
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function GiftGuidePage() {
  usePageTitle('Gift Guide');
  const { data, loading, error } = useGameData();
  const [mode, setMode] = useState<Mode>('by-npc');
  const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    </div>
  );
}
