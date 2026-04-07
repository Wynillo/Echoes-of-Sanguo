import { loadTcgFile, TcgNetworkError, TcgFormatError } from '@wynillo/tcg-format';
import JSZip from 'jszip';
import type { TcgLoadResult, TcgParsedCard, TcgOpponentDeck, TcgOpponentDescription, TcgFusionFormula, TcgManifest } from '@wynillo/tcg-format';
import type { CardData, FusionRecipe, FusionFormula, FusionComboType, OpponentConfig } from './types.js';
import { CardType, Rarity } from './types.js';
import { CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from './cards.js';
import { intToCardType, intToAttribute, intToRace, intToRarity, intToSpellType, intToTrapTrigger, isTrapTrigger } from './enums.js';
import { deserializeEffect, isValidEffectString, parseEffectString } from './effect-serializer.js';
import { applyRules } from './rules.js';
import { applyTypeMeta } from './type-metadata.js';
import { applyShopData, SHOP_DATA, type ShopData } from './shop-data.js';
import { applyCampaignData } from './campaign-store.js';
import type { CampaignData } from './campaign-types.js';
import { TYPE_META } from './type-metadata.js';

// Re-export error classes for consumers
export { TcgNetworkError, TcgFormatError };

const rid = (numId: number): string => String(numId);

interface LoadedMod {
  source: string;
  cardIds: string[];
  opponentIds: number[];
  timestamp: number;
  manifest?: TcgManifest;
}
const loadedMods: LoadedMod[] = [];

let currentManifest: TcgManifest | null = null;

export function getCurrentManifest(): TcgManifest | null {
  return currentManifest;
}

function parsedToCardData(p: TcgParsedCard, warnings: string[]): CardData {
  let parsedEffect: Partial<Pick<CardData, 'effect' | 'effects'>> = {};
  if (p.effect) {
    if (!isValidEffectString(p.effect)) {
      warnings.push(`Card #${p.id}: effect string may contain unknown actions: "${p.effect}"`);
    }
    try {
      parseEffectString(p.effect, parsedEffect);
    } catch (e) {
      warnings.push(`Card #${p.id} (${p.name}): failed to deserialize effect — effect disabled. ${e instanceof Error ? e.message : e}`);
    }
  }

  let type = CardType.Monster;  // fallback
  try { type = intToCardType(p.type, !!p.effect); }
  catch { warnings.push(`Card #${p.id}: unknown type int ${p.type}, defaulting to Monster`); }

  let rarity = Rarity.Common;  // fallback
  try { rarity = intToRarity(p.rarity); }
  catch { warnings.push(`Card #${p.id}: unknown rarity int ${p.rarity}, defaulting to Common`); }

  const card: CardData = {
    id:          String(p.id),
    name:        p.name,
    type,
    description: p.description,
    level:       p.level ?? undefined,
    rarity,
  };

  if (p.atk !== undefined) card.atk = p.atk;
  if (p.def !== undefined) card.def = p.def;
  if (p.attribute !== undefined && p.attribute > 0) {
    try { card.attribute = intToAttribute(p.attribute); }
    catch { warnings.push(`Card #${p.id}: invalid attribute ${p.attribute}`); }
  }
  if (p.race !== undefined && p.race > 0) {
    try { card.race = intToRace(p.race); }
    catch { warnings.push(`Card #${p.id}: invalid race ${p.race}`); }
  }
  if (parsedEffect.effect)   card.effect  = parsedEffect.effect;
  if (parsedEffect.effects)  card.effects = parsedEffect.effects;
  if (p.spellType) {
    try { card.spellType = intToSpellType(p.spellType); }
    catch { warnings.push(`Card #${p.id}: invalid spellType int ${p.spellType}`); }
  }
  if (p.trapTrigger) {
    if (typeof p.trapTrigger === 'string' && isTrapTrigger(p.trapTrigger)) {
      card.trapTrigger = p.trapTrigger;
    } else if (typeof p.trapTrigger === 'number') {
      try { card.trapTrigger = intToTrapTrigger(p.trapTrigger); }
      catch { warnings.push(`Card #${p.id}: invalid trapTrigger int ${p.trapTrigger}`); }
    } else {
      warnings.push(`Card #${p.id}: invalid trapTrigger value ${p.trapTrigger}`);
    }
  }
  if (!card.trapTrigger && type === CardType.Trap && card.effect) {
    const trigger = card.effect.trigger;
    if (isTrapTrigger(trigger)) card.trapTrigger = trigger;
  }
  if (p.target)      card.target      = p.target;
  if (p.atkBonus !== undefined) card.atkBonus = p.atkBonus;
  if (p.defBonus !== undefined) card.defBonus = p.defBonus;
  if (p.equipReqRace !== undefined || p.equipReqAttr !== undefined) {
    card.equipRequirement = {};
    if (p.equipReqRace !== undefined) {
      try { card.equipRequirement.race = intToRace(p.equipReqRace); }
      catch { warnings.push(`Card #${p.id}: invalid equipReqRace ${p.equipReqRace}`); }
    }
    if (p.equipReqAttr !== undefined) {
      try { card.equipRequirement.attr = intToAttribute(p.equipReqAttr); }
      catch { warnings.push(`Card #${p.id}: invalid equipReqAttr ${p.equipReqAttr}`); }
    }
  }

  return card;
}

function applyOpponents(
  tcgOpponents: TcgOpponentDeck[],
  oppDescs?: TcgOpponentDescription[],
): number[] {
  const addedOpponentIds: number[] = [];
  const oppDescMap = new Map<number, TcgOpponentDescription>();
  if (oppDescs) {
    for (const d of oppDescs) oppDescMap.set(d.id, d);
  }
  const configs: OpponentConfig[] = tcgOpponents.map(o => {
    const desc = oppDescMap.get(o.id);
    addedOpponentIds.push(o.id);
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
  return addedOpponentIds;
}

function applyFusionRecipes(raw: Array<{ materials: number[]; result: number }>): void {
  const recipes: FusionRecipe[] = raw.map(r => ({
    materials: [rid(r.materials[0]), rid(r.materials[1])] as [string, string],
    result: rid(r.result),
  }));
  FUSION_RECIPES.push(...recipes);
}

function applyStarterDecks(raw: Record<string, number[]>): void {
  for (const [raceKey, numIds] of Object.entries(raw)) {
    STARTER_DECKS[Number(raceKey)] = numIds.map(rid);
  }
  const firstDeck = Object.values(STARTER_DECKS)[0];
  if (firstDeck) {
    PLAYER_DECK_IDS.splice(0, PLAYER_DECK_IDS.length, ...firstDeck);
    OPPONENT_DECK_IDS.splice(0, OPPONENT_DECK_IDS.length, ...firstDeck);
  }
}

const VALID_COMBO_TYPES = new Set<FusionComboType>(['race+race', 'race+attr', 'attr+attr']);

function applyFusionFormulas(raw: TcgFusionFormula[], warnings: string[]): void {
  const converted: FusionFormula[] = [];
  for (const f of raw) {
    if (!VALID_COMBO_TYPES.has(f.comboType as FusionComboType)) {
      warnings.push(`Fusion formula ${f.id}: unknown comboType "${f.comboType}" — skipped`);
      continue;
    }
    converted.push({
      id: f.id, comboType: f.comboType as FusionComboType,
      operand1: f.operand1, operand2: f.operand2, priority: f.priority,
      resultPool: f.resultPool.map(rid),
    });
  }
  converted.sort((a, b) => b.priority - a.priority);
  FUSION_FORMULAS.push(...converted);
}

const blobUrls: Map<number, string> = new Map();

function applyImages(rawImages: Map<number, ArrayBuffer>): Map<number, string> {
  for (const [id, buf] of rawImages) {
    const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
    blobUrls.set(id, url);
  }
  return new Map(blobUrls);
}

export function revokeTcgImages(): void {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
}

export interface BridgeLoadResult {
  cards: TcgLoadResult['cards'];
  parsedCards: TcgLoadResult['parsedCards'];
  images: Map<number, string>;
  manifest?: TcgManifest;
  warnings: string[];
}

export async function loadAndApplyTcg(
  source: string | ArrayBuffer,
  options?: { lang?: string; onProgress?: (percent: number) => void },
): Promise<BridgeLoadResult> {
  // Resolve source to ArrayBuffer so we can extract locale files from the ZIP
  let buffer: ArrayBuffer;
  if (typeof source === 'string') {
    const res = await fetch(source);
    if (!res.ok) throw new TcgNetworkError(source, res.status);
    buffer = await res.arrayBuffer();
  } else {
    buffer = source;
  }

  await Promise.all([
    extractLocalesFromZip(buffer),
    extractExtraDataFromZip(buffer),
  ]);

  const lang = options?.lang ?? (typeof navigator !== 'undefined' ? navigator.language.substring(0, 2) : '');
  const result = await loadTcgFile(buffer, { lang, onProgress: options?.onProgress });
  console.log('[tcg-bridge] loadTcgFile result keys:', Object.keys(result));
  console.log('[tcg-bridge] result.opponents:', result.opponents ? `${result.opponents.length} opponents` : 'undefined');
  console.log('[tcg-bridge] result has opponentDescriptions:', result.opponentDescriptions?.size ?? 0, 'locales');
  const mod: LoadedMod = {
    source: typeof source === 'string' ? source : '<ArrayBuffer>',
    cardIds: [], opponentIds: [], timestamp: Date.now(),
    manifest: result.manifest,
  };

  // Manual fallback: if result.opponents is empty, try loading from raw JSON
  if (!result.opponents || result.opponents.length === 0) {
    console.warn('[tcg-bridge] loadTcgFile returned no opponents, attempting manual extraction...');
    try {
      const zip = await JSZip.loadAsync(buffer);
      const oppFile = zip.file('opponents.json');
      if (oppFile) {
        const rawOpponents = JSON.parse(await oppFile.async('string')) as TcgOpponentDeck[];
        console.log('[tcg-bridge] Manually extracted', rawOpponents.length, 'opponents from opponents.json');
        // Pick the first available locale for descriptions
        const firstDesc = result.opponentDescriptions?.values().next().value ?? undefined;
        result.opponents = rawOpponents;
        result.opponentDescriptions = result.opponentDescriptions ?? new Map();
      }
    } catch (e) {
      console.error('[tcg-bridge] Failed to manually extract opponents:', e);
    }
  }

  // Convert TcgParsedCard[] → CardData[] with collision detection
  for (let i = 0; i < result.parsedCards.length; i++) {
    const parsed = result.parsedCards[i];
    const raw    = result.cards[i];
    const id = String(parsed.id);
    if (CARD_DB[id]) {
      result.warnings.push(`Card ${id} ("${parsed.name}") overwrites existing card "${CARD_DB[id].name}"`);
    }
    const card = parsedToCardData(parsed, result.warnings);
    if (raw.spirit) card.spirit = true;
    CARD_DB[id] = card;
    mod.cardIds.push(id);
  }

  // Convert raw ArrayBuffers → blob URLs
  const images = applyImages(result.rawImages);

  // Apply game-specific side effects
  if (result.typeMeta?.races)      applyTypeMeta({ races: result.typeMeta.races });
  if (result.typeMeta?.attributes) applyTypeMeta({ attributes: result.typeMeta.attributes });
  if (result.typeMeta?.cardTypes)  applyTypeMeta({ cardTypes: result.typeMeta.cardTypes });
  if (result.typeMeta?.rarities)   applyTypeMeta({ rarities: result.typeMeta.rarities });
  if (result.rules)                applyRules(result.rules);
  if (result.shopData) {
    // Convert shop background ArrayBuffers to blob URLs before applying
    if (result.rawShopBackgrounds) {
      const resolvedBgs: Record<string, string> = {};
      for (const [key, buf] of result.rawShopBackgrounds) {
        resolvedBgs[key] = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
      }
      result.shopData.backgrounds = resolvedBgs;
    }
    applyShopData(result.shopData as unknown as Partial<ShopData>);
  }
  if (result.campaignData) applyCampaignData(result.campaignData as unknown as CampaignData);

  // Pick the best opponent description locale
  const oppDescs = result.opponentDescriptions?.get(lang)
    ?? (result.opponentDescriptions?.size ? result.opponentDescriptions.values().next().value! : undefined);

  console.log('[tcg-bridge] loadTcgFile result:', {
    hasOpponents: !!result.opponents,
    opponentCount: result.opponents?.length,
    hasOppDescs: result.opponentDescriptions?.size,
    lang,
  });
  if (result.opponents) {
    const opponentIds = applyOpponents(result.opponents, oppDescs);
    console.log('[tcg-bridge] Applied', opponentIds.length, 'opponents:', opponentIds);
    mod.opponentIds.push(...opponentIds);
  } else {
    console.warn('[tcg-bridge] No opponents found in TCG file!');
  }
  if (result.fusionFormulas) applyFusionFormulas(result.fusionFormulas, result.warnings);

  loadedMods.push(mod);
  currentManifest = result.manifest ?? null;

  return {
    cards: result.cards,
    parsedCards: result.parsedCards,
    images,
    manifest: result.manifest,
    warnings: result.warnings,
  };
}

/**
 * Partial unload — removes cards and opponents added by this mod only.
 * Does NOT revert: fusion recipes/formulas, shop data, campaign data, rules, or type metadata.
 */
export function unloadModCards(source: string): boolean {
  console.warn('[EOS] unloadModCards: partial unload — fusion formulas, shop data, campaign data, rules, and type metadata from this mod are NOT reverted.');
  const idx = loadedMods.findIndex(m => m.source === source);
  if (idx === -1) return false;
  const mod = loadedMods[idx];
  for (const id of mod.cardIds) delete CARD_DB[id];
  for (const id of mod.opponentIds) {
    const oi = OPPONENT_CONFIGS.findIndex(o => o.id === id);
    if (oi !== -1) OPPONENT_CONFIGS.splice(oi, 1);
  }
  loadedMods.splice(idx, 1);
  return true;
}

/** List all currently loaded mods. */
export function getLoadedMods(): readonly LoadedMod[] {
  return loadedMods;
}

interface TcgLocale {
  cards?: Record<string, { name: string; description: string }>;
  opponents?: Record<string, { name: string; title: string; flavor: string }>;
  races?: Record<string, string>;
  attributes?: Record<string, string>;
  cardTypes?: Record<string, string>;
  shop?: Record<string, { name: string; desc: string }>;
}

/** Cache of locale data extracted from .tcg archives. */
const localeCache = new Map<string, TcgLocale>();

async function extractExtraDataFromZip(buffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);

  // Try both root and tcg-src/ subdirectory for compatibility
  const starterDecksFile = zip.file('starterDecks.json') ?? zip.file('tcg-src/starterDecks.json');
  if (starterDecksFile) {
    const raw: Record<string, number[]> = JSON.parse(await starterDecksFile.async('string'));
    applyStarterDecks(raw);
  }

  const fusionRecipesFile = zip.file('fusion_recipes.json') ?? zip.file('tcg-src/fusion_recipes.json');
  if (fusionRecipesFile) {
    const raw = JSON.parse(await fusionRecipesFile.async('string'));
    applyFusionRecipes(raw);
  }

  // Extract opponents.json from tcg-src/ if present
  const opponentsFile = zip.file('tcg-src/opponents.json');
  if (opponentsFile) {
    console.log('[tcg-bridge] Found opponents.json in tcg-src/, will be loaded by loadTcgFile');
  }
}

const LOCALE_PATTERN = /^locales\/([a-z]{2}(?:-[A-Z]{2})?)\.json$/;

async function extractLocalesFromZip(buffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);
  const promises: Promise<void>[] = [];
  zip.forEach((relativePath, entry) => {
    const match = relativePath.match(LOCALE_PATTERN);
    if (match && !entry.dir) {
      promises.push(
        entry.async('string').then(text => {
          localeCache.set(match[1], JSON.parse(text));
        })
      );
    }
  });
  await Promise.all(promises);
}

function applyLocaleToStores(locale: TcgLocale): void {
  if (locale.cards) {
    for (const [id, trans] of Object.entries(locale.cards)) {
      const card = CARD_DB[id];
      if (card) {
        card.name = trans.name;
        card.description = trans.description;
      }
    }
  }

  if (locale.opponents) {
    for (const [id, trans] of Object.entries(locale.opponents)) {
      const opp = OPPONENT_CONFIGS.find(o => o.id === Number(id));
      if (opp) {
        opp.name = trans.name;
        opp.title = trans.title;
        opp.flavor = trans.flavor;
      }
    }
  }

  if (locale.races) {
    for (const meta of TYPE_META.races) {
      if (locale.races[meta.key]) meta.value = locale.races[meta.key];
    }
  }

  if (locale.attributes) {
    for (const meta of TYPE_META.attributes) {
      if (locale.attributes[meta.key]) meta.value = locale.attributes[meta.key];
    }
  }

  if (locale.cardTypes) {
    for (const meta of TYPE_META.cardTypes) {
      if (locale.cardTypes[meta.key]) meta.value = locale.cardTypes[meta.key];
    }
  }

  if (locale.shop) {
    for (const pkg of SHOP_DATA.packages) {
      const trans = locale.shop[pkg.id];
      if (trans) {
        pkg.name = trans.name;
        pkg.desc = trans.desc;
      }
    }
  }
}

/**
 * Apply a cached TCG locale for the given language.
 * Updates card names, opponent info, type metadata, and shop text in-place.
 * Falls back to 'en' if the requested locale is unavailable.
 * Locales are extracted from the .tcg archive during loadAndApplyTcg().
 */
export async function reloadTcgLocale(lang: string): Promise<void> {
  const locale = localeCache.get(lang) ?? localeCache.get('en');
  if (locale) applyLocaleToStores(locale);
}
