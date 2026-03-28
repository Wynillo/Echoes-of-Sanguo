// ============================================================
// ECHOES OF SANGUO — TCG File Loader (Pure)
// Loads .tcg (ZIP) files and returns parsed data.
// No side effects — no global store mutations, no browser APIs.
// The engine bridge (js/tcg-bridge.ts) handles applying data.
// ============================================================

import JSZip from 'jszip';
import type { TcgCard, TcgCardDefinition, TcgParsedCard, TcgMeta, TcgOpponentDeck, TcgFusionFormula, TcgLocaleOverrides, TcgShopJson, TcgCampaignJson, TcgLoadResult } from './types.js';
import { validateTcgArchive, validateCampaignJson, validateFusionFormulasJson } from './tcg-validator.js';

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

/**
 * Load a split metadata file (races.json, attributes.json, etc.)
 * with optional locale overrides. Returns the parsed array or undefined.
 */
async function loadMetadataFile<T extends { key: string; value: string }>(
  zip: JSZip,
  filename: string,
  lang: string,
  warnings: string[],
): Promise<T[] | undefined> {
  const file = zip.file(filename);
  if (!file) return undefined;
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
    return data;
  } catch {
    warnings.push(`${filename}: failed to parse, using defaults`);
    return undefined;
  }
}

/**
 * Build a TcgParsedCard by merging a TcgCard with its TcgCardDefinition.
 * All numeric fields are kept as-is — no enum conversion.
 */
function tcgCardToParsedCard(tc: TcgCard, def: TcgCardDefinition | undefined): TcgParsedCard {
  const parsed: TcgParsedCard = {
    id:          tc.id,
    name:        def?.name ?? `Card #${tc.id}`,
    description: def?.description ?? '',
    type:        tc.type,
    level:       tc.level,
    rarity:      tc.rarity,
  };
  if (tc.atk !== undefined) parsed.atk = tc.atk;
  if (tc.def !== undefined) parsed.def = tc.def;
  if (tc.attribute !== undefined) parsed.attribute = tc.attribute;
  if (tc.race !== undefined) parsed.race = tc.race;
  if (tc.effect) parsed.effect = tc.effect;
  if (tc.spellType !== undefined) parsed.spellType = tc.spellType;
  if (tc.trapTrigger !== undefined) parsed.trapTrigger = tc.trapTrigger;
  if (tc.target) parsed.target = tc.target;
  if (tc.atkBonus !== undefined) parsed.atkBonus = tc.atkBonus;
  if (tc.defBonus !== undefined) parsed.defBonus = tc.defBonus;
  if (tc.equipReqRace !== undefined) parsed.equipReqRace = tc.equipReqRace;
  if (tc.equipReqAttr !== undefined) parsed.equipReqAttr = tc.equipReqAttr;
  return parsed;
}

/**
 * Load a .tcg file from a URL or ArrayBuffer.
 * Returns all parsed data without any side effects.
 * The engine bridge is responsible for populating game stores.
 */
