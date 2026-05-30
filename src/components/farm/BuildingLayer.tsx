import type { PlacedBuilding } from '../../types/save';
import type { BuildingDef, Item } from '../../types/game';

const BASE = import.meta.env.BASE_URL;

// springobjects sheet dimensions (24 cols × 39 rows × 16px)
const SHEET_COLS = 24;
const SHEET_W    = SHEET_COLS * 16;
const SHEET_H    = 39 * 16;

interface Props {
  buildings: PlacedBuilding[];
  buildingDefs: Map<string, BuildingDef>;
  itemMap: Map<string, Item>;
  tileSize: number;
  selectedId: string | null;
  onBuildingPointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void;
  onBuildingContextMenu?: (id: string, e: React.MouseEvent<SVGElement>) => void;
}

// Building fill colours
const FILL_FB      = 'rgba(107, 79, 20, 0.72)';
const FILL_STATIC  = 'rgba(70, 55, 30, 0.60)';
const FILL_RUIN    = 'rgba(60, 50, 40, 0.55)';
const STROKE       = '#c8a96b';
const STROKE_STA   = '#8a7050';
const DOOR_CLR     = 'rgba(255, 150, 50, 0.85)';

export function BuildingLayer({
  buildings, buildingDefs, itemMap, tileSize, selectedId,
  onBuildingPointerDown, onBuildingContextMenu,
}: Props) {
  return (
    <g>
      {buildings.map((b) => {
        const def = buildingDefs.get(b.buildingId);
        if (!def) return null;

        const px       = b.x * tileSize;
        const py       = b.y * tileSize;
        const pw       = def.width * tileSize;
        const ph       = def.height * tileSize;
        const sel      = b.id === selectedId;
        const isRuin   = b.buildingId === 'Greenhouse' && b.repaired !== true;
        const isStatic = b.isStatic ?? false;

        // ── Fish pond fish icon ──────────────────────────────────────────────
        const isFishPond = b.buildingId === 'Fish Pond';
        const fishItem   = isFishPond && b.fishId ? itemMap.get(b.fishId) : null;
        const fishSprite = (fishItem && fishItem.spriteSheet === 'springobjects' && fishItem.spriteIndex !== undefined)
          ? (() => {
              const col    = fishItem.spriteIndex! % SHEET_COLS;
              const row    = Math.floor(fishItem.spriteIndex! / SHEET_COLS);
              const iconPx = tileSize * 2;
              return { col, row, iconPx, cx: px + pw / 2, cy: py + ph / 2 };
            })()
          : null;

        const fillColor   = isRuin ? FILL_RUIN : isStatic ? FILL_STATIC : FILL_FB;
        const strokeColor = sel ? '#FFD700' : isStatic ? STROKE_STA : STROKE;
        const strokeDash  = isRuin ? '3 2' : isStatic ? '5 3' : undefined;

        // Label: fish pond shows fish name, others show building name
        const fs        = Math.max(5, Math.min(10, (pw / (def.name.length + 1)) | 0));
        const labelText = fishItem
          ? (b.label || '')
          : (b.label || (isFishPond ? 'Fish Pond' : def.name)) + (isRuin ? ' (ruin)' : '');

        return (
          <g
            key={b.id}
            style={{ cursor: isStatic ? 'default' : 'pointer' }}
            onPointerDown={!isStatic && onBuildingPointerDown ? (e) => onBuildingPointerDown(b.id, e) : undefined}
            onContextMenu={onBuildingContextMenu ? (e) => onBuildingContextMenu(b.id, e) : undefined}
          >
            {/* ── Background rect ── */}
            <rect
              x={px} y={py} width={pw} height={ph}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={sel ? 2 : 1}
              strokeDasharray={strokeDash}
            />

            {/* ── Door markers ── */}
            {def.humanDoor && def.humanDoor.x >= 0 && def.humanDoor.y >= 0 && (
              <rect
                x={(b.x + def.humanDoor.x) * tileSize}
                y={(b.y + def.humanDoor.y) * tileSize + tileSize * 0.5}
                width={(def.humanDoor.w ?? 1) * tileSize}
                height={tileSize * 0.5}
                fill={DOOR_CLR}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {def.animalDoor && def.animalDoor.x >= 0 && def.animalDoor.y >= 0 && (
              <rect
                x={(b.x + def.animalDoor.x) * tileSize}
                y={(b.y + def.animalDoor.y) * tileSize + tileSize * 0.5}
                width={(def.animalDoor.w ?? 1) * tileSize}
                height={tileSize * 0.5}
                fill="rgba(80, 200, 80, 0.7)"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* ── Fish sprite for Fish Ponds (16×16 item sprite — works fine) ── */}
            {fishSprite && (
              <svg
                x={fishSprite.cx - fishSprite.iconPx / 2}
                y={fishSprite.cy - fishSprite.iconPx / 2}
                width={fishSprite.iconPx}
                height={fishSprite.iconPx}
                viewBox={`${fishSprite.col * 16} ${fishSprite.row * 16} 16 16`}
                style={{ pointerEvents: 'none' }}
              >
                <image
                  href={`${BASE}sprites/springobjects.png`}
                  x={0} y={0}
                  width={SHEET_W} height={SHEET_H}
                  imageRendering="pixelated"
                />
              </svg>
            )}

            {/* ── Name label ── */}
            {labelText && (
              <text
                x={px + pw / 2} y={py + ph / 2}
                textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize={fs}
                style={{ pointerEvents: 'none', fontFamily: 'monospace', fontWeight: 'bold' }}
              >
                {labelText}
              </text>
            )}

            {/* ── Mailbox (attached to Farmhouse) ── */}
            {b.buildingId === 'Farmhouse' && def.humanDoor && (
              <g style={{ pointerEvents: 'none' }}>
                <rect
                  x={(b.x + def.width) * tileSize}
                  y={(b.y + def.humanDoor.y) * tileSize}
                  width={tileSize} height={tileSize}
                  fill="rgba(60,100,160,0.85)"
                  stroke="rgba(200,220,255,0.7)"
                  strokeWidth={0.5}
                  rx={1}
                />
                <text
                  x={(b.x + def.width) * tileSize + tileSize / 2}
                  y={(b.y + def.humanDoor.y) * tileSize + tileSize / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize={4}
                  style={{ fontFamily: 'monospace' }}
                >✉</text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
