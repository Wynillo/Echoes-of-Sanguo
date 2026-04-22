import type { CardData, CardEffectBlock } from '../types.js';

export function getEffectBlocks(card: CardData, trigger: string): CardEffectBlock[] {
  const blocks: CardEffectBlock[] = [];
  if (card.effects) {
    for (const b of card.effects) {
      if (b.trigger === trigger) blocks.push(b);
    }
  } else if (card.effect && card.effect.trigger === trigger) {
    blocks.push(card.effect);
  }
  return blocks;
}

export function getPassiveBlocks(card: CardData): CardEffectBlock[] {
  return getEffectBlocks(card, 'passive');
}
