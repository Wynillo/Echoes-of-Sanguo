import type { CardData, FieldCard } from '../../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardHeader } from '../atoms/CardHeader.js';
import { CardLevel } from '../atoms/CardLevel.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardBody } from '../atoms/CardBody.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface DetailCardProps {
  card: CardData;
  fc?: FieldCard | null;
}

export function DetailCard({ card, fc = null }: DetailCardProps) {
  const tokens = getCardTokens('lg');
  return (
    <CardFrame card={card} size="lg" layout="full" fc={fc}>
      <CardHeader card={card} tokens={tokens} />
      <CardLevel card={card} tokens={tokens} />
      <CardArt card={card} tokens={tokens} />
      <CardBody card={card} tokens={tokens} showDescription />
      <CardStats card={card} fc={fc} tokens={tokens} />
    </CardFrame>
  );
}
