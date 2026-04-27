// Card.tsx — Backward-compatible wrapper (DEPRECATED)
// Use specific view components instead:
//   HandCardCompact, FieldCardCompact, DetailCard, DeckCard, RevealCard, CardBack
//
// This file will be removed in a future release.

import { DetailCard } from './card/views/DetailCard.js';
import { DeckCard } from './card/views/DeckCard.js';
import { HandCardCompact } from './card/views/HandCardCompact.js';
import { FieldCardCompact } from './card/views/FieldCardCompact.js';
import { CardType } from '../../types.js';
import type { CardData, FieldCard } from '../../types.js';
import { getCardTypeById, getAttrById } from '../../type-metadata.js';

export function cardTypeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect' : 'normal';
  return getCardTypeById(card.type)?.key.toLowerCase() ?? 'monster';
}

export const ATTR_CSS: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { return getAttrById(Number(prop))?.key ?? 'spell'; },
});

interface CardProps {
  card: CardData;
  fc?: FieldCard | null;
  dimmed?: boolean;
  rotated?: boolean;
  big?: boolean;
  small?: boolean;
  extraClass?: string;
}

/**
 * @deprecated Use specific view components instead:
 *   - HandCardCompact for hand cards
 *   - FieldCardCompact for field cards
 *   - DetailCard for detail modals / hover previews
 *   - DeckCard for deckbuilder / collection / lists
 *   - RevealCard for pack opening / activation overlays
 *   - CardBack for facedown cards
 */
export function Card({ card, fc = null, big = false, small = false }: CardProps) {
  if (big) {
    return <DetailCard card={card} fc={fc} />;
  }
  if (small) {
    return <HandCardCompact card={card} />;
  }
  return <DeckCard card={card} size="sm" />;
}
