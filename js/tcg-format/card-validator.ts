// ============================================================
// ECHOES OF SANGUO — Card JSON Validator
// Validates TcgCard[] from cards.json
// ============================================================

import type { ValidationResult } from './types.js';
import { TCG_TYPES, TCG_ATTRIBUTES, TCG_RACES, TCG_RARITIES, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_MONSTER, TCG_TYPE_FUSION } from './types.js';
import { isValidEffectString } from './effect-serializer.js';

const VALID_TYPES      = new Set(TCG_TYPES);
const VALID_ATTRIBUTES = new Set(TCG_ATTRIBUTES);
const VALID_RACES      = new Set(TCG_RACES);
const VALID_RARITIES   = new Set(TCG_RARITIES);

function validateSingleCard(card: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `cards[${index}]`;

  if (typeof card !== 'object' || card === null) {
    errors.push(`${prefix}: must be an object`);
    return errors;
  }

  const c = card as Record<string, unknown>;

  // id: required int > 0
  if (typeof c.id !== 'number' || !Number.isInteger(c.id) || c.id <= 0) {
    errors.push(`${prefix}.id: must be a positive integer, got ${c.id}`);
  }

  // level: required int 1-12 for monsters/fusions, optional (ignored) for spells/traps
  const needsLevel = c.type === TCG_TYPE_MONSTER || c.type === TCG_TYPE_FUSION;
  if (needsLevel) {
    if (typeof c.level !== 'number' || !Number.isInteger(c.level) || c.level < 1 || c.level > 12) {
      errors.push(`${prefix}.level: must be integer 1-12, got ${c.level}`);
    }
  }

  // type: required int in {1,2,3,4}
  if (typeof c.type !== 'number' || !VALID_TYPES.has(c.type as any)) {
    errors.push(`${prefix}.type: must be one of [${[...VALID_TYPES].join(',')}], got ${c.type}`);
  }

  const isSpellOrTrap = c.type === TCG_TYPE_SPELL || c.type === TCG_TYPE_TRAP;
  const isMonsterOrFusion = c.type === TCG_TYPE_MONSTER || c.type === TCG_TYPE_FUSION;

  // atk: optional, required for monsters/fusions, absent for spells/traps
  if (isMonsterOrFusion) {
    if (c.atk !== undefined && (typeof c.atk !== 'number' || !Number.isInteger(c.atk) || c.atk < 0)) {
      errors.push(`${prefix}.atk: must be a non-negative integer for monsters, got ${c.atk}`);
    }
  }
  if (isSpellOrTrap && c.atk !== undefined && c.atk !== null) {
    errors.push(`${prefix}.atk: should be absent for spells/traps`);
  }

  // def: same rules as atk
  if (isMonsterOrFusion) {
    if (c.def !== undefined && (typeof c.def !== 'number' || !Number.isInteger(c.def) || c.def < 0)) {
      errors.push(`${prefix}.def: must be a non-negative integer for monsters, got ${c.def}`);
    }
  }
  if (isSpellOrTrap && c.def !== undefined && c.def !== null) {
    errors.push(`${prefix}.def: should be absent for spells/traps`);
  }

  // rarity: required int in valid set
  if (typeof c.rarity !== 'number' || !VALID_RARITIES.has(c.rarity as any)) {
    errors.push(`${prefix}.rarity: must be one of [${[...VALID_RARITIES].join(',')}], got ${c.rarity}`);
  }

  // attribute: optional int 1-6
  if (c.attribute !== undefined && c.attribute !== null) {
    if (typeof c.attribute !== 'number' || !VALID_ATTRIBUTES.has(c.attribute as any)) {
      errors.push(`${prefix}.attribute: must be one of [${[...VALID_ATTRIBUTES].join(',')}], got ${c.attribute}`);
    }
  }

  // race: optional int 1-10
  if (c.race !== undefined && c.race !== null) {
    if (typeof c.race !== 'number' || !VALID_RACES.has(c.race as any)) {
      errors.push(`${prefix}.race: must be one of [${[...VALID_RACES].join(',')}], got ${c.race}`);
    }
  }

  // effect: optional string with valid grammar
  if (c.effect !== undefined && c.effect !== null) {
    if (typeof c.effect !== 'string') {
      errors.push(`${prefix}.effect: must be a string, got ${typeof c.effect}`);
    } else if (c.effect.length > 0 && !isValidEffectString(c.effect)) {
      errors.push(`${prefix}.effect: invalid effect syntax: "${c.effect}"`);
    }
  }

  return errors;
}

/**
 * Validate an array of TcgCard objects from cards.json
 */
export function validateTcgCards(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['cards.json must contain a JSON array'], warnings };
  }

  if (data.length === 0) {
    return { valid: false, errors: ['cards.json must contain at least one card'], warnings };
  }

  // Validate each card
  const seenIds = new Set<number>();
  for (let i = 0; i < data.length; i++) {
    const cardErrors = validateSingleCard(data[i], i);
    errors.push(...cardErrors);

    // Check for duplicate IDs
    const card = data[i] as Record<string, unknown>;
    if (typeof card?.id === 'number' && Number.isInteger(card.id)) {
      if (seenIds.has(card.id)) {
        errors.push(`cards[${i}].id: duplicate id ${card.id}`);
      }
      seenIds.add(card.id);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
