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

const TAPPER_COLOR: Record<string, string> = {
  'tapper':       'rgba(200, 120, 30, 0.9)',
  'heavy-tapper': 'rgba(130, 60, 180, 0.9)',
};

export function TreeLayer({
  trees, treeDefs, tileSize, selectedId,
  onTreePointerDown, onTreeContextMenu,
}: Props) {
  const base = import.meta.env.BASE_URL;

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
            <title>{def?.name ?? tree.treeType}{tree.tapper ? ` (${tree.tapper})` : ''}</title>
            {url && def ? (
              <image
                href={url}
                x={-def.iconX}
                y={-def.iconY}
                width={sheetW}
                height={sheetH}
                imageRendering="pixelated"
                style={{ pointerEvents: 'none' }}
              />
            ) : (
              <rect x={0} y={0} width={tileSize} height={tileSize} fill="rgba(30,80,30,0.8)" />
            )}

            {/* Tapper indicator — small coloured square in bottom-right corner */}
            {tree.tapper && (
              <rect
                x={tileSize * 0.55} y={tileSize * 0.55}
                width={tileSize * 0.4} height={tileSize * 0.4}
                fill={TAPPER_COLOR[tree.tapper] ?? 'orange'}
                rx={1}
                style={{ pointerEvents: 'none' }}
              />
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
