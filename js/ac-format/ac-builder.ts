// ============================================================
// AETHERIAL CLASH — AC File Builder
// Converts existing CARD_DB into .ac format and builds a ZIP
// ============================================================

import JSZip from 'jszip';
import { type CardData, Race } from '../types.js';
import type { AcCard, AcCardDefinition, AcMeta } from './types.js';
import { cardTypeToInt, attributeToInt, raceToInt, rarityToInt } from './enums.js';
import { serializeEffect } from './effect-serializer.js';

/**
 * Convert a CardData to AcCard format with a given numeric ID.
 */
export function cardDataToAcCard(card: CardData, numericId: number): AcCard {
  const ac: AcCard = {
    id:     numericId,
    level:  card.level ?? 1,
    rarity: card.rarity ? rarityToInt(card.rarity) : 1,
    type:   cardTypeToInt(card.type),
  };

  if (card.atk !== undefined) ac.atk = card.atk;
  if (card.def !== undefined) ac.def = card.def;
  if (card.attribute) ac.attribute = attributeToInt(card.attribute);
  if (card.race) ac.race = raceToInt(card.race);
  if (card.effect) ac.effect = serializeEffect(card.effect);

  return ac;
}

/**
 * Extract AcCardDefinition from a CardData.
 */
export function cardDataToAcDef(card: CardData, numericId: number): AcCardDefinition {
  return {
    id:          numericId,
    name:        card.name,
    description: card.description,
  };
}

export interface BuildAcOptions {
  /** Language code for the description file (default: 'de') */
  lang?: string;
  /** Include meta.json with fusion recipes, opponent configs, starter decks */
  includeMeta?: boolean;
}

export interface BuildAcResult {
  zip: JSZip;
  idMapping: Record<string, number>;  // old string ID -> new int ID
  cardCount: number;
}

/**
 * Build an .ac archive from a CARD_DB record.
 *
 * @param cardDb - Record of string-keyed CardData
 * @param options - Build options
 * @param meta - Optional metadata (fusion recipes, opponents, starter decks)
 */
export function buildAcArchive(
  cardDb: Record<string, CardData>,
  options: BuildAcOptions = {},
  meta?: {
    fusionRecipes?: Array<{ materials: [string, string]; result: string }>;
    opponentConfigs?: Array<{ id: number; name: string; title: string; race: Race; flavor: string; coinsWin: number; coinsLoss: number; deckIds: string[] }>;
    starterDecks?: Record<string, string[]>;
  },
): BuildAcResult {
  const lang = options.lang ?? 'de';
  const zip = new JSZip();

  // Assign sequential numeric IDs
  const allIds = Object.keys(cardDb);
  const idMapping: Record<string, number> = {};
  let nextId = 1;
  for (const oldId of allIds) {
    idMapping[oldId] = nextId++;
  }

  // Build cards.json
  const acCards: AcCard[] = [];
  for (const oldId of allIds) {
    const card = cardDb[oldId];
    acCards.push(cardDataToAcCard(card, idMapping[oldId]));
  }
  zip.file('cards.json', JSON.stringify(acCards, null, 2));

  // Build xx_cards_description.json
  const acDefs: AcCardDefinition[] = [];
  for (const oldId of allIds) {
    const card = cardDb[oldId];
    acDefs.push(cardDataToAcDef(card, idMapping[oldId]));
  }
  const descFileName = lang ? `${lang}_cards_description.json` : 'cards_description.json';
  zip.file(descFileName, JSON.stringify(acDefs, null, 2));

  // Create empty img/ folder
  zip.folder('img');

  // Build id_migration.json
  zip.file('id_migration.json', JSON.stringify(idMapping, null, 2));

  // Build meta.json if requested
  if (options.includeMeta && meta) {
    const acMeta: AcMeta = {};

    if (meta.fusionRecipes) {
      acMeta.fusionRecipes = meta.fusionRecipes.map(r => ({
        materials: [idMapping[r.materials[0]], idMapping[r.materials[1]]] as [number, number],
        result: idMapping[r.result],
      }));
    }

    if (meta.opponentConfigs) {
      acMeta.opponentConfigs = meta.opponentConfigs.map(o => ({
        id:        o.id,
        name:      o.name,
        title:     o.title,
        race:      raceToInt(o.race),
        flavor:    o.flavor,
        coinsWin:  o.coinsWin,
        coinsLoss: o.coinsLoss,
        deckIds:   o.deckIds.map(id => idMapping[id]),
      }));
    }

    if (meta.starterDecks) {
      acMeta.starterDecks = {};
      for (const [key, ids] of Object.entries(meta.starterDecks)) {
        acMeta.starterDecks[key] = ids.map(id => idMapping[id]);
      }
    }

    zip.file('meta.json', JSON.stringify(acMeta, null, 2));
  }

  return { zip, idMapping, cardCount: acCards.length };
}

/**
 * Generate the .ac file as an ArrayBuffer.
 */
export async function buildAcBuffer(
  cardDb: Record<string, CardData>,
  options: BuildAcOptions = {},
  meta?: Parameters<typeof buildAcArchive>[2],
): Promise<{ buffer: ArrayBuffer; idMapping: Record<string, number>; cardCount: number }> {
  const { zip, idMapping, cardCount } = buildAcArchive(cardDb, options, meta);
  const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return { buffer, idMapping, cardCount };
}
