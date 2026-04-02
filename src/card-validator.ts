// ============================================================
// ECHOES OF SANGUO — Card JSON Validator
// Validates TcgCard[] from cards.json
// ============================================================

import type { ValidationResult } from './types.js';
import { TCG_TYPES, TCG_ATTRIBUTES, TCG_RARITIES, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_EQUIPMENT, TCG_SPELL_TYPES, TCG_TRAP_TRIGGERS } from './types.js';
const VALID_TYPES       = new Set(TCG_TYPES);
const VALID_ATTRIBUTES  = new Set(TCG_ATTRIBUTES);
const VALID_RARITIES    = new Set(TCG_RARITIES);
const VALID_SPELL_TYPES = new Set(TCG_SPELL_TYPES);
const VALID_TRAP_TRIGGERS = new Set(TCG_TRAP_TRIGGERS);

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

  // type: required int in {1,2,3,4,5}
  if (typeof c.type !== 'number' || !VALID_TYPES.has(c.type as typeof TCG_TYPES[number])) {
    errors.push(`${prefix}.type: must be one of [${[...VALID_TYPES].join(',')}], got ${c.type}`);
  }

  const isSpellOrTrap = c.type === TCG_TYPE_SPELL || c.type === TCG_TYPE_TRAP;
  const isMonsterOrFusion = c.type === TCG_TYPE_MONSTER || c.type === TCG_TYPE_FUSION;
  const isEquipment = c.type === TCG_TYPE_EQUIPMENT;

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

  // Equipment: atkBonus and/or defBonus (at least one should be present)
  if (isEquipment) {
    const hasAtkBonus = c.atkBonus !== undefined && c.atkBonus !== null;
    const hasDefBonus = c.defBonus !== undefined && c.defBonus !== null;
    if (!hasAtkBonus && !hasDefBonus) {
      errors.push(`${prefix}: equipment card must have atkBonus and/or defBonus`);
    }
    if (hasAtkBonus && (typeof c.atkBonus !== 'number' || !Number.isInteger(c.atkBonus))) {
      errors.push(`${prefix}.atkBonus: must be an integer, got ${c.atkBonus}`);
    }
    if (hasDefBonus && (typeof c.defBonus !== 'number' || !Number.isInteger(c.defBonus))) {
      errors.push(`${prefix}.defBonus: must be an integer, got ${c.defBonus}`);
    }
    if (c.equipReqRace !== undefined && c.equipReqRace !== null) {
      if (typeof c.equipReqRace !== 'number' || !Number.isInteger(c.equipReqRace) || c.equipReqRace < 1) {
        errors.push(`${prefix}.equipReqRace: must be a positive integer, got ${c.equipReqRace}`);
      }
    }
    if (c.equipReqAttr !== undefined && c.equipReqAttr !== null) {
      if (typeof c.equipReqAttr !== 'number' || !VALID_ATTRIBUTES.has(c.equipReqAttr as typeof TCG_ATTRIBUTES[number])) {
        errors.push(`${prefix}.equipReqAttr: must be a valid attribute, got ${c.equipReqAttr}`);
      }
    }
  }

  // equipReqRace / equipReqAttr only allowed on equipment cards
  if (!isEquipment) {
    if (c.equipReqRace !== undefined && c.equipReqRace !== null) {
      errors.push(`${prefix}.equipReqRace: only allowed on equipment cards`);
    }
    if (c.equipReqAttr !== undefined && c.equipReqAttr !== null) {
      errors.push(`${prefix}.equipReqAttr: only allowed on equipment cards`);
    }
  }

  // rarity: required int in valid set
  if (typeof c.rarity !== 'number' || !VALID_RARITIES.has(c.rarity as typeof TCG_RARITIES[number])) {
    errors.push(`${prefix}.rarity: must be one of [${[...VALID_RARITIES].join(',')}], got ${c.rarity}`);
  }

  // attribute: optional int 1-6
  if (c.attribute !== undefined && c.attribute !== null) {
    if (typeof c.attribute !== 'number' || !VALID_ATTRIBUTES.has(c.attribute as typeof TCG_ATTRIBUTES[number])) {
      errors.push(`${prefix}.attribute: must be one of [${[...VALID_ATTRIBUTES].join(',')}], got ${c.attribute}`);
    }
  }

  // race: optional positive int (extensible — mods can define races beyond the base 12)
  if (c.race !== undefined && c.race !== null) {
    if (typeof c.race !== 'number' || !Number.isInteger(c.race) || c.race < 1) {
      errors.push(`${prefix}.race: must be a positive integer, got ${c.race}`);
    }
  }

  // effect: optional string (treated as opaque — semantic validation is done by the engine bridge)
  if (c.effect !== undefined && c.effect !== null) {
    if (typeof c.effect !== 'string') {
      errors.push(`${prefix}.effect: must be a string, got ${typeof c.effect}`);
    }
  }

  // spellType: optional int 1-4
  if (c.spellType !== undefined && c.spellType !== null) {
    if (typeof c.spellType !== 'number' || !Number.isInteger(c.spellType) || !VALID_SPELL_TYPES.has(c.spellType as typeof TCG_SPELL_TYPES[number])) {
      errors.push(`${prefix}.spellType: must be one of [1,2,3,4], got ${c.spellType}`);
    }
  }

  // trapTrigger: optional int 1-7
  if (c.trapTrigger !== undefined && c.trapTrigger !== null) {
    if (typeof c.trapTrigger !== 'number' || !Number.isInteger(c.trapTrigger) || !VALID_TRAP_TRIGGERS.has(c.trapTrigger as typeof TCG_TRAP_TRIGGERS[number])) {
      errors.push(`${prefix}.trapTrigger: must be one of [1,2,3,4,5,6,7], got ${c.trapTrigger}`);
    }
  }

  // name: optional plaintext name
  if (c.name !== undefined && c.name !== null) {
    if (typeof c.name !== 'string') {
      errors.push(`${prefix}.name: must be a string, got ${typeof c.name}`);
    }
  }

  // description: optional plaintext description
  if (c.description !== undefined && c.description !== null) {
    if (typeof c.description !== 'string') {
      errors.push(`${prefix}.description: must be a string, got ${typeof c.description}`);
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
