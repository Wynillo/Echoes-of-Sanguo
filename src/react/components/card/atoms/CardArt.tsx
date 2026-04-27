import { getRaceById, getRarityById } from '../../../../type-metadata.js';
import type { CardData } from '../../../../types.js';
import { CardType } from '../../../../types.js';
import type { CardSizeTokens } from '../CardTokens.js';
import styles from './CardArt.module.css';

function getPlaceholderUrl(card: CardData): string | null {
  switch (card.type) {
    case CardType.Monster: return './img/placeholders/monster.svg';
    case CardType.Fusion: return './img/placeholders/fusion.svg';
    case CardType.Trap: return './img/placeholders/trap.svg';
    case CardType.Equipment: return './img/placeholders/equipment.svg';
    case CardType.Spell: return card.spellType === 'field' ? './img/placeholders/field-spell.svg' : './img/placeholders/spell.svg';
    default: return null;
  }
}

interface CardArtProps {
  card: CardData;
  tokens: CardSizeTokens;
}

export function CardArt({ card, tokens }: CardArtProps) {
  const ph = getPlaceholderUrl(card);
  const artStyle: React.CSSProperties | undefined = ph
    ? { backgroundImage: `url(${ph})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  const raceMeta = card.race ? getRaceById(card.race) : undefined;
  const raceBadge = card.race ? (
    <span className={styles.raceBadge} style={{ background: raceMeta?.color ?? '#444', fontSize: tokens.badgeFont, padding: `${tokens.badgePaddingV}px ${tokens.badgePaddingH}px` }}>
      {raceMeta?.value ?? card.race}
    </span>
  ) : null;

  const rarMeta = card.rarity ? getRarityById(card.rarity) : undefined;
  const rarityText = card.rarity ? (
    <span className={styles.rarityText} style={{ fontSize: tokens.badgeFont, color: rarMeta?.color ?? '#aaa' }}>
      {rarMeta?.value ?? ''}
    </span>
  ) : null;

  return (
    <div className={styles.cardArt} style={{ ...artStyle, width: `calc(100% - ${tokens.artMargin * 2}px)`, margin: `${tokens.artMargin}px` }}>
      {raceBadge}
      {rarityText}
    </div>
  );
}
