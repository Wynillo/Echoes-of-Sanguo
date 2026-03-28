// ============================================================
// ECHOES OF SANGUO — TCG Format Public API (backwards-compat barrel)
// Re-exports from @wynillo/tcg-format package + engine-specific exports
// ============================================================

// ── Package re-exports ──────────────────────────────────────
export type {
  TcgCard, TcgCardDefinition, TcgParsedCard, TcgManifest, TcgMeta,
  TcgOpponentDeck, TcgOpponentDescription, TcgFusionFormula, TcgLoadResult,
  TcgCampaignJson, TcgShopJson, ValidationResult,
  TcgRaceEntry, TcgRacesJson, TcgAttributeEntry, TcgAttributesJson,
  TcgCardTypeEntry, TcgCardTypesJson, TcgRarityEntry, TcgRaritiesJson,
  TcgLocaleOverrides, TcgArchiveContents,
} from '@wynillo/tcg-format';
export {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPES,
  TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND, TCG_ATTRIBUTES,
  TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_BEAST, TCG_RACE_PLANT,
  TCG_RACE_ROCK, TCG_RACE_PHOENIX, TCG_RACE_UNDEAD, TCG_RACE_AQUA, TCG_RACE_INSECT,
  TCG_RACE_MACHINE, TCG_RACE_PYRO, TCG_RACES,
  TCG_RARITY_COMMON, TCG_RARITY_UNCOMMON, TCG_RARITY_RARE, TCG_RARITY_SUPER_RARE, TCG_RARITY_ULTRA_RARE, TCG_RARITIES,
  validateTcgCards, validateTcgDefinitions,
  validateTcgArchive, validateFusionFormulasJson, validateOpponentDeck,
  loadTcgFile, TcgNetworkError, TcgFormatError,
} from '@wynillo/tcg-format';

// ── Engine-specific exports (not in package) ────────────────
export {
  cardTypeToInt, intToCardType,
  attributeToInt, intToAttribute,
  raceToInt, intToRace,
  rarityToInt, intToRarity,
  isValidTrigger, isValidSpellType,
  spellTypeToInt, intToSpellType,
  trapTriggerToInt, intToTrapTrigger,
} from '../enums.js';

export { serializeEffect, deserializeEffect, isValidEffectString } from '../effect-serializer.js';

export { cardDataToTcgCard, cardDataToTcgDef, buildManifest, buildRacesJson, buildAttributesJson, buildCardTypesJson, buildRaritiesJson } from '../tcg-builder.js';
