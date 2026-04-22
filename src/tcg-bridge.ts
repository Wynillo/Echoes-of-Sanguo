import { loadTcgFile, TcgNetworkError, TcgFormatError } from '@wynillo/tcg-format';
import JSZip from 'jszip';
import i18next from 'i18next';
import path from 'path';
import type { TcgLoadResult, TcgParsedCard, TcgOpponentDeck, TcgOpponentDescription, TcgFusionFormula, TcgManifest } from '@wynillo/tcg-format';
import type { CardData, FusionRecipe, FusionFormula, FusionComboType, OpponentConfig } from './types.js';
import { CardType } from './types.js';
import { CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from './cards.js';
import { intToTrapTrigger, isTrapTrigger } from './enums.js';
import { isValidEffectString, parseEffectString } from './effect-serializer.js';
import { applyRules, GAME_RULES, type GameRules } from './rules.js';
import { applyTypeMeta, rebuildIndices, type TypeMetaData } from './type-metadata.js';
import { applyShopData, SHOP_DATA, type ShopData } from './shop-data.js';
import { applyCampaignData, CAMPAIGN_DATA } from './campaign-store.js';
import type { CampaignData } from './campaign-types.js';
import { TYPE_META } from './type-metadata.js';

// Re-export error classes for consumers
export { TcgNetworkError, TcgFormatError };

/**
 * Verifies the integrity of a mod archive using SHA-256 hash.
 * SECURITY: Critical security check for Subresource Integrity (SRI).
 * 
 * @param buffer - The ArrayBuffer containing the .tcg archive
 * @param expectedHash - The expected SHA-256 hash (base64, hex, or with sha256- prefix)
 * @returns Promise resolving to true if hash matches, false otherwise
 * 
 * Supports hash formats:
 * - Base64: 'dGhpcyBpcyBhIHRlc3Q='
 * - Hex: '68656c6c6f20776f726c64'
 * - SRI: 'sha256-dGhpcyBpcyBhIHRlc3Q=' (W3C SRI format)
 * 
 * Use this function before applying any mod from an external source.
 * See issue #461 for security context.
 */
export async function verifyModIntegrity(buffer: ArrayBuffer, expectedHash: string): Promise<boolean> {
  try {
    // Normalize hash format (remove sha256- prefix if present)
    let normalizedHash = expectedHash;
    if (normalizedHash.toLowerCase().startsWith('sha256-')) {
      normalizedHash = normalizedHash.substring(7);
    }

    // Compute SHA-256 hash of the buffer using Web Crypto API
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = new Uint8Array(hashBuffer);
    
    // Convert to base64 for comparison
    const actualHashBase64 = uint8ArrayToBase64(hashArray);
    
    // Convert to hex for comparison
    const actualHashHex = uint8ArrayToHex(hashArray);
    
    // Normalize expected hash (handle both base64 and hex)
    const isHex = /^[0-9a-f]+$/i.test(normalizedHash);
    
    // Compare hashes (hex is case-insensitive, base64 is case-sensitive)
    const matches = isHex 
      ? actualHashHex === normalizedHash.toLowerCase()
      : actualHashBase64 === normalizedHash;
    
    return matches;
  } catch (error) {
    console.error('[verifyModIntegrity] Hash verification failed:', error);
    return false;
  }
}

/**
 * Converts Uint8Array to base64 string.
 * @param bytes - The byte array to convert
 * @returns Base64 encoded string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Use native btoa for browser environment
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Uint8Array to hex string.
 * @param bytes - The byte array to convert
 * @returns Hex encoded string (lowercase)
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const rid = (numId: number): string => String(numId);

/**
 * Deep clone a value using structuredClone (native) with JSON fallback.
 * Handles arrays, plain objects, primitives. Does NOT handle functions, Map, Set, or circular refs.
 */
function deepClone<T>(obj: T): T {
  try {
    return structuredClone(obj);
  } catch {
    // Fallback for environments without structuredClone
    return JSON.parse(JSON.stringify(obj));
  }
}

interface ModStateSnapshot {
  /** Deep clone of SHOP_DATA before mod was applied */
  shopData?: ShopData;
  /** Deep clone of TYPE_META before mod was applied */
  typeMeta?: TypeMetaData;
  /** Deep clone of CAMPAIGN_DATA before mod was applied */
  campaignData?: CampaignData;
  /** Deep clone of GAME_RULES before mod was applied */
  rules?: Partial<GameRules>;
  /** Deep clone of STARTER_DECKS before mod was applied */
  starterDecks?: Record<number, string[]>;
  /** Track which keys were modified (for selective restore) */
  modifiedKeys: {
    shop?: Array<'packs' | 'currencies' | 'backgrounds'>;
    typeMeta?: Array<'races' | 'attributes' | 'rarities' | 'cardTypes'>;
    rules?: string[];
    starterDecks?: number[];
  };
}

const modSnapshots = new Map<string, ModStateSnapshot>();

interface LoadedMod {
  source: string;
  cardIds: string[];
  opponentIds: number[];
  timestamp: number;
  manifest?: TcgManifest;
  /** Number of fusion recipes added by this mod */
  recipeCount: number;
  /** Number of fusion formulas added by this mod */
  formulaCount: number;
  /** State of PLAYER_DECK_IDS and OPPONENT_DECK_IDS before mod loaded */
  deckIdSpliceState?: {
    playerDeckIds: string[];
    opponentDeckIds: string[];
  };
  /** Points to snapshot in modSnapshots - which keys to restore */
  snapshotKeys?: ModStateSnapshot['modifiedKeys'];
}
const loadedMods: LoadedMod[] = [];

let currentManifest: TcgManifest | null = null;

export function getCurrentManifest(): TcgManifest | null {
  return currentManifest;
}

/**
 * Detects potentially malicious HTML/script content in card descriptions.
 * Returns true if suspicious patterns are found.
 */
function containsMaliciousContent(description: string): boolean {
  const suspiciousPatterns = [
    /<\s*script/i,           // Script tags
    /<\s*img[^>]*onerror/i,  // Image with onerror handler
    /<\s*svg[^>]*onload/i,   // SVG with onload handler
    /javascript\s*:/i,       // JavaScript protocol
    /on\w+\s*=/i,            // Event handlers (onclick, onerror, onload, etc.)
    /<\s*iframe/i,           // iframe tags
    /<\s*object/i,           // Object tags
    /<\s*embed/i,            // Embed tags
    /expression\s*\(/i,      // CSS expression (IE)
    /url\s*\(\s*['"]?\s*javascript/i,  // CSS url with javascript
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(description)) {
      return true;
    }
  }
  return false;
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

  // Validate card description for potential XSS attacks
  if (p.description && containsMaliciousContent(p.description)) {
    warnings.push(`Card #${p.id} (${p.name}): description contains potentially malicious HTML/script content — will be sanitized on rendering`);
  }

  const card: CardData = {
    id:          String(p.id),
    name:        p.name,
    type:        p.type,
    description: p.description,
    level:       p.level ?? undefined,
    rarity:      p.rarity,
  };

  if (p.atk !== undefined) card.atk = p.atk;
  if (p.def !== undefined) card.def = p.def;
  if (p.attribute !== undefined && p.attribute > 0) card.attribute = p.attribute;
  if (p.race !== undefined && p.race > 0) card.race = p.race; 
  if (parsedEffect.effect)   card.effect  = parsedEffect.effect;
  if (parsedEffect.effects)  card.effects = parsedEffect.effects;

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

  if (!card.trapTrigger && p.type === CardType.Trap && card.effect) {
    const trigger = card.effect.trigger;
    if (isTrapTrigger(trigger)) card.trapTrigger = trigger;
  }

  if (p.target)      card.target      = p.target;
  if (p.atkBonus !== undefined) card.atkBonus = p.atkBonus;
  if (p.defBonus !== undefined) card.defBonus = p.defBonus;
  if (p.equipReqRace !== undefined || p.equipReqAttr !== undefined) {
    card.equipRequirement = {};
    if (p.equipReqRace !== undefined) {
      try { card.equipRequirement.race = p.equipReqRace; }
      catch { warnings.push(`Card #${p.id}: invalid equipReqRace ${p.equipReqRace}`); }
    }
    if (p.equipReqAttr !== undefined) {
      try { card.equipRequirement.attr = p.equipReqAttr; }
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
      name:       desc?.name ?? o.name ?? `Opponent #${o.id}`,
      title:      desc?.title ?? o.title ?? '',
      race:       o.race,
      flavor:     desc?.flavor ?? o.flavor ?? '',
      coinsWin:   o.coinsWin,
      coinsLoss:  o.coinsLoss,
      deckIds:    o.deckIds.map(rid),
      behaviorId: o.behaviorId,
      currencyId: o.currencyId,
      rewardConfig: o.rewardConfig as any,
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

export interface BridgeLoadResult {
  cards: TcgLoadResult['cards'];
  parsedCards: TcgLoadResult['parsedCards'];
  manifest?: TcgManifest;
  warnings: string[];
}

async function resolveToBuffer(source: string | ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof source === 'string') {
    const res = await fetch(source, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    if (!res.ok) throw new TcgNetworkError(source, res.status);
    return await res.arrayBuffer();
  }
  return source;
}

async function extractAuxiliaryData(buffer: ArrayBuffer): Promise<void> {
  await Promise.all([
    extractLocalesFromZip(buffer),
    extractExtraDataFromZip(buffer),
  ]);
}

async function extractOpponentsFromZip(buffer: ArrayBuffer, result: TcgLoadResult): Promise<void> {
  console.warn('[tcg-bridge] loadTcgFile returned no opponents, attempting manual extraction...');
  try {
    const zip = await JSZip.loadAsync(buffer);
    const oppFile = zip.file('opponents.json');
    if (oppFile) {
      const rawOpponents = JSON.parse(await oppFile.async('string')) as TcgOpponentDeck[];
      result.opponents = rawOpponents;
      console.log('[tcg-bridge] Successfully extracted opponents.json manually');
    }
  } catch (e) {
    console.error('[tcg-bridge] Failed to manually extract opponents:', e);
  }
}

async function processTcgData(
  result: TcgLoadResult,
  buffer: ArrayBuffer,
  lang: string,
  mod: LoadedMod,
  starterDecksBefore: Record<number, string[]>,
): Promise<void> {
  if (!result.opponents || result.opponents.length === 0) {
    await extractOpponentsFromZip(buffer, result);
  }

  // Capture BEFORE state for objects (selective snapshot)
  const snapshot: ModStateSnapshot = { modifiedKeys: {} };
  const snapshotKeys: ModStateSnapshot['modifiedKeys'] = {};

  // STARTER_DECKS snapshot (passed from loadAndApplyTcg since starterDecks are set during extractAuxiliaryData)
  if (Object.keys(starterDecksBefore).length > 0) {
    snapshot.starterDecks = starterDecksBefore;
    snapshotKeys.starterDecks = Object.keys(starterDecksBefore).map(Number);
  }
  
  // TYPE_META snapshot (only if will be modified)
  if (result.typeMeta) {
    snapshot.typeMeta = {
      races: deepClone(TYPE_META.races),
      attributes: deepClone(TYPE_META.attributes),
      rarities: deepClone(TYPE_META.rarities),
      cardTypes: deepClone(TYPE_META.cardTypes),
    };
    const keys: Array<'races' | 'attributes' | 'rarities' | 'cardTypes'> = [];
    if (result.typeMeta.races) keys.push('races');
    if (result.typeMeta.attributes) keys.push('attributes');
    if (result.typeMeta.rarities) keys.push('rarities');
    if (result.typeMeta.cardTypes) keys.push('cardTypes');
    if (keys.length > 0) snapshotKeys.typeMeta = keys;
  }
  
  // RULES snapshot (only if will be modified)
  if (result.rules) {
    snapshot.rules = deepClone(GAME_RULES);
    snapshotKeys.rules = Object.keys(result.rules);
  }
  
  // SHOP_DATA snapshot (only if will be modified)
  if (result.shopData) {
    snapshot.shopData = deepClone(SHOP_DATA);
    const keys: Array<'packs' | 'currencies' | 'backgrounds'> = [];
    if (result.shopData.packs) keys.push('packs');
    if (result.shopData.currencies) keys.push('currencies');
    if (result.shopData.backgrounds) keys.push('backgrounds');
    if (keys.length > 0) snapshotKeys.shop = keys;
  }
  
  // CAMPAIGN_DATA snapshot (only if will be modified)
  if (result.campaignData) {
    snapshot.campaignData = deepClone(CAMPAIGN_DATA);
    snapshotKeys.campaignData = true;
  }
  
  if (Object.keys(snapshotKeys).length > 0) {
    snapshot.modifiedKeys = snapshotKeys;
    modSnapshots.set(mod.source, snapshot);
    mod.snapshotKeys = snapshotKeys;
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

  if (result.typeMeta?.races)      applyTypeMeta({ races: result.typeMeta.races.map(r => ({ ...r, value: r.value ?? r.key })) });
  if (result.typeMeta?.attributes) applyTypeMeta({ attributes: result.typeMeta.attributes.map(a => ({ ...a, value: a.value ?? a.key })) });
  if (result.typeMeta?.cardTypes)  applyTypeMeta({ cardTypes: result.typeMeta.cardTypes.map(c => ({ ...c, value: c.value ?? c.key })) });
  if (result.typeMeta?.rarities)   applyTypeMeta({ rarities: result.typeMeta.rarities.map(r => ({ ...r, value: r.value ?? r.key })) });
  if (result.rules)                applyRules(result.rules);
  if (result.shopData) {
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

  const oppDescs = result.opponentDescriptions?.get(lang)
    ?? (result.opponentDescriptions?.size ? result.opponentDescriptions.values().next().value! : undefined);

  if (result.opponents) {
    const opponentIds = applyOpponents(result.opponents, oppDescs);
    mod.opponentIds.push(...opponentIds);
  }
  if (result.fusionFormulas) applyFusionFormulas(result.fusionFormulas, result.warnings);
}

function formatResult(result: TcgLoadResult): BridgeLoadResult {
  return {
    cards: result.cards,
    parsedCards: result.parsedCards,
    manifest: result.manifest,
    warnings: result.warnings,
  };
}

export async function loadAndApplyTcg(
  source: string | ArrayBuffer,
  options?: { lang?: string; onProgress?: (percent: number) => void },
): Promise<BridgeLoadResult> {
  const buffer = await resolveToBuffer(source);
  
  // Count recipes/formulas BEFORE extraction to track delta
  const recipeCountBefore = FUSION_RECIPES.length;
  const formulaCountBefore = FUSION_FORMULAS.length;
  const deckIdSpliceState = {
    playerDeckIds: [...PLAYER_DECK_IDS],
    opponentDeckIds: [...OPPONENT_DECK_IDS],
  };
  const starterDecksBefore = deepClone(STARTER_DECKS);
  
  await extractAuxiliaryData(buffer);
  
  // Track delta from auxiliary extraction
  const recipeDeltaFromAux = FUSION_RECIPES.length - recipeCountBefore;

  const lang = options?.lang ?? (typeof navigator !== 'undefined' ? navigator.language.substring(0, 2) : '');
  const result = await loadTcgFile(buffer, { lang, onProgress: options?.onProgress });

  const mod: LoadedMod = {
    source: typeof source === 'string' ? source : '<ArrayBuffer>',
    cardIds: [], opponentIds: [], timestamp: Date.now(),
    manifest: result.manifest,
    recipeCount: FUSION_RECIPES.length,
    formulaCount: FUSION_FORMULAS.length,
    deckIdSpliceState,
  };

  await processTcgData(result, buffer, lang, mod, starterDecksBefore);
  
  // Add recipe delta from auxiliary extraction to tracking
  mod.recipeCount = FUSION_RECIPES.length;

  loadedMods.push(mod);
  currentManifest = result.manifest ?? null;

  return formatResult(result);
}

/**
 * Completely unload a mod by reverting ALL state changes.
 * Removes cards, opponents, fusion recipes/formulas, and restores snapshots of modified stores.
 */
export function unloadModCompletely(source: string): boolean {
  const idx = loadedMods.findIndex(m => m.source === source);
  if (idx === -1) return false;
  
  const mod = loadedMods[idx];
  
  // 1. Remove cards (existing behavior)
  for (const id of mod.cardIds) delete CARD_DB[id];
  
  // 2. Remove opponents (existing behavior)
  for (const id of mod.opponentIds) {
    const oi = OPPONENT_CONFIGS.findIndex(o => o.id === id);
    if (oi !== -1) OPPONENT_CONFIGS.splice(oi, 1);
  }
  
  // 3. Truncate fusion recipes to pre-mod count
  const recipeCountBefore = mod.recipeCount;
  FUSION_RECIPES.splice(recipeCountBefore);
  
  // 4. Truncate fusion formulas to pre-mod count
  const formulaCountBefore = mod.formulaCount;
  FUSION_FORMULAS.splice(formulaCountBefore);
  
  // 5. Restore deck ID arrays to pre-mod state
  if (mod.deckIdSpliceState) {
    PLAYER_DECK_IDS.splice(0, PLAYER_DECK_IDS.length, ...mod.deckIdSpliceState.playerDeckIds);
    OPPONENT_DECK_IDS.splice(0, OPPONENT_DECK_IDS.length, ...mod.deckIdSpliceState.opponentDeckIds);
  }
  
  // 6. Restore snapshots of modified stores
  const snapshot = modSnapshots.get(source);
  if (snapshot) {
    if (snapshot.starterDecks) {
      Object.assign(STARTER_DECKS, snapshot.starterDecks);
    }
    
    if (snapshot.typeMeta) {
      if (snapshot.modifiedKeys.typeMeta?.includes('races')) {
        TYPE_META.races = deepClone((snapshot.typeMeta as any).races);
      }
      if (snapshot.modifiedKeys.typeMeta?.includes('attributes')) {
        TYPE_META.attributes = deepClone((snapshot.typeMeta as any).attributes);
      }
      if (snapshot.modifiedKeys.typeMeta?.includes('rarities')) {
        TYPE_META.rarities = deepClone((snapshot.typeMeta as any).rarities);
      }
      if (snapshot.modifiedKeys.typeMeta?.includes('cardTypes')) {
        TYPE_META.cardTypes = deepClone((snapshot.typeMeta as any).cardTypes);
      }
      // Rebuild indices after restoring type metadata
      rebuildIndices();
    }
    
    if (snapshot.rules) {
      Object.assign(GAME_RULES, snapshot.rules);
    }
    
    if (snapshot.shopData) {
      if (snapshot.modifiedKeys.shop?.includes('packs')) {
        SHOP_DATA.packs = deepClone((snapshot.shopData as any).packs);
      }
      if (snapshot.modifiedKeys.shop?.includes('currencies')) {
        SHOP_DATA.currencies = deepClone((snapshot.shopData as any).currencies);
      }
      if (snapshot.modifiedKeys.shop?.includes('backgrounds')) {
        SHOP_DATA.backgrounds = deepClone((snapshot.shopData as any).backgrounds);
      }
    }
    
    if (snapshot.campaignData) {
      CAMPAIGN_DATA.chapters = deepClone((snapshot.campaignData as any).chapters);
    }
    
    modSnapshots.delete(source);
  }
  
  loadedMods.splice(idx, 1);
  return true;
}

/**
 * @deprecated Use unloadModCompletely instead. Alias for backwards compatibility.
 */
export function unloadModCards(source: string): boolean {
  return unloadModCompletely(source);
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

// Locale cache eviction policy
const MAX_LOCALE_CACHE_SIZE = 10; // Maximum languages to cache

/**
 * Validates that a file path within a ZIP archive is safe and doesn't contain directory traversal.
 * Uses path.resolve canonicalization to prevent Zip Slip vulnerability.
 * See: https://snyk.io/research/zip-slip-vulnerability
 */
function validateZipPath(filePath: string): void {
  // Normalize path separators to forward slashes
  const normalized = filePath.replace(/\\/g, '/');
  
  // Reject absolute paths (Unix or Windows style)
  if (normalized.startsWith('/') || normalized.startsWith('\\') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Invalid path in ZIP archive: "${filePath}" - absolute paths not allowed`);
  }
  
  // Normalize the path and check for directory traversal
  const resolvedPath = path.normalize(normalized);
  
  // After normalization, the path should not escape the current directory
  // path.normalize will convert "foo/../bar" to "bar", but ".." or "foo/../../bar" 
  // will still start with ".." indicating traversal attempt
  if (resolvedPath.startsWith('..') || resolvedPath.startsWith('/') || resolvedPath.startsWith('\\')) {
    throw new Error(`Invalid path in ZIP archive: "${filePath}" - directory traversal not allowed`);
  }
  
  // Double-check: resolved path should not contain ".." segments
  if (resolvedPath.includes('..')) {
    throw new Error(`Invalid path in ZIP archive: "${filePath}" - directory traversal not allowed`);
  }
}

async function extractExtraDataFromZip(buffer: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);

  // Validate all file paths in the ZIP to prevent Zip Slip vulnerability
  zip.forEach((relativePath, entry) => {
    if (!entry.dir) {
      validateZipPath(relativePath);
    }
  });

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
  const newLocales: Array<{ lang: string; locale: TcgLocale }> = [];
  
  zip.forEach((relativePath, entry) => {
    const match = relativePath.match(LOCALE_PATTERN);
    if (match && !entry.dir) {
      // Validate path before processing (Zip Slip protection)
      validateZipPath(relativePath);
      promises.push(
        entry.async('string').then(text => {
          newLocales.push({ lang: match[1], locale: JSON.parse(text) });
        })
      );
    }
  });
  
  await Promise.all(promises);
  
  for (const { lang, locale } of newLocales) {
    if (localeCache.has(lang)) {
      localeCache.delete(lang);
    }
    localeCache.set(lang, locale);
    
    while (localeCache.size > MAX_LOCALE_CACHE_SIZE) {
      const firstKey = localeCache.keys().next().value;
      if (firstKey) {
        localeCache.delete(firstKey);
        console.log(`[tcg-bridge] Evicted locale "${firstKey}" from cache (limit: ${MAX_LOCALE_CACHE_SIZE})`);
      }
    }
  }
}

function applyLocaleToStores(locale: TcgLocale, lang: string): void {
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

  const cardsPatch: Record<string, string> = {};

  if (locale.races) {
    for (const meta of TYPE_META.races) {
      if (locale.races[meta.key]) {
        meta.value = locale.races[meta.key];
        cardsPatch[`race_${meta.key}`] = locale.races[meta.key];
      }
    }
  }

  if (locale.attributes) {
    for (const meta of TYPE_META.attributes) {
      if (locale.attributes[meta.key]) {
        meta.value = locale.attributes[meta.key];
        cardsPatch[`attr_${meta.key.toLowerCase()}`] = locale.attributes[meta.key];
      }
    }
  }

  if (locale.cardTypes) {
    for (const meta of TYPE_META.cardTypes) {
      if (locale.cardTypes[meta.key]) meta.value = locale.cardTypes[meta.key];
    }
  }

  if (locale.shop) {
    for (const pkg of SHOP_DATA.packs) {
      const trans = locale.shop[pkg.id];
      if (trans) {
        pkg.name = trans.name;
        pkg.desc = trans.desc;
      }
    }
  }

  if (Object.keys(cardsPatch).length > 0) {
    i18next.addResourceBundle(lang, 'translation', { cards: cardsPatch }, true, true);
  }
}

/**
 * Apply a cached TCG locale for the given language.
 * Updates card names, opponent info, type metadata, and shop text in-place.
 * Falls back to 'en' if the requested locale is unavailable.
 * Locales are extracted from the .tcg archive during loadAndApplyTcg().
 */
export async function reloadTcgLocale(lang: string): Promise<void> {
  const effectiveLang = localeCache.has(lang) ? lang : 'en';
  const locale = localeCache.get(effectiveLang);
  if (locale) applyLocaleToStores(locale, effectiveLang);
}
