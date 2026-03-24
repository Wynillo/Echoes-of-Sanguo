// ============================================================
// ECHOES OF SANGUO — TCG File Loader
// Loads .tcg (ZIP) files and populates the card database
// ============================================================

import JSZip from 'jszip';
import type { CardData, CardEffectBlock, FusionRecipe, OpponentConfig } from '../types.js';
import { Race } from '../types.js';
import type { TcgCard, TcgCardDefinition, TcgMeta, TcgOpponentDeck, TcgOpponentDescription, TcgTypesJson, TcgLoadResult } from './types.js';
import { validateTcgArchive } from './tcg-validator.js';
import { intToCardType, intToAttribute, intToRace, intToRarity, intToSpellType, intToTrapTrigger } from './enums.js';
import { deserializeEffect } from './effect-serializer.js';
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../cards.js';
import { applyRules } from '../rules.js';
import type { GameRules } from '../rules.js';
import { applyTypeMeta } from '../type-metadata.js';

/**
 * Load a .tcg file from a URL or ArrayBuffer.
 * Validates the archive, converts cards to internal format, and populates
 * CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, and STARTER_DECKS.
 */
export async function loadTcgFile(source: string | ArrayBuffer): Promise<TcgLoadResult> {
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
  const result = await validateTcgArchive(zip);
  if (!result.valid || !result.contents) {
    throw new Error(`Invalid .tcg file:\n${result.errors.join('\n')}`);
  }

  const { cards, definitions, opponentDescriptions, imageIds, manifest } = result.contents;

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
  let meta: TcgMeta | undefined;
  const metaFile = zip.file('meta.json');
  if (metaFile) {
    try {
      const metaJson = await metaFile.async('string');
      meta = JSON.parse(metaJson);
    } catch {
      result.warnings.push('meta.json: failed to parse, skipping');
    }
  }

  // Load rules.json if present and apply overrides
  const rulesFile = zip.file('rules.json');
  if (rulesFile) {
    try {
      const rulesJson = await rulesFile.async('string');
      const partial: Partial<GameRules> = JSON.parse(rulesJson);
      applyRules(partial);
    } catch {
      result.warnings.push('rules.json: failed to parse, skipping');
    }
  }

  // Scan opponents/*.json — takes priority over meta.opponentConfigs
  const oppPaths = Object.keys(zip.files)
    .filter(f => /^opponents\/[^/]+\.json$/.test(f))
    .sort();
  let tcgOpponents: TcgOpponentDeck[] | undefined;
  if (oppPaths.length > 0) {
    tcgOpponents = [];
    for (const p of oppPaths) {
      try {
        tcgOpponents.push(JSON.parse(await zip.file(p)!.async('string')));
      } catch {
        result.warnings.push(`${p}: failed to parse, skipping`);
      }
    }
    tcgOpponents.sort((a, b) => a.id - b.id);
  }

  // Convert TcgCards to CardData and populate CARD_DB
  // Pick the best description file (prefer browser language, fallback to first)
  const lang = typeof navigator !== 'undefined'
    ? navigator.language.substring(0, 2)
    : '';
  const defs = definitions.get(lang) ?? definitions.values().next().value!;
  const defMap = new Map<number, TcgCardDefinition>();
  for (const d of defs) defMap.set(d.id, d);

  for (const tc of cards) {
    const def = defMap.get(tc.id);
    const originalId = reverseIdMap[tc.id];
    const cardData = tcgCardToCardData(tc, def, originalId);
    CARD_DB[cardData.id] = cardData;
  }

  // Load types.json if present (enum visual metadata)
  const typesFile = zip.file('types.json');
  if (typesFile) {
    try {
      const typesJson = await typesFile.async('string');
      const typesData: TcgTypesJson = JSON.parse(typesJson);
      applyTypeMeta(typesData);
    } catch {
      result.warnings.push('types.json: failed to parse, using defaults');
    }
  }

  // Pick the best opponent description file (same logic as card descriptions)
  const oppDescs = opponentDescriptions.get(lang) ?? (opponentDescriptions.size > 0 ? opponentDescriptions.values().next().value! : undefined);

  // Apply meta to game data stores
  if (meta) {
    applyTcgMeta(meta, reverseIdMap, tcgOpponents, oppDescs);
  }

  return {
    cards,
    definitions,
    images,
    meta,
    manifest,
    warnings: result.warnings,
  };
}

/**
 * Convert a TcgCard + TcgCardDefinition to the internal CardData format.
 */
function tcgCardToCardData(tc: TcgCard, def?: TcgCardDefinition, originalId?: string): CardData {
  let effect: CardEffectBlock | undefined;
  if (tc.effect) {
    effect = deserializeEffect(tc.effect);
  }

  const hasEffect = !!tc.effect;
  const type = intToCardType(tc.type, hasEffect);

  const card: CardData = {
    id:          originalId ?? String(tc.id),
    name:        def?.name ?? `Card #${tc.id}`,
    type,
    description: def?.description ?? '',
    level:       tc.level,
    rarity:      intToRarity(tc.rarity),
  };

  if (tc.atk !== undefined) card.atk = tc.atk;
  if (tc.def !== undefined) card.def = tc.def;
  if (tc.attribute !== undefined && tc.attribute > 0) card.attribute = intToAttribute(tc.attribute);
  if (tc.race !== undefined && tc.race > 0) card.race = intToRace(tc.race);
  if (effect) card.effect = effect;
  if (tc.spellType)   card.spellType   = intToSpellType(tc.spellType);
  if (tc.trapTrigger) card.trapTrigger = intToTrapTrigger(tc.trapTrigger);
  if (tc.target)      card.target      = tc.target;

  return card;
}

/**
 * Apply TcgMeta to the game's live data stores, converting numeric IDs
 * back to original string IDs using the reverse migration map.
 * If tcgOpponents is provided (from opponents/ folder), it takes priority
 * over meta.opponentConfigs (fallback for archives without the folder).
 */
function applyTcgMeta(
  meta: TcgMeta,
  reverseIdMap: Record<number, string>,
  tcgOpponents?: TcgOpponentDeck[],
  oppDescs?: TcgOpponentDescription[],
): void {
  const rid = (numId: number): string => reverseIdMap[numId] ?? String(numId);

  if (meta.fusionRecipes) {
    const recipes: FusionRecipe[] = meta.fusionRecipes.map(r => ({
      materials: [rid(r.materials[0]), rid(r.materials[1])] as [string, string],
      result: rid(r.result),
    }));
    FUSION_RECIPES.push(...recipes);
  }

  // Use opponents/ folder if available, else fall back to meta.opponentConfigs
  const rawOpponents = tcgOpponents ?? meta.opponentConfigs;
  if (rawOpponents) {
    // Build lookup from opponent descriptions (localized name/title/flavor)
    const oppDescMap = new Map<number, TcgOpponentDescription>();
    if (oppDescs) {
      for (const d of oppDescs) oppDescMap.set(d.id, d);
    }

    const configs: OpponentConfig[] = rawOpponents.map(o => {
      const desc = oppDescMap.get(o.id);
      return {
        id:         o.id,
        name:       desc?.name ?? o.name,
        title:      desc?.title ?? o.title,
        race:       intToRace(o.race),
        flavor:     desc?.flavor ?? o.flavor,
        coinsWin:   o.coinsWin,
        coinsLoss:  o.coinsLoss,
        deckIds:    o.deckIds.map(rid),
        behaviorId: o.behavior,
      };
    });
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
export function revokeTcgImages(images: Map<number, string>): void {
  for (const url of images.values()) {
    URL.revokeObjectURL(url);
  }
}
