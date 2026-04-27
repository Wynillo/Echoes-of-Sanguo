import type { CardData, FieldCard } from '../../../types.js';
import { CardType } from '../../../types.js';
import { getCardTypeById, getAttrById } from '../../../type-metadata.js';
import { getCardTokens, type CardSize } from './CardTokens.js';
import styles from './CardFrame.module.css';

export interface CardFrameProps {
  card?: CardData;
  fc?: FieldCard | null;
  size: CardSize;
  layout: 'full' | 'compact' | 'art-only' | 'none';
  children?: React.ReactNode;
  extraClass?: string;
}

function typeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect-card' : 'normal-card';
  const typeMeta = getCardTypeById(card.type);
  return typeMeta ? typeMeta.key.toLowerCase() + '-card' : 'monster-card';
}

function attrCssKey(attr: number | undefined): string {
  if (!attr) return 'spell';
  const attrMeta = getAttrById(attr);
  return attrMeta ? attrMeta.key : 'spell';
}

export function CardFrame({ card, fc = null, size, layout, children, extraClass = '' }: CardFrameProps) {
  const tokens = getCardTokens(size);

  if (layout === 'none' || !card) {
    return (
      <div
        className={`${styles.cardFrame} ${styles.faceDown}${extraClass ? ` ${extraClass}` : ''}`}
        style={{ width: tokens.width, height: tokens.height }}
      >
        <div className={styles.cardBackPattern}>
          <span className={styles.backLabel}>A</span>
        </div>
      </div>
    );
  }

  const tCss = typeCss(card);
  const aCss = attrCssKey(card.attribute);

  const cls = [
    styles.cardFrame,
    styles[tCss],
    styles['attr' + aCss.charAt(0).toUpperCase() + aCss.slice(1)],
    extraClass,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      style={{ width: tokens.width, height: tokens.height }}
    >
      {children}
    </div>
  );
}
