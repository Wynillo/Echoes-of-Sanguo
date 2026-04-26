import type { CardData, FieldCard } from '../../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface FieldCardCompactProps {
  card: CardData;
  fc?: FieldCard | null;
  size?: 'xs' | 'sm';
}

export function FieldCardCompact({ card, fc = null, size = 'sm' }: FieldCardCompactProps) {
  const tokens = getCardTokens(size);
  return (
    <CardFrame card={card} size={size} layout="compact" fc={fc}>
      <CardArt card={card} tokens={tokens} />
      <CardStats card={card} fc={fc} tokens={tokens} compact />
      <div
        style={{
          fontSize: tokens.fontNameSmall,
          fontWeight: 'bold',
          color: 'var(--gold-light, #e0c870)',
          textAlign: 'center',
          padding: '2px 3px 3px',
          background: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.3,
        }}
      >
        {card.name}
      </div>
    </CardFrame>
  );
}
