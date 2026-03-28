// ============================================================
// ECHOES OF SANGUO — TCG File Loader
// Loads .tcg (ZIP) files and populates the card database
// ============================================================

import JSZip from 'jszip';
import type { CardData, CardEffectBlock, FusionRecipe, FusionFormula, FusionComboType, OpponentConfig } from '../types.js';
import type { TcgCard, TcgCardDefinition, TcgMeta, TcgOpponentDeck, TcgOpponentDescription, TcgFusionFormula, TcgLocaleOverrides, TcgShopJson, TcgCampaignJson, TcgLoadResult } from './types.js';
import { validateTcgArchive, validateCampaignJson, validateFusionFormulasJson } from './tcg-validator.js';
import { intToCardType, intToAttribute, intToRace, intToRarity, intToSpellType, intToTrapTrigger } from './enums.js';
import { deserializeEffect } from './effect-serializer.js';
import { CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../cards.js';
import { applyRules } from '../rules.js';
import type { GameRules } from '../rules.js';
import { applyTypeMeta } from '../type-metadata.js';
import type { TypeMetaData } from '../type-metadata.js';
import { applyShopData } from '../shop-data.js';
import { applyCampaignData } from '../campaign-store.js';

// ── Error Classes ───────────────────────────────────────────

/** Thrown when a .tcg file cannot be fetched from the network. */
export class TcgNetworkError extends Error {
  constructor(url: string, status: number) {
    super(`Failed to fetch ${url}: ${status}`);
    this.name = 'TcgNetworkError';
  }
}

/** Thrown when a .tcg file is structurally invalid (corrupt ZIP, failed validation, unsupported version). */
export class TcgFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TcgFormatError';
  }
}

// ── Constants ───────────────────────────────────────────────

const SUPPORTED_FORMAT_VERSION = 2;

// ── Helpers ─────────────────────────────────────────────────

function getBrowserLang(): string {
  return typeof navigator !== 'undefined' ? navigator.language.substring(0, 2) : '';
}

/**
 * Load and apply a split metadata file (races.json, attributes.json, etc.)
 * with optional locale overrides. Reduces repetition for each metadata type.
 */
async function loadMetadataFile<T extends { key: string; value: string }>(
  zip: JSZip,
  filename: string,
  lang: string,
  metaKey: keyof TypeMetaData,
  warnings: string[],
): Promise<void> {
  const file = zip.file(filename);
  if (!file) return;
  try {
    const data: T[] = JSON.parse(await file.async('string'));
    const localeSuffix = filename.replace('.json', '');
    const localeFile = zip.file(`locales/${lang}_${localeSuffix}.json`);
    if (localeFile) {
      const overrides: TcgLocaleOverrides = JSON.parse(await localeFile.async('string'));
      for (const entry of data) {
        if (overrides[entry.key] !== undefined) entry.value = overrides[entry.key];
      }
    }
    applyTypeMeta({ [metaKey]: data } as TypeMetaData);
  } catch {
    warnings.push(`${filename}: failed to parse, using defaults`);
  }
}

/**
 * Load a .tcg file from a URL or ArrayBuffer.
 * Validates the ZIP archive, converts cards to internal format, and populates
 * CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, and STARTER_DECKS.
 */
