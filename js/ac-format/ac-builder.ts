// ============================================================
// AETHERIAL CLASH — AC Builder
// Converts CardData → AcCard / AcCardDefinition for export
// ============================================================
import type { CardData } from '../types.js';
import { CardType } from '../types.js';
import type { AcCard, AcCardDefinition } from './types.js';
import { cardTypeToInt, attributeToInt, raceToInt, rarityToInt, spellTypeToInt, trapTriggerToInt } from './enums.js';
import { serializeEffect } from './effect-serializer.js';

export function cardDataToAcCard(card: CardData, numId: number): AcCard {
  const isMonster = card.type === CardType.Monster || card.type === CardType.Fusion;
  const ac: AcCard = {
    id:     numId,
    level:  card.level ?? 1,
    rarity: card.rarity ? rarityToInt(card.rarity) : 1,
    type:   cardTypeToInt(card.type),
  };
  if (isMonster) {
    if (card.atk !== undefined) ac.atk = card.atk;
    if (card.def !== undefined) ac.def = card.def;
    if (card.attribute)         ac.attribute = attributeToInt(card.attribute);
    if (card.race)              ac.race = raceToInt(card.race);
  }
  if (card.effect) ac.effect = serializeEffect(card.effect);
  if (card.spellType)   ac.spellType   = spellTypeToInt(card.spellType as any);
  if (card.trapTrigger) ac.trapTrigger = trapTriggerToInt(card.trapTrigger as any);
  if (card.target)      ac.target      = card.target as string;
  return ac;
}

export function cardDataToAcDef(card: CardData, numId: number): AcCardDefinition {
  return {
    id:          numId,
    name:        card.name,
    description: card.description ?? '',
  };
}
