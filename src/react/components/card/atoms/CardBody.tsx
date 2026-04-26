import { useTranslation } from 'react-i18next';
import { getRaceById, getCardTypeById } from '../../../../type-metadata.js';
import { CardType } from '../../../../types.js';
import type { CardData } from '../../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import { highlightCardText } from '../../../utils/highlightCardText.js';
import styles from './CardBody.module.css';

interface CardBodyProps {
  card: CardData;
  tokens: CardSizeTokens;
  showDescription?: boolean;
}

export function CardBody({ card, tokens, showDescription = true }: CardBodyProps) {
  const { t } = useTranslation();
  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceLabel = raceMeta?.value ?? '';
  const typeLabel = 
    card.type === CardType.Monster && card.effect
      ? t('card_detail.type_effect')
      : getCardTypeById(card.type)?.value ?? '';
  const isMonster = card.atk !== undefined && card.type !== CardType.Equipment;
  const typeSubtypeStr = isMonster && raceLabel ? `[${typeLabel} / ${raceLabel}]` : `[${typeLabel}]`;

  return (
    <div className={styles.cardBody} style={{ maxHeight: tokens.bodyMaxHeight, padding: `${tokens.bodyPaddingV}px ${tokens.bodyPaddingH}px`, gap: tokens.artGap }}>
      <div className={styles.typeSubtype} style={{ fontSize: tokens.fontType }}>
        {typeSubtypeStr}
      </div>
      {showDescription && card.description && (
        <div className={styles.descText} style={{ fontSize: tokens.fontDesc, WebkitLineClamp: tokens.bodyMaxHeight > 40 ? 3 : 2 }}>
          {highlightCardText(card.description)}
        </div>
      )}
    </div>
  );
}
