import type { GiftTaste } from '../../types/game';

interface Props {
  taste: GiftTaste;
}

const LABELS: Record<GiftTaste, string> = {
  loved: 'Loved',
  liked: 'Liked',
  neutral: 'Neutral',
  disliked: 'Disliked',
  hated: 'Hated',
};

export function GiftTag({ taste }: Props) {
  return (
    <span className={`gift-tag gift-tag--${taste}`} aria-label={`Gift taste: ${LABELS[taste]}`}>
      {LABELS[taste]}
    </span>
  );
}
