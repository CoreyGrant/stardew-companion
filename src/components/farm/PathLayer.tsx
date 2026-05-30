import type { PlacedPath, PathType } from '../../types/save';

// Pixel coordinates of the "fully-connected center" tile (Corner + 32px offset)
// in TerrainFeatures/Flooring.png (256×256, 16×16 per tile).
// Source: Data/FloorsAndPaths.json Corner values + 32px to pick the interior tile.
const PATH_SPRITE: Partial<Record<PathType, { cx: number; cy: number }>> = {
  wood:           { cx: 128+32, cy:  64+32 },  // Wood Path (type 6)
  stone:          { cx:  64+32, cy:   0+32 },  // Stone Floor (type 1)
  gravel:         { cx:  64+32, cy:  64+32 },  // Gravel Path (type 5)
  wood_plank:     { cx: 192+32, cy: 128+32 },  // Rustic Plank Floor (type 11)
  crystal:        { cx: 192+32, cy:  64+32 },  // Crystal Path (type 7)
  cobblestone:    { cx:   0+32, cy: 128+32 },  // Cobblestone Path (type 8)
  stepping_stone: { cx:  64+32, cy: 128+32 },  // Stepping Stone Path (type 9)
  straw:          { cx:   0+32, cy:  64+32 },  // Straw Floor (type 4)
  dirt:           { cx:   0+32, cy:   0+32 },  // Wood Floor as fallback (type 0)
};

// springobjects.png sprites for fences and gates (24 cols × 39 rows, 16×16 each).
// Item IDs: Wood Fence 322, Stone Fence 323, Iron Fence 324, Gate 325, Hardwood Fence 298.
const FENCE_SPRITE: Partial<Record<PathType, { col: number; row: number }>> = {
  fence_wood:     { col: 322 % 24, row: Math.floor(322 / 24) },  // (10, 13)
  fence_stone:    { col: 323 % 24, row: Math.floor(323 / 24) },  // (11, 13)
  fence_iron:     { col: 324 % 24, row: Math.floor(324 / 24) },  // (12, 13)
  gate:           { col: 325 % 24, row: Math.floor(325 / 24) },  // (13, 13)
  fence_hardwood: { col: 298 % 24, row: Math.floor(298 / 24) },  // (10, 12)
};

const SPRINGOBJECTS_COLS = 24;
const SPRINGOBJECTS_ROWS = 39;

interface Props {
  paths: PlacedPath[];
  tileSize: number;
}

export function PathLayer({ paths, tileSize }: Props) {
  const base       = import.meta.env.BASE_URL;
  const floorUrl   = `${base}sprites/Flooring.png`;
  const objectsUrl = `${base}sprites/springobjects.png`;

  return (
    <g>
      {paths.map((p) => {
        // ── Fence / gate: render icon from springobjects ──────────────────────
        const fence = FENCE_SPRITE[p.pathType];
        if (fence) {
          const { col, row } = fence;
          return (
            <svg
              key={`${p.x},${p.y}`}
              x={p.x * tileSize} y={p.y * tileSize}
              width={tileSize} height={tileSize}
              overflow="hidden"
            >
              <image
                href={objectsUrl}
                x={-col * 16} y={-row * 16}
                width={SPRINGOBJECTS_COLS * 16}
                height={SPRINGOBJECTS_ROWS * 16}
                imageRendering="pixelated"
                style={{ pointerEvents: 'none' }}
              />
            </svg>
          );
        }

        // ── Path / floor: render from Flooring.png ────────────────────────────
        const sprite = PATH_SPRITE[p.pathType];
        if (!sprite) return null;
        const { cx, cy } = sprite;
        return (
          <svg
            key={`${p.x},${p.y}`}
            x={p.x * tileSize} y={p.y * tileSize}
            width={tileSize} height={tileSize}
            overflow="hidden"
          >
            <image
              href={floorUrl}
              x={-cx} y={-cy}
              width={256} height={256}
              imageRendering="pixelated"
              style={{ pointerEvents: 'none' }}
            />
          </svg>
        );
      })}
    </g>
  );
}
