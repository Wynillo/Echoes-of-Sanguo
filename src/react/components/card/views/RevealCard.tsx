import type { CardData, FieldCard } from '../../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardHeader } from '../atoms/CardHeader.js';
import { CardLevel } from '../atoms/CardLevel.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardBody } from '../atoms/CardBody.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface RevealCardProps {
  card: CardData;
  fc?: FieldCard | null;
}

export function RevealCard({ card, fc = null }: RevealCardProps) {
  const tokens = getCardTokens('xl');
  return (
    <CardFrame card={card} size="xl" layout="full" fc={fc}>
      <CardHeader card={card} tokens={tokens} />
      <CardLevel card={card} tokens={tokens} />
      <CardArt card={card} tokens={tokens} />
      <CardBody card={card} tokens={tokens} showDescription />
      <CardStats card={card} fc={fc} tokens={tokens} />
    </CardFrame>
  );
}
