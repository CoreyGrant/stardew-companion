import { useMemo, useState } from 'react';
import { useGameData } from '../../contexts/GameDataContext';
import { SpriteIcon } from './SpriteIcon';
import type { ToolState } from './HoverLayer';
import type { Season, TreeDef } from '../../types/game';
import type { CropZone, PathType, TapperType, TreeType } from '../../types/save';
import { isItemAllowedInInterior } from '../../data/interiorItems';
import type { InteriorContext } from '../../data/interiorItems';

type Tab = 'farming' | 'buildings' | 'misc' | 'machines' | 'trees';

// ── Collapsible section (defined outside FarmSidebar for stable identity) ─────

interface SectionProps {
  id: string;
  label: string;
  isOpen: boolean;
  onOpen: () => void;
  children: React.ReactNode;
  colBody?: boolean;
}

function SidebarSection({ label, isOpen, onOpen, children, colBody = false }: SectionProps) {
  return (
    <div className={`planner-section${isOpen ? ' planner-section--open' : ''}`}>
      <button
        className="planner-section__hdr"
        onClick={onOpen}
        aria-expanded={isOpen}
      >
        {label}
        <span className="planner-section__caret">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className={`planner-section__body${colBody ? ' planner-section__body--col' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEASONS: { id: Season; label: string }[] = [
  { id: 'spring', label: 'Spr' },
  { id: 'summer', label: 'Sum' },
  { id: 'fall',   label: 'Fall' },
  { id: 'winter', label: 'Win' },
];

const ALL_TABS: { id: Tab; label: string }[] = [
  { id: 'farming',   label: 'Farm'  },
  { id: 'buildings', label: 'Build' },
  { id: 'misc',      label: 'Misc'  },
  { id: 'machines',  label: 'Mach'  },
  { id: 'trees',     label: 'Trees' },
];

const PATH_TYPES: { type: PathType; label: string; spriteIndex: number }[] = [
  { type: 'wood',           label: 'Wood Path',      spriteIndex: 405 },
  { type: 'stone',          label: 'Stone Floor',    spriteIndex: 329 },
  { type: 'gravel',         label: 'Gravel Path',    spriteIndex: 407 },
  { type: 'wood_plank',     label: 'Rustic Plank',   spriteIndex: 840 },
  { type: 'crystal',        label: 'Crystal Path',   spriteIndex: 409 },
  { type: 'cobblestone',    label: 'Cobblestone',    spriteIndex: 411 },
  { type: 'stepping_stone', label: 'Stepping Stone', spriteIndex: 415 },
  { type: 'straw',          label: 'Straw Floor',    spriteIndex: 401 },
  { type: 'dirt',           label: 'Wood Floor',     spriteIndex: 328 },
];

const FENCE_TYPES: { type: PathType; label: string; spriteIndex: number }[] = [
  { type: 'fence_wood',     label: 'Wood Fence',     spriteIndex: 322 },
  { type: 'fence_stone',    label: 'Stone Fence',    spriteIndex: 323 },
  { type: 'fence_iron',     label: 'Iron Fence',     spriteIndex: 324 },
  { type: 'fence_hardwood', label: 'Hardwood Fence', spriteIndex: 298 },
  { type: 'gate',           label: 'Gate',           spriteIndex: 325 },
];

const SPRINKLERS = [
  { id: '599',          label: 'Basic',          cheatId: '599' },
  { id: '621',          label: 'Quality',         cheatId: '621' },
  { id: '645',          label: 'Iridium',         cheatId: '645' },
  { id: 'qi-sprinkler', label: 'Iridium+Nozzle',  cheatId: '645' },
];

const SCARECROWS = [
  { id: '8',   label: 'Scarecrow',  cheatId: '8'   },
  { id: '110', label: 'Rarecrow 1', cheatId: '110' },
  { id: '113', label: 'Rarecrow 2', cheatId: '113' },
  { id: '126', label: 'Rarecrow 3', cheatId: '126' },
  { id: '136', label: 'Rarecrow 4', cheatId: '136' },
  { id: '137', label: 'Rarecrow 5', cheatId: '137' },
  { id: '138', label: 'Rarecrow 6', cheatId: '138' },
  { id: '139', label: 'Rarecrow 7', cheatId: '139' },
  { id: '140', label: 'Rarecrow 8', cheatId: '140' },
  { id: '167', label: 'Deluxe',     cheatId: '167' },
];

/** Default open section key per tab. */
const DEFAULT_OPEN: Record<Tab, string> = {
  farming:   'sprinklers',
  buildings: 'robin',
  misc:      'paths',
  machines:  'machines',
  trees:     'trees',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  season: Season;
  onSeasonChange: (s: Season) => void;
  zones: CropZone[];
  treeDefs: TreeDef[];
  toolState: ToolState;
  onToolChange: (t: ToolState) => void;
  onNewZone: () => void;
  onRemoveZone: (id: string) => void;
  onSetZoneCrop?: (zoneId: string, season: Season, cropId: string | null) => void;
  showSprinklerRanges: boolean;
  onToggleSprinklerRanges: () => void;
  showScarecrowRanges: boolean;
  onToggleScarecrowRanges: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  /** When true, shows a tropical year-round label instead of season selector. */
  isIsland?: boolean;

  // ── Interior mode ────────────────────────────────────────────────────────────
  interiorMode?: boolean;
  onBackToFarm?: () => void;
  interiorBuildingName?: string;
  interiorTreesAllowed?: boolean;
  interiorContext?: InteriorContext;
  interiorShedDims?: { w: number; h: number; corridor: number; count: number } | null;
  onOptimalFill?: (machineId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FarmSidebar({
  season, onSeasonChange,
  zones, treeDefs, toolState, onToolChange, onNewZone, onRemoveZone, onSetZoneCrop,
  showSprinklerRanges, onToggleSprinklerRanges,
  showScarecrowRanges, onToggleScarecrowRanges,
  canUndo, canRedo, onUndo, onRedo, onFitView,
  isIsland = false,
  interiorMode = false,
  onBackToFarm,
  interiorBuildingName,
  interiorTreesAllowed = false,
  interiorContext,
  interiorShedDims,
  onOptimalFill,
}: Props) {
  const { data } = useGameData();

  const [activeTab, setActiveTab] = useState<Tab>(() => interiorMode ? 'machines' : 'farming');
  const [search, setSearch]       = useState('');
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [tapperOption, setTapperOption]     = useState<TapperType | null>(null);
  const [optimalMachineId, setOptimalMachineId] = useState('');

  // Per-tab open section — accordion, one open at a time
  const [openSections, setOpenSections] = useState<Record<Tab, string>>(DEFAULT_OPEN);

  const q = search.toLowerCase();
  const curSection = openSections[activeTab];
  const setSection = (key: string) => setOpenSections(prev => ({ ...prev, [activeTab]: key }));

  const visibleTabs = useMemo(() => {
    if (!interiorMode) return ALL_TABS;
    return ALL_TABS.filter(t => {
      if (t.id === 'farming' || t.id === 'buildings') return false;
      if (t.id === 'trees' && !interiorTreesAllowed) return false;
      return true;
    });
  }, [interiorMode, interiorTreesAllowed]);

  const robinBuildings  = (data?.buildingDefs ?? []).filter(b => b.builder === 'Robin' && (!b.familyLevel || b.familyLevel === 0));
  const wizardBuildings = (data?.buildingDefs ?? []).filter(b => b.builder === 'Wizard');

  const machines = useMemo(() => {
    const allItems = data?.items ?? [];
    if (interiorMode && interiorContext) {
      return allItems.filter(i => isItemAllowedInInterior(i.cheatId, interiorContext, i.isBigCraftable)).sort((a, b) => a.name.localeCompare(b.name));
    }
    return allItems.filter(i => i.category === 'machine' && !['8', '167'].includes(i.cheatId));
  }, [data, interiorMode, interiorContext]);

  const signItems     = (data?.items ?? []).filter(i => i.category === 'decoration');
  const sprinklerItems = (data?.items ?? []).filter(i => ['599','621','645'].includes(i.cheatId));
  const scarecrowItems = (data?.items ?? []).filter(i => ['8','110','113','126','136','137','138','139','140','167'].includes(i.cheatId) && i.isBigCraftable);

  const isActive = (t: ToolState) =>
    t.tool === toolState.tool &&
    t.buildingId === toolState.buildingId &&
    t.pathType === toolState.pathType &&
    t.itemId === toolState.itemId &&
    t.treeType === toolState.treeType;

  const handleTapperChange = (type: TapperType) => {
    const next = tapperOption === type ? null : type;
    setTapperOption(next);
    if (toolState.tool === 'place-tree' && toolState.treeType) {
      onToolChange({ ...toolState, tapperType: next ?? undefined });
    }
  };

  const switchTab = (tab: Tab) => { setActiveTab(tab); setSearch(''); };

  const cropsForSeason = (s: Season) => (data?.crops ?? []).filter(c => c.seasons.includes(s));
  const zoneSeasonsRows: { id: Season; label: string }[] = isIsland
    ? [{ id: 'summer', label: 'Year-round' }]
    : SEASONS;

  // Helper to create a section's open/onOpen props
  const sp = (id: string) => ({ id, isOpen: curSection === id, onOpen: () => setSection(id) });

  return (
    <aside className="planner-sidebar">

      {/* Season selector / back button / tropical label */}
      <div className="planner-sidebar__seasons">
        {interiorMode ? (
          <button className="btn btn--sm planner-back-btn" onClick={() => onBackToFarm?.()}>
            ← {interiorBuildingName ?? 'Farm'}
          </button>
        ) : isIsland ? (
          <div className="planner-season planner-season--island">
            <span className="planner-season__tropical">🌴 Year-round</span>
          </div>
        ) : (
          <div className="planner-season">
            {SEASONS.map(({ id, label }) => (
              <button
                key={id}
                className={`planner-season__btn planner-season__btn--${id}${season === id ? ' planner-season__btn--active' : ''}`}
                onClick={() => onSeasonChange(id)}
                title={id.charAt(0).toUpperCase() + id.slice(1)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="planner-tabs" role="tablist">
        {visibleTabs.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            className={`planner-tabs__tab${activeTab === id ? ' planner-tabs__tab--active' : ''}`}
            onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="planner-search">
        <input
          className="planner-search__input"
          type="search"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tab content — collapsible sections, one open at a time */}
      <div className="planner-sidebar__content">

        {/* ── Farming tab ───────────────────────────────────────────────────── */}
        {activeTab === 'farming' && !interiorMode && (
          <>
            <SidebarSection {...sp('sprinklers')} label="Sprinklers">
              <label className="planner-toggle" style={{ width: '100%' }}>
                <input type="checkbox" checked={showSprinklerRanges} onChange={onToggleSprinklerRanges} />
                Show ranges
              </label>
              {SPRINKLERS.filter(s => !q || s.label.toLowerCase().includes(q)).map((spr) => {
                const itemDef = sprinklerItems.find(i => i.cheatId === spr.cheatId);
                return (
                  <button
                    key={spr.id}
                    className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: spr.id }) ? ' planner-chip--active' : ''}`}
                    onClick={() => onToolChange(isActive({ tool: 'place-item', itemId: spr.id }) ? { tool: 'select' } : { tool: 'place-item', itemId: spr.id })}
                  >
                    {itemDef?.spriteSheet && itemDef.spriteIndex !== undefined &&
                      <SpriteIcon spriteSheet={itemDef.spriteSheet} spriteIndex={itemDef.spriteIndex} size={13} />}
                    <span>{spr.label}</span>
                  </button>
                );
              })}
            </SidebarSection>

            <SidebarSection {...sp('scarecrows')} label="Scarecrows">
              <label className="planner-toggle" style={{ width: '100%' }}>
                <input type="checkbox" checked={showScarecrowRanges} onChange={onToggleScarecrowRanges} />
                Show ranges
              </label>
              {SCARECROWS.filter(s => !q || s.label.toLowerCase().includes(q)).map((sc) => {
                const itemDef = scarecrowItems.find(i => i.cheatId === sc.cheatId);
                return (
                  <button
                    key={sc.id}
                    className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: sc.id }) ? ' planner-chip--active' : ''}`}
                    onClick={() => onToolChange(isActive({ tool: 'place-item', itemId: sc.id }) ? { tool: 'select' } : { tool: 'place-item', itemId: sc.id })}
                  >
                    {itemDef?.spriteSheet && itemDef.spriteIndex !== undefined &&
                      <SpriteIcon spriteSheet={itemDef.spriteSheet} spriteIndex={itemDef.spriteIndex} isBigCraftable={itemDef.isBigCraftable} size={13} />}
                    <span>{sc.label}</span>
                  </button>
                );
              })}
            </SidebarSection>

            <SidebarSection {...sp('zones')} label="Crop Zones" colBody>
              {zones.length === 0 && <p className="planner-hint">Draw zones to assign crops per season.</p>}
              {zones.map((z) => {
                const isExpanded = expandedZoneId === z.id;
                return (
                  <div
                    key={z.id}
                    className={`planner-zone-chip${toolState.tool === 'zone' && toolState.itemId === z.id ? ' planner-zone-chip--active' : ''}`}
                  >
                    <div className="planner-zone-chip__header">
                      <button className="planner-zone-chip__name" onClick={() => onToolChange({ tool: 'zone', itemId: z.id })}>
                        {z.name}
                      </button>
                      {onSetZoneCrop && (
                        <button
                          className="planner-zone-chip__expand"
                          onClick={() => setExpandedZoneId(isExpanded ? null : z.id)}
                          aria-label={isExpanded ? 'Collapse crop picker' : 'Expand crop picker'}
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      )}
                      <button
                        className="planner-zone-chip__remove"
                        onClick={() => { onRemoveZone(z.id); if (expandedZoneId === z.id) setExpandedZoneId(null); }}
                        aria-label={`Remove zone ${z.name}`}
                      >×</button>
                    </div>
                    {isExpanded && onSetZoneCrop && (
                      <div className="planner-zone-crop-picker">
                        {zoneSeasonsRows.map(({ id: sid, label: slabel }) => (
                          <div key={sid} className={`planner-zone-crop-row planner-zone-crop-row--${sid}`}>
                            <span className="planner-zone-crop-row__label">{slabel}</span>
                            <select
                              className="planner-zone-crop-row__select"
                              value={z.crops[sid] ?? ''}
                              onChange={(e) => onSetZoneCrop(z.id, sid, e.target.value || null)}
                            >
                              <option value="">— none —</option>
                              {cropsForSeason(sid).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <button className="btn btn--sm btn--primary" onClick={onNewZone}>+ New Zone</button>
            </SidebarSection>
          </>
        )}

        {/* ── Buildings tab ─────────────────────────────────────────────────── */}
        {activeTab === 'buildings' && !interiorMode && (
          <>
            <SidebarSection {...sp('robin')} label="Robin">
              {robinBuildings.filter(b => !q || b.name.toLowerCase().includes(q)).map(b => (
                <button
                  key={b.id}
                  className={`planner-chip${isActive({ tool: 'place-building', buildingId: b.id }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(isActive({ tool: 'place-building', buildingId: b.id }) ? { tool: 'select' } : { tool: 'place-building', buildingId: b.id })}
                  title={`${b.name} (${b.width}×${b.height})`}
                >
                  {b.name}
                </button>
              ))}
            </SidebarSection>

            <SidebarSection {...sp('wizard')} label="Wizard">
              {wizardBuildings.length === 0 && !q && <span className="planner-empty">None found</span>}
              {wizardBuildings.filter(b => !q || b.name.toLowerCase().includes(q)).map(b => (
                <button
                  key={b.id}
                  className={`planner-chip${isActive({ tool: 'place-building', buildingId: b.id }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(isActive({ tool: 'place-building', buildingId: b.id }) ? { tool: 'select' } : { tool: 'place-building', buildingId: b.id })}
                  title={`${b.name} (${b.width}×${b.height})`}
                >
                  {b.name}
                </button>
              ))}
            </SidebarSection>
          </>
        )}

        {/* ── Misc tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'misc' && (
          <>
            <SidebarSection {...sp('paths')} label="Paths &amp; Floors">
              {PATH_TYPES.filter(({ label }) => !q || label.toLowerCase().includes(q)).map(({ type, label, spriteIndex }) => (
                <button
                  key={type}
                  className={`planner-chip planner-chip--sprite${isActive({ tool: 'path-draw', pathType: type }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(isActive({ tool: 'path-draw', pathType: type }) ? { tool: 'select' } : { tool: 'path-draw', pathType: type })}
                >
                  <SpriteIcon spriteSheet="springobjects" spriteIndex={spriteIndex} size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </SidebarSection>

            <SidebarSection {...sp('fences')} label="Fences &amp; Gates">
              {FENCE_TYPES.filter(({ label }) => !q || label.toLowerCase().includes(q)).map(({ type, label, spriteIndex }) => (
                <button
                  key={type}
                  className={`planner-chip planner-chip--sprite${isActive({ tool: 'path-draw', pathType: type }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(isActive({ tool: 'path-draw', pathType: type }) ? { tool: 'select' } : { tool: 'path-draw', pathType: type })}
                >
                  <SpriteIcon spriteSheet="springobjects" spriteIndex={spriteIndex} size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </SidebarSection>
          </>
        )}

        {/* ── Machines tab ──────────────────────────────────────────────────── */}
        {activeTab === 'machines' && (
          <>
            <SidebarSection {...sp('machines')} label="Machines">
              {machines
                .slice().sort((a, b) => a.name.localeCompare(b.name))
                .filter(item => !q || item.name.toLowerCase().includes(q))
                .map(item => (
                  <button
                    key={item.cheatId}
                    className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: item.cheatId }) ? ' planner-chip--active' : ''}`}
                    onClick={() => onToolChange(isActive({ tool: 'place-item', itemId: item.cheatId }) ? { tool: 'select' } : { tool: 'place-item', itemId: item.cheatId })}
                    title={item.description || item.name}
                  >
                    {item.spriteSheet && item.spriteIndex !== undefined &&
                      <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} isBigCraftable={item.isBigCraftable} size={13} />}
                    <span>{item.name}</span>
                  </button>
                ))}

              {/* Signs — main farm only */}
              {!interiorMode && signItems.filter(item => !q || item.name.toLowerCase().includes(q)).length > 0 && (
                <>
                  <div className="planner-group-label">Signs</div>
                  {signItems.slice().sort((a, b) => a.name.localeCompare(b.name))
                    .filter(item => !q || item.name.toLowerCase().includes(q))
                    .map(item => (
                      <button
                        key={item.cheatId}
                        className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: item.cheatId }) ? ' planner-chip--active' : ''}`}
                        onClick={() => onToolChange(isActive({ tool: 'place-item', itemId: item.cheatId }) ? { tool: 'select' } : { tool: 'place-item', itemId: item.cheatId })}
                        title={item.description || item.name}
                      >
                        {item.spriteSheet && item.spriteIndex !== undefined &&
                          <SpriteIcon spriteSheet={item.spriteSheet} spriteIndex={item.spriteIndex} isBigCraftable={item.isBigCraftable} size={13} />}
                        <span>{item.name}</span>
                      </button>
                    ))}
                </>
              )}
            </SidebarSection>

            {/* Optimal fill — sheds only, interior mode */}
            {interiorMode && interiorShedDims && (
              <SidebarSection {...sp('optimal-fill')} label="Optimal Fill" colBody>
                <select
                  className="planner-optimal__select"
                  value={optimalMachineId}
                  onChange={(e) => setOptimalMachineId(e.target.value)}
                >
                  <option value="">— pick a machine —</option>
                  {machines.map(item => <option key={item.cheatId} value={item.cheatId}>{item.name}</option>)}
                </select>
                <button
                  className="btn btn--sm btn--primary planner-optimal__btn"
                  disabled={!optimalMachineId}
                  onClick={() => { if (optimalMachineId) onOptimalFill?.(optimalMachineId); }}
                >
                  Fill ({interiorShedDims.count})
                </button>
              </SidebarSection>
            )}
          </>
        )}

        {/* ── Trees tab ─────────────────────────────────────────────────────── */}
        {activeTab === 'trees' && (
          <>
            {/* Tapper options — pinned above sections */}
            <div className="planner-tapper-opts">
              <label className="planner-tapper-opts__label">
                <input
                  type="checkbox"
                  checked={tapperOption === 'tapper'}
                  onChange={() => handleTapperChange('tapper')}
                />
                Tapper
              </label>
              <label className="planner-tapper-opts__label">
                <input
                  type="checkbox"
                  checked={tapperOption === 'heavy-tapper'}
                  onChange={() => handleTapperChange('heavy-tapper')}
                />
                Heavy Tapper
              </label>
            </div>

            <SidebarSection {...sp('trees')} label="Trees">
              {(['wild', 'fruit'] as const).map((group) => {
                const defs = treeDefs.filter(td =>
                  (group === 'fruit' ? td.isFruitTree : !td.isFruitTree) &&
                  (!q || td.name.toLowerCase().includes(q)),
                );
                if (defs.length === 0) return null;
                return (
                  <div key={group} style={{ width: '100%' }}>
                    <p className="planner-section-label">
                      {group === 'wild' ? 'Wild Trees' : 'Fruit Trees'}
                    </p>
                    {defs.map((td) => {
                      const treeType = td.type as TreeType;
                      const active   = isActive({ tool: 'place-tree', treeType });
                      return (
                        <button
                          key={treeType}
                          className={`planner-chip${active ? ' planner-chip--active' : ''}`}
                          onClick={() => onToolChange(
                            active
                              ? { tool: 'select' }
                              : { tool: 'place-tree', treeType, tapperType: tapperOption ?? undefined },
                          )}
                          title={td.name}
                        >
                          {td.name.replace(/ Tree$/i, '')}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </SidebarSection>
          </>
        )}

      </div>

      {/* Undo / Redo / Delete / Fit — always visible */}
      <div className="planner-sidebar__actions">
        <button className="btn btn--sm" onClick={onUndo} disabled={!canUndo} aria-label="Undo">↩</button>
        <button className="btn btn--sm" onClick={onRedo} disabled={!canRedo} aria-label="Redo">↪</button>
        <button
          className={`btn btn--sm${toolState.tool === 'erase' ? ' btn--danger' : ''}`}
          onClick={() => onToolChange(toolState.tool === 'erase' ? { tool: 'select' } : { tool: 'erase' })}
          aria-label="Delete tool"
          title="Delete: click any object to remove it"
        >
          ✕ Del
        </button>
        <button className="btn btn--sm planner-fit-btn" onClick={onFitView} aria-label="Fit to view">⊡ Fit</button>
      </div>
    </aside>
  );
}
