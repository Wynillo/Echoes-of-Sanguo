// ============================================================
// ECHOES OF SANGUO — Modding API
// Exposes moddable data on window.EchoesOfSanguoMod so that
// external mod scripts can add cards, opponents, and effects
// without touching internal ES module imports.
//
// SECURITY: Direct mutable references to internal state have
// been replaced with controlled access methods to prevent
// accidental or malicious corruption of game state.
// ============================================================
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS } from './cards.js';
import { EFFECT_REGISTRY, registerEffect } from './effect-registry.js';
import type { FusionRecipe, OpponentConfig, CardData } from './types.js';
import { loadAndApplyTcg, unloadModCards, getLoadedMods, getCurrentManifest } from './tcg-bridge.js';
import { TriggerBus } from './trigger-bus.js';

// Export types for modders
export type { FusionRecipe, OpponentConfig, CardData };

declare global {
  interface Window {
    EchoesOfSanguoMod: typeof modApi;
  }
}

const modApi = {
  /** Returns a read-only copy of the card database to prevent direct mutation. */
  getCardDb(): Readonly<Record<string, CardData>> {
    return { ...CARD_DB } as Readonly<Record<string, CardData>>;
  },
  /** Register a fusion recipe safely through controlled API. */
  registerFusion(recipe: FusionRecipe): void {
    FUSION_RECIPES.push(recipe);
  },
  /** Register an opponent config safely through controlled API. */
  registerOpponent(config: OpponentConfig): void {
    OPPONENT_CONFIGS.push(config);
  },
  /** Register a starter deck safely through controlled API. */
  registerStarterDeck(deckId: number, cards: string[]): void {
    STARTER_DECKS[deckId] = cards;
  },
  /** Read-only view of all registered effect implementations. */
  EFFECT_REGISTRY,
  /** Register a custom effect handler (type string → EffectImpl). */
  registerEffect,
  /** Load a community .tcg archive and merge its cards into the game. */
  loadModTcg: loadAndApplyTcg,
  /** Partial unload: removes cards and opponents only. Fusion recipes, shop data, etc. are NOT reverted. */
  unloadModCards,
  /** List all currently loaded mods with their card IDs and load order. */
  getLoadedMods,
  /** Get the manifest of the currently loaded TCG mod, or null if none loaded. */
  getCurrentManifest,
  /** Fire effects with a custom trigger name. */
  emitTrigger: TriggerBus.emit,
  /** Subscribe to a trigger event (returns unsubscribe function). */
  addTriggerHook: TriggerBus.on,
};

window.EchoesOfSanguoMod = modApi;