export async function loadTcgFile(
  source: string | ArrayBuffer,
  options?: { lang?: string; onProgress?: (percent: number) => void },
): Promise<TcgLoadResult> {
  const lang = options?.lang ?? '';
  const onProgress = options?.onProgress;

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
  const warnings = result.warnings;

  // Validate format version from manifest
  if (manifest && manifest.formatVersion > SUPPORTED_FORMAT_VERSION) {
    throw new TcgFormatError(
      `TCG format version mismatch: archive is v${manifest.formatVersion}, ` +
      `loader supports up to v${SUPPORTED_FORMAT_VERSION}. ` +
      `Please update the game engine or regenerate base.tcg with \`npm run generate:tcg\`.`
    );
  }
  onProgress?.(20);

  // Extract images as raw ArrayBuffers (environment-agnostic — no blob URLs)
  const rawImages = new Map<number, ArrayBuffer>();
  const imageIdArr = [...imageIds];
  for (let i = 0; i < imageIdArr.length; i++) {
    const cardId = imageIdArr[i];
    const imgFile = zip.file(`img/${cardId}.png`);
    if (imgFile) {
      rawImages.set(cardId, await imgFile.async('arraybuffer'));
    }
    onProgress?.(20 + Math.round(((i + 1) / imageIdArr.length) * 35));
  }

  // Load meta.json if present
  let meta: TcgMeta | undefined;
  const metaFile = zip.file('meta.json');
  if (metaFile) {
    try {
      meta = JSON.parse(await metaFile.async('string'));
    } catch {
      warnings.push('meta.json: failed to parse, skipping');
    }
  }

  // Load rules.json if present — return as raw data, no application
  let rules: Record<string, unknown> | undefined;
  const rulesFile = zip.file('rules.json');
  if (rulesFile) {
    try {
      rules = JSON.parse(await rulesFile.async('string'));
    } catch {
      warnings.push('rules.json: failed to parse, skipping');
    }
  }

  // Load shop.json if present — return raw data, extract background images as ArrayBuffers
  let shopData: TcgShopJson | undefined;
  let rawShopBackgrounds: Map<string, ArrayBuffer> | undefined;
  const shopFile = zip.file('shop.json');
  if (shopFile) {
    try {
      shopData = JSON.parse(await shopFile.async('string'));
      if (shopData!.backgrounds) {
        rawShopBackgrounds = new Map();
        for (const [key, path] of Object.entries(shopData!.backgrounds)) {
          const bgFile = zip.file(path);
          if (bgFile) {
            rawShopBackgrounds.set(key, await bgFile.async('arraybuffer'));
          }
        }
      }
    } catch {
      warnings.push('shop.json: failed to parse, using defaults');
    }
  }

  // Scan opponents/*.json — takes priority over meta.opponentConfigs
  const oppPaths = Object.keys(zip.files)
    .filter(f => /^opponents\/[^/]+\.json$/.test(f))
    .sort();
  let opponents: TcgOpponentDeck[] | undefined;
  if (oppPaths.length > 0) {
    opponents = [];
    for (const p of oppPaths) {
      try {
        opponents.push(JSON.parse(await zip.file(p)!.async('string')));
      } catch {
        warnings.push(`${p}: failed to parse opponent deck, skipping`);
      }
    }
    opponents.sort((a, b) => a.id - b.id);
  }
  onProgress?.(65);

  // Build TcgParsedCard[] — merge TcgCard with definition, keep ints as-is
  const parsedCards: TcgParsedCard[] = [];
  if (definitions.size === 0) {
    warnings.push('No card definitions found in TCG archive');
  }
  const defs = definitions.get(lang) ?? (definitions.size > 0 ? definitions.values().next().value! : []);
  const defMap = new Map<number, TcgCardDefinition>();
  for (const d of defs) defMap.set(d.id, d);

  for (const tc of cards) {
    parsedCards.push(tcgCardToParsedCard(tc, defMap.get(tc.id)));
  }
  onProgress?.(75);

  // Load split metadata files from ZIP (races.json, attributes.json, card_types.json, rarities.json)
  const typeMeta: TcgLoadResult['typeMeta'] = {};
  typeMeta.races = await loadMetadataFile(zip, 'races.json', lang, warnings) ?? undefined;
  typeMeta.attributes = await loadMetadataFile(zip, 'attributes.json', lang, warnings) ?? undefined;
  typeMeta.cardTypes = await loadMetadataFile(zip, 'card_types.json', lang, warnings) ?? undefined;

  // Rarities have no locale overrides
  const raritiesZipFile = zip.file('rarities.json');
  if (raritiesZipFile) {
    try {
      typeMeta.rarities = JSON.parse(await raritiesZipFile.async('string'));
    } catch {
      warnings.push('rarities.json: failed to parse, using defaults');
    }
  }
  onProgress?.(85);

  // Load campaign.json if present
  let campaignData: TcgCampaignJson | undefined;
  const campaignFile = zip.file('campaign.json');
  if (campaignFile) {
    try {
      campaignData = JSON.parse(await campaignFile.async('string'));
      const campaignWarnings = validateCampaignJson(campaignData!);
      warnings.push(...campaignWarnings);
    } catch {
      warnings.push('campaign.json: failed to parse, skipping');
    }
  }

  // Load fusion_formulas.json if present
  let fusionFormulas: TcgFusionFormula[] | undefined;
  const formulasFile = zip.file('fusion_formulas.json');
  if (formulasFile) {
    try {
      const formulasData = JSON.parse(await formulasFile.async('string'));
      const formulaWarnings = validateFusionFormulasJson(formulasData);
      warnings.push(...formulaWarnings);
      if (formulasData?.formulas && Array.isArray(formulasData.formulas)) {
        fusionFormulas = formulasData.formulas as TcgFusionFormula[];
      }
    } catch {
      warnings.push('fusion_formulas.json: failed to parse, skipping');
    }
  }
  onProgress?.(100);

  return {
    cards,
    parsedCards,
    definitions,
    rawImages,
    meta,
    manifest,
    warnings,
    opponents,
    opponentDescriptions,
    typeMeta: (typeMeta.races || typeMeta.attributes || typeMeta.cardTypes || typeMeta.rarities) ? typeMeta : undefined,
    rules,
    shopData,
    rawShopBackgrounds,
    campaignData,
    fusionFormulas,
  };
}
