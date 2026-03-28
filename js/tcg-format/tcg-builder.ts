// ============================================================
// ECHOES OF SANGUO — TCG Builder
// Converts CardData → TcgCard / TcgCardDefinition for export
// ============================================================
import type { CardData } from '../types.js';
import { CardType } from '../types.js';
import type { TcgCard, TcgCardDefinition, TcgManifest, TcgRacesJson, TcgAttributesJson, TcgCardTypesJson, TcgRaritiesJson } from './types.js';
import { cardTypeToInt, attributeToInt, raceToInt, rarityToInt, spellTypeToInt, trapTriggerToInt } from './enums.js';
import { serializeEffect } from './effect-serializer.js';
import { TYPE_META } from '../type-metadata.js';

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
  if (card.spellType)   tc.spellType   = spellTypeToInt(card.spellType);
  if (card.trapTrigger) tc.trapTrigger = trapTriggerToInt(card.trapTrigger);
  if (card.target)      tc.target      = card.target;
  if (card.atkBonus !== undefined) tc.atkBonus = card.atkBonus;
  if (card.defBonus !== undefined) tc.defBonus = card.defBonus;
  if (card.equipRequirement?.race) tc.equipReqRace = raceToInt(card.equipRequirement.race);
  if (card.equipRequirement?.attr) tc.equipReqAttr = attributeToInt(card.equipRequirement.attr);
  return tc;
}

export function cardDataToTcgDef(card: CardData, numId: number): TcgCardDefinition {
  return {
    id:          numId,
    name:        card.name,
    description: card.description ?? '',
  };
}

/**
 * Create a default TcgManifest with sensible defaults.
 */
export function buildManifest(overrides?: Partial<TcgManifest>): TcgManifest {
  return {
    formatVersion: 2,
    ...overrides,
  };
}

/** Build races.json from the current TYPE_META store. */
export function buildRacesJson(): TcgRacesJson {
  return TYPE_META.races.map(r => ({ id: r.id, key: r.key, value: r.value, color: r.color, ...(r.icon ? { icon: r.icon } : {}) }));
}

/** Build attributes.json from the current TYPE_META store. */
export function buildAttributesJson(): TcgAttributesJson {
  return TYPE_META.attributes.map(a => ({ id: a.id, key: a.key, value: a.value, color: a.color, ...(a.symbol ? { symbol: a.symbol } : {}) }));
}

/** Build card_types.json from the current TYPE_META store. */
export function buildCardTypesJson(): TcgCardTypesJson {
  return TYPE_META.cardTypes.map(c => ({ id: c.id, key: c.key, value: c.value, color: c.color }));
}

/** Build rarities.json from the current TYPE_META store. */
export function buildRaritiesJson(): TcgRaritiesJson {
  return TYPE_META.rarities.map(r => ({ id: r.id, key: r.key, value: r.value, color: r.color }));
}
