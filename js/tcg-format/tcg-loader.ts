// ============================================================
// ECHOES OF SANGUO — TCG File Loader
// Loads .tcg (ZIP) files and populates the card database
// ============================================================

import JSZip from 'jszip';
import type { CardData, CardEffectBlock, FusionRecipe, OpponentConfig } from '../types.js';
import { Race } from '../types.js';
import type { TcgCard, TcgCardDefinition, TcgMeta, TcgOpponentDeck, TcgOpponentDescription, TcgRacesJson, TcgAttributesJson, TcgCardTypesJson, TcgRaritiesJson, TcgLocaleOverrides, TcgShopJson, TcgCampaignJson, TcgLoadResult } from './types.js';
import { validateTcgArchive } from './tcg-validator.js';
import { intToCardType, intToAttribute, intToRace, intToRarity, intToSpellType, intToTrapTrigger } from './enums.js';
import { deserializeEffect } from './effect-serializer.js';
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../cards.js';
import { applyRules } from '../rules.js';
import type { GameRules } from '../rules.js';
import { applyTypeMeta } from '../type-metadata.js';
import { applyShopData } from '../shop-data.js';
import { applyCampaignData } from '../campaign-store.js';
import { validateCampaignJson } from './tcg-validator.js';

/**
 * Apply locale overrides (key → translated value) to an array of metadata entries.
 */
function applyLocaleOverrides(entries: Array<{ key: string; value: string }>, overrides: TcgLocaleOverrides): void {
  for (const entry of entries) {
    if (overrides[entry.key] !== undefined) {
      entry.value = overrides[entry.key];
    }
  }
}

/**
 * Load a .tcg folder (served as static files) from a base URL ending with '/'.
 * Fetches individual JSON files from the folder, applies locale overrides, and
 * populates CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, and STARTER_DECKS.
 */
