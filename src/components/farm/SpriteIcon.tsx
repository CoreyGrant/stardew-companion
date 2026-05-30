import type { CSSProperties } from 'react';

interface Props {
  spriteSheet: string;
  spriteIndex: number;
  isBigCraftable?: boolean;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const SHEET_COLS: Record<string, number> = {
  springobjects: 24,
  Objects_2:     8,
  Craftables:    8,
};

const SHEET_ROWS: Record<string, number> = {
  springobjects: 39,
  Objects_2:     20,
  Craftables:    46,
};

export function SpriteIcon({
  spriteSheet, spriteIndex, isBigCraftable = false,
  size = 32, className, style,
}: Props) {
  const cols  = SHEET_COLS[spriteSheet] ?? 24;
  const rows  = SHEET_ROWS[spriteSheet] ?? 39;
  const col   = spriteIndex % cols;
  const row   = Math.floor(spriteIndex / cols);
  const src   = `${import.meta.env.BASE_URL}sprites/${spriteSheet}.png`;
  // BigCraftables are 16×32 px per cell; show the full 1×2 sprite (twice as tall as wide).
  const cellH = isBigCraftable ? size * 2 : size;
  const containerH = isBigCraftable ? size * 2 : size;

  return (
    <div
      className={className}
      style={{
        width:  size,
        height: containerH,
        flexShrink: 0,
        overflow: 'hidden',
        imageRendering: 'pixelated',
        backgroundImage: `url(${src})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${cols * size}px ${rows * cellH}px`,
        backgroundPosition: `-${col * size}px -${row * cellH}px`,
        ...style,
      }}
    />
  );
}
