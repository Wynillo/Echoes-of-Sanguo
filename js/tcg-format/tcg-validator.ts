// ============================================================
// ECHOES OF SANGUO — TCG Archive Validator
// Validates the structure and content of a .tcg (ZIP) file
// ============================================================

import type JSZip from 'jszip';
import type { TcgCard, TcgCardDefinition, TcgOpponentDescription, TcgManifest, ValidationResult } from './types.js';
import { validateTcgCards } from './card-validator.js';
import { validateTcgDefinitions } from './def-validator.js';
import { validateTcgOpponentDescriptions } from './opp-desc-validator.js';

/** Regex matching valid description file names: cards_description.json, xx_cards_description.json, or locales/xx_cards_description.json */
const DESC_FILE_REGEX = /^(?:locales\/)?([a-z]{2}_)?cards_description\.json$/;

/** Regex matching opponent description files: opponents_description.json, xx_opponents_description.json, or locales/xx_opponents_description.json */
const OPP_DESC_FILE_REGEX = /^(?:locales\/)?([a-z]{2}_)?opponents_description\.json$/;

export interface TcgArchiveContents {
  cards: TcgCard[];
  definitions: Map<string, TcgCardDefinition[]>;   // lang (or '') -> definitions
  opponentDescriptions: Map<string, TcgOpponentDescription[]>;  // lang (or '') -> opponent descriptions
  imageIds: Set<number>;                            // card ids that have images
  missingImageIds: number[];                        // card ids without images
  manifest?: TcgManifest;                           // parsed manifest.json if present
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

