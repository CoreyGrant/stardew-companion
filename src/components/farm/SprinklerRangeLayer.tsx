import type { PlacedItem } from '../../types/save';

type SprinklerSpec = { cross: boolean; rings: number };

const SPECS: Record<string, SprinklerSpec> = {
  '599':          { cross: true,  rings: 1 },
  '621':          { cross: false, rings: 1 },
  '645':          { cross: false, rings: 2 },
  'qi-sprinkler': { cross: false, rings: 3 },
};

function tilesForSpec(tx: number, ty: number, spec: SprinklerSpec): { x: number; y: number }[] {
  if (spec.cross) {
    return [
      { x: tx,     y: ty - 1 },
      { x: tx + 1, y: ty },
      { x: tx,     y: ty + 1 },
      { x: tx - 1, y: ty },
    ];
  }
  const tiles: { x: number; y: number }[] = [];
  for (let dy = -spec.rings; dy <= spec.rings; dy++) {
    for (let dx = -spec.rings; dx <= spec.rings; dx++) {
      if (dx === 0 && dy === 0) continue;
      tiles.push({ x: tx + dx, y: ty + dy });
    }
  }
  return tiles;
}

interface Props {
  items: PlacedItem[];
  tileSize: number;
  show: boolean;
}

export function SprinklerRangeLayer({ items, tileSize, show }: Props) {
  if (!show) return null;

  return (
    <g opacity={0.28}>
      {items.flatMap((item) => {
        const spec = SPECS[item.itemId];
        if (!spec) return [];
        return tilesForSpec(item.x, item.y, spec).map((t) => (
          <rect
            key={`${item.id}-${t.x},${t.y}`}
            x={t.x * tileSize} y={t.y * tileSize}
            width={tileSize} height={tileSize}
            fill="#4488FF"
          />
        ));
      })}
    </g>
  );
}
