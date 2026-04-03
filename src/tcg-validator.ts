// ============================================================
// ECHOES OF SANGUO — TCG Archive Validator
// Validates the structure and content of a .tcg (ZIP) file
// ============================================================

import type JSZip from 'jszip';
import type { TcgCard, TcgOpponentDescription, TcgManifest, ValidationResult } from './types.js';
import { validateTcgCards } from './card-validator.js';
import { validateTcgOpponentDescriptions } from './opp-desc-validator.js';

/** Regex matching locale files: locales/en.json, locales/de.json, etc. */
const LOCALE_FILE_REGEX = /^locales\/([a-z]{2})\.json$/;

/** Regex matching opponent description files: opponents_description.json, xx_opponents_description.json */
const OPP_DESC_FILE_REGEX = /^([a-z]{2}_)?opponents_description\.json$/;

export interface TcgArchiveContents {
  cards: TcgCard[];
  opponentDescriptions: Map<string, TcgOpponentDescription[]>;  // lang (or '') -> opponent descriptions
  imageIds: Set<number>;                            // card ids that have images
  missingImageIds: number[];                        // card ids without images
  manifest?: TcgManifest;                           // parsed manifest.json if present
  localeOverrides?: Map<string, Record<string, string>>;  // lang -> key->value for i18n mode
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

  // 2. Check for locale files (optional)
  const allFiles = Object.keys(zip.files);
  const localeFiles = allFiles.filter(f => LOCALE_FILE_REGEX.test(f));

  // Check what names/descriptions cards have
  const hasPlainName = cards.some(c => c.name !== undefined && c.name !== null && c.name !== '');
  const hasPlainDesc = cards.some(c => c.description !== undefined && c.description !== null && c.description !== '');
  const hasLocaleFiles = localeFiles.length > 0;

