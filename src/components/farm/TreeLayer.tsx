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
        // Tapper: kept small so the tree sprite remains visible behind it.
        const tapperSize = Math.round(tileSize * 0.34);

        // Fruit-tree sprites are visually larger than wild-tree sprites at the
        // same 16×32 source size, so scale them down to 72% and bottom-align
        // (trunk sits at the base of the tile, canopy floats upward).
        const spriteScale = def?.isFruitTree ? 0.72 : 1.0;
        const sprW = Math.round(tileSize * spriteScale);
        const sprH = Math.round(tileSize * spriteScale);
        const sprX = Math.round((tileSize - sprW) / 2); // centre horizontally
        const sprY = tileSize - sprH;                   // bottom-align

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
            {/* Tree sprite scaled to fit the tile (fruit trees shrunk further). */}
            {url && def ? (
              <svg
                x={sprX} y={sprY}
                width={sprW} height={sprH}
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

            {/* Tapper sprite overlay — small icon near top of tile so tree is still visible. */}
            {tapperSpr && (
              <svg
                x={Math.round((tileSize - tapperSize) / 2)}
                y={Math.round(tileSize * 0.04)}
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
