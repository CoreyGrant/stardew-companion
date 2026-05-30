import type { PlacedTree } from '../../types/save';
import type { TreeDef } from '../../types/game';

interface Props {
  trees: PlacedTree[];
  treeDefs: TreeDef[];
  tileSize: number;
  selectedId: string | null;
  onTreePointerDown?: (id: string, e: React.PointerEvent<SVGElement>) => void;
  onTreeContextMenu?: (id: string, e: React.MouseEvent<SVGElement>) => void;
}

/**
 * Tapper/Heavy Tapper sprite info from Craftables.png.
 * BigCraftable sprites are 16×32 px each; the sheet has 8 cols.
 * spriteIndex for Tapper = 105, Heavy Tapper = 264 (matches their cheatId / SpriteIndex).
 */
const TAPPER_SPRITE: Record<string, { col: number; row: number }> = {
  'tapper':       { col: 105 % 8, row: Math.floor(105 / 8) }, // col=1, row=13
  'heavy-tapper': { col: 264 % 8, row: Math.floor(264 / 8) }, // col=0, row=33
};
const CRAFTABLES_COLS = 8;
const CRAFTABLES_ROWS = 46;

export function TreeLayer({
  trees, treeDefs, tileSize, selectedId,
  onTreePointerDown, onTreeContextMenu,
}: Props) {
  const base = import.meta.env.BASE_URL;
  const craftablesUrl = `${base}sprites/Craftables.png`;

  return (
    <g>
      {trees.map((tree) => {
        const def = treeDefs.find((d) => d.type === tree.treeType);
        const px  = tree.x * tileSize;
        const py  = tree.y * tileSize;
        const sel = tree.id === selectedId;
        const url = def ? `${base}sprites/${def.spriteFile}` : null;
        const sheetW = def ? def.cols * 16 : 0;
        const sheetH = def ? def.rows * 16 : 0;

        // Trees are 1×2 sprites (16×32 px).  We display the full sprite scaled
        // to fit inside the tile square via a viewBox (same as every other sprite).
        // The sprite region starts at (iconX, iconY) and is 16 wide × 32 tall.
        const tapperSpr = tree.tapper ? TAPPER_SPRITE[tree.tapper] : null;
        // Tapper sits on the trunk, which maps to the lower half of the scaled sprite.
        const tapperSize = Math.round(tileSize * 0.5);

        return (
          <svg
            key={tree.id}
            x={px} y={py}
            width={tileSize} height={tileSize}
            overflow="hidden"
            style={{ cursor: 'pointer' }}
            onPointerDown={onTreePointerDown ? (e) => onTreePointerDown(tree.id, e) : undefined}
            onContextMenu={onTreeContextMenu ? (e) => onTreeContextMenu(tree.id, e) : undefined}
          >
            {/* Full 16×32 tree sprite (canopy + trunk) scaled to fit the tile. */}
            {url && def ? (
              <svg
                x={0} y={0}
                width={tileSize} height={tileSize}
                viewBox={`${def.iconX} ${def.iconY} 16 32`}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: 'none' }}
                overflow="hidden"
              >
                <image
                  href={url}
                  x={0} y={0}
                  width={sheetW}
                  height={sheetH}
                  imageRendering="pixelated"
                />
              </svg>
            ) : (
              <rect x={0} y={0} width={tileSize} height={tileSize} fill="rgba(30,80,30,0.8)" />
            )}

            {/* Tapper sprite overlay — positioned on the lower (trunk) half of the tile. */}
            {tapperSpr && (
              <svg
                x={Math.round((tileSize - tapperSize) / 2)}
                y={Math.round(tileSize * 0.38)}
                width={tapperSize}
                height={tapperSize * 2}
                viewBox={`${tapperSpr.col * 16} ${tapperSpr.row * 32} 16 32`}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: 'none' }}
                overflow="hidden"
              >
                <image
                  href={craftablesUrl}
                  x={0} y={0}
                  width={CRAFTABLES_COLS * 16}
                  height={CRAFTABLES_ROWS * 32}
                  imageRendering="pixelated"
                />
              </svg>
            )}

            {/* Selection ring */}
            {sel && (
              <rect
                x={0} y={0} width={tileSize} height={tileSize}
                fill="none" stroke="#FFD700" strokeWidth={1.5} rx={1}
                style={{ pointerEvents: 'none' }}
              />
            )}
          </svg>
        );
      })}
    </g>
  );
}