  // Validate locale files if present
  const localeOverrides = new Map<string, Record<string, string>>();
  if (hasLocaleFiles) {
    for (const localeFile of localeFiles) {
      const match = localeFile.match(LOCALE_FILE_REGEX);
      const lang = match?.[1] ?? '';
      try {
        const localeJson = await zip.file(localeFile)!.async('string');
        const localeData = JSON.parse(localeJson);
        if (typeof localeData === 'object' && localeData !== null && !Array.isArray(localeData)) {
          localeOverrides.set(lang, localeData as Record<string, string>);
        } else {
          warnings.push(`${localeFile}: must be a JSON object`);
        }
      } catch (e) {
        warnings.push(`${localeFile}: failed to parse JSON: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // If using plaintext names/descriptions without locale files, warn
  if ((hasPlainName || hasPlainDesc) && !hasLocaleFiles) {
    warnings.push('Using plaintext name/description — consider using locales/ for i18n support');
  }

  // If locale files exist, warn if there are also plaintext names/descriptions
  if (localeOverrides.size > 0 && (hasPlainName || hasPlainDesc)) {
    warnings.push('Archive has both plaintext name/description and locale files — locale files will be used');
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

  // 7. Validate manifest.json (optional)
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
    ? { cards, opponentDescriptions, imageIds, missingImageIds, manifest, localeOverrides }
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
  if (obj.packs !== undefined) {
    if (!Array.isArray(obj.packs)) {
      warnings.push('shop.json: packs must be an array');
    } else {
      const seenIds = new Set<string>();
      for (let i = 0; i < obj.packs.length; i++) {
        const pkg = obj.packs[i] as Record<string, unknown>;
        const prefix = `shop.json: packs[${i}]`;

        if (typeof pkg !== 'object' || pkg === null) {
          warnings.push(`${prefix}: must be an object`);
          continue;
        }

        // Required fields
        if (typeof pkg.id !== 'string' || !pkg.id) {
          warnings.push(`${prefix}: missing or invalid "id"`);
        } else {
          if (seenIds.has(pkg.id)) warnings.push(`${prefix}: duplicate pack id "${pkg.id}"`);
          seenIds.add(pkg.id);
        }
        const hasName = typeof pkg.name === 'string';
        if (!hasName) warnings.push(`${prefix}: missing "name"`);
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

      // Validate gauntlet field for duel nodes
      if (n.gauntlet !== undefined && n.gauntlet !== null) {
        if (!Array.isArray(n.gauntlet)) {
          warnings.push(`campaign.json: node "${n.id}": gauntlet must be an array of opponent IDs`);
        } else if ((n.gauntlet as unknown[]).length < 2) {
          warnings.push(`campaign.json: node "${n.id}": gauntlet must have at least 2 opponents`);
        } else if (!(n.gauntlet as unknown[]).every((id: unknown) => typeof id === 'number')) {
          warnings.push(`campaign.json: node "${n.id}": gauntlet entries must be numbers`);
        }
      }

      // Validate type-specific required fields (warnings only — campaign.json is optional)
      switch (n.type) {
        case 'duel':
          if (!('preDialogue' in n)) warnings.push(`campaign.json: node "${n.id}": duel node missing required field "preDialogue"`);
          if (!('postDialogue' in n)) warnings.push(`campaign.json: node "${n.id}": duel node missing required field "postDialogue"`);
          break;
        case 'story':
          if (typeof n.scene !== 'object' || n.scene === null) warnings.push(`campaign.json: node "${n.id}": story node missing required field "scene"`);
          break;
        case 'shop':
          if (typeof n.shopId !== 'string' || !n.shopId) warnings.push(`campaign.json: node "${n.id}": shop node missing required field "shopId"`);
          break;
        case 'branch':
          if (typeof n.promptKey !== 'string' || !n.promptKey) warnings.push(`campaign.json: node "${n.id}": branch node missing required field "promptKey"`);
          if (!Array.isArray(n.options) || (n.options as unknown[]).length === 0) warnings.push(`campaign.json: node "${n.id}": branch node missing required field "options"`);
          break;
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

// ── Fusion Formulas Validator ──────────────────────────────────

const VALID_COMBO_TYPES = ['race+race', 'race+attr', 'attr+attr'];

/**
 * Validate a fusion_formulas.json object. Returns an array of warning strings.
 */
export function validateFusionFormulasJson(data: unknown): string[] {
  const warnings: string[] = [];
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    warnings.push('fusion_formulas.json: must be a JSON object with a "formulas" array');
    return warnings;
  }

  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.formulas)) {
    warnings.push('fusion_formulas.json: missing or invalid "formulas" array');
    return warnings;
  }

  const seenIds = new Set<string>();
  for (let i = 0; i < obj.formulas.length; i++) {
    const f = obj.formulas[i] as Record<string, unknown>;
    const prefix = `fusion_formulas.json: formulas[${i}]`;

    if (typeof f !== 'object' || f === null) {
      warnings.push(`${prefix}: must be an object`);
      continue;
    }

    if (typeof f.id !== 'string' || !f.id) {
      warnings.push(`${prefix}: missing or invalid "id" (must be a non-empty string)`);
    } else {
      if (seenIds.has(f.id)) warnings.push(`${prefix}: duplicate formula id "${f.id}"`);
      seenIds.add(f.id);
    }

    if (typeof f.comboType !== 'string' || !VALID_COMBO_TYPES.includes(f.comboType)) {
      warnings.push(`${prefix}: invalid "comboType" "${f.comboType}" (expected: ${VALID_COMBO_TYPES.join(', ')})`);
    }

    if (typeof f.operand1 !== 'number') warnings.push(`${prefix}: "operand1" must be a number`);
    if (typeof f.operand2 !== 'number') warnings.push(`${prefix}: "operand2" must be a number`);
    if (typeof f.priority !== 'number') warnings.push(`${prefix}: "priority" must be a number`);

    if (!Array.isArray(f.resultPool) || f.resultPool.length === 0) {
      warnings.push(`${prefix}: "resultPool" must be a non-empty array`);
    } else if (!f.resultPool.every((id: unknown) => typeof id === 'number' && id > 0)) {
      warnings.push(`${prefix}: "resultPool" entries must be positive numbers`);
    }
  }

  return warnings;
}

// ── Opponent Deck Validator ────────────────────────────────────

/**
 * Validate a single opponent deck object. Returns an array of warning strings.
 * Pass knownCardIds to cross-validate deck card references.
 */
export function validateOpponentDeck(data: unknown, index: number, knownCardIds?: Set<number>): string[] {
  const warnings: string[] = [];
  const prefix = `opponents[${index}]`;

  if (typeof data !== 'object' || data === null) {
    warnings.push(`${prefix}: must be an object`);
    return warnings;
  }

  const o = data as Record<string, unknown>;

  if (typeof o.id !== 'number' || o.id <= 0) {
    warnings.push(`${prefix}: "id" must be a positive number`);
  }
  if (typeof o.name !== 'string' || !o.name) {
    warnings.push(`${prefix}: "name" must be a non-empty string`);
  }
  if (typeof o.title !== 'string') {
    warnings.push(`${prefix}: "title" must be a string`);
  }
  if (typeof o.race !== 'number' || !Number.isInteger(o.race) || o.race < 1) {
    warnings.push(`${prefix}: "race" must be a positive integer`);
  }
  if (typeof o.coinsWin !== 'number' || o.coinsWin < 0) {
    warnings.push(`${prefix}: "coinsWin" must be a non-negative number`);
  }
  if (typeof o.coinsLoss !== 'number' || o.coinsLoss < 0) {
    warnings.push(`${prefix}: "coinsLoss" must be a non-negative number`);
  }

  if (!Array.isArray(o.deckIds) || o.deckIds.length === 0) {
    warnings.push(`${prefix}: "deckIds" must be a non-empty array`);
  } else {
    if (!(o.deckIds as unknown[]).every((id: unknown) => typeof id === 'number' && id > 0)) {
      warnings.push(`${prefix}: "deckIds" entries must be positive numbers`);
    }
    if (knownCardIds) {
      for (const id of o.deckIds as number[]) {
        if (typeof id === 'number' && !knownCardIds.has(id)) {
          warnings.push(`${prefix}: deckIds references unknown card ID ${id}`);
        }
      }
    }
  }

  return warnings;
}
