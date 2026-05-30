import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarmPlanner } from '../hooks/useFarmPlanner';
import { usePageTitle } from '../hooks/usePageTitle';
import { usePlannerGrid } from '../hooks/usePlannerGrid';
import { FarmCanvas, TILE_SIZE } from '../components/farm/FarmCanvas';
import type { ToolState } from '../components/farm/FarmCanvas';
import { FarmSidebar } from '../components/farm/FarmSidebar';
import { ContextMenu } from '../components/farm/ContextMenu';
import type { ContextMenuItem } from '../components/farm/ContextMenu';
import { InteriorEditor } from '../components/farm/InteriorEditor';
import { FishPickerModal } from '../components/farm/FishPickerModal';
import { useUserData } from '../contexts/UserDataContext';
import { useGameData } from '../contexts/GameDataContext';
import type { PlacedBuilding } from '../types/save';
import type { PathType, TreeType } from '../types/save';
import type { DrawRect } from '../hooks/usePlannerGrid';

interface CtxMenuState {
  x: number; y: number;
  type: 'building' | 'item' | 'tree';
  targetId: string;
}

export function FarmPlannerPage() {
  usePageTitle('Farm Planner');
  const {
    layout, gridWidth, gridHeight, zoneMap, farmBaseType,
    season, setSeason, canUndo, canRedo, undo, redo, loading,
    buildingDefMap, itemMap, treeDefs,
    placeBuilding, removeBuilding, updateBuilding,
    createZone, addZoneRect, removeZone, setZoneCrop,
    paintPathRect, placeItemRect, placeTreeRect, eraseRect,
    removeItem, updateInterior, removeTree, setTreeTapper,
  } = useFarmPlanner();

  const { activeSave } = useUserData();
  const { data: gameData } = useGameData();

  const cropMap = useMemo(
    () => new Map((gameData?.crops ?? []).map((c) => [c.id, c])),
    [gameData],
  );

  // ── Tool state ────────────────────────────────────────────────────────────────
  const [toolState, setToolState] = useState<ToolState>({ tool: 'select' });
  const [showSprinklerRanges, setShowSprinklerRanges] = useState(true);
  const [showScarecrowRanges, setShowScarecrowRanges] = useState(true);
  const [contextMenu, setContextMenu] = useState<CtxMenuState | null>(null);
  const [interiorBuilding, setInteriorBuilding] = useState<PlacedBuilding | null>(null);
  const [fishPickerBuilding, setFishPickerBuilding] = useState<PlacedBuilding | null>(null);

  // ── Commit rect to the right mutation ─────────────────────────────────────────
  const handleCommit = useCallback((rect: DrawRect) => {
    const { tool } = toolState;
    if (tool === 'zone' && toolState.itemId)             addZoneRect(toolState.itemId, rect);
    else if (tool === 'path-draw' && toolState.pathType)  paintPathRect(rect, toolState.pathType as PathType);
    else if (tool === 'path-erase')                       paintPathRect(rect, null);
    else if (tool === 'place-item' && toolState.itemId)   placeItemRect(rect, toolState.itemId);
    else if (tool === 'place-tree' && toolState.treeType) placeTreeRect(rect, toolState.treeType as TreeType, toolState.tapperType);
    else if (tool === 'erase')                            eraseRect(rect);
  }, [toolState, addZoneRect, paintPathRect, placeItemRect, placeTreeRect, eraseRect]);

  // ── Shared grid hook ──────────────────────────────────────────────────────────
  const {
    wrapRef, pan, zoom, isPanning,
    hoverTile, drawRect, isDrawingRect,
    fitToView, svgHandlers,
  } = usePlannerGrid({
    tileSize:   TILE_SIZE,
    gridWidth,
    gridHeight,
    isPanTool:  toolState.tool === 'select',
    loading,
    autoFit:    true,
    onToolDown: (tx, ty) => {
      if (toolState.tool === 'place-building' && toolState.buildingId) {
        placeBuilding(toolState.buildingId, tx, ty);
        return true; // suppress drawRect
      }
    },
    onCommit:  handleCommit,
    onUndo:    undo,
    onRedo:    redo,
    onEscape:  () => setToolState({ tool: 'select' }),
    onPointerDownBefore: () => setContextMenu(null),
  });

  // ── Building events ───────────────────────────────────────────────────────────
  const handleBuildingPointerDown = useCallback((id: string, e: React.PointerEvent<SVGElement>) => {
    if (e.button === 2) { e.stopPropagation(); return; }
    if (toolState.tool === 'erase') {
      const b = layout.buildings.find((b) => b.id === id);
      if (b?.isStatic) { e.stopPropagation(); return; }
      e.stopPropagation();
      removeBuilding(id);
      return;
    }
    if (toolState.tool === 'select') e.stopPropagation();
  }, [toolState.tool, removeBuilding, layout.buildings]);

  const handleBuildingContextMenu = useCallback((id: string, e: React.MouseEvent<SVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'building', targetId: id });
  }, []);

  const handleItemPointerDown = useCallback((_id: string, e: React.PointerEvent<SVGElement>) => {
    if (e.button === 2) { e.stopPropagation(); return; }
    if (toolState.tool === 'select') e.stopPropagation();
  }, [toolState.tool]);

  const handleItemContextMenu = useCallback((id: string, e: React.MouseEvent<SVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'item', targetId: id });
  }, []);

  const handleTreePointerDown = useCallback((_id: string, e: React.PointerEvent<SVGElement>) => {
    if (e.button === 2) { e.stopPropagation(); return; }
    if (toolState.tool === 'select') e.stopPropagation();
  }, [toolState.tool]);

  const handleTreeContextMenu = useCallback((id: string, e: React.MouseEvent<SVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'tree', targetId: id });
  }, []);

  // ── Context menu actions ──────────────────────────────────────────────────────
  const buildContextItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];

    if (contextMenu.type === 'building') {
      const b = layout.buildings.find((b) => b.id === contextMenu.targetId);
      const def = b ? buildingDefMap.get(b.buildingId) : null;
      const items: ContextMenuItem[] = [];

      if (b?.buildingId === 'Greenhouse') {
        if (b.repaired !== true) {
          items.push({ label: 'Mark as Repaired', onClick: () => updateBuilding(b.id, { repaired: true }) });
        } else {
          items.push({ label: 'Mark as Ruin', onClick: () => updateBuilding(b.id, { repaired: false }) });
        }
      }

      if (b?.buildingId === 'Fish Pond') {
        items.push({
          label: b.fishId ? 'Change Fish…' : 'Set Fish…',
          onClick: () => { if (b) { setFishPickerBuilding(b); setContextMenu(null); } },
        });
      }

      if (def?.hasInterior && b?.repaired !== false) {
        items.push({
          label: 'Open Interior…',
          onClick: () => { if (b) setInteriorBuilding(b); },
        });
      }

      if (def?.upgradeTo) {
        const upDef = buildingDefMap.get(def.upgradeTo);
        if (upDef && b) {
          items.push({
            label: `Upgrade → ${upDef.name}`,
            onClick: () => updateBuilding(b.id, { buildingId: def.upgradeTo! }),
          });
        }
      }

      if (def?.upgradeFrom && b) {
        const downDef = buildingDefMap.get(def.upgradeFrom);
        if (downDef) {
          items.push({
            label: `Downgrade → ${downDef.name}`,
            onClick: () => updateBuilding(b.id, { buildingId: def.upgradeFrom! }),
          });
        }
      }

      items.push({
        label: 'Edit Label…',
        onClick: () => {
          if (!b) return;
          const newLabel = window.prompt('Building label:', b.label ?? '');
          if (newLabel !== null) updateBuilding(b.id, { label: newLabel || undefined });
        },
      });

      if (!b?.isStatic) {
        items.push({
          label: 'Remove',
          danger: true,
          onClick: () => { if (b) removeBuilding(b.id); },
        });
      }
      return items;
    }

    if (contextMenu.type === 'item') {
      return [{ label: 'Remove', danger: true, onClick: () => removeItem(contextMenu.targetId) }];
    }

    if (contextMenu.type === 'tree') {
      const tree = layout.trees.find((t) => t.id === contextMenu.targetId);
      if (!tree) return [];
      const items: ContextMenuItem[] = [];
      if (!tree.tapper) {
        items.push({ label: 'Add Tapper', onClick: () => setTreeTapper(tree.id, 'tapper') });
        items.push({ label: 'Add Heavy Tapper', onClick: () => setTreeTapper(tree.id, 'heavy-tapper') });
      } else {
        items.push({ label: 'Remove Tapper', onClick: () => setTreeTapper(tree.id, null) });
      }
      items.push({ label: 'Remove', danger: true, onClick: () => removeTree(tree.id) });
      return items;
    }

    return [];
  };

  // ── Zone helpers ──────────────────────────────────────────────────────────────
  const handleNewZone = useCallback(() => {
    const name = window.prompt('Zone name:', `Zone ${layout.zones.length + 1}`);
    if (!name) return;
    const id = createZone(name);
    setToolState({ tool: 'zone', itemId: id });
  }, [createZone, layout.zones.length]);

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (loading) return <div className="page-loading">Loading…</div>;

  if (!activeSave) {
    return (
      <div className="page">
        <h1 className="page__title">Farm Planner</h1>
        <p className="notice">
          <Link to="/saves">Create a save profile</Link> to use the farm planner.
        </p>
      </div>
    );
  }

  // ── Interior editor (inline, replaces main farm view) ────────────────────────
  if (interiorBuilding) {
    const buildingDef = buildingDefMap.get(interiorBuilding.buildingId) ?? null;
    return (
      <InteriorEditor
        building={interiorBuilding}
        buildingDef={buildingDef}
        interior={layout.interiors[interiorBuilding.id] ?? { items: [], paths: [], trees: [] }}
        allItems={gameData?.items ?? []}
        treeDefs={treeDefs}
        onBack={(savedInterior) => {
          updateInterior(interiorBuilding.id, savedInterior);
          setInteriorBuilding(null);
        }}
      />
    );
  }

  return (
    <div className="page--farm-planner">
      <div className="planner-touch-notice" aria-live="polite">
        Touch device detected — use the sidebar to select tools, then tap the map to place.
        Pinch to zoom, drag with two fingers to pan.
      </div>

      <FarmSidebar
        season={season}
        onSeasonChange={setSeason}
        zones={layout.zones}
        treeDefs={treeDefs}
        toolState={toolState}
        onToolChange={setToolState}
        onNewZone={handleNewZone}
        onRemoveZone={removeZone}
        onSetZoneCrop={setZoneCrop}
        showSprinklerRanges={showSprinklerRanges}
        onToggleSprinklerRanges={() => setShowSprinklerRanges((v) => !v)}
        showScarecrowRanges={showScarecrowRanges}
        onToggleScarecrowRanges={() => setShowScarecrowRanges((v) => !v)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onFitView={fitToView}
      />

      <div ref={wrapRef} className="planner-canvas-wrap">
        <FarmCanvas
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          zoneMap={zoneMap}
          farmBaseType={farmBaseType}
          layout={layout}
          buildingDefs={buildingDefMap}
          itemMap={itemMap}
          treeDefs={treeDefs}
          cropMap={cropMap}
          zoom={zoom}
          pan={pan}
          isPanning={isPanning}
          showSprinklerRanges={showSprinklerRanges}
          showScarecrowRanges={showScarecrowRanges}
          selectedBuildingId={null}
          selectedItemId={null}
          hoverTile={hoverTile}
          toolState={toolState}
          drawRect={drawRect}
          isDrawingRect={isDrawingRect}
          {...svgHandlers}
          onBuildingPointerDown={handleBuildingPointerDown}
          onBuildingContextMenu={handleBuildingContextMenu}
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

      {fishPickerBuilding && (
        <FishPickerModal
          fish={(gameData?.items ?? []).filter((i) => i.category === 'fish')}
          currentFishId={fishPickerBuilding.fishId}
          onSelect={(fishId) => {
            updateBuilding(fishPickerBuilding.id, { fishId: fishId ?? undefined });
            setFishPickerBuilding(null);
          }}
          onClose={() => setFishPickerBuilding(null)}
        />
      )}
    </div>
  );
}
