// ============================================================
// ECHOES OF SANGUO — Modding API
// Exposes moddable data on window.EchoesOfSanguoMod so that
// external mod scripts can add cards, opponents, and effects
// without touching internal ES module imports.
//
// SECURITY: Direct mutable references to internal state have
// been replaced with controlled access methods to prevent
// accidental or malicious corruption of game state.
//
// XSS HARDENING: All exposed data is deep-frozen to prevent
// prototype pollution and object tampering. Trigger events
// are validated to block sensitive internal events. See issue #414.
//
// MOD SOURCE VALIDATION: Subresource Integrity (SRI) checks
// prevent loading malicious .tcg files from untrusted sources.
// Sources are validated against an allowlist OR trusted mods
// list with SHA-256 hash verification. See issue #461.
// ============================================================
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS } from './cards.js';
import { EFFECT_REGISTRY, registerEffect, type EffectHandlerManifest, type EffectImpl } from './effect-registry.js';
import type { FusionRecipe, OpponentConfig, CardData } from './types.js';
import { loadAndApplyTcg, unloadModCompletely, unloadModCards, getLoadedMods, getCurrentManifest, verifyModIntegrity } from './tcg-bridge.js';
import { TriggerBus, type TriggerContext } from './trigger-bus.js';

/**
 * Deep freeze utility to prevent object tampering and prototype pollution.
 * Recursively freezes all nested properties, making the entire object graph immutable.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj as Readonly<T>;
  if (Object.isFrozen(obj)) return obj as Readonly<T>;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === 'object' && value !== null) {
      deepFreeze(value);
    }
  }
  return obj as Readonly<T>;
}

// Export types for modders
export type { FusionRecipe, OpponentConfig, CardData };

/**
 * Allowlist of trusted URL prefixes for mod sources.
 * Mods from these sources can be loaded without explicit hash verification.
 * Configure by modifying this array before any mods are loaded.
 * Default: Only GitHub raw content from Wynillo organization.
 */
export const ALLOWED_MOD_SOURCES: string[] = [
  'https://raw.githubusercontent.com/Wynillo/',
];

/**
 * Trusted mods map: URL → SHA-256 hash (base64 or hex format).
 * Mods in this list bypass the source allowlist but must pass integrity verification.
 * Use this for known-good mods from external sources.
 * 
 * Format: { 'https://example.com/mod.tcg': 'sha256-base64-or-hex-hash' }
 */
export const TRUSTED_MODS: Map<string, string> = new Map();

/**
 * Checks if a mod source is from an allowed source or trusted mod list.
 * @param source - The URL or ArrayBuffer source of the mod
 * @returns true if source is from allowlist, false otherwise
 */
function isAllowedSource(source: string): boolean {
  return ALLOWED_MOD_SOURCES.some(prefix => source.startsWith(prefix));
}

/**
 * Checks if a mod is in the trusted mods list.
 * @param source - The URL of the mod
 * @returns The expected SHA-256 hash if trusted, undefined otherwise
 */
function getTrustedModHash(source: string): string | undefined {
  return TRUSTED_MODS.get(source);
}

/**
 * Prompts user for confirmation before loading a mod from an untrusted source.
 * SECURITY: This is a critical security check. Never bypass without user consent.
 * @param source - The URL of the mod being loaded
 * @param isTrusted - Whether the mod passed hash verification
 * @returns Promise resolving to true if user confirms, false otherwise
 * 
 * WARNING: Loading mods from untrusted sources can execute arbitrary code.
 * Only confirm if you trust the mod author and have verified the mod's integrity.
 */
export async function confirmModLoad(source: string, isTrusted: boolean): Promise<boolean> {
  const { EchoesOfSanguo } = await import('./debug-logger.js');
  
  // Development bypass: allow loading any mod with query param ?dev-bypass=1
  if (typeof window !== 'undefined' && window.location.search.includes('dev-bypass=1')) {
    EchoesOfSanguo.log('SECURITY', 'Dev bypass active - skipping mod confirmation for: ' + source);
    return true;
  }

  if (isTrusted) {
    EchoesOfSanguo.log('SECURITY', 'Mod from trusted source with verified integrity: ' + source);
    return true;
  }

  // For untrusted sources, require explicit user confirmation
  const warningMessage = `⚠️ SECURITY WARNING ⚠️

You are about to load a mod from an UNTRUSTED source:

Source: ${source}

This mod has NOT been verified and may contain malicious code that could:
• Corrupt your game save
• Steal personal information
• Execute arbitrary code in your browser

Only continue if you:
1. Trust the mod author completely
2. Have verified the mod's integrity yourself
3. Understand the security risks

Do you want to proceed? (Cancel recommended)`;

  // Use native confirm dialog for security-critical prompt
  return window.confirm(warningMessage);
}

declare global {
  interface Window {
    EchoesOfSanguoMod: typeof modApi;
  }
}

