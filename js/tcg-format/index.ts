// ============================================================
// ECHOES OF SANGUO — TCG Format Public API
// ============================================================

// Types
export type { TcgCard, TcgCardDefinition, TcgManifest, TcgMeta, TcgOpponentDeck, TcgLoadResult, ValidationResult } from './types.js';
export {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPES,
  TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND, TCG_ATTRIBUTES,
  TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_FIRE, TCG_RACE_PLANT,
  TCG_RACE_STONE, TCG_RACE_FLYER, TCG_RACE_ELF, TCG_RACE_DEMON, TCG_RACE_WATER, TCG_RACES,
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
} from './enums.js';

// Effect serializer
export { serializeEffect, deserializeEffect, isValidEffectString } from './effect-serializer.js';

// Validators
export { validateTcgCards } from './card-validator.js';
export { validateTcgDefinitions } from './def-validator.js';
export { validateTcgArchive } from './tcg-validator.js';
export type { TcgArchiveContents } from './tcg-validator.js';

// Builder
export { cardDataToTcgCard, cardDataToTcgDef, buildManifest } from './tcg-builder.js';

// Loader
export { loadTcgFile, revokeTcgImages } from './tcg-loader.js';
