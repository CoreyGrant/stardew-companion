import type { PlacedBuilding } from '../../types/save';
import type { BuildingDef, Item } from '../../types/game';

const BASE = import.meta.env.BASE_URL;

// springobjects sheet dimensions (24 cols × 39 rows × 16px)
const SHEET_COLS = 24;
const SHEET_W    = SHEET_COLS * 16;
const SHEET_H    = 39 * 16;

// Objects_2 sheet dimensions (8 cols × 20 rows × 16px)
const O2_COLS = 8;
const O2_W    = O2_COLS * 16;
const O2_H    = 20 * 16;

interface Props {
  buildings: PlacedBuilding[];
  buildingDefs: Map<string, BuildingDef>;
  itemMap: Map<string, Item>;
  /** Fish-only lookup (Objects only, category=fish) — prevents BigCraftable ID collisions. */
  fishItemMap?: Map<string, Item>;
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
  buildings, buildingDefs, itemMap, fishItemMap, tileSize, selectedId,
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
        // Use fishItemMap (Objects-only, fish category) to avoid BigCraftable
        // ID collisions in the general itemMap (e.g. Octopus=Object 149 vs
        // Skull Brazier=BigCraftable 149; BCs come last and overwrite Objects).
        const isFishPond = b.buildingId === 'Fish Pond';
        const fishItem   = isFishPond && b.fishId ? (fishItemMap ?? itemMap).get(b.fishId) : null;
        const fishSprite = (() => {
          if (!fishItem || fishItem.spriteIndex === undefined) return null;
          const iconPx = tileSize * 2;
          const cx = px + pw / 2;
          const cy = py + ph / 2;
          if (fishItem.spriteSheet === 'springobjects') {
            const col = fishItem.spriteIndex % SHEET_COLS;
            const row = Math.floor(fishItem.spriteIndex / SHEET_COLS);
            return { sheet: 'springobjects', col, row, iconPx, cx, cy, sheetW: SHEET_W, sheetH: SHEET_H };
          }
          if (fishItem.spriteSheet === 'Objects_2') {
            const col = fishItem.spriteIndex % O2_COLS;
            const row = Math.floor(fishItem.spriteIndex / O2_COLS);
            return { sheet: 'Objects_2', col, row, iconPx, cx, cy, sheetW: O2_W, sheetH: O2_H };
          }
          return null;
        })();

        const fillColor   = isRuin ? FILL_RUIN : isStatic ? FILL_STATIC : FILL_FB;
        const strokeColor = sel ? '#FFD700' : isStatic ? STROKE_STA : STROKE;
        const strokeDash  = isRuin ? '3 2' : isStatic ? '5 3' : undefined;

        // Label: fish pond shows fish name when sprite not available, others show building name
        const fs        = Math.max(5, Math.min(10, (pw / (def.name.length + 1)) | 0));
        const labelText = isFishPond
          ? (b.label || (fishSprite ? '' : (fishItem?.name ?? (b.fishId ? b.fishId : 'Fish Pond'))))
          : (b.label || def.name) + (isRuin ? ' (ruin)' : '');

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

            {/* ── Fish sprite for Fish Ponds ── */}
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
                  href={`${BASE}sprites/${fishSprite.sheet === 'Objects_2' ? 'Objects_2' : 'springobjects'}.png`}
                  x={0} y={0}
                  width={fishSprite.sheetW} height={fishSprite.sheetH}
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