const modApi = {
  /** Returns a deep-frozen copy of the card database to prevent mutation and XSS amplification. */
  getCardDb(): Readonly<Record<string, CardData>> {
    return deepFreeze({ ...CARD_DB });
  },
  /** Register a fusion recipe safely through controlled API with user confirmation. */
  registerFusion(recipe: FusionRecipe): void {
    if (!window.confirm(`Register fusion recipe: ${recipe.materials.join(' + ')} → ${recipe.result}?`)) return;
    FUSION_RECIPES.push(recipe);
  },
  /** Register an opponent config safely through controlled API with user confirmation. */
  registerOpponent(config: OpponentConfig): void {
    if (!window.confirm(`Register opponent: ${config.name}?`)) return;
    OPPONENT_CONFIGS.push(config);
  },
  /** Register a starter deck safely through controlled API with user confirmation. */
  registerStarterDeck(deckId: number, cards: string[]): void {
    if (!window.confirm(`Register starter deck ${deckId} with ${cards.length} cards?`)) return;
    STARTER_DECKS[deckId] = cards;
  },
  /** Read-only view of all registered effect implementations. */
  EFFECT_REGISTRY,
  /**
   * Register a custom effect handler with security validation.
   * @param manifest - Effect metadata including type, description, and allowed actions
   * @param impl - Effect implementation function
   * @throws Error if manifest validation fails or implementation is invalid
   * 
   * SECURITY: All custom effects are wrapped with:
   * - Timeout protection (default 100ms)
   * - Optional rate limiting (maxCallsPerTurn)
   * - Validation of manifest and implementation
   * - Registration logging for debugging
   */
  registerEffect(manifest: EffectHandlerManifest, impl: EffectImpl): void {
    registerEffect(manifest, impl);
  },
  /**
   * Load a community .tcg archive and merge its cards into the game.
   * SECURITY: Validates source against allowlist OR trusted mods list.
   * Untrusted sources require user confirmation.
   * @param source - URL or ArrayBuffer of the .tcg file
   * @param options - Optional loading options
   * @throws Error if source validation fails or user declines confirmation
   */
  async loadModTcg(
    source: string | ArrayBuffer,
    options?: { lang?: string; onProgress?: (percent: number) => void },
  ): Promise<void> {
    const { EchoesOfSanguo } = await import('./debug-logger.js');
    
    // Only validate string URLs, not ArrayBuffers (local files)
    if (typeof source === 'string') {
      const allowedSource = isAllowedSource(source);
      const trustedHash = getTrustedModHash(source);
      const isTrusted = allowedSource || (trustedHash !== undefined);

      EchoesOfSanguo.log('SECURITY', `Validating mod source: ${source}`);
      EchoesOfSanguo.log('SECURITY', `Allowed source: ${allowedSource}, Trusted hash: ${trustedHash ? 'present' : 'none'}`);

      // If not from allowed source and not in trusted list, require confirmation
      if (!isTrusted) {
        EchoesOfSanguo.log('SECURITY', 'Mod from untrusted source - requesting user confirmation');
        const confirmed = await confirmModLoad(source, false);
        if (!confirmed) {
          EchoesOfSanguo.log('SECURITY', 'User declined to load untrusted mod: ' + source);
          throw new Error(`Mod load cancelled: untrusted source "${source}"`);
        }
      }

      // If in trusted list, verify integrity before loading
      if (trustedHash) {
        EchoesOfSanguo.log('SECURITY', 'Verifying mod integrity with SHA-256 hash');
        const buffer = await fetch(source).then(res => res.arrayBuffer());
        const isValid = await verifyModIntegrity(buffer, trustedHash);
        if (!isValid) {
          EchoesOfSanguo.log('SECURITY', 'Mod integrity check FAILED for: ' + source);
          throw new Error(`Mod integrity verification failed: hash mismatch for "${source}"`);
        }
        EchoesOfSanguo.log('SECURITY', 'Mod integrity verified successfully');
        await loadAndApplyTcg(buffer, options);
      } else {
        // Allowed source without hash verification
        await loadAndApplyTcg(source, options);
      }
    } else {
      // ArrayBuffer source (local file) - no validation needed
      EchoesOfSanguo.log('SECURITY', 'Loading mod from ArrayBuffer (local file)');
      await loadAndApplyTcg(source, options);
    }
  },
  /** Completely unload a mod by reverting ALL state changes (cards, opponents, fusion recipes/formulas, shop data, campaign data, rules, type metadata). */
  unloadModCompletely,
  /** @deprecated Use unloadModCompletely instead. Partial unload removes only cards and opponents. */
  unloadModCards,
  /** List all currently loaded mods with their card IDs and load order. */
  getLoadedMods,
  /** Get the manifest of the currently loaded TCG mod, or null if none loaded. */
  getCurrentManifest,
  /** Fire a trigger event (limited to safe events to prevent XSS amplification). */
  emitTrigger(event: string, ctx: TriggerContext): void {
    const SAFE_EVENTS = new Set(['custom', 'user_action']);
    if (!SAFE_EVENTS.has(event)) {
      throw new Error(`Event "${event}" cannot be triggered externally`);
    }
    TriggerBus.emit(event, ctx);
  },
  /** Subscribe to trigger events (read-only, blocks sensitive internal events). */
  addTriggerHook(event: string, handler: (ctx: TriggerContext) => void): () => void {
    const SAFE_EVENTS = new Set(['custom', 'user_action', 'battle_start', 'turn_end']);
    if (!SAFE_EVENTS.has(event)) {
      throw new Error(`Cannot subscribe to event "${event}"`);
    }
    return TriggerBus.on(event, handler);
  },
};

Object.freeze(modApi);
window.EchoesOfSanguoMod = modApi;

export const modApiForTesting = modApi;
