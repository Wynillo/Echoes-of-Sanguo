import { CardFrame } from '../CardFrame.js';
import type { CardSize } from '../CardTokens.js';

interface CardBackProps {
  size?: CardSize;
}

export function CardBack({ size = 'sm' }: CardBackProps) {
  return <CardFrame size={size} layout="none" />;
}
