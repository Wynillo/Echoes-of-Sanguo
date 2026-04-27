import { CardType } from '../../../types.js';
import type { CardData } from '../../../types.js';
import { getCardTypeById, getAttrById } from '../../../type-metadata.js';

export function typeCss(card: CardData): string {
  if (card.type === CardType.Monster) return card.effect ? 'effect' : 'normal';
  return getCardTypeById(card.type)?.key.toLowerCase() ?? 'monster';
}

export function attrCssKey(attr: number | undefined): string {
  if (!attr) return 'spell';
  return getAttrById(attr)?.key ?? 'spell';
}

export function cardTypeCss(card: CardData): string {
  return typeCss(card);
}

export const ATTR_CSS: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) {
    return getAttrById(Number(prop))?.key ?? 'spell';
  },
});
