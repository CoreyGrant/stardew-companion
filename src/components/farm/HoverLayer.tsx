import type { ZoneType, BuildingDef } from '../../types/game';
import { canPlaceBuilding, canPlaceItem } from '../../utils/farmPlacement';

export interface ToolState {
  tool: 'select' | 'place-building' | 'zone' | 'path-draw' | 'path-erase' | 'place-item' | 'place-tree' | 'erase';
  buildingId?: string;
  pathType?: string;
  itemId?: string;
  treeType?: string;
}

interface Props {
  hoverTile: { tx: number; ty: number } | null;
  tileSize: number;
  toolState: ToolState;
  buildingDefs: Map<string, BuildingDef>;
  /** Current draw rectangle (unified for all rect-draw tools). */
  drawRect: { x: number; y: number; w: number; h: number } | null;
  /** True while the user is actively dragging a rect-draw gesture. */
  isDrawing?: boolean;
  // Placement validation data
  zoneMap: Map<string, ZoneType>;
  baseType: ZoneType;
  gridWidth: number;
  gridHeight: number;
  buildingOccupancy: Set<string>;
  itemOccupancy: Set<string>;
}

/** Returns true if the entire building footprint at (tx,ty) is placeable. */
export function isBuildingPlaceable(
  tx: number, ty: number,
  def: BuildingDef,
  zoneMap: Map<string, ZoneType>, baseType: ZoneType,
  gridWidth: number, gridHeight: number,
  buildingOccupancy: Set<string>,
): boolean {
  return canPlaceBuilding(tx, ty, def.width, def.height, zoneMap, baseType, gridWidth, gridHeight, buildingOccupancy);
}

export function HoverLayer({
  hoverTile, tileSize, toolState, buildingDefs, drawRect, isDrawing,
  zoneMap, baseType, gridWidth, gridHeight,
  buildingOccupancy, itemOccupancy,
}: Props) {
  const { tool } = toolState;

  // ── Rect-draw overlay (while actively dragging) ────────────────────────────
  // path-draw / place-item / place-tree: preview is rendered by FarmCanvas layers → return null
  // zone: green dashed rect
  // erase / path-erase: red dashed rect
  if (isDrawing && drawRect) {
    const { x, y, w, h } = drawRect;

    if (tool === 'zone') {
      return (
        <rect
          x={x * tileSize} y={y * tileSize}
          width={w * tileSize} height={h * tileSize}
          fill="rgba(80, 160, 80, 0.3)"
          stroke="#FFD700"
          strokeWidth={1}
          strokeDasharray="4 2"
          style={{ pointerEvents: 'none' }}
        />
      );
    }

    if (tool === 'erase' || tool === 'path-erase') {
      return (
        <rect
          x={x * tileSize} y={y * tileSize}
          width={w * tileSize} height={h * tileSize}
          fill="rgba(220,60,60,0.18)"
          stroke="rgba(220,60,60,0.75)"
          strokeWidth={0.75}
          strokeDasharray="4 2"
          style={{ pointerEvents: 'none' }}
        />
      );
    }

    // path-draw, place-item, place-tree: handled by semi-transparent preview layers
    return null;
  }

  // ── Single-tile hover (before / without drawing) ───────────────────────────
  if (!hoverTile) return null;

  const { tx, ty } = hoverTile;

  // ── Building placement — per-tile red/green footprint ─────────────────────
  if (tool === 'place-building' && toolState.buildingId) {
    const def = buildingDefs.get(toolState.buildingId);
    if (!def) return null;

    const tiles: React.ReactElement[] = [];
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        const ttx = tx + dx;
        const tty = ty + dy;
        const ok = canPlaceBuilding(
          ttx, tty, 1, 1,
          zoneMap, baseType, gridWidth, gridHeight,
          buildingOccupancy,
        );
        tiles.push(
          <rect
            key={`${dx},${dy}`}
            x={ttx * tileSize} y={tty * tileSize}
            width={tileSize} height={tileSize}
            fill={ok ? 'rgba(80,200,80,0.30)' : 'rgba(220,60,60,0.45)'}
            stroke={ok ? 'rgba(80,200,80,0.75)' : 'rgba(220,60,60,0.85)'}
            strokeWidth={0.5}
            style={{ pointerEvents: 'none' }}
          />,
        );
      }
    }
    return <g>{tiles}</g>;
  }

  // ── Item (machine / scarecrow / etc.) placement — single tile ─────────────
  if (tool === 'place-item') {
    const ok = canPlaceItem(
      tx, ty, zoneMap, baseType, gridWidth, gridHeight,
      buildingOccupancy, itemOccupancy,
    );
    return (
      <rect
        x={tx * tileSize} y={ty * tileSize}
        width={tileSize} height={tileSize}
        fill={ok ? 'rgba(60,40,100,0.45)' : 'rgba(220,60,60,0.45)'}
        stroke={ok ? '#FFD700' : 'rgba(220,60,60,0.85)'}
        strokeWidth={ok ? 1.5 : 0.5}
        strokeDasharray={ok ? '4 2' : undefined}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  // ── Zone — single tile preview (before drag starts) ────────────────────────
  if (tool === 'zone') {
    return (
      <rect
        x={tx * tileSize} y={ty * tileSize}
        width={tileSize} height={tileSize}
        fill="rgba(80, 160, 80, 0.25)"
        stroke="#FFD700"
        strokeWidth={1}
        strokeDasharray="4 2"
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  // ── Tree placement ─────────────────────────────────────────────────────────
  if (tool === 'place-tree') {
    return (
      <rect
        x={tx * tileSize} y={ty * tileSize}
        width={tileSize} height={tileSize}
        fill="rgba(30, 100, 30, 0.45)"
        stroke="#FFD700"
        strokeWidth={1.5}
        strokeDasharray="4 2"
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  // ── Path draw / erase ──────────────────────────────────────────────────────
  if (tool === 'path-draw' || tool === 'path-erase' || tool === 'erase') {
    return (
      <rect
        x={tx * tileSize} y={ty * tileSize}
        width={tileSize} height={tileSize}
        fill={tool === 'erase' || tool === 'path-erase' ? 'rgba(255,60,60,0.35)' : 'rgba(255,255,255,0.25)'}
        stroke="rgba(255,255,255,0.5)"
        strokeWidth={0.5}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  return null;
}