export async function loadTcgFolder(baseUrl: string): Promise<TcgLoadResult> {
  const warnings: string[] = [];
  const lang = typeof navigator !== 'undefined' ? navigator.language.substring(0, 2) : '';

  async function fetchJson<T>(path: string): Promise<T | null> {
    try {
      const r = await fetch(baseUrl + path);
      if (!r.ok) return null;
      return await r.json() as T;
    } catch {
      return null;
    }
  }

  async function fetchLocaleOverrides(name: string): Promise<TcgLocaleOverrides | null> {
    if (!lang) return null;
    return fetchJson<TcgLocaleOverrides>(`locales/${lang}_${name}.json`);
  }

  // Load required cards.json
  const cards = await fetchJson<TcgCard[]>('cards.json');
  if (!cards) throw new Error(`Failed to fetch ${baseUrl}cards.json`);

  // Load id_migration.json
  let reverseIdMap: Record<number, string> = {};
  const idMapping = await fetchJson<Record<string, number>>('id_migration.json');
  if (idMapping) {
    for (const [oldId, numId] of Object.entries(idMapping)) {
      reverseIdMap[numId] = oldId;
    }
  }

  // Load description files — try lang-prefixed first, fallback to en_ or base
  const definitions = new Map<string, TcgCardDefinition[]>();
  const enDefs = await fetchJson<TcgCardDefinition[]>('en_cards_description.json');
  if (enDefs) definitions.set('en', enDefs);
  if (lang && lang !== 'en') {
    const langDefs = await fetchJson<TcgCardDefinition[]>(`${lang}_cards_description.json`);
    if (langDefs) definitions.set(lang, langDefs);
  }
  const baseDefs = await fetchJson<TcgCardDefinition[]>('cards_description.json');
  if (baseDefs) definitions.set('', baseDefs);

  if (definitions.size === 0) {
    warnings.push('No cards_description.json files found');
  }

  // Load opponent description files
  const opponentDescriptions = new Map<string, TcgOpponentDescription[]>();
  const enOppDescs = await fetchJson<TcgOpponentDescription[]>('en_opponents_description.json');
  if (enOppDescs) opponentDescriptions.set('en', enOppDescs);
  if (lang && lang !== 'en') {
    const langOppDescs = await fetchJson<TcgOpponentDescription[]>(`${lang}_opponents_description.json`);
    if (langOppDescs) opponentDescriptions.set(lang, langOppDescs);
  }

  // Load meta.json
  let meta: TcgMeta | undefined;
  const metaData = await fetchJson<TcgMeta>('meta.json');
  if (metaData) meta = metaData;

  // Load rules.json
  const rulesData = await fetchJson<any>('rules.json');
  if (rulesData) {
    try {
      applyRules(rulesData);
    } catch {
      warnings.push('rules.json: failed to apply');
    }
  }

  // Load shop.json
  const shopData = await fetchJson<TcgShopJson>('shop.json');
  if (shopData) {
    try {
      applyShopData(shopData);
    } catch {
      warnings.push('shop.json: failed to apply');
    }
  }

  // Load races.json + locale overrides
  const racesData = await fetchJson<TcgRacesJson>('races.json');
  if (racesData) {
    const raceOverrides = await fetchLocaleOverrides('races');
    if (raceOverrides) applyLocaleOverrides(racesData, raceOverrides);
    applyTypeMeta({ races: racesData });
  }

  // Load attributes.json + locale overrides
  const attributesData = await fetchJson<TcgAttributesJson>('attributes.json');
  if (attributesData) {
    const attrOverrides = await fetchLocaleOverrides('attributes');
    if (attrOverrides) applyLocaleOverrides(attributesData, attrOverrides);
    applyTypeMeta({ attributes: attributesData });
  }

  // Load card_types.json + locale overrides
  const cardTypesData = await fetchJson<TcgCardTypesJson>('card_types.json');
  if (cardTypesData) {
    const ctOverrides = await fetchLocaleOverrides('card_types');
    if (ctOverrides) applyLocaleOverrides(cardTypesData, ctOverrides);
    applyTypeMeta({ cardTypes: cardTypesData });
  }

  // Load rarities.json (no localization)
  const raritiesData = await fetchJson<TcgRaritiesJson>('rarities.json');
  if (raritiesData) {
    applyTypeMeta({ rarities: raritiesData });
  }

  // Scan opponents/ folder — load exactly as many as described in en_opponents_description.json
  // (avoids a probe 404 on the first missing file)
  const opponentCount = enOppDescs?.length ?? 0;
  const tcgOpponents: TcgOpponentDeck[] = [];
  for (let i = 1; i <= opponentCount; i++) {
    const oppData = await fetchJson<TcgOpponentDeck>(`opponents/opponent_deck_${i}.json`);
    if (oppData) tcgOpponents.push(oppData);
  }
  tcgOpponents.sort((a, b) => a.id - b.id);

  // Load campaign.json
  const campaignData = await fetchJson<TcgCampaignJson>('campaign.json');
  if (campaignData) {
    try {
      const campaignWarnings = validateCampaignJson(campaignData);
      warnings.push(...campaignWarnings);
      applyCampaignData(campaignData);
    } catch {
      warnings.push('campaign.json: failed to apply');
    }
  }

  // Extract images as blob URLs
  const images = new Map<number, string>();
  for (const card of cards) {
    try {
      const imgR = await fetch(`${baseUrl}img/${card.id}.png`);
      if (imgR.ok) {
        const blob = await imgR.blob();
        images.set(card.id, URL.createObjectURL(blob));
      }
    } catch {
      // Image not available, skip
    }
  }

  // Pick best description set
  const defs = definitions.get(lang) ?? definitions.get('en') ?? definitions.values().next().value!;
  const defMap = new Map<number, TcgCardDefinition>();
  if (defs) {
    for (const d of defs) defMap.set(d.id, d);
  }

  // Convert TcgCards to CardData and populate CARD_DB
  for (const tc of cards) {
    const def = defMap.get(tc.id);
    const originalId = reverseIdMap[tc.id];
    const cardData = tcgCardToCardData(tc, def, originalId);
    CARD_DB[cardData.id] = cardData;
  }

  // Pick opponent descriptions
  const oppDescs = opponentDescriptions.get(lang) ?? opponentDescriptions.get('en') ?? (opponentDescriptions.size > 0 ? opponentDescriptions.values().next().value! : undefined);

  // Apply meta to game data stores
  if (meta) {
    applyTcgMeta(meta, reverseIdMap, tcgOpponents.length > 0 ? tcgOpponents : undefined, oppDescs);
  } else if (tcgOpponents.length > 0) {
    applyTcgMeta({}, reverseIdMap, tcgOpponents, oppDescs);
  }

  return {
    cards,
    definitions,
    images,
    meta,
    manifest: undefined,
    warnings,
  };
}

