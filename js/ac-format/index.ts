// ============================================================
// AETHERIAL CLASH — AC Format Public API
// ============================================================

// Types
export type { AcCard, AcCardDefinition, AcMeta, AcLoadResult, ValidationResult } from './types.js';
export {
  AC_TYPE_MONSTER, AC_TYPE_FUSION, AC_TYPE_SPELL, AC_TYPE_TRAP, AC_TYPES,
  AC_ATTR_LIGHT, AC_ATTR_DARK, AC_ATTR_FIRE, AC_ATTR_WATER, AC_ATTR_EARTH, AC_ATTR_WIND, AC_ATTRIBUTES,
  AC_RACE_DRAGON, AC_RACE_SPELLCASTER, AC_RACE_WARRIOR, AC_RACE_FIRE, AC_RACE_PLANT,
  AC_RACE_STONE, AC_RACE_FLYER, AC_RACE_ELF, AC_RACE_DEMON, AC_RACE_WATER, AC_RACES,
  AC_RARITY_COMMON, AC_RARITY_UNCOMMON, AC_RARITY_RARE, AC_RARITY_SUPER_RARE, AC_RARITY_ULTRA_RARE, AC_RARITIES,
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
export { validateAcCards } from './card-validator.js';
export { validateAcDefinitions } from './def-validator.js';
export { validateAcArchive } from './ac-validator.js';

// Loader
export { loadAcFile, revokeAcImages } from './ac-loader.js';

// Builder
export { cardDataToAcCard, cardDataToAcDef, buildAcArchive, buildAcBuffer } from './ac-builder.js';