export async function loadTcgFile(
  source: string | ArrayBuffer,
  onProgress?: (percent: number) => void,
): Promise<TcgLoadResult> {
  // Fetch if URL
  let buffer: ArrayBuffer;
  if (typeof source === 'string') {
    let response: Response;
    try {
      response = await fetch(source);
    } catch (e) {
      throw new TcgNetworkError(source, 0);
    }
    if (!response.ok) throw new TcgNetworkError(source, response.status);
    buffer = await response.arrayBuffer();
  } else {
    buffer = source;
  }
  onProgress?.(10);

  // Open ZIP
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    throw new TcgFormatError(`Failed to open ZIP archive: ${e instanceof Error ? e.message : e}`);
  }
  onProgress?.(15);

  // Validate
  const result = await validateTcgArchive(zip);
  if (!result.valid || !result.contents) {
    throw new TcgFormatError(`Invalid .tcg file:\n${result.errors.join('\n')}`);
  }

  const { cards, definitions, opponentDescriptions, imageIds, manifest } = result.contents;

  // Validate format version from manifest
  if (manifest && manifest.formatVersion > SUPPORTED_FORMAT_VERSION) {
    throw new TcgFormatError(
      `TCG format version mismatch: archive is v${manifest.formatVersion}, ` +
      `loader supports up to v${SUPPORTED_FORMAT_VERSION}. ` +
      `Please update the game engine or regenerate base.tcg with \`npm run generate:tcg\`.`
    );
  }
  onProgress?.(20);

  // Extract images as blob URLs
  const images = new Map<number, string>();
  const imageIdArr = [...imageIds];
  for (let i = 0; i < imageIdArr.length; i++) {
    const cardId = imageIdArr[i];
    const imgFile = zip.file(`img/${cardId}.png`);
    if (imgFile) {
      const blob = await imgFile.async('blob');
      const url = URL.createObjectURL(blob);
      images.set(cardId, url);
    }
    onProgress?.(20 + Math.round(((i + 1) / imageIdArr.length) * 35));
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
      // Resolve background image paths → blob URLs
      if (shopData.backgrounds) {
        const resolvedBgs: Record<string, string> = {};
        for (const [key, path] of Object.entries(shopData.backgrounds)) {
          const bgFile = zip.file(path);
          if (bgFile) {
            const blob = await bgFile.async('blob');
            resolvedBgs[key] = URL.createObjectURL(blob);
          }
        }
        shopData.backgrounds = resolvedBgs;
      }
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
        result.warnings.push(`${p}: failed to parse opponent deck, skipping`);
      }
    }
    tcgOpponents.sort((a, b) => a.id - b.id);
  }
  onProgress?.(65);

  // Convert TcgCards to CardData and populate CARD_DB
  // Pick the best description file (prefer browser language, fallback to first)
  const lang = getBrowserLang();
  if (definitions.size === 0) {
    result.warnings.push('No card definitions found in TCG archive');
    return { cards, definitions, images, meta, manifest, warnings: result.warnings };
  }
  const defs = definitions.get(lang) ?? definitions.values().next().value!;
  const defMap = new Map<number, TcgCardDefinition>();
  for (const d of defs) defMap.set(d.id, d);

  for (const tc of cards) {
    const def = defMap.get(tc.id);
    const cardData = tcgCardToCardData(tc, def, result.warnings);
    CARD_DB[cardData.id] = cardData;
  }
  onProgress?.(75);

  // Load split metadata files from ZIP (races.json, attributes.json, card_types.json, rarities.json)
  await loadMetadataFile(zip, 'races.json', lang, 'races', result.warnings);
  await loadMetadataFile(zip, 'attributes.json', lang, 'attributes', result.warnings);
  await loadMetadataFile(zip, 'card_types.json', lang, 'cardTypes', result.warnings);

  // Rarities have no locale overrides
  const raritiesZipFile = zip.file('rarities.json');
  if (raritiesZipFile) {
    try {
      const raritiesData = JSON.parse(await raritiesZipFile.async('string'));
      applyTypeMeta({ rarities: raritiesData });
    } catch {
      result.warnings.push('rarities.json: failed to parse, using defaults');
    }
  }
  onProgress?.(85);

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

  // Load fusion_formulas.json if present
  const formulasFile = zip.file('fusion_formulas.json');
  if (formulasFile) {
    try {
      const formulasJson = await formulasFile.async('string');
      const formulasData = JSON.parse(formulasJson);
      const formulaWarnings = validateFusionFormulasJson(formulasData);
      result.warnings.push(...formulaWarnings);
      if (formulasData?.formulas && Array.isArray(formulasData.formulas)) {
        applyFusionFormulas(formulasData.formulas as TcgFusionFormula[]);
      }
    } catch {
      result.warnings.push('fusion_formulas.json: failed to parse, skipping');
    }
  }
  onProgress?.(92);

  // Pick the best opponent description file (same logic as card descriptions)
  const oppDescs = opponentDescriptions.get(lang) ?? (opponentDescriptions.size > 0 ? opponentDescriptions.values().next().value! : undefined);

  // Apply meta to game data stores
  if (meta) {
    try {
      applyTcgMeta(meta, tcgOpponents, oppDescs);
    } catch (e) {
      result.warnings.push(`meta.json: failed to apply game data — ${e instanceof Error ? e.message : e}`);
    }
  }
  onProgress?.(100);

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
 *
 * Intentionally lenient: invalid effects are disabled with a warning rather than
 * rejecting the card, so that archives with newer effect syntax degrade gracefully.
 */