/**
 * Load a .tcg file from a URL or ArrayBuffer.
 * If source is a string ending with '/', treats it as a folder URL and delegates
 * to loadTcgFolder(). Otherwise loads a ZIP archive.
 * Validates the archive, converts cards to internal format, and populates
 * CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, and STARTER_DECKS.
 */
export async function loadTcgFile(source: string | ArrayBuffer): Promise<TcgLoadResult> {
  // Delegate to folder loader if URL ends with '/'
  if (typeof source === 'string' && source.endsWith('/')) {
    return loadTcgFolder(source);
  }

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

  // Load shop.json if present
  const shopFile = zip.file('shop.json');
  if (shopFile) {
    try {
      const shopJson = await shopFile.async('string');
      const shopData: TcgShopJson = JSON.parse(shopJson);
      applyShopData(shopData);
    } catch {
      result.warnings.push('shop.json: failed to parse, using defaults');
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

  // Load split metadata files from ZIP (races.json, attributes.json, card_types.json, rarities.json)
  const zipLang = typeof navigator !== 'undefined' ? navigator.language.substring(0, 2) : '';
  const racesZipFile = zip.file('races.json');
  if (racesZipFile) {
    try {
      const racesData: TcgRacesJson = JSON.parse(await racesZipFile.async('string'));
      const raceLocaleFile = zip.file(`locales/${zipLang}_races.json`);
      if (raceLocaleFile) {
        const overrides: TcgLocaleOverrides = JSON.parse(await raceLocaleFile.async('string'));
        for (const entry of racesData) {
          if (overrides[entry.key] !== undefined) entry.value = overrides[entry.key];
        }
      }
      applyTypeMeta({ races: racesData });
    } catch {
      result.warnings.push('races.json: failed to parse, using defaults');
    }
  }
  const attributesZipFile = zip.file('attributes.json');
  if (attributesZipFile) {
    try {
      const attributesData: TcgAttributesJson = JSON.parse(await attributesZipFile.async('string'));
      const attrLocaleFile = zip.file(`locales/${zipLang}_attributes.json`);
      if (attrLocaleFile) {
        const overrides: TcgLocaleOverrides = JSON.parse(await attrLocaleFile.async('string'));
        for (const entry of attributesData) {
          if (overrides[entry.key] !== undefined) entry.value = overrides[entry.key];
        }
      }
      applyTypeMeta({ attributes: attributesData });
    } catch {
      result.warnings.push('attributes.json: failed to parse, using defaults');
    }
  }
  const cardTypesZipFile = zip.file('card_types.json');
  if (cardTypesZipFile) {
    try {
      const cardTypesData: TcgCardTypesJson = JSON.parse(await cardTypesZipFile.async('string'));
      const ctLocaleFile = zip.file(`locales/${zipLang}_card_types.json`);
      if (ctLocaleFile) {
        const overrides: TcgLocaleOverrides = JSON.parse(await ctLocaleFile.async('string'));
        for (const entry of cardTypesData) {
          if (overrides[entry.key] !== undefined) entry.value = overrides[entry.key];
        }
      }
      applyTypeMeta({ cardTypes: cardTypesData });
    } catch {
      result.warnings.push('card_types.json: failed to parse, using defaults');
    }
  }
  const raritiesZipFile = zip.file('rarities.json');
  if (raritiesZipFile) {
    try {
      const raritiesData: TcgRaritiesJson = JSON.parse(await raritiesZipFile.async('string'));
      applyTypeMeta({ rarities: raritiesData });
    } catch {
      result.warnings.push('rarities.json: failed to parse, using defaults');
    }
  }

  // Load campaign.json if present
  const campaignFile = zip.file('campaign.json');
  if (campaignFile) {
    try {
      const campaignJson = await campaignFile.async('string');
      const campaignData: TcgCampaignJson = JSON.parse(campaignJson);
      const campaignWarnings = validateCampaignJson(campaignData);
      result.warnings.push(...campaignWarnings);
      applyCampaignData(campaignData);
    } catch {
      result.warnings.push('campaign.json: failed to parse, skipping');
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
