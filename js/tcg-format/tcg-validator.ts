// ============================================================
// ECHOES OF SANGUO — TCG Archive Validator
// Validates the structure and content of a .tcg (ZIP) file
// ============================================================

import type JSZip from 'jszip';
import type { TcgCard, TcgCardDefinition, ValidationResult } from './types.js';
import { validateTcgCards } from './card-validator.js';
import { validateTcgDefinitions } from './def-validator.js';

/** Regex matching valid description file names: cards_description.json or xx_cards_description.json */
const DESC_FILE_REGEX = /^([a-z]{2}_)?cards_description\.json$/;

export interface TcgArchiveContents {
  cards: TcgCard[];
  definitions: Map<string, TcgCardDefinition[]>;   // lang (or '') -> definitions
  imageIds: Set<number>;                            // card ids that have images
  missingImageIds: number[];                        // card ids without images
}

/**
 * Validate a TCG archive (JSZip instance) and extract its contents.
 * Returns both validation results and parsed contents.
 */
export async function validateTcgArchive(zip: JSZip): Promise<ValidationResult & { contents?: TcgArchiveContents }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check cards.json exists
  const cardsFile = zip.file('cards.json');
  if (!cardsFile) {
    errors.push('Missing required file: cards.json');
    return { valid: false, errors, warnings };
  }

  // Parse and validate cards.json
  let cards: TcgCard[] = [];
  try {
    const cardsJson = await cardsFile.async('string');
    const cardsData = JSON.parse(cardsJson);
    const cardsResult = validateTcgCards(cardsData);
    if (!cardsResult.valid) {
      errors.push(...cardsResult.errors.map(e => `cards.json: ${e}`));
    }
    warnings.push(...cardsResult.warnings);
    if (cardsResult.valid) cards = cardsData as TcgCard[];
  } catch (e) {
    errors.push(`cards.json: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
  }

  // 2. Check for description files (at least one required)
  const allFiles = Object.keys(zip.files);
  const descFiles = allFiles.filter(f => DESC_FILE_REGEX.test(f));

  if (descFiles.length === 0) {
    errors.push('Missing required file: cards_description.json (or xx_cards_description.json)');
  }

  // Parse and validate each description file
  const definitions = new Map<string, TcgCardDefinition[]>();
  for (const descFile of descFiles) {
    const match = descFile.match(DESC_FILE_REGEX);
    const lang = match?.[1]?.replace('_', '') ?? '';

    try {
      const descJson = await zip.file(descFile)!.async('string');
      const descData = JSON.parse(descJson);
      const descResult = validateTcgDefinitions(descData);
      if (!descResult.valid) {
        errors.push(...descResult.errors.map(e => `${descFile}: ${e}`));
      }
      warnings.push(...descResult.warnings);
      if (descResult.valid) definitions.set(lang, descData as TcgCardDefinition[]);
    } catch (e) {
      errors.push(`${descFile}: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3. Validate types.json if present (optional file)
  const typesFile = zip.file('types.json');
  if (typesFile) {
    try {
      const typesJson = await typesFile.async('string');
      const typesData = JSON.parse(typesJson);
      const typesErrors = validateTypesJson(typesData);
      if (typesErrors.length > 0) {
        warnings.push(...typesErrors.map(e => `types.json: ${e}`));
      }
    } catch (e) {
      warnings.push(`types.json: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 4. Check img/ folder exists
  const hasImgFolder = allFiles.some(f => f.startsWith('img/'));
  if (!hasImgFolder) {
    errors.push('Missing required folder: img/');
  }

  // 5. Cross-validate: every card id must have a definition in at least one description file
  if (cards.length > 0 && definitions.size > 0) {
    const allDefinedIds = new Set<number>();
    for (const defs of definitions.values()) {
      for (const d of defs) allDefinedIds.add(d.id);
    }

    for (const card of cards) {
      if (!allDefinedIds.has(card.id)) {
        errors.push(`Card id ${card.id} has no matching entry in any cards_description file`);
      }
    }

    // Also check for orphan definitions
    const cardIds = new Set(cards.map(c => c.id));
    for (const [lang, defs] of definitions) {
      const file = lang ? `${lang}_cards_description.json` : 'cards_description.json';
      for (const d of defs) {
        if (!cardIds.has(d.id)) {
          warnings.push(`${file}: definition for id ${d.id} has no matching card in cards.json`);
        }
      }
    }
  }

  // 6. Check images: img/{id}.png for each card
  const imageIds = new Set<number>();
  const missingImageIds: number[] = [];

  if (hasImgFolder && cards.length > 0) {
    for (const card of cards) {
      const imgPath = `img/${card.id}.png`;
      if (zip.file(imgPath)) {
        imageIds.add(card.id);
      } else {
        missingImageIds.push(card.id);
        warnings.push(`Missing image for card id ${card.id}: ${imgPath} (placeholder will be used)`);
      }
    }
  }

  const valid = errors.length === 0;
  const contents: TcgArchiveContents | undefined = valid
    ? { cards, definitions, imageIds, missingImageIds }
    : undefined;

  return { valid, errors, warnings, contents };
}

/**
 * Validate a types.json object. Returns an array of warning strings
 * (types.json is optional, so issues are warnings not errors).
 */
function validateTypesJson(data: unknown): string[] {
  const warnings: string[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    warnings.push('must be a JSON object');
    return warnings;
  }

  const obj = data as Record<string, unknown>;
  const REQUIRED_KEYS: Record<string, string[]> = {
    races:      ['id', 'key', 'color', 'icon', 'symbol', 'abbr'],
    attributes: ['id', 'key', 'color', 'symbol', 'name'],
    rarities:   ['id', 'key', 'color', 'name'],
    cardTypes:  ['id', 'key', 'label', 'css'],
  };

  for (const [section, requiredFields] of Object.entries(REQUIRED_KEYS)) {
    if (!(section in obj)) continue;
    const arr = obj[section];
    if (!Array.isArray(arr)) {
      warnings.push(`${section} must be an array`);
      continue;
    }
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (typeof item !== 'object' || item === null) {
        warnings.push(`${section}[${i}] must be an object`);
        continue;
      }
      for (const field of requiredFields) {
        if (!(field in item)) {
          warnings.push(`${section}[${i}] missing required field '${field}'`);
        }
      }
      if (typeof item.id !== 'number') {
        warnings.push(`${section}[${i}].id must be a number`);
      }
    }
  }

  return warnings;
}
