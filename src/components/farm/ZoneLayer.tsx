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

        // Resolve harvest-item sprite for the assigned crop
        const crop        = cropId ? cropMap?.get(cropId) : undefined;
        const harvestItem = crop ? itemMap?.get(crop.harvestItemId) : undefined;
        const hasSpr      = !!(harvestItem?.spriteSheet && harvestItem.spriteIndex !== undefined);

        // Pre-compute sprite values so they aren't recalculated per-cell
        const sprSheet  = harvestItem?.spriteSheet ?? '';
        const sprIdx    = harvestItem?.spriteIndex ?? 0;
        const sprCols   = SHEET_COLS[sprSheet] ?? 24;
        const sprRows   = SHEET_ROWS[sprSheet] ?? 39;
        const sprCol    = sprIdx % sprCols;
        const sprRow    = Math.floor(sprIdx / sprCols);
        const sprUrl    = hasSpr ? `${base}sprites/${sprSheet}.png` : '';
        const iconSize  = Math.max(8, Math.min(tileSize * 0.75, 14));

        return zone.rects.map((rect, ri) => {
          // Render an icon in every cell of this rect
          const icons: React.ReactNode[] = [];
          if (cropId) {
            for (let dy = 0; dy < rect.h; dy++) {
              for (let dx = 0; dx < rect.w; dx++) {
                const cx = (rect.x + dx + 0.5) * tileSize;
                const cy = (rect.y + dy + 0.5) * tileSize;
                if (hasSpr) {
                  icons.push(
                    <svg
                      key={`${ri}-${dx}-${dy}`}
                      x={cx - iconSize / 2} y={cy - iconSize / 2}
                      width={iconSize} height={iconSize}
                      overflow="hidden"
                      style={{ pointerEvents: 'none' }}
                    >
                      <image
                        href={sprUrl}
                        x={-sprCol * 16} y={-sprRow * 16}
                        width={sprCols * 16} height={sprRows * 16}
                        imageRendering="pixelated"
                      />
                    </svg>,
                  );
                } else {
                  icons.push(
                    <text
                      key={`${ri}-${dx}-${dy}`}
                      x={cx} y={cy}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize={7}
                      style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
                    >
                      {crop?.name.slice(0, 1) ?? '?'}
                    </text>,
                  );
                }
              }
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
              {icons}
            </g>
          );
        });
      })}
    </g>
  );
}
