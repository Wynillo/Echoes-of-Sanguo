// Re-export effect serializers from TCG format library (single source of truth)
import {
  deserializeTcgEffects,
  serializeTcgEffects,
  parseTcgEffectString,
  isValidTcgEffectString,
  deserializeTcgEffect,
  serializeTcgEffect,
  isMultiBlockTcgEffect,
} from '@wynillo/tcg-format';

// Re-export for backward compatibility with existing ENGINE code
export {
  deserializeTcgEffects as deserializeEffects,
  serializeTcgEffects as serializeEffects,
  parseTcgEffectString as parseEffectString,
  isValidTcgEffectString as isValidEffectString,
  deserializeTcgEffect as deserializeEffect,
  serializeTcgEffect as serializeEffect,
  isMultiBlockTcgEffect as isMultiBlockEffect,
};
