import { CardType } from '../../../../types.js';
import type { CardData } from '../../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardLevel.module.css';

interface CardLevelProps {
  card: CardData;
  tokens: CardSizeTokens;
}

export function CardLevel({ card, tokens }: CardLevelProps) {
  const isMonsterLevel = card.type === CardType.Monster || card.type === CardType.Fusion;
  const levelStars = isMonsterLevel && card.level ? '\u2605'.repeat(Math.min(card.level, 12)) : '';
  if (!levelStars) return null;
  return (
    <div className={styles.cardLevel} style={{ fontSize: tokens.fontLevel, padding: '1px 2px', minHeight: tokens.fontLevel + 3 }}>
      {levelStars}
    </div>
  );
}