  // 3. Parse opponent description files (optional)
  const oppDescFiles = allFiles.filter(f => OPP_DESC_FILE_REGEX.test(f));
  const opponentDescriptions = new Map<string, TcgOpponentDescription[]>();
  for (const oppDescFile of oppDescFiles) {
    const match = oppDescFile.match(OPP_DESC_FILE_REGEX);
    const lang = match?.[1]?.replace('_', '') ?? '';

    try {
      const descJson = await zip.file(oppDescFile)!.async('string');
      const descData = JSON.parse(descJson);
      const descResult = validateTcgOpponentDescriptions(descData);
      if (!descResult.valid) {
        errors.push(...descResult.errors.map(e => `${oppDescFile}: ${e}`));
      }
      warnings.push(...descResult.warnings);
      if (descResult.valid) opponentDescriptions.set(lang, descData as TcgOpponentDescription[]);
    } catch (e) {
      errors.push(`${oppDescFile}: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 3b. Validate split metadata files if present (optional files)
  for (const metaFile of ['races.json', 'attributes.json', 'card_types.json', 'rarities.json']) {
    const f = zip.file(metaFile);
    if (f) {
      try {
        const data = JSON.parse(await f.async('string'));
        if (!Array.isArray(data)) {
          warnings.push(`${metaFile}: must be an array`);
        } else {
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (typeof item !== 'object' || item === null) {
              warnings.push(`${metaFile}[${i}] must be an object`);
              continue;
            }
            for (const field of ['id', 'key', 'value', 'color']) {
              if (!(field in item)) warnings.push(`${metaFile}[${i}] missing required field '${field}'`);
            }
            if (typeof item.id !== 'number') warnings.push(`${metaFile}[${i}].id must be a number`);
          }
        }
      } catch (e) {
        warnings.push(`${metaFile}: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
      }
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

  // 6. Validate manifest.json (optional)
  let manifest: TcgManifest | undefined;
  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    try {
      const manifestJson = await manifestFile.async('string');
      const parsed = JSON.parse(manifestJson);
      if (typeof parsed.formatVersion !== 'number' || parsed.formatVersion <= 0) {
        errors.push('manifest.json: formatVersion must be a positive number');
      } else {
        manifest = parsed as TcgManifest;
      }
    } catch (e) {
      errors.push(`manifest.json: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
    }
  } else {
    warnings.push('manifest.json not found — consider adding one for format versioning');
  }

  const valid = errors.length === 0;
  const contents: TcgArchiveContents | undefined = valid
    ? { cards, definitions, opponentDescriptions, imageIds, missingImageIds, manifest }
    : undefined;

  return { valid, errors, warnings, contents };
}

/**
 * Validate a shop.json object. Returns an array of warning strings
 * (shop.json is optional, so issues are warnings not errors).
 * Pass knownNodeIds to enable cross-validation of unlock conditions.
 */
export function validateShopJson(data: unknown, knownNodeIds?: Set<string>): string[] {
  const warnings: string[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    warnings.push('shop.json: must be a JSON object');
    return warnings;
  }

  const obj = data as Record<string, unknown>;

  // Validate packs array (if present)
  if (obj.packs !== undefined && !Array.isArray(obj.packs)) {
    warnings.push('shop.json: packs must be an array');
  }

  // Validate packages array (if present)
  if (obj.packages !== undefined) {
    if (!Array.isArray(obj.packages)) {
      warnings.push('shop.json: packages must be an array');
    } else {
      const seenIds = new Set<string>();
      for (let i = 0; i < obj.packages.length; i++) {
        const pkg = obj.packages[i] as Record<string, unknown>;
        const prefix = `shop.json: packages[${i}]`;

        if (typeof pkg !== 'object' || pkg === null) {
          warnings.push(`${prefix}: must be an object`);
          continue;
        }

        // Required fields
        if (typeof pkg.id !== 'string' || !pkg.id) {
          warnings.push(`${prefix}: missing or invalid "id"`);
        } else {
          if (seenIds.has(pkg.id)) warnings.push(`${prefix}: duplicate package id "${pkg.id}"`);
          seenIds.add(pkg.id);
        }
        if (typeof pkg.name !== 'string') warnings.push(`${prefix}: missing or invalid "name"`);
        if (typeof pkg.price !== 'number' || pkg.price <= 0) warnings.push(`${prefix}: "price" must be a positive number`);
        if (!Array.isArray(pkg.slots) || !(pkg.slots as unknown[]).length) {
          warnings.push(`${prefix}: "slots" must be a non-empty array`);
        }

        // Validate cardPool (optional)
        if (pkg.cardPool !== undefined) {
          const cp = pkg.cardPool as Record<string, unknown>;
          for (const side of ['include', 'exclude'] as const) {
            if (cp[side] !== undefined) {
              if (typeof cp[side] !== 'object' || cp[side] === null || Array.isArray(cp[side])) {
                warnings.push(`${prefix}.cardPool.${side}: must be an object`);
              } else {
                const f = cp[side] as Record<string, unknown>;
                for (const arrField of ['races', 'attributes', 'types', 'spellTypes', 'ids']) {
                  if (f[arrField] !== undefined && !Array.isArray(f[arrField])) {
                    warnings.push(`${prefix}.cardPool.${side}.${arrField}: must be an array`);
                  }
                }
                for (const numField of ['maxRarity', 'minRarity', 'maxAtk', 'maxLevel']) {
                  if (f[numField] !== undefined && typeof f[numField] !== 'number') {
                    warnings.push(`${prefix}.cardPool.${side}.${numField}: must be a number`);
                  }
                }
              }
            }
          }
        }

        // Validate unlockCondition (optional)
        if (pkg.unlockCondition !== undefined && pkg.unlockCondition !== null) {
          const cond = pkg.unlockCondition as Record<string, unknown>;
          if (cond.type === 'nodeComplete') {
            if (typeof cond.nodeId !== 'string') {
              warnings.push(`${prefix}.unlockCondition: nodeComplete requires a string "nodeId"`);
            } else if (knownNodeIds && !knownNodeIds.has(cond.nodeId)) {
              warnings.push(`${prefix}.unlockCondition: nodeId "${cond.nodeId}" not found in campaign.json`);
            }
          } else if (cond.type === 'winsCount') {
            if (typeof cond.count !== 'number' || cond.count <= 0) {
              warnings.push(`${prefix}.unlockCondition: winsCount requires a positive "count"`);
            }
          } else {
            warnings.push(`${prefix}.unlockCondition: unknown type "${cond.type}" (expected: nodeComplete, winsCount)`);
          }
        }
      }
    }
  }

  return warnings;
}

/**
 * Validate a campaign.json object. Returns an array of warning strings
 * (campaign.json is optional, so issues are warnings not errors).
 */
export function validateCampaignJson(data: unknown): string[] {
  const warnings: string[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    warnings.push('campaign.json: must be a JSON object');
    return warnings;
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.chapters)) {
    warnings.push('campaign.json: chapters must be an array');
    return warnings;
  }

  const VALID_NODE_TYPES = ['duel', 'story', 'reward', 'shop', 'branch'];
  const VALID_CONDITION_TYPES = ['nodeComplete', 'allComplete', 'anyComplete', 'cardOwned', 'winsCount'];
  const allNodeIds = new Set<string>();
  const referencedNodeIds = new Set<string>();

  // First pass: collect all node IDs and check for duplicates
  for (const chapter of obj.chapters as unknown[]) {
    if (typeof chapter !== 'object' || chapter === null) {
      warnings.push('campaign.json: each chapter must be an object');
      continue;
    }
    const ch = chapter as Record<string, unknown>;
    if (!Array.isArray(ch.nodes)) {
      warnings.push(`campaign.json: chapter "${ch.id ?? '?'}": nodes must be an array`);
      continue;
    }
    for (const node of ch.nodes as unknown[]) {
      if (typeof node !== 'object' || node === null) {
        warnings.push('campaign.json: each node must be an object');
        continue;
      }
      const n = node as Record<string, unknown>;

      // Required fields
      if (typeof n.id !== 'string') {
        warnings.push('campaign.json: node missing required field "id"');
        continue;
      }
      if (allNodeIds.has(n.id)) {
        warnings.push(`campaign.json: duplicate node ID "${n.id}"`);
      }
      allNodeIds.add(n.id);

      if (typeof n.type !== 'string' || !VALID_NODE_TYPES.includes(n.type)) {
        warnings.push(`campaign.json: node "${n.id}": invalid type "${n.type}" (expected: ${VALID_NODE_TYPES.join(', ')})`);
      }

      if (typeof n.position !== 'object' || n.position === null) {
        warnings.push(`campaign.json: node "${n.id}": missing required field "position"`);
      } else {
        const pos = n.position as Record<string, unknown>;
        if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
          warnings.push(`campaign.json: node "${n.id}": position must have numeric x and y`);
        }
      }

      // Validate unlock conditions and collect referenced node IDs
      if (n.unlockCondition !== null && n.unlockCondition !== undefined) {
        const cond = n.unlockCondition as Record<string, unknown>;
        if (typeof cond.type !== 'string' || !VALID_CONDITION_TYPES.includes(cond.type)) {
          warnings.push(`campaign.json: node "${n.id}": invalid unlock condition type "${cond.type}"`);
        } else {
          switch (cond.type) {
            case 'nodeComplete':
              if (typeof cond.nodeId === 'string') referencedNodeIds.add(cond.nodeId);
              break;
            case 'allComplete':
            case 'anyComplete':
              if (Array.isArray(cond.nodeIds)) {
                for (const id of cond.nodeIds) {
                  if (typeof id === 'string') referencedNodeIds.add(id);
                }
              }
              break;
          }
        }
      }

      // Validate opponentId for duel nodes (warning only)
      if (n.type === 'duel' && n.opponentId !== undefined && typeof n.opponentId !== 'number') {
        warnings.push(`campaign.json: node "${n.id}": opponentId must be a number`);
      }
    }
  }

  // Second pass: check that referenced node IDs exist
  for (const refId of referencedNodeIds) {
    if (!allNodeIds.has(refId)) {
      warnings.push(`campaign.json: unlock condition references unknown node ID "${refId}"`);
    }
  }

  return warnings;
}
