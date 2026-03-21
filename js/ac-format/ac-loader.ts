// ============================================================
// AETHERIAL CLASH — AC File Loader
// Loads .ac (ZIP) files and populates the card database
// ============================================================

import JSZip from 'jszip';
import type { CardData, CardEffectBlock } from '../types.js';
import type { AcCard, AcCardDefinition, AcMeta, AcLoadResult } from './types.js';
import { validateAcArchive } from './ac-validator.js';
import { intToCardType, intToAttribute, intToRace, intToRarity } from './enums.js';
import { deserializeEffect } from './effect-serializer.js';
import { CARD_DB } from '../cards.js';

/**
 * Load an .ac file from a URL or ArrayBuffer.
 * Validates the archive, converts cards to internal format, and populates CARD_DB.
 */
export async function loadAcFile(source: string | ArrayBuffer): Promise<AcLoadResult> {
  // Fetch if URL
  let buffer: ArrayBuffer;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Failed to fetch ${source}: ${response.status}`);
    buffer = await response.arrayBuffer();
  } else {
    buffer = source;
  }

  // Open ZIP
  const zip = await JSZip.loadAsync(buffer);

  // Validate
  const result = await validateAcArchive(zip);
  if (!result.valid || !result.contents) {
    throw new Error(`Invalid .ac file:\n${result.errors.join('\n')}`);
  }

  const { cards, definitions, imageIds } = result.contents;

  // Extract images as blob URLs
  const images = new Map<number, string>();
  for (const cardId of imageIds) {
    const imgFile = zip.file(`img/${cardId}.png`);
    if (imgFile) {
      const blob = await imgFile.async('blob');
      const url = URL.createObjectURL(blob);
      images.set(cardId, url);
    }
  }

  // Load meta.json if present
  let meta: AcMeta | undefined;
  const metaFile = zip.file('meta.json');
  if (metaFile) {
    try {
      const metaJson = await metaFile.async('string');
      meta = JSON.parse(metaJson);
    } catch {
      result.warnings.push('meta.json: failed to parse, skipping');
    }
  }

  // Convert AcCards to CardData and populate CARD_DB
  // Pick the best description file (prefer browser language, fallback to first)
  const lang = typeof navigator !== 'undefined'
    ? navigator.language.substring(0, 2)
    : '';
  const defs = definitions.get(lang) ?? definitions.values().next().value!;
  const defMap = new Map<number, AcCardDefinition>();
  for (const d of defs) defMap.set(d.id, d);

  for (const ac of cards) {
    const def = defMap.get(ac.id);
    const cardData = acCardToCardData(ac, def);
    CARD_DB[cardData.id] = cardData;
  }

  return {
    cards,
    definitions,
    images,
    meta,
    warnings: result.warnings,
  };
}

/**
 * Convert an AcCard + AcCardDefinition to the internal CardData format.
 */
function acCardToCardData(ac: AcCard, def?: AcCardDefinition): CardData {
  let effect: CardEffectBlock | undefined;
  if (ac.effect) {
    effect = deserializeEffect(ac.effect);
  }

  const hasEffect = !!ac.effect;
  const type = intToCardType(ac.type, hasEffect);

  const card: CardData = {
    id:          String(ac.id),
    name:        def?.name ?? `Card #${ac.id}`,
    type,
    description: def?.description ?? '',
    level:       ac.level,
    rarity:      intToRarity(ac.rarity),
  };

  if (ac.atk !== undefined) card.atk = ac.atk;
  if (ac.def !== undefined) card.def = ac.def;
  if (ac.attribute !== undefined && ac.attribute > 0) card.attribute = intToAttribute(ac.attribute);
  if (ac.race !== undefined && ac.race > 0) card.race = intToRace(ac.race);
  if (effect) card.effect = effect;

  return card;
}

/**
 * Revoke all blob URLs from a previous load to free memory.
 */
export function revokeAcImages(images: Map<number, string>): void {
  for (const url of images.values()) {
    URL.revokeObjectURL(url);
  }
}
