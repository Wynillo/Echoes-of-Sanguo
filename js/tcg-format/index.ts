// ============================================================
// ECHOES OF SANGUO — TCG Format Public API
// ============================================================

// Types
export type { TcgCard, TcgCardDefinition, TcgParsedCard, TcgManifest, TcgMeta, TcgOpponentDeck, TcgOpponentDescription, TcgFusionFormula, TcgLoadResult, TcgCampaignJson, TcgShopJson, ValidationResult,
  TcgRaceEntry, TcgRacesJson, TcgAttributeEntry, TcgAttributesJson,
  TcgCardTypeEntry, TcgCardTypesJson, TcgRarityEntry, TcgRaritiesJson, TcgLocaleOverrides } from './types.js';
export {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPES,
  TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND, TCG_ATTRIBUTES,
  TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_BEAST, TCG_RACE_PLANT,
  TCG_RACE_ROCK, TCG_RACE_PHOENIX, TCG_RACE_UNDEAD, TCG_RACE_AQUA, TCG_RACE_INSECT,
  TCG_RACE_MACHINE, TCG_RACE_PYRO, TCG_RACES,
  TCG_RARITY_COMMON, TCG_RARITY_UNCOMMON, TCG_RARITY_RARE, TCG_RARITY_SUPER_RARE, TCG_RARITY_ULTRA_RARE, TCG_RARITIES,
} from './types.js';

// Enum converters
export {
  cardTypeToInt, intToCardType,
  attributeToInt, intToAttribute,
  raceToInt, intToRace,
  rarityToInt, intToRarity,
  isValidTrigger, isValidSpellType,
  spellTypeToInt, intToSpellType,
  trapTriggerToInt, intToTrapTrigger,
} from '../enums.js';

// Effect serializer
export { serializeEffect, deserializeEffect, isValidEffectString } from '../effect-serializer.js';

// Validators
export { validateTcgCards } from './card-validator.js';
export { validateTcgDefinitions } from './def-validator.js';
export { validateTcgArchive, validateFusionFormulasJson, validateOpponentDeck } from './tcg-validator.js';
export type { TcgArchiveContents } from './tcg-validator.js';

// Builder
export { cardDataToTcgCard, cardDataToTcgDef, buildManifest, buildRacesJson, buildAttributesJson, buildCardTypesJson, buildRaritiesJson } from '../tcg-builder.js';

// Loader
export { loadTcgFile, TcgNetworkError, TcgFormatError } from './tcg-loader.js';
