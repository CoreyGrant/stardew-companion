import type { PlacedItem } from '../../types/save';
import type { Item } from '../../types/game';

interface Props {
  items: PlacedItem[];
  itemMap: Map<string, Item>;
  tileSize: number;
  selectedId: string | null;
  onItemPointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void;
  onItemContextMenu?: (id: string, e: React.MouseEvent<SVGElement>) => void;
}

const SHEET_COLS: Record<string, number> = { springobjects: 24, Objects_2: 8, Craftables: 8 };
const SHEET_ROWS: Record<string, number> = { springobjects: 39, Objects_2: 20, Craftables: 46 };

export function ItemLayer({
  items, itemMap, tileSize, selectedId,
  onItemPointerDown, onItemContextMenu,
}: Props) {
  const base = import.meta.env.BASE_URL;

  return (
    <g>
      {items.map((item) => {
        // qi-sprinkler is stored by logical id but shares the iridium sprinkler sprite
        const lookupId = item.itemId === 'qi-sprinkler' ? '645' : item.itemId;
        const def = itemMap.get(lookupId);
        const px  = item.x * tileSize;
        const py  = item.y * tileSize;
        const sel = item.id === selectedId;

        const hasSprite = def?.spriteSheet && def.spriteIndex !== undefined;
        if (hasSprite) {
          const sheet    = def!.spriteSheet!;
          const idx      = def!.spriteIndex!;
          const isBig    = def!.isBigCraftable ?? false;
          const cols     = SHEET_COLS[sheet] ?? 24;
          const rows     = SHEET_ROWS[sheet] ?? 39;
          const col      = idx % cols;
          const row      = Math.floor(idx / cols);
          const url      = `${base}sprites/${sheet}.png`;

          return (
            // Outer SVG clips to the 1×1 tile
            <svg
              key={item.id}
              x={px} y={py}
              width={tileSize} height={tileSize}
              overflow="hidden"
              style={{ cursor: 'pointer' }}
              onPointerDown={onItemPointerDown ? (e) => onItemPointerDown(item.id, e) : undefined}
              onContextMenu={onItemContextMenu ? (e) => onItemContextMenu(item.id, e) : undefined}
            >
              <title>{def!.name}</title>
              {isBig ? (
                // Scale 16×32 → 8×16, centered horizontally in the 16×16 tile
                <svg
                  x={tileSize / 4} y={0}
                  width={tileSize / 2} height={tileSize}
                  viewBox={`${col * 16} ${row * 32} 16 32`}
                  preserveAspectRatio="none"
                >
                  <image href={url} x={0} y={0} width={cols * 16} height={rows * 32} imageRendering="pixelated" style={{ pointerEvents: 'none' }} />
                </svg>
              ) : (
                <image
                  href={url}
                  x={-col * 16}
                  y={-row * 16}
                  width={cols * 16}
                  height={rows * 16}
                  imageRendering="pixelated"
                  style={{ pointerEvents: 'none' }}
                />
              )}
              {sel && (
                <rect
                  x={0} y={0} width={tileSize} height={tileSize}
                  fill="none" stroke="#FFD700" strokeWidth={1.5} rx={1}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>
          );
        }

        // Fallback: coloured rect with abbreviated name
        const label = def?.name ?? (item.itemId === 'qi-sprinkler' ? 'Iridium+Nozzle' : item.itemId);
        const abbr  = label.length > 4 ? label.slice(0, 4) : label;
        return (
          <g
            key={item.id}
            style={{ cursor: 'pointer' }}
            onPointerDown={onItemPointerDown ? (e) => onItemPointerDown(item.id, e) : undefined}
            onContextMenu={onItemContextMenu ? (e) => onItemContextMenu(item.id, e) : undefined}
          >
            <title>{label}</title>
            <rect
              x={px} y={py} width={tileSize} height={tileSize}
              fill="rgba(60, 40, 100, 0.75)"
              stroke={sel ? '#FFD700' : 'rgba(255,255,255,0.4)'}
              strokeWidth={sel ? 1.5 : 0.5}
              rx={1}
            />
            <text
              x={px + tileSize / 2} y={py + tileSize / 2}
              textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize={4}
              style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
            >
              {abbr}
            </text>
          </g>
        );
      })}
    </g>
  );
}
