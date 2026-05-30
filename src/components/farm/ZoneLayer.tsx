import type { CropZone } from '../../types/save';
import type { Season, Crop, Item } from '../../types/game';

const FILLS = [
  'rgba(80, 160, 80, 0.35)',
  'rgba(80, 120, 200, 0.35)',
  'rgba(200, 160, 80, 0.35)',
  'rgba(200, 80,  80, 0.35)',
  'rgba(160, 80, 200, 0.35)',
  'rgba(80, 200, 200, 0.35)',
];

const STROKES = [
  'rgba(80, 180, 80, 0.9)',
  'rgba(80, 140, 220, 0.9)',
  'rgba(220, 180, 80, 0.9)',
  'rgba(220, 80, 80, 0.9)',
  'rgba(180, 80, 220, 0.9)',
  'rgba(80, 220, 220, 0.9)',
];

const SHEET_COLS: Record<string, number> = { springobjects: 24, Objects_2: 8 };
const SHEET_ROWS: Record<string, number> = { springobjects: 39, Objects_2: 20 };

interface Props {
  zones: CropZone[];
  tileSize: number;
  season: Season;
  selectedZoneId: string | null;
  /** Crop definitions keyed by crop id (e.g. "parsnip-crop"). */
  cropMap?: Map<string, Crop>;
  /** Item definitions keyed by cheatId. Used to resolve harvest-item sprites. */
  itemMap?: Map<string, Item>;
}

export function ZoneLayer({ zones, tileSize, season, selectedZoneId, cropMap, itemMap }: Props) {
  const base = import.meta.env.BASE_URL;

  return (
    <g>
      {zones.map((zone, zIdx) => {
        const fill   = FILLS[zIdx % FILLS.length];
        const stroke = STROKES[zIdx % STROKES.length];
        const sel    = zone.id === selectedZoneId;
        const cropId = zone.crops[season];

        // Look up the harvest-item sprite for the assigned crop
        const crop        = cropId ? cropMap?.get(cropId) : undefined;
        const harvestItem = crop ? itemMap?.get(crop.harvestItemId) : undefined;
        const hasSpr      = !!(harvestItem?.spriteSheet && harvestItem.spriteIndex !== undefined);

        return zone.rects.map((rect, ri) => {
          const cx = (rect.x + rect.w / 2) * tileSize;
          const cy = (rect.y + rect.h / 2) * tileSize;

          // Crop icon: render in the first rect only
          let cropNode: React.ReactNode = null;
          if (ri === 0 && cropId) {
            if (hasSpr) {
              const sheet    = harvestItem!.spriteSheet!;
              const idx      = harvestItem!.spriteIndex!;
              const cols     = SHEET_COLS[sheet] ?? 24;
              const rows     = SHEET_ROWS[sheet] ?? 39;
              const col      = idx % cols;
              const row      = Math.floor(idx / cols);
              const iconSize = Math.max(8, Math.min(tileSize * 0.75, 14));
              cropNode = (
                <svg
                  x={cx - iconSize / 2} y={cy - iconSize / 2}
                  width={iconSize} height={iconSize}
                  overflow="hidden"
                  style={{ pointerEvents: 'none' }}
                >
                  <image
                    href={`${base}sprites/${sheet}.png`}
                    x={-col * 16} y={-row * 16}
                    width={cols * 16} height={rows * 16}
                    imageRendering="pixelated"
                  />
                </svg>
              );
            } else {
              // Fallback: text abbreviation when no sprite is available
              cropNode = (
                <text
                  x={cx} y={cy}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="white" fontSize={7}
                  style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                >
                  {crop?.name.slice(0, 6) ?? cropId.slice(0, 6)}
                </text>
              );
            }
          }

          return (
            <g key={`${zone.id}-${ri}`}>
              <rect
                x={rect.x * tileSize} y={rect.y * tileSize}
                width={rect.w * tileSize} height={rect.h * tileSize}
                fill={fill}
                stroke={sel ? '#FFD700' : stroke}
                strokeWidth={sel ? 1.5 : 0.75}
              />
              {cropNode}
            </g>
          );
        });
      })}
    </g>
  );
}
