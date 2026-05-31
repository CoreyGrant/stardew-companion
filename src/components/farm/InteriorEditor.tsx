import { useCallback, useMemo, useState } from 'react';
import type { DrawRect } from '../../hooks/usePlannerGrid';
import { usePlannerGrid } from '../../hooks/usePlannerGrid';
import { FarmCanvas, TILE_SIZE } from './FarmCanvas';
import type { ToolState } from './FarmCanvas';
import { FarmSidebar } from './FarmSidebar';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import { FishPickerModal } from './FishPickerModal';
import {
  getInteriorContext,
  getInteriorZoneData,
  SHED_DIMS,
  generateOptimalLayout,
} from '../../data/interiorItems';
import { canPlaceItem, canPlacePath, canPlaceTree } from '../../utils/farmPlacement';
import type {
  PlacedBuilding, PlacedItem, PlacedPath, PlacedTree, CropZone,
  InteriorLayout, PathType, TreeType, TapperType, TileRect,
} from '../../types/save';
import type { Season } from '../../types/game';
import type { BuildingDef, Item, TreeDef, Crop } from '../../types/game';

interface CtxMenuState {
  x: number;
  y: number;
  type: 'item' | 'tree';
  targetId: string;
}

interface Props {
  building: PlacedBuilding;
  buildingDef: BuildingDef | null;
  interior: InteriorLayout;
  allItems: Item[];
  treeDefs: TreeDef[];
  /** Crop definitions keyed by crop id — used to render crop icons inside zones (e.g. greenhouse). */
  cropMap?: Map<string, Crop>;
  onBack: (savedInterior: InteriorLayout) => void;
}

