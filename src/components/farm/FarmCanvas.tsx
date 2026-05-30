import { useMemo } from 'react';
import type { ZoneType, BuildingDef, Item, TreeDef, Crop } from '../../types/game';
import type { FarmLayout, PathType, TreeType } from '../../types/save';
import type { ToolState } from './HoverLayer';
import {
  getBuildingOccupancy, getItemOccupancy, getTreeOccupancy,
  canPlaceBuilding, canPlaceItem, canPlacePath, canPlaceTree,
} from '../../utils/farmPlacement';
import { BuildingLayer } from './BuildingLayer';
import { ZoneLayer } from './ZoneLayer';
import { PathLayer } from './PathLayer';
import { ItemLayer } from './ItemLayer';
import { TreeLayer } from './TreeLayer';
import { SprinklerRangeLayer } from './SprinklerRangeLayer';
import { ScarecrowRangeLayer } from './ScarecrowRangeLayer';
import { HoverLayer } from './HoverLayer';

export { type ToolState } from './HoverLayer';
export const TILE_SIZE = 16;

const ZONE_FILL: Record<ZoneType, string> = {
  farmable:   '#3d6b42',
  grass:      '#5a8040',
  water:      '#2a72b8',
  impassable: '#2e2016',
  building:   '#6b4f14',
  bridge:     '#a07840',
  path:       '#c8a96b',
  sand:       '#c4a05e',
};

/** Item IDs that are sprinklers — used to block sand tiles in previews. */
const SPRINKLER_IDS = new Set(['599', '621', '645']);

interface Props {
  gridWidth: number;
  gridHeight: number;
  zoneMap: Map<string, ZoneType>;
  farmBaseType: ZoneType;
  layout: FarmLayout;
  buildingDefs: Map<string, BuildingDef>;
  itemMap: Map<string, Item>;
  treeDefs: TreeDef[];
  /** Crop definitions keyed by crop id — passed through to ZoneLayer for icon rendering. */
  cropMap?: Map<string, Crop>;
  zoom: number;
  pan: { x: number; y: number };
  isPanning: boolean;
  showSprinklerRanges: boolean;
  showScarecrowRanges: boolean;
  selectedBuildingId: string | null;
  selectedItemId: string | null;
  hoverTile: { tx: number; ty: number } | null;
  toolState: ToolState;
  /** Unified draw rect for all rect-draw tools (path, item, tree, zone, erase). */
  drawRect: { x: number; y: number; w: number; h: number } | null;
  /** True while the user is actively dragging a rect-draw gesture. */
  isDrawingRect?: boolean;
  onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
  onContextMenu: (e: React.MouseEvent<SVGSVGElement>) => void;
  onBuildingPointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void;
  onBuildingContextMenu?: (id: string, e: React.MouseEvent<SVGElement>) => void;
  onItemPointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void;
  onItemContextMenu?: (id: string, e: React.MouseEvent<SVGElement>) => void;
  onTreePointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void;
  onTreeContextMenu?: (id: string, e: React.MouseEvent<SVGElement>) => void;
}

