import { CARD_DB } from './cards.js';
import { GAME_RULES } from './rules.js';
import { Progression } from './progression.js';
import { getEffectSource } from './effect-items.js';
import { spendCurrency } from './currencies.js';
import { CardType } from './types.js';
import type { CardData } from './types.js';
import type { CraftedCardRecord } from './progression.js';

const CRAFTED_ID_OFFSET = 100_000_000;

export function isCraftedId(id: string | number): boolean {
  return Number(id) >= CRAFTED_ID_OFFSET;
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

export function getCard(id: string | number): CardData | null {
  const strId = String(id);
  
  if (isCraftedId(strId)) {
    return resolveCraftedCard(strId);
  }
  
  return CARD_DB[strId] ?? null;
}
