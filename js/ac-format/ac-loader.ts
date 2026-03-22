// ============================================================
// AETHERIAL CLASH — AC File Loader
// Loads .ac (ZIP) files and populates the card database
// ============================================================

import JSZip from 'jszip';
import type { CardData, CardEffectBlock, FusionRecipe, OpponentConfig } from '../types.js';
import { Race } from '../types.js';
import type { AcCard, AcCardDefinition, AcMeta, AcLoadResult } from './types.js';
import { validateAcArchive } from './ac-validator.js';
import { intToCardType, intToAttribute, intToRace, intToRarity, intToSpellType, intToTrapTrigger } from './enums.js';
import { deserializeEffect } from './effect-serializer.js';
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../cards.js';

/**
 * Load an .ac file from a URL or ArrayBuffer.
 * Validates the archive, converts cards to internal format, and populates
 * CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, and STARTER_DECKS.
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

  // Load id_migration.json for reverse mapping (numeric → original string ID)
  let reverseIdMap: Record<number, string> = {};
  const migrationFile = zip.file('id_migration.json');
  if (migrationFile) {
    try {
      const migrationJson = await migrationFile.async('string');
      const idMapping: Record<string, number> = JSON.parse(migrationJson);
      for (const [oldId, numId] of Object.entries(idMapping)) {
        reverseIdMap[numId] = oldId;
      }
    } catch {
      result.warnings.push('id_migration.json: failed to parse, using numeric IDs');
    }
  }

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
    const originalId = reverseIdMap[ac.id];
    const cardData = acCardToCardData(ac, def, originalId);
    CARD_DB[cardData.id] = cardData;
  }

  // Apply meta to game data stores
  if (meta) {
    applyAcMeta(meta, reverseIdMap);
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
function acCardToCardData(ac: AcCard, def?: AcCardDefinition, originalId?: string): CardData {
  let effect: CardEffectBlock | undefined;
  if (ac.effect) {
    effect = deserializeEffect(ac.effect);
  }

  const hasEffect = !!ac.effect;
  const type = intToCardType(ac.type, hasEffect);

  const card: CardData = {
    id:          originalId ?? String(ac.id),
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
  if (ac.spellType)   card.spellType   = intToSpellType(ac.spellType);
  if (ac.trapTrigger) card.trapTrigger = intToTrapTrigger(ac.trapTrigger);
  if (ac.target)      card.target      = ac.target;

  return card;
}

/**
 * Apply AcMeta to the game's live data stores, converting numeric IDs
 * back to original string IDs using the reverse migration map.
 */
function applyAcMeta(meta: AcMeta, reverseIdMap: Record<number, string>): void {
  const rid = (numId: number): string => reverseIdMap[numId] ?? String(numId);

  if (meta.fusionRecipes) {
    const recipes: FusionRecipe[] = meta.fusionRecipes.map(r => ({
      materials: [rid(r.materials[0]), rid(r.materials[1])] as [string, string],
      result: rid(r.result),
    }));
    FUSION_RECIPES.push(...recipes);
  }

  if (meta.opponentConfigs) {
    const configs: OpponentConfig[] = meta.opponentConfigs.map(o => ({
      id:        o.id,
      name:      o.name,
      title:     o.title,
      race:      intToRace(o.race),
      flavor:    o.flavor,
      coinsWin:  o.coinsWin,
      coinsLoss: o.coinsLoss,
      deckIds:   o.deckIds.map(rid),
    }));
    OPPONENT_CONFIGS.push(...configs);
  }

  if (meta.starterDecks) {
    for (const [raceKey, numIds] of Object.entries(meta.starterDecks)) {
      const raceNum = Number(raceKey) as Race;
      STARTER_DECKS[raceNum] = numIds.map(rid);
    }
    // Populate fallback IDs from first available starter deck
    const firstDeck = Object.values(STARTER_DECKS)[0];
    if (firstDeck) {
      PLAYER_DECK_IDS.splice(0, PLAYER_DECK_IDS.length, ...firstDeck);
      OPPONENT_DECK_IDS.splice(0, OPPONENT_DECK_IDS.length, ...firstDeck);
    }
  }
}

/**
 * Revoke all blob URLs from a previous load to free memory.
 */
export function revokeAcImages(images: Map<number, string>): void {
  for (const url of images.values()) {
    URL.revokeObjectURL(url);
  }
}
