import type { PlacedItem } from '../../types/save';

const SCARECROW_RADIUS: Record<string, number> = {
  '8':   8,   // Scarecrow
  '110': 8,   // Rarecrow (Turnip Head)
  '113': 8,   // Rarecrow (Witch Hat)
  '126': 8,   // Rarecrow (Alien)
  '136': 8,   // Rarecrow (Butterfly)
  '137': 8,   // Rarecrow (Skull)
  '138': 8,   // Rarecrow (Cactus)
  '139': 8,   // Rarecrow (Snowman)
  '140': 8,   // Rarecrow (Dwarf)
  '167': 16,  // Deluxe Scarecrow
};

function tilesInRadius(tx: number, ty: number, r: number): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (Math.sqrt(dx * dx + dy * dy) <= r + 0.5) {
        tiles.push({ x: tx + dx, y: ty + dy });
      }
    }
  }
  return tiles;
}

interface Props {
  items: PlacedItem[];
  tileSize: number;
  show: boolean;
}

export function ScarecrowRangeLayer({ items, tileSize, show }: Props) {
  if (!show) return null;

  const scarecrows = items.filter((i) => SCARECROW_RADIUS[i.itemId] !== undefined);
  if (scarecrows.length === 0) return null;

  return (
    <g style={{ pointerEvents: 'none' }}>
      {scarecrows.flatMap((item) => {
        const r = SCARECROW_RADIUS[item.itemId];
        return tilesInRadius(item.x, item.y, r).map((t) => (
          <rect
            key={`${item.id}-${t.x},${t.y}`}
            x={t.x * tileSize} y={t.y * tileSize}
            width={tileSize} height={tileSize}
            fill="rgba(255,200,40,0.18)"
            stroke="none"
          />
        ));
      })}
    </g>
  );
}