export function InteriorEditor({
  building, buildingDef, interior, allItems, treeDefs, cropMap, onBack,
}: Props) {
  // ── Zone data ─────────────────────────────────────────────────────────────────
  const { gridWidth, gridHeight, farmBaseType, zoneMap, treesAllowed } = useMemo(
    () => getInteriorZoneData(building.buildingId, buildingDef),
    [building.buildingId, buildingDef],
  );

  // ── Local interior state ──────────────────────────────────────────────────────
  const [localInterior, setLocalInterior] = useState<InteriorLayout>(() => ({
    items: interior.items ?? [],
    paths: interior.paths ?? [],
    trees: interior.trees ?? [],
    zones: interior.zones ?? [],
  }));

  // ── Tool / UI state ───────────────────────────────────────────────────────────
  const [toolState, setToolState] = useState<ToolState>({ tool: 'select' });
  const [contextMenu, setContextMenu] = useState<CtxMenuState | null>(null);
  const [gemPickerItemId, setGemPickerItemId] = useState<string | null>(null);

  // Gem items (for Crystalarium picker)
  const gemItems = useMemo(
    () => allItems.filter(i => i.category === 'gem' || i.category === 'mineral').sort((a, b) => a.name.localeCompare(b.name)),
    [allItems],
  );

  // ── Stable empty occupancy (no buildings inside buildings) ───────────────────
  const emptyBuildingOcc     = useMemo(() => new Set<string>(), []);
  const emptyBuildingDefMap  = useMemo(() => new Map<string, BuildingDef>(), []);

  // ── Item map for FarmCanvas tooltips ─────────────────────────────────────────
  const itemMap = useMemo(
    () => new Map(allItems.map(i => [i.cheatId, i])),
    [allItems],
  );

  // ── Synthetic FarmLayout for FarmCanvas ──────────────────────────────────────
  const farmLayout = useMemo(() => ({
    season: 'spring' as const,
    zones: localInterior.zones ?? [],
    buildings: [],
    paths: localInterior.paths,
    items: localInterior.items,
    trees: localInterior.trees ?? [],
    interiors: {},
  }), [localInterior]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const placeItemRect = useCallback((rect: TileRect, itemId: string, gemId?: string) => {
    setLocalInterior(prev => {
      const iOcc = new Set(prev.items.map(i => `${i.x},${i.y}`));
      const newItems: PlacedItem[] = [];
      for (let dy = 0; dy < rect.h; dy++) {
        for (let dx = 0; dx < rect.w; dx++) {
          const tx = rect.x + dx, ty = rect.y + dy;
          const key = `${tx},${ty}`;
          if (!iOcc.has(key) &&
              canPlaceItem(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, emptyBuildingOcc, iOcc)) {
            iOcc.add(key);
            newItems.push({ id: crypto.randomUUID(), itemId, x: tx, y: ty, ...(gemId ? { gemId } : {}) });
          }
        }
      }
      if (newItems.length === 0) return prev;
      return { ...prev, items: [...prev.items, ...newItems] };
    });
  }, [zoneMap, farmBaseType, gridWidth, gridHeight, emptyBuildingOcc]);

  const paintPathRect = useCallback((rect: TileRect, pathType: PathType) => {
    setLocalInterior(prev => {
      const inRect = (x: number, y: number) =>
        x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const filtered = prev.paths.filter(p => !inRect(p.x, p.y));
      const newPaths: PlacedPath[] = [...filtered];
      for (let dy = 0; dy < rect.h; dy++) {
        for (let dx = 0; dx < rect.w; dx++) {
          const tx = rect.x + dx, ty = rect.y + dy;
          if (canPlacePath(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, emptyBuildingOcc)) {
            newPaths.push({ x: tx, y: ty, pathType });
          }
        }
      }
      return { ...prev, paths: newPaths };
    });
  }, [zoneMap, farmBaseType, gridWidth, gridHeight, emptyBuildingOcc]);

  const placeTreeRect = useCallback((rect: TileRect, treeType: TreeType, tapperType?: TapperType | null) => {
    setLocalInterior(prev => {
      const iOcc = new Set(prev.items.map(i => `${i.x},${i.y}`));
      const tOcc = new Set((prev.trees ?? []).map(t => `${t.x},${t.y}`));
      const newTrees: PlacedTree[] = [];
      for (let dy = 0; dy < rect.h; dy++) {
        for (let dx = 0; dx < rect.w; dx++) {
          const tx = rect.x + dx, ty = rect.y + dy;
          const key = `${tx},${ty}`;
          if (!tOcc.has(key) &&
              canPlaceTree(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, emptyBuildingOcc, iOcc, tOcc)) {
            tOcc.add(key);
            newTrees.push({
              id: crypto.randomUUID(),
              treeType,
              x: tx, y: ty,
              ...(tapperType ? { tapper: tapperType } : {}),
            });
          }
        }
      }
      if (newTrees.length === 0) return prev;
      return { ...prev, trees: [...(prev.trees ?? []), ...newTrees] };
    });
  }, [zoneMap, farmBaseType, gridWidth, gridHeight, emptyBuildingOcc]);

  const eraseRect = useCallback((rect: TileRect) => {
    const inRect = (x: number, y: number) =>
      x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
    setLocalInterior(prev => ({
      ...prev,
      items: prev.items.filter(i => !inRect(i.x, i.y)),
      paths: prev.paths.filter(p => !inRect(p.x, p.y)),
      trees: (prev.trees ?? []).filter(t => !inRect(t.x, t.y)),
    }));
  }, []);

  // ── Zone mutations ────────────────────────────────────────────────────────────

  const createZone = useCallback((name: string): string => {
    const id = crypto.randomUUID();
    const newZone: CropZone = { id, name, rects: [], crops: {} };
    setLocalInterior(prev => ({ ...prev, zones: [...(prev.zones ?? []), newZone] }));
    return id;
  }, []);

  const addZoneRect = useCallback((zoneId: string, rect: TileRect) => {
    setLocalInterior(prev => ({
      ...prev,
      zones: (prev.zones ?? []).map(z =>
        z.id === zoneId ? { ...z, rects: [...z.rects, rect] } : z,
      ),
    }));
  }, []);

  const removeZone = useCallback((zoneId: string) => {
    setLocalInterior(prev => ({
      ...prev,
      zones: (prev.zones ?? []).filter(z => z.id !== zoneId),
    }));
  }, []);

  const setZoneCrop = useCallback((zoneId: string, season: Season, cropId: string | null) => {
    setLocalInterior(prev => ({
      ...prev,
      zones: (prev.zones ?? []).map(z => {
        if (z.id !== zoneId) return z;
        const crops = { ...z.crops };
        if (cropId) crops[season] = cropId;
        else delete crops[season];
        return { ...z, crops };
      }),
    }));
  }, []);

  const handleNewZone = useCallback(() => {
    const zones = localInterior.zones ?? [];
    const name = window.prompt('Zone name:', `Zone ${zones.length + 1}`);
    if (!name) return;
    const id = createZone(name);
    setToolState({ tool: 'zone', itemId: id });
  }, [createZone, localInterior.zones]);

  // ── Commit ────────────────────────────────────────────────────────────────────

  const handleCommit = useCallback((rect: DrawRect) => {
    const { tool } = toolState;
    if      (tool === 'zone'         && toolState.itemId)    addZoneRect(toolState.itemId, rect);
    else if (tool === 'place-item'   && toolState.itemId)    placeItemRect(rect, toolState.itemId, toolState.gemId);
    else if (tool === 'path-draw'    && toolState.pathType)  paintPathRect(rect, toolState.pathType as PathType);
    else if (tool === 'place-tree'   && toolState.treeType)  placeTreeRect(rect, toolState.treeType as TreeType, toolState.tapperType);
    else if (tool === 'erase')                               eraseRect(rect);
  }, [toolState, addZoneRect, placeItemRect, paintPathRect, placeTreeRect, eraseRect]);

  // ── Grid hook ─────────────────────────────────────────────────────────────────

  const {
    wrapRef, pan, zoom, isPanning,
    hoverTile, drawRect, isDrawingRect,
    fitToView, svgHandlers,
  } = usePlannerGrid({
    tileSize:  TILE_SIZE,
    gridWidth,
    gridHeight,
    isPanTool: toolState.tool === 'select',
    loading:   false,
    autoFit:   true,
    onCommit:  handleCommit,
    onEscape:  () => setToolState({ tool: 'select' }),
    onPointerDownBefore: () => setContextMenu(null),
  });

  // ── Sprite event handlers ─────────────────────────────────────────────────────

  const handleItemPointerDown = useCallback((_id: string, e: React.PointerEvent<SVGElement>) => {
    if (e.button === 2) { e.stopPropagation(); return; }
    if (toolState.tool === 'select') e.stopPropagation();
  }, [toolState.tool]);

  const handleItemContextMenu = useCallback((id: string, e: React.MouseEvent<SVGElement>) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', targetId: id });
  }, []);

  const handleTreePointerDown = useCallback((_id: string, e: React.PointerEvent<SVGElement>) => {
    if (e.button === 2) { e.stopPropagation(); return; }
    if (toolState.tool === 'select') e.stopPropagation();
  }, [toolState.tool]);

  const handleTreeContextMenu = useCallback((id: string, e: React.MouseEvent<SVGElement>) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'tree', targetId: id });
  }, []);

  // ── Context menu items ────────────────────────────────────────────────────────

  const buildContextItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'item') {
      const placedItem = localInterior.items.find(i => i.id === contextMenu.targetId);
      const menuItems: ContextMenuItem[] = [];
      if (placedItem?.itemId === '21') {
        menuItems.push({
          label: placedItem.gemId ? 'Change Gem' : 'Set Gem',
          onClick: () => { setGemPickerItemId(contextMenu.targetId); setContextMenu(null); },
        });
        if (placedItem.gemId) {
          menuItems.push({
            label: 'Clear Gem',
            onClick: () => {
              setLocalInterior(prev => ({
                ...prev,
                items: prev.items.map(i => i.id === contextMenu.targetId ? { ...i, gemId: undefined } : i),
              }));
              setContextMenu(null);
            },
          });
        }
      }
      menuItems.push({
        label: 'Remove',
        danger: true,
        onClick: () => setLocalInterior(prev => ({
          ...prev,
          items: prev.items.filter(i => i.id !== contextMenu.targetId),
        })),
      });
      return menuItems;
    }

    if (contextMenu.type === 'tree') {
      const tree = (localInterior.trees ?? []).find(t => t.id === contextMenu.targetId);
      if (!tree) return [];
      const items: ContextMenuItem[] = [];
      if (!tree.tapper) {
        items.push({
          label: 'Add Tapper',
          onClick: () => setLocalInterior(prev => ({
            ...prev,
            trees: (prev.trees ?? []).map(t =>
              t.id === tree.id ? { ...t, tapper: 'tapper' as TapperType } : t,
            ),
          })),
        });
        items.push({
          label: 'Add Heavy Tapper',
          onClick: () => setLocalInterior(prev => ({
            ...prev,
            trees: (prev.trees ?? []).map(t =>
              t.id === tree.id ? { ...t, tapper: 'heavy-tapper' as TapperType } : t,
            ),
          })),
        });
      } else {
        items.push({
          label: 'Remove Tapper',
          onClick: () => setLocalInterior(prev => ({
            ...prev,
            trees: (prev.trees ?? []).map(t =>
              t.id === tree.id ? { ...t, tapper: undefined } : t,
            ),
          })),
        });
      }
      items.push({
        label: 'Remove',
        danger: true,
        onClick: () => setLocalInterior(prev => ({
          ...prev,
          trees: (prev.trees ?? []).filter(t => t.id !== contextMenu.targetId),
        })),
      });
      return items;
    }

    return [];
  };

  // ── Optimal fill ──────────────────────────────────────────────────────────────

  const handleOptimalFill = useCallback((machineId: string) => {
    const tiles = generateOptimalLayout(building.buildingId, machineId);
    if (tiles.length === 0) return;
    setLocalInterior(prev => ({
      ...prev,
      items: tiles.map(t => ({ id: crypto.randomUUID(), itemId: t.itemId, x: t.x, y: t.y })),
    }));
  }, [building.buildingId]);

  // ── Derived values ────────────────────────────────────────────────────────────

  const context      = getInteriorContext(building.buildingId);
  const shedDims     = SHED_DIMS[building.buildingId] ?? null;
  const buildingName = building.label || buildingDef?.name || 'Interior';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="page--farm-planner">
      <FarmSidebar
        season="spring"
        onSeasonChange={() => {}}
        zones={localInterior.zones ?? []}
        treeDefs={treeDefs}
        toolState={toolState}
        onToolChange={setToolState}
        onNewZone={handleNewZone}
        onRemoveZone={removeZone}
        onSetZoneCrop={setZoneCrop}
        showSprinklerRanges={false}
        onToggleSprinklerRanges={() => {}}
        showScarecrowRanges={false}
        onToggleScarecrowRanges={() => {}}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
        onFitView={fitToView}
        interiorMode
        onBackToFarm={() => onBack(localInterior)}
        interiorBuildingName={buildingName}
        interiorTreesAllowed={treesAllowed}
        interiorContext={context}
        interiorShedDims={shedDims}
        onOptimalFill={handleOptimalFill}
      />

      <div ref={wrapRef} className="planner-canvas-wrap">
        <FarmCanvas
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          zoneMap={zoneMap}
          farmBaseType={farmBaseType}
          layout={farmLayout}
          buildingDefs={emptyBuildingDefMap}
          itemMap={itemMap}
          cropMap={cropMap}
          treeDefs={treeDefs}
          zoom={zoom}
          pan={pan}
          isPanning={isPanning}
          showSprinklerRanges={false}
          showScarecrowRanges={false}
          selectedBuildingId={null}
          selectedItemId={null}
          hoverTile={hoverTile}
          toolState={toolState}
          drawRect={drawRect}
          isDrawingRect={isDrawingRect}
          interiorMode
          {...svgHandlers}
          onItemPointerDown={handleItemPointerDown}
          onItemContextMenu={handleItemContextMenu}
          onTreePointerDown={handleTreePointerDown}
          onTreeContextMenu={handleTreeContextMenu}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {gemPickerItemId && (
        <FishPickerModal
          title="Select Gem"
          fish={gemItems}
          currentFishId={localInterior.items.find(i => i.id === gemPickerItemId)?.gemId}
          onSelect={(gemId) => {
            setLocalInterior(prev => ({
              ...prev,
              items: prev.items.map(i =>
                i.id === gemPickerItemId ? { ...i, gemId: gemId ?? undefined } : i,
              ),
            }));
            setGemPickerItemId(null);
          }}
          onClose={() => setGemPickerItemId(null)}
        />
      )}
    </div>
  );
}
