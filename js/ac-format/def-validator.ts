// ============================================================
// ECHOES OF SANGUO — Card Definition Validator
// Validates AcCardDefinition[] from *cards_description.json
// ============================================================

import type { ValidationResult } from './types.js';

function validateSingleDefinition(def: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `definitions[${index}]`;

  if (typeof def !== 'object' || def === null) {
    errors.push(`${prefix}: must be an object`);
    return errors;
  }

  const d = def as Record<string, unknown>;

  // id: required int > 0
  if (typeof d.id !== 'number' || !Number.isInteger(d.id) || d.id <= 0) {
    errors.push(`${prefix}.id: must be a positive integer, got ${d.id}`);
  }

  // name: required non-empty string
  if (typeof d.name !== 'string' || d.name.trim().length === 0) {
    errors.push(`${prefix}.name: must be a non-empty string`);
  }

  // description: required non-empty string
  if (typeof d.description !== 'string' || d.description.trim().length === 0) {
    errors.push(`${prefix}.description: must be a non-empty string`);
  }

  return errors;
}

/**
 * Validate an array of AcCardDefinition objects from a cards_description.json file
 */
export function validateAcDefinitions(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['cards_description.json must contain a JSON array'], warnings };
  }

  if (data.length === 0) {
    return { valid: false, errors: ['cards_description.json must contain at least one definition'], warnings };
  }

  const seenIds = new Set<number>();
  for (let i = 0; i < data.length; i++) {
    const defErrors = validateSingleDefinition(data[i], i);
    errors.push(...defErrors);

    // Check for duplicate IDs
    const def = data[i] as Record<string, unknown>;
    if (typeof def?.id === 'number' && Number.isInteger(def.id)) {
      if (seenIds.has(def.id)) {
        errors.push(`definitions[${i}].id: duplicate id ${def.id}`);
      }
      seenIds.add(def.id);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