function tcgCardToCardData(tc: TcgCard, def: TcgCardDefinition | undefined, warnings: string[]): CardData {
  let effect: CardEffectBlock | undefined;
  if (tc.effect) {
    try {
      effect = deserializeEffect(tc.effect);
    } catch (e) {
      warnings.push(`Card #${tc.id} (${def?.name ?? 'unknown'}): failed to deserialize effect — effect disabled. ${e instanceof Error ? e.message : e}`);
    }
  }

  const hasEffect = !!tc.effect;
  const type = intToCardType(tc.type, hasEffect);

  const card: CardData = {
    id:          String(tc.id),
    name:        def?.name ?? `Card #${tc.id}`,
    type,
    description: def?.description ?? '',
    level:       tc.level ?? undefined,
    rarity:      intToRarity(tc.rarity),
  };

  if (tc.atk !== undefined) card.atk = tc.atk;
  if (tc.def !== undefined) card.def = tc.def;
  if (tc.attribute !== undefined && tc.attribute > 0) {
    try { card.attribute = intToAttribute(tc.attribute); }
    catch { warnings.push(`Card #${tc.id}: invalid attribute ${tc.attribute}`); }
  }
  if (tc.race !== undefined && tc.race > 0) {
    try { card.race = intToRace(tc.race); }
    catch { warnings.push(`Card #${tc.id}: invalid race ${tc.race}`); }
  }
  if (effect) card.effect = effect;
  if (tc.spellType)   card.spellType   = intToSpellType(tc.spellType);
  if (tc.trapTrigger) card.trapTrigger = intToTrapTrigger(tc.trapTrigger);
  if (tc.target)      card.target      = tc.target;
  if (tc.atkBonus !== undefined) card.atkBonus = tc.atkBonus;
  if (tc.defBonus !== undefined) card.defBonus = tc.defBonus;
  if (tc.equipReqRace !== undefined || tc.equipReqAttr !== undefined) {
    card.equipRequirement = {};
    if (tc.equipReqRace !== undefined) {
      try { card.equipRequirement.race = intToRace(tc.equipReqRace); }
      catch { warnings.push(`Card #${tc.id}: invalid equipReqRace ${tc.equipReqRace}`); }
    }
    if (tc.equipReqAttr !== undefined) {
      try { card.equipRequirement.attr = intToAttribute(tc.equipReqAttr); }
      catch { warnings.push(`Card #${tc.id}: invalid equipReqAttr ${tc.equipReqAttr}`); }
    }
  }

  return card;
}

/**
 * Apply TcgMeta to the game's live data stores.
 * If tcgOpponents is provided (from opponents/ folder), it takes priority
 * over meta.opponentConfigs (fallback for archives without the folder).
 */
function applyTcgMeta(
  meta: TcgMeta,
  tcgOpponents?: TcgOpponentDeck[],
  oppDescs?: TcgOpponentDescription[],
): void {
  const rid = (numId: number): string => String(numId);

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
      const raceNum = Number(raceKey);
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
 * Convert raw TcgFusionFormula entries to FusionFormula and populate the store.
 * Sorted by descending priority for deterministic lookup order.
 */
function applyFusionFormulas(raw: TcgFusionFormula[]): void {
  const rid = (numId: number): string => String(numId);
  const converted: FusionFormula[] = raw.map(f => ({
    id:         f.id,
    comboType:  f.comboType as FusionComboType,
    operand1:   f.operand1,
    operand2:   f.operand2,
    priority:   f.priority,
    resultPool: f.resultPool.map(rid),
  }));
  converted.sort((a, b) => b.priority - a.priority);
  FUSION_FORMULAS.push(...converted);
}

/**
 * Revoke all blob URLs from a previous load to free memory.
 */
export function revokeTcgImages(images: Map<number, string>): void {
  for (const url of images.values()) {
    URL.revokeObjectURL(url);
  }
}
