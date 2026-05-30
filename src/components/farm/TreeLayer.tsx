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
const CRAFTABLES_ROWS = 46; // rows of 32px each

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

        // Trees are 1×2 sprites (16×32 px). We render the base tile at (px, py) and
        // let the canopy overflow upward by 1 tile via overflow="visible".
        // Shifting the image up by tileSize aligns the trunk (bottom 16 px of the
        // sprite) with the placed tile and the canopy with the tile above.
        const tapperSpr = tree.tapper ? TAPPER_SPRITE[tree.tapper] : null;
        const tapperOverlaySize = Math.round(tileSize * 0.55); // ~9 px at tileSize=16

        return (
          <svg
            key={tree.id}
            x={px} y={py}
            width={tileSize} height={tileSize}
            overflow="visible"
            style={{ cursor: 'pointer' }}
            onPointerDown={onTreePointerDown ? (e) => onTreePointerDown(tree.id, e) : undefined}
            onContextMenu={onTreeContextMenu ? (e) => onTreeContextMenu(tree.id, e) : undefined}
          >
            <title>{def?.name ?? tree.treeType}{tree.tapper ? ` (${tree.tapper})` : ''}</title>

            {/* Tree sprite — trunk at [0, tileSize], canopy overflows to [-tileSize, 0] */}
            {url && def ? (
              <image
                href={url}
                x={-def.iconX}
                y={-def.iconY - tileSize}
                width={sheetW}
                height={sheetH}
                imageRendering="pixelated"
                style={{ pointerEvents: 'none' }}
              />
            ) : (
              <rect x={0} y={0} width={tileSize} height={tileSize} fill="rgba(30,80,30,0.8)" />
            )}

            {/* Tapper sprite — small overlay on the trunk, centred horizontally */}
            {tapperSpr && (
              <svg
                x={Math.round((tileSize - tapperOverlaySize) / 2)}
                y={Math.round(tileSize * 0.2)}
                width={tapperOverlaySize}
                height={tapperOverlaySize * 2}
                viewBox={`${tapperSpr.col * 16} ${tapperSpr.row * 32} 16 32`}
                preserveAspectRatio="xMidYMid meet"
                style={{ pointerEvents: 'none' }}
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

            {/* Selection ring — on the base tile only */}
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
