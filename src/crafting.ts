import { CARD_DB } from './cards';
import { GAME_RULES } from './rules';
import { Progression } from './progression';
import { getEffectSource } from './effect-items';
import { spendCurrency } from './currencies';
import { CardType } from './types';
import type { CardData } from './types';
import type { CraftedCardRecord } from './progression';

export function isCraftedId(id: string | number): boolean {
  if (typeof id === 'number') return false;
  return id.startsWith('crafted_');
}

export function buildCraftedCard(record: CraftedCardRecord): CardData | null {
  const baseCard = CARD_DB[record.baseId];
  const effectSource = CARD_DB[record.effectSourceId];
  
  if (!baseCard || !effectSource) return null;
  
  return {
    ...baseCard,
    id: record.id,
    effects: effectSource.effects ?? (effectSource.effect ? [effectSource.effect] : []),
  };
}

export function resolveCraftedCard(id: string): CardData | null {
  const record = Progression.findCraftedRecord(id);
  if (!record) return null;
  return buildCraftedCard(record);
}

export interface CraftResult {
  success: boolean;
  card?: CardData;
  error?: string;
}

export function craftEffectMonster(
  baseCardId: string,
  effectSourceId: string,
): CraftResult {
  if (!GAME_RULES.craftingEnabled) {
    return { success: false, error: 'Crafting is disabled' };
  }
  
  const baseCard = CARD_DB[baseCardId];
  if (!baseCard) {
    return { success: false, error: 'Base card not found' };
  }
  
  if (baseCard.type !== CardType.Monster) {
    return { success: false, error: 'Base card must be a monster' };
  }
  
  if (baseCard.effect || baseCard.effects) {
    return { success: false, error: 'Base card already has an effect' };
  }
  
  const effectSource = getEffectSource(effectSourceId);
  if (!effectSource) {
    return { success: false, error: 'Effect source not found' };
  }
  
  const cardCount = Progression.cardCount(baseCardId);
  if (cardCount <= 0) {
    return { success: false, error: 'You do not own this base card' };
  }
  
  const itemCount = Progression.getEffectItemCount(effectSourceId);
  if (itemCount <= 0) {
    return { success: false, error: 'You do not own this effect item' };
  }
  
  if (GAME_RULES.craftingCurrency && GAME_RULES.craftingCost > 0) {
    const spent = spendCurrency(Progression.getActiveSlot()!, GAME_RULES.craftingCurrency, GAME_RULES.craftingCost);
    if (!spent) {
      return { success: false, error: 'Insufficient currency' };
    }
  }
  
  Progression.removeCardsFromCollection([baseCardId]);
  Progression.removeEffectItem(effectSourceId, 1);
  
  const newId = Progression.addCraftedCard(baseCardId, effectSourceId);
  Progression.addCardsToCollection([newId]);
  
  const card = buildCraftedCard({ id: newId, baseId: baseCardId, effectSourceId });
  
  return { success: true, card: card ?? undefined };
}
