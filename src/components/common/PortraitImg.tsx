/**
 * PortraitImg
 *
 * Renders the first 64×64 frame of a Stardew Valley NPC portrait sprite sheet
 * scaled to an arbitrary display size.
 *
 * Portrait PNGs are sprite sheets (e.g. Abigail: 128×320, Alex: 128×384).
 * The first emotion frame sits at (0,0) and is always 64×64 px.
 * A plain <img> with objectFit:none at sizes <64 only shows the top-left
 * corner — this component fixes that by scaling via CSS transform.
 */

interface Props {
  src: string;
  alt?: string;
  /** Display size in CSS px (the component is always square). */
  size: number;
  className?: string;
}

export function PortraitImg({ src, alt = '', size, className }: Props) {
  const scale = size / 64;
  return (
    <span
      className={className}
      style={{
        display:    'inline-block',
        width:      size,
        height:     size,
        overflow:   'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={src}
        alt={alt}
        width={128}
        style={{
          imageRendering: 'pixelated',
          display:        'block',
          height:         'auto',
          maxWidth:       'none',   // prevent container from constraining to wrapper width
          transform:      `scale(${scale})`,
          transformOrigin:'0 0',
        }}
      />
    </span>
  );
}
