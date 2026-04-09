// ============================================================
// ECHOES OF SANGUO — TCG Builder
// Converts CardData → TcgCard / TcgCardDefinition for export
// ============================================================
import type { CardData } from './types.js';
import { CardType } from './types.js';
import type { TcgCard, TcgCardDefinition, TcgManifest, TcgRacesJson, TcgAttributesJson, TcgCardTypesJson, TcgRaritiesJson } from '@wynillo/tcg-format';
import { cardTypeToInt, trapTriggerToInt } from './enums.js';
import { serializeEffect } from './effect-serializer.js';
import type { RaceMeta, AttributeMeta, CardTypeMeta, RarityMeta } from './type-metadata.js';

export function cardDataToTcgCard(card: CardData, numId: number): TcgCard {
  const isMonster = card.type === CardType.Monster || card.type === CardType.Fusion;
  const tc: TcgCard = {
    id:     numId,
    level:  card.level ?? 1,
    rarity: card.rarity ? card.rarity : 1,
    type:   cardTypeToInt(card.type),
  };
  if (isMonster) {
    if (card.atk !== undefined) tc.atk = card.atk;
    if (card.def !== undefined) tc.def = card.def;
    if (card.attribute !== undefined) tc.attribute = card.attribute;
    if (card.race !== undefined) tc.race = card.race;
  }
  if (card.effect) tc.effect = serializeEffect(card.effect);
  if (card.trapTrigger) tc.trapTrigger = trapTriggerToInt(card.trapTrigger);
  if (card.target)      tc.target      = card.target;
  if (card.atkBonus !== undefined) tc.atkBonus = card.atkBonus;
  if (card.defBonus !== undefined) tc.defBonus = card.defBonus;
  if (card.equipRequirement?.race) tc.equipReqRace = card.equipRequirement.race;
  if (card.equipRequirement?.attr) tc.equipReqAttr = card.equipRequirement.attr;
  return tc;
}

export function cardDataToTcgDef(card: CardData, numId: number): TcgCardDefinition {
  return {
    id:          numId,
    name:        card.name,
    description: card.description ?? '',
  };
}

/** Build races.json from race metadata entries. */
export function buildRacesJson(races: RaceMeta[]): TcgRacesJson {
  return races.map(r => ({ id: r.id, key: r.key, value: r.value, color: r.color, ...(r.icon ? { icon: r.icon } : {}) }));
}

/** Build attributes.json from attribute metadata entries. */
export function buildAttributesJson(attributes: AttributeMeta[]): TcgAttributesJson {
  return attributes.map(a => ({ id: a.id, key: a.key, value: a.value, color: a.color, ...(a.symbol ? { symbol: a.symbol } : {}) }));
}

/** Build card_types.json from card type metadata entries. */
export function buildCardTypesJson(cardTypes: CardTypeMeta[]): TcgCardTypesJson {
  return cardTypes.map(c => ({ id: c.id, key: c.key, value: c.value, color: c.color }));
}

/** Build rarities.json from rarity metadata entries. */
export function buildRaritiesJson(rarities: RarityMeta[]): TcgRaritiesJson {
  return rarities.map(r => ({ id: r.id, key: r.key, value: r.value, color: r.color }));
}
