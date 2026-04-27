import { getAttrById } from '../../../../type-metadata.js';
import type { CardData } from '../../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardHeader.module.css';

interface CardHeaderProps {
  card: CardData;
  tokens: CardSizeTokens;
}

export function CardHeader({ card, tokens }: CardHeaderProps) {
  const attrMeta = card.attribute ? getAttrById(card.attribute) : undefined;
  const attrSym = attrMeta?.symbol ?? '\u2726';
  const orbColor = attrMeta?.color ?? '#444';

  return (
    <div className={styles.cardHeader} style={{ padding: `2px ${tokens.bodyPaddingH}px` }}>
      <span className={styles.nameShort} style={{ fontSize: tokens.fontName }}>
        {card.name}
      </span>
      {card.attribute && (
        <span
          className={styles.attrOrb}
          style={{
            width: tokens.orbSize,
            height: tokens.orbSize,
            fontSize: tokens.orbFont,
            background: orbColor,
          }}
        >
          {attrSym}
        </span>
      )}
    </div>
  );
}
