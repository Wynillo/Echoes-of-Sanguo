// ============================================================
// ECHOES OF SANGUO — TCG Builder
// Converts CardData → TcgCard / TcgCardDefinition for export
// ============================================================
import type { CardData } from '../types.js';
import { CardType } from '../types.js';
import type { TcgCard, TcgCardDefinition } from './types.js';
import { cardTypeToInt, attributeToInt, raceToInt, rarityToInt, spellTypeToInt, trapTriggerToInt } from './enums.js';
import { serializeEffect } from './effect-serializer.js';

export function cardDataToTcgCard(card: CardData, numId: number): TcgCard {
  const isMonster = card.type === CardType.Monster || card.type === CardType.Fusion;
  const tc: TcgCard = {
    id:     numId,
    level:  card.level ?? 1,
    rarity: card.rarity ? rarityToInt(card.rarity) : 1,
    type:   cardTypeToInt(card.type),
  };
  if (isMonster) {
    if (card.atk !== undefined) tc.atk = card.atk;
    if (card.def !== undefined) tc.def = card.def;
    if (card.attribute)         tc.attribute = attributeToInt(card.attribute);
    if (card.race)              tc.race = raceToInt(card.race);
  }
  if (card.effect) tc.effect = serializeEffect(card.effect);
  if (card.spellType)   tc.spellType   = spellTypeToInt(card.spellType as any);
  if (card.trapTrigger) tc.trapTrigger = trapTriggerToInt(card.trapTrigger as any);
  if (card.target)      tc.target      = card.target as string;
  return tc;
}

export function cardDataToTcgDef(card: CardData, numId: number): TcgCardDefinition {
  return {
    id:          numId,
    name:        card.name,
    description: card.description ?? '',
  };
}
