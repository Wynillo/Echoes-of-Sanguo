import type { ValidationResult } from './types.js';

function validateSingleOppDesc(desc: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `opponents_description[${index}]`;

  if (typeof desc !== 'object' || desc === null) {
    errors.push(`${prefix}: must be an object`);
    return errors;
  }

  const d = desc as Record<string, unknown>;

  // id: required int > 0
  if (typeof d.id !== 'number' || !Number.isInteger(d.id) || d.id <= 0) {
    errors.push(`${prefix}.id: must be a positive integer, got ${d.id}`);
  }

  // name: required non-empty string
  if (typeof d.name !== 'string' || d.name.trim().length === 0) {
    errors.push(`${prefix}.name: must be a non-empty string`);
  }

  // title: required string (can be empty)
  if (typeof d.title !== 'string') {
    errors.push(`${prefix}.title: must be a string`);
  }

  // flavor: required string (can be empty)
  if (typeof d.flavor !== 'string') {
    errors.push(`${prefix}.flavor: must be a string`);
  }

  return errors;
}

/**
 * Validate an array of TcgOpponentDescription objects from an opponents_description.json file
 */
export function validateTcgOpponentDescriptions(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['opponents_description.json must contain a JSON array'], warnings };
  }

  if (data.length === 0) {
    return { valid: false, errors: ['opponents_description.json must contain at least one description'], warnings };
  }

  const seenIds = new Set<number>();
  for (let i = 0; i < data.length; i++) {
    const descErrors = validateSingleOppDesc(data[i], i);
    errors.push(...descErrors);

    // Check for duplicate IDs
    const desc = data[i] as Record<string, unknown>;
    if (typeof desc?.id === 'number' && Number.isInteger(desc.id)) {
      if (seenIds.has(desc.id)) {
        errors.push(`opponents_description[${i}].id: duplicate id ${desc.id}`);
      }
      seenIds.add(desc.id);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
