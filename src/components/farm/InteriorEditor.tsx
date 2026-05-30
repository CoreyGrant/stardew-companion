import { useCallback, useMemo, useState } from 'react';
import type { DrawRect } from '../../hooks/usePlannerGrid';
import { usePlannerGrid } from '../../hooks/usePlannerGrid';
import { FarmCanvas, TILE_SIZE } from './FarmCanvas';
import type { ToolState } from './FarmCanvas';
import { FarmSidebar } from './FarmSidebar';
import { ContextMenu } from './ContextMenu';
import type { ContextMenuItem } from './ContextMenu';
import {
  getInteriorContext,
  getInteriorZoneData,
  SHED_DIMS,
  generateOptimalLayout,
} from '../../data/interiorItems';
import { canPlaceItem, canPlacePath, canPlaceTree } from '../../utils/farmPlacement';
import type {
  PlacedBuilding, PlacedItem, PlacedPath, PlacedTree,
  InteriorLayout, PathType, TreeType, TapperType, TileRect,
} from '../../types/save';
import type { BuildingDef, Item, TreeDef } from '../../types/game';

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
  onBack: (savedInterior: InteriorLayout) => void;
}

export function InteriorEditor({
  building, buildingDef, interior, allItems, treeDefs, onBack,
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
  }));

  // ── Tool / UI state ───────────────────────────────────────────────────────────
  const [toolState, setToolState] = useState<ToolState>({ tool: 'select' });
  const [contextMenu, setContextMenu] = useState<CtxMenuState | null>(null);

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
    zones: [],
    buildings: [],
    paths: localInterior.paths,
    items: localInterior.items,
    trees: localInterior.trees ?? [],
    interiors: {},
  }), [localInterior]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const placeItemRect = useCallback((rect: TileRect, itemId: string) => {
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
            newItems.push({ id: crypto.randomUUID(), itemId, x: tx, y: ty });
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

  // ── Commit ────────────────────────────────────────────────────────────────────

  const handleCommit = useCallback((rect: DrawRect) => {
    const { tool } = toolState;
    if      (tool === 'place-item'  && toolState.itemId)    placeItemRect(rect, toolState.itemId);
    else if (tool === 'path-draw'   && toolState.pathType)  paintPathRect(rect, toolState.pathType as PathType);
    else if (tool === 'place-tree'  && toolState.treeType)  placeTreeRect(rect, toolState.treeType as TreeType, toolState.tapperType);
    else if (tool === 'erase')                              eraseRect(rect);
  }, [toolState, placeItemRect, paintPathRect, placeTreeRect, eraseRect]);

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
      return [{
        label: 'Remove',
        danger: true,
        onClick: () => setLocalInterior(prev => ({
          ...prev,
          items: prev.items.filter(i => i.id !== contextMenu.targetId),
        })),
      }];
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
        zones={[]}
        treeDefs={treeDefs}
        toolState={toolState}
        onToolChange={setToolState}
        onNewZone={() => {}}
        onRemoveZone={() => {}}
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
    </div>
  );
}
