import type { CardData } from '../../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardHeader } from '../atoms/CardHeader.js';
import { CardLevel } from '../atoms/CardLevel.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardBody } from '../atoms/CardBody.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';
export { cardTypeCss, ATTR_CSS } from '../../Card.js';

interface DeckCardProps {
  card: CardData;
  size?: 'sm' | 'md';
}

export function DeckCard({ card, size = 'sm' }: DeckCardProps) {
  const tokens = getCardTokens(size);
  return (
    <CardFrame card={card} size={size} layout="full">
      <CardHeader card={card} tokens={tokens} />
      <CardLevel card={card} tokens={tokens} />
      <CardArt card={card} tokens={tokens} />
      <CardBody card={card} tokens={tokens} showDescription={false} />
      <CardStats card={card} tokens={tokens} />
    </CardFrame>
  );
}