export function FarmCanvas({
  gridWidth, gridHeight, zoneMap, farmBaseType,
  layout, buildingDefs, itemMap, treeDefs, cropMap,
  zoom, pan, isPanning, showSprinklerRanges, showScarecrowRanges,
  selectedBuildingId, selectedItemId,
  hoverTile, toolState, drawRect, isDrawingRect,
  onWheel, onPointerDown, onPointerMove, onPointerUp, onContextMenu,
  onBuildingPointerDown, onBuildingContextMenu,
  onItemPointerDown, onItemContextMenu,
  onTreePointerDown, onTreeContextMenu,
}: Props) {
  const farmW   = gridWidth * TILE_SIZE;
  const farmH   = gridHeight * TILE_SIZE;
  const showGrid = zoom > 0.35;

  // Occupancy sets — recomputed only when layout or defs change
  const buildingOccupancy = useMemo(
    () => getBuildingOccupancy(layout.buildings, buildingDefs),
    [layout.buildings, buildingDefs],
  );
  const itemOccupancy = useMemo(
    () => getItemOccupancy(layout.items),
    [layout.items],
  );
  const treeOccupancy = useMemo(
    () => getTreeOccupancy(layout.trees),
    [layout.trees],
  );

  // Whether the current hover position accepts a placement (drives cursor)
  const isValidHover = useMemo(() => {
    if (!hoverTile) return true;
    const { tx, ty } = hoverTile;
    if (toolState.tool === 'place-building' && toolState.buildingId) {
      const def = buildingDefs.get(toolState.buildingId);
      if (!def) return true;
      return canPlaceBuilding(tx, ty, def.width, def.height, zoneMap, farmBaseType, gridWidth, gridHeight, buildingOccupancy);
    }
    if (toolState.tool === 'place-item') {
      return canPlaceItem(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, buildingOccupancy, itemOccupancy);
    }
    return true;
  }, [hoverTile, toolState, buildingDefs, zoneMap, farmBaseType, gridWidth, gridHeight, buildingOccupancy, itemOccupancy]);

  const zoneRects = useMemo(() => (
    Array.from(zoneMap.entries())
      .filter(([, zone]) => zone !== farmBaseType)
      .map(([key, zone]) => {
        const comma = key.indexOf(',');
        return { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)), zone };
      })
  ), [zoneMap, farmBaseType]);

  // ── Rect-draw previews ───────────────────────────────────────────────────────
  // These are computed here (not in FarmPlannerPage) because we already have all
  // the placement state (occupancy sets, zoneMap, etc.) in scope.

  const previewPaths = useMemo(() => {
    if (!drawRect || !isDrawingRect || toolState.tool !== 'path-draw' || !toolState.pathType) return [];
    const type = toolState.pathType as PathType;
    const result: Array<{ x: number; y: number; pathType: PathType }> = [];
    for (let dy = 0; dy < drawRect.h; dy++) {
      for (let dx = 0; dx < drawRect.w; dx++) {
        const tx = drawRect.x + dx, ty = drawRect.y + dy;
        if (canPlacePath(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, buildingOccupancy))
          result.push({ x: tx, y: ty, pathType: type });
      }
    }
    return result;
  }, [drawRect, isDrawingRect, toolState, buildingOccupancy, zoneMap, farmBaseType, gridWidth, gridHeight]);

  const previewItems = useMemo(() => {
    if (!drawRect || !isDrawingRect || toolState.tool !== 'place-item' || !toolState.itemId) return [];
    const itemId = toolState.itemId;
    const isSprinkler = SPRINKLER_IDS.has(itemId);
    const added = new Set<string>();
    const result: Array<{ id: string; itemId: string; x: number; y: number }> = [];
    for (let dy = 0; dy < drawRect.h; dy++) {
      for (let dx = 0; dx < drawRect.w; dx++) {
        const tx = drawRect.x + dx, ty = drawRect.y + dy;
        const key = `${tx},${ty}`;
        if (!added.has(key) &&
            canPlaceItem(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, buildingOccupancy, itemOccupancy, isSprinkler)) {
          added.add(key);
          result.push({ id: `preview-${tx}-${ty}`, itemId, x: tx, y: ty });
        }
      }
    }
    return result;
  }, [drawRect, isDrawingRect, toolState, buildingOccupancy, itemOccupancy, zoneMap, farmBaseType, gridWidth, gridHeight]);

  const previewTrees = useMemo(() => {
    if (!drawRect || !isDrawingRect || toolState.tool !== 'place-tree' || !toolState.treeType) return [];
    const treeType = toolState.treeType as TreeType;
    const added = new Set<string>();
    const result: Array<{ id: string; treeType: TreeType; x: number; y: number }> = [];
    for (let dy = 0; dy < drawRect.h; dy++) {
      for (let dx = 0; dx < drawRect.w; dx++) {
        const tx = drawRect.x + dx, ty = drawRect.y + dy;
        const key = `${tx},${ty}`;
        // No treePlantSet in FarmCanvas — canPlaceTree falls back to zone-type heuristic (fine for preview)
        if (!added.has(key) &&
            canPlaceTree(tx, ty, zoneMap, farmBaseType, gridWidth, gridHeight, buildingOccupancy, itemOccupancy, treeOccupancy)) {
          added.add(key);
          result.push({ id: `preview-${tx}-${ty}`, treeType, x: tx, y: ty });
        }
      }
    }
    return result;
  }, [drawRect, isDrawingRect, toolState, buildingOccupancy, itemOccupancy, treeOccupancy, zoneMap, farmBaseType, gridWidth, gridHeight]);

  const cursor = isPanning ? 'grabbing'
    : toolState.tool === 'select' ? 'grab'
    : (toolState.tool === 'place-building' || toolState.tool === 'place-item')
      ? (isValidHover ? 'cell' : 'not-allowed')
    : toolState.tool === 'path-draw' || toolState.tool === 'zone' ? 'crosshair'
    : toolState.tool === 'erase' ? 'not-allowed'
    : 'default';

  return (
    <svg
      style={{ touchAction: 'none', userSelect: 'none', display: 'block', width: '100%', height: '100%', cursor }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
    >
      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>

        {/* Base zone fill */}
        <rect x={0} y={0} width={farmW} height={farmH} fill={ZONE_FILL[farmBaseType]} />

        {/* Game zone tiles (water, impassable, etc.) */}
        {zoneRects.map(({ x, y, zone }) => (
          <rect
            key={`${x},${y}`}
            x={x * TILE_SIZE} y={y * TILE_SIZE}
            width={TILE_SIZE} height={TILE_SIZE}
            fill={ZONE_FILL[zone]}
          />
        ))}

        {/* User crop zones */}
        <ZoneLayer
          zones={layout.zones}
          tileSize={TILE_SIZE}
          season={layout.season}
          selectedZoneId={null}
          cropMap={cropMap}
          itemMap={itemMap}
        />

        {/* Paths */}
        <PathLayer paths={layout.paths} tileSize={TILE_SIZE} />

        {/* Sprinkler ranges (behind buildings) */}
        <SprinklerRangeLayer items={layout.items} tileSize={TILE_SIZE} show={showSprinklerRanges} />

        {/* Scarecrow ranges (behind buildings) */}
        <ScarecrowRangeLayer items={layout.items} tileSize={TILE_SIZE} show={showScarecrowRanges} />

        {/* Buildings */}
        <BuildingLayer
          buildings={layout.buildings}
          buildingDefs={buildingDefs}
          itemMap={itemMap}
          tileSize={TILE_SIZE}
          selectedId={selectedBuildingId}
          onBuildingPointerDown={onBuildingPointerDown}
          onBuildingContextMenu={onBuildingContextMenu}
        />

        {/* Items (machines, sprinklers) */}
        <ItemLayer
          items={layout.items}
          itemMap={itemMap}
          tileSize={TILE_SIZE}
          selectedId={selectedItemId}
          onItemPointerDown={onItemPointerDown}
          onItemContextMenu={onItemContextMenu}
        />

        {/* Trees */}
        <TreeLayer
          trees={layout.trees}
          treeDefs={treeDefs}
          tileSize={TILE_SIZE}
          selectedId={null}
          onTreePointerDown={onTreePointerDown}
          onTreeContextMenu={onTreeContextMenu}
        />

        {/* Rect-draw previews (semi-transparent, pointer-events disabled) */}
        {previewPaths.length > 0 && (
          <g opacity={0.55} style={{ pointerEvents: 'none' }}>
            <PathLayer paths={previewPaths} tileSize={TILE_SIZE} />
          </g>
        )}
        {previewItems.length > 0 && (
          <g opacity={0.55} style={{ pointerEvents: 'none' }}>
            <ItemLayer items={previewItems} itemMap={itemMap} tileSize={TILE_SIZE} selectedId={null} />
          </g>
        )}
        {previewTrees.length > 0 && (
          <g opacity={0.55} style={{ pointerEvents: 'none' }}>
            <TreeLayer trees={previewTrees} treeDefs={treeDefs} tileSize={TILE_SIZE} selectedId={null} />
          </g>
        )}

        {/* Grid lines */}
        {showGrid && (
          <g stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} shapeRendering="crispEdges">
            {Array.from({ length: gridHeight + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} y1={i * TILE_SIZE} x2={farmW} y2={i * TILE_SIZE} />
            ))}
            {Array.from({ length: gridWidth + 1 }, (_, i) => (
              <line key={`v${i}`} x1={i * TILE_SIZE} y1={0} x2={i * TILE_SIZE} y2={farmH} />
            ))}
          </g>
        )}

        {/* Farm boundary */}
        <rect
          x={0} y={0} width={farmW} height={farmH}
          fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={1 / zoom}
        />

        {/* Hover / placement preview */}
        <HoverLayer
          hoverTile={hoverTile}
          tileSize={TILE_SIZE}
          toolState={toolState}
          buildingDefs={buildingDefs}
          drawRect={drawRect}
          isDrawing={isDrawingRect}
          zoneMap={zoneMap}
          baseType={farmBaseType}
          gridWidth={gridWidth}
          gridHeight={gridHeight}
          buildingOccupancy={buildingOccupancy}
          itemOccupancy={itemOccupancy}
        />

      </g>
    </svg>
  );
}
