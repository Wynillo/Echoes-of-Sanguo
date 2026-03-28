// ============================================================
// ECHOES OF SANGUO — Modding API
// Exposes moddable data on window.EchoesOfSanguoMod so that
// external mod scripts can add cards, opponents, and effects
// without touching internal ES module imports.
// ============================================================
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS } from './cards.js';
import { EFFECT_REGISTRY, registerEffect } from './effect-registry.js';
import { loadAndApplyTcg, unloadModCards, getLoadedMods } from './tcg-bridge.js';
import { TriggerBus } from './trigger-bus.js';

declare global {
  interface Window {
    EchoesOfSanguoMod: typeof modApi;
  }
}

const modApi = {
  /** Live reference — add entries here to register new cards. */
  CARD_DB,
  /** Live reference — push FusionRecipe objects to add fusions. */
  FUSION_RECIPES,
  /** Live reference — push OpponentConfig objects to add opponents. */
  OPPONENT_CONFIGS,
  /** Live reference — add keys here to define new starter decks. */
  STARTER_DECKS,
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
  /** Fire effects with a custom trigger name. */
  emitTrigger: TriggerBus.emit,
  /** Subscribe to a trigger event (returns unsubscribe function). */
  addTriggerHook: TriggerBus.on,
};

window.EchoesOfSanguoMod = modApi;
