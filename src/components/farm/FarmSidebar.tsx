import { useMemo, useState } from 'react';
import { useGameData } from '../../contexts/GameDataContext';
import { SpriteIcon } from './SpriteIcon';
import type { ToolState } from './HoverLayer';
import type { Season, TreeDef } from '../../types/game';
import type { CropZone, PathType, TapperType, TreeType } from '../../types/save';
import { isItemAllowedInInterior } from '../../data/interiorItems';
import type { InteriorContext } from '../../data/interiorItems';

type Tab = 'farming' | 'buildings' | 'misc' | 'machines' | 'trees';

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
  { id: '8',   label: 'Scarecrow', cheatId: '8'   },
  { id: '167', label: 'Deluxe',    cheatId: '167' },
];

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
  /** When true, hides the season selector and shows a tropical year-round label instead. */
  isIsland?: boolean;

  // ── Interior mode ────────────────────────────────────────────────────────────
  /** When true, shows a back button instead of season selector and filters tabs. */
  interiorMode?: boolean;
  /** Callback for the Back button in interior mode. */
  onBackToFarm?: () => void;
  /** Building name shown in the back button label. */
  interiorBuildingName?: string;
  /** When false, the Trees tab is hidden in interior mode. */
  interiorTreesAllowed?: boolean;
  /** Used to filter the machines list to only context-valid items. */
  interiorContext?: InteriorContext;
  /** When set, shows the Optimal Fill section at the bottom of the Machines tab. */
  interiorShedDims?: { w: number; h: number; corridor: number; count: number } | null;
  /** Called when the user clicks "Fill optimally" with the chosen machine cheatId. */
  onOptimalFill?: (machineId: string) => void;
}

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

  // Default to 'machines' in interior mode, 'farming' otherwise
  const [activeTab, setActiveTab] = useState<Tab>(() => interiorMode ? 'machines' : 'farming');
  const [search, setSearch] = useState('');
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [tapperOption, setTapperOption] = useState<TapperType | null>(null);
  const [optimalMachineId, setOptimalMachineId] = useState('');

  const q = search.toLowerCase();

  // Tabs visible in current mode
  const visibleTabs = useMemo(() => {
    if (!interiorMode) return ALL_TABS;
    return ALL_TABS.filter(t => {
      if (t.id === 'farming' || t.id === 'buildings') return false;
      if (t.id === 'trees' && !interiorTreesAllowed) return false;
      return true;
    });
  }, [interiorMode, interiorTreesAllowed]);

  const robinBuildings = (data?.buildingDefs ?? []).filter(
    (b) => b.builder === 'Robin' && (!b.familyLevel || b.familyLevel === 0),
  );
  const wizardBuildings = (data?.buildingDefs ?? []).filter(
    (b) => b.builder === 'Wizard',
  );

  // In interior mode: show all BigCraftables valid for the context.
  // On the main farm: show items with category=machine (excluding scarecrows).
  const machines = useMemo(() => {
    const allItems = data?.items ?? [];
    if (interiorMode && interiorContext) {
      return allItems
        .filter(i => isItemAllowedInInterior(i.cheatId, interiorContext, i.isBigCraftable))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return allItems.filter(i => i.category === 'machine' && !['8', '167'].includes(i.cheatId));
  }, [data, interiorMode, interiorContext]);

  const signItems = (data?.items ?? []).filter(
    (i) => i.category === 'decoration',
  );
  const sprinklerItems = (data?.items ?? []).filter(
    (i) => ['599','621','645'].includes(i.cheatId),
  );
  const scarecrowItems = (data?.items ?? []).filter(
    (i) => ['8','167'].includes(i.cheatId) && i.isBigCraftable,
  );

  const isActive = (t: ToolState) =>
    t.tool === toolState.tool &&
    t.buildingId === toolState.buildingId &&
    t.pathType === toolState.pathType &&
    t.itemId === toolState.itemId &&
    t.treeType === toolState.treeType;

  const handleTapperChange = (type: TapperType) => {
    const next = tapperOption === type ? null : type;
    setTapperOption(next);
    // Propagate into current tool state if already placing a tree
    if (toolState.tool === 'place-tree' && toolState.treeType) {
      onToolChange({ ...toolState, tapperType: next ?? undefined });
    }
  };

  const switchTab = (tab: Tab) => { setActiveTab(tab); setSearch(''); };

  /** Crops available for a given season, sorted alphabetically. */
  const cropsForSeason = (s: Season) =>
    (data?.crops ?? []).filter((c) => c.seasons.includes(s));

  /** Seasons to show in the zone crop picker. Island uses only summer, labeled year-round. */
  const zoneSeasonsRows: { id: Season; label: string }[] = isIsland
    ? [{ id: 'summer', label: 'Year-round' }]
    : SEASONS;

  return (
    <aside className="planner-sidebar">

      {/* Season selector / back button / tropical label */}
      <div className="planner-sidebar__seasons">
        {interiorMode ? (
          <button
            className="btn btn--sm planner-back-btn"
            onClick={() => onBackToFarm?.()}
          >
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

      {/* Tab content — scrollable */}
      <div className="planner-sidebar__content">

        {activeTab === 'farming' && !interiorMode && (
          <div className="planner-tab-body">
            <div className="planner-group-label">Sprinklers</div>
            <label className="planner-toggle">
              <input type="checkbox" checked={showSprinklerRanges} onChange={onToggleSprinklerRanges} />
              Show ranges
            </label>
            {SPRINKLERS.filter((s) => !q || s.label.toLowerCase().includes(q)).map((spr) => {
              const itemDef = sprinklerItems.find((i) => i.cheatId === spr.cheatId);
              return (
                <button
                  key={spr.id}
                  className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: spr.id }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(
                    isActive({ tool: 'place-item', itemId: spr.id })
                      ? { tool: 'select' }
                      : { tool: 'place-item', itemId: spr.id },
                  )}
                >
                  {itemDef?.spriteSheet && itemDef.spriteIndex !== undefined ? (
                    <SpriteIcon spriteSheet={itemDef.spriteSheet} spriteIndex={itemDef.spriteIndex} size={13} />
                  ) : null}
                  <span>{spr.label}</span>
                </button>
              );
            })}

            <div className="planner-group-label">Scarecrows</div>
            <label className="planner-toggle">
              <input type="checkbox" checked={showScarecrowRanges} onChange={onToggleScarecrowRanges} />
              Show ranges
            </label>
            {SCARECROWS.filter((s) => !q || s.label.toLowerCase().includes(q)).map((sc) => {
              const itemDef = scarecrowItems.find((i) => i.cheatId === sc.cheatId);
              return (
                <button
                  key={sc.id}
                  className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: sc.id }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(
                    isActive({ tool: 'place-item', itemId: sc.id })
                      ? { tool: 'select' }
                      : { tool: 'place-item', itemId: sc.id },
                  )}
                >
                  {itemDef?.spriteSheet && itemDef.spriteIndex !== undefined ? (
                    <SpriteIcon
                      spriteSheet={itemDef.spriteSheet}
                      spriteIndex={itemDef.spriteIndex}
                      isBigCraftable={itemDef.isBigCraftable}
                      size={13}
                    />
                  ) : null}
                  <span>{sc.label}</span>
                </button>
              );
            })}

            <div className="planner-group-label">Farmland Zones</div>
            {zones.length === 0 && (
              <p className="planner-hint">Draw zones to assign crops per season.</p>
            )}
            {zones.map((z) => {
              const isExpanded = expandedZoneId === z.id;
              return (
                <div
                  key={z.id}
                  className={`planner-zone-chip${toolState.tool === 'zone' && toolState.itemId === z.id ? ' planner-zone-chip--active' : ''}`}
                >
                  {/* Zone chip header row */}
                  <div className="planner-zone-chip__header">
                    <button
                      className="planner-zone-chip__name"
                      onClick={() => onToolChange({ tool: 'zone', itemId: z.id })}
                    >
                      {z.name}
                    </button>
                    {onSetZoneCrop && (
                      <button
                        className="planner-zone-chip__expand"
                        onClick={() => setExpandedZoneId(isExpanded ? null : z.id)}
                        aria-label={isExpanded ? 'Collapse crop picker' : 'Expand crop picker'}
                        title="Assign crops per season"
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    )}
                    <button
                      className="planner-zone-chip__remove"
                      onClick={() => { onRemoveZone(z.id); if (expandedZoneId === z.id) setExpandedZoneId(null); }}
                      aria-label={`Remove zone ${z.name}`}
                    >
                      ×
                    </button>
                  </div>

                  {/* Crop picker — shown when expanded */}
                  {isExpanded && onSetZoneCrop && (
                    <div className="planner-zone-crop-picker">
                      {zoneSeasonsRows.map(({ id: sid, label: slabel }) => {
                        const assignedId = z.crops[sid] ?? '';
                        const crops      = cropsForSeason(sid);
                        return (
                          <div key={sid} className={`planner-zone-crop-row planner-zone-crop-row--${sid}`}>
                            <span className="planner-zone-crop-row__label">{slabel}</span>
                            <select
                              className="planner-zone-crop-row__select"
                              value={assignedId}
                              onChange={(e) =>
                                onSetZoneCrop(z.id, sid, e.target.value || null)
                              }
                            >
                              <option value="">— none —</option>
                              {crops.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <button className="btn btn--sm btn--primary" onClick={onNewZone}>+ New Zone</button>
          </div>
        )}

        {activeTab === 'buildings' && !interiorMode && (
          <div className="planner-tab-body">
            <div className="planner-group-label">Robin</div>
            {robinBuildings
              .filter((b) => !q || b.name.toLowerCase().includes(q))
              .map((b) => (
                <button
                  key={b.id}
                  className={`planner-chip${isActive({ tool: 'place-building', buildingId: b.id }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(
                    isActive({ tool: 'place-building', buildingId: b.id })
                      ? { tool: 'select' }
                      : { tool: 'place-building', buildingId: b.id },
                  )}
                  title={`${b.name} (${b.width}×${b.height})`}
                >
                  {b.name}
                </button>
              ))}

            <div className="planner-group-label">Wizard</div>
            {wizardBuildings.length === 0 && !q && (
              <span className="planner-empty">None found</span>
            )}
            {wizardBuildings
              .filter((b) => !q || b.name.toLowerCase().includes(q))
              .map((b) => (
                <button
                  key={b.id}
                  className={`planner-chip${isActive({ tool: 'place-building', buildingId: b.id }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(
                    isActive({ tool: 'place-building', buildingId: b.id })
                      ? { tool: 'select' }
                      : { tool: 'place-building', buildingId: b.id },
                  )}
                  title={`${b.name} (${b.width}×${b.height})`}
                >
                  {b.name}
                </button>
              ))}
          </div>
        )}

        {activeTab === 'misc' && (
          <div className="planner-tab-body">
            <div className="planner-group-label">Paths &amp; Floors</div>
            {PATH_TYPES.filter(({ label }) => !q || label.toLowerCase().includes(q)).map(({ type, label, spriteIndex }) => (
              <button
                key={type}
                className={`planner-chip planner-chip--sprite${isActive({ tool: 'path-draw', pathType: type }) ? ' planner-chip--active' : ''}`}
                onClick={() => onToolChange(
                  isActive({ tool: 'path-draw', pathType: type })
                    ? { tool: 'select' }
                    : { tool: 'path-draw', pathType: type },
                )}
              >
                <SpriteIcon spriteSheet="springobjects" spriteIndex={spriteIndex} size={13} />
                <span>{label}</span>
              </button>
            ))}

            <div className="planner-group-label">Fences &amp; Gates</div>
            {FENCE_TYPES.filter(({ label }) => !q || label.toLowerCase().includes(q)).map(({ type, label, spriteIndex }) => (
              <button
                key={type}
                className={`planner-chip planner-chip--sprite${isActive({ tool: 'path-draw', pathType: type }) ? ' planner-chip--active' : ''}`}
                onClick={() => onToolChange(
                  isActive({ tool: 'path-draw', pathType: type })
                    ? { tool: 'select' }
                    : { tool: 'path-draw', pathType: type },
                )}
              >
                <SpriteIcon spriteSheet="springobjects" spriteIndex={spriteIndex} size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'machines' && (
          <div className="planner-tab-body">
            {machines
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .filter((item) => !q || item.name.toLowerCase().includes(q))
              .map((item) => (
                <button
                  key={item.cheatId}
                  className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: item.cheatId }) ? ' planner-chip--active' : ''}`}
                  onClick={() => onToolChange(
                    isActive({ tool: 'place-item', itemId: item.cheatId })
                      ? { tool: 'select' }
                      : { tool: 'place-item', itemId: item.cheatId },
                  )}
                  title={item.description || item.name}
                >
                  {item.spriteSheet && item.spriteIndex !== undefined ? (
                    <SpriteIcon
                      spriteSheet={item.spriteSheet}
                      spriteIndex={item.spriteIndex}
                      isBigCraftable={item.isBigCraftable}
                      size={13}
                    />
                  ) : null}
                  <span>{item.name}</span>
                </button>
              ))}

            {/* Signs — main farm only */}
            {!interiorMode && signItems.filter((item) => !q || item.name.toLowerCase().includes(q)).length > 0 && (
              <>
                <div className="planner-group-label">Signs</div>
                {signItems
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .filter((item) => !q || item.name.toLowerCase().includes(q))
                  .map((item) => (
                    <button
                      key={item.cheatId}
                      className={`planner-chip planner-chip--sprite${isActive({ tool: 'place-item', itemId: item.cheatId }) ? ' planner-chip--active' : ''}`}
                      onClick={() => onToolChange(
                        isActive({ tool: 'place-item', itemId: item.cheatId })
                          ? { tool: 'select' }
                          : { tool: 'place-item', itemId: item.cheatId },
                      )}
                      title={item.description || item.name}
                    >
                      {item.spriteSheet && item.spriteIndex !== undefined ? (
                        <SpriteIcon
                          spriteSheet={item.spriteSheet}
                          spriteIndex={item.spriteIndex}
                          isBigCraftable={item.isBigCraftable}
                          size={13}
                        />
                      ) : null}
                      <span>{item.name}</span>
                    </button>
                  ))}
              </>
            )}

            {/* Optimal fill — sheds only, interior mode */}
            {interiorMode && interiorShedDims && (
              <div className="planner-optimal">
                <div className="planner-group-label">Optimal Fill</div>
                <select
                  className="planner-optimal__select"
                  value={optimalMachineId}
                  onChange={(e) => setOptimalMachineId(e.target.value)}
                >
                  <option value="">— pick a machine —</option>
                  {machines.map((item) => (
                    <option key={item.cheatId} value={item.cheatId}>{item.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn--sm btn--primary planner-optimal__btn"
                  disabled={!optimalMachineId}
                  onClick={() => { if (optimalMachineId) onOptimalFill?.(optimalMachineId); }}
                >
                  Fill ({interiorShedDims.count})
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trees' && (
          <div className="planner-tab-body">
            {/* Tapper options */}
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

            {(['wild', 'fruit'] as const).map((group) => {
              const defs = treeDefs.filter((td) =>
                (group === 'fruit' ? td.isFruitTree : !td.isFruitTree) &&
                (!q || td.name.toLowerCase().includes(q)),
              );
              if (defs.length === 0) return null;
              return (
                <div key={group}>
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
          </div>
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
