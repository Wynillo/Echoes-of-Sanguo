import type { CardData } from '../../../../types.js';
import { CardFrame } from '../CardFrame.js';
import { CardArt } from '../atoms/CardArt.js';
import { CardStats } from '../atoms/CardStats.js';
import { getCardTokens } from '../CardTokens.js';

interface HandCardCompactProps {
  card: CardData;
  size?: 'xs' | 'sm';
}

export function HandCardCompact({ card, size = 'sm' }: HandCardCompactProps) {
  const tokens = getCardTokens(size);
  return (
    <CardFrame card={card} size={size} layout="compact">
      <CardArt card={card} tokens={tokens} />
      <CardStats card={card} tokens={tokens} compact />
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
