import type { PlacedClump, ClumpType } from '../../types/save';

interface Props {
  clumps: PlacedClump[];
  tileSize: number;
}

/**
 * Sprite coords in springobjects.png for each resource clump type.
 * Formula: x = (parentSheetIndex % 24) * 16, y = floor(parentSheetIndex / 24) * 16
 * Sprite region is always 32×32px (2×2 tiles).
 */
const CLUMP_SPRITE: Record<ClumpType, { sx: number; sy: number } | null> = {
  stump:     { sx: 0,   sy: 400 }, // psi 600: (600%24)*16=0,  (600/24)*16=400
  log:       { sx: 32,  sy: 400 }, // psi 602: (602%24)*16=32, (602/24)*16=400
  meteorite: { sx: 0,   sy: 448 }, // psi 672: (672%24)*16=0,  (672/24)*16=448
  weeds:     { sx: 0,   sy: 512 }, // psi 760: (760%24)*16=16... fallback below
  boulder:   { sx: 32,  sy: 512 }, // psi 752+: rough fallback
  unknown:   null,
};

// springobjects.png dimensions (24 cols × 39 rows, 16×16 px per cell)
const SHEET_W = 24 * 16; // 384
const SHEET_H = 39 * 16; // 624

export function ClumpLayer({ clumps, tileSize }: Props) {
  const base = import.meta.env.BASE_URL;
  const sheetUrl = `${base}sprites/springobjects.png`;

  return (
    <g>
      {clumps.map((clump, i) => {
        const px = clump.x * tileSize;
        const py = clump.y * tileSize;
        const pw = clump.w * tileSize;
        const ph = clump.h * tileSize;
        const spr = CLUMP_SPRITE[clump.clumpType];

        return (
          <svg
            key={i}
            x={px} y={py}
            width={pw} height={ph}
            overflow="visible"
            style={{ pointerEvents: 'none' }}
          >
            {spr ? (
              /* Sprite from springobjects.png — viewBox clips the 32×32 source region */
              <svg
                x={0} y={0}
                width={pw} height={ph}
                viewBox={`${spr.sx} ${spr.sy} 32 32`}
                preserveAspectRatio="xMidYMid meet"
                overflow="hidden"
              >
                <image
                  href={sheetUrl}
                  x={0} y={0}
                  width={SHEET_W}
                  height={SHEET_H}
                  imageRendering="pixelated"
                />
              </svg>
            ) : (
              /* Fallback rect for unknown clump types */
              <rect
                x={0} y={0} width={pw} height={ph}
                fill="rgba(100,80,60,0.7)"
                stroke="rgba(60,40,20,0.9)"
                strokeWidth={0.5}
              />
            )}
          </svg>
        );
      })}
    </g>
  );
}
