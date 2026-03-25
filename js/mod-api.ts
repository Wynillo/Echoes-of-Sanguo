// ============================================================
// ECHOES OF SANGUO — Modding API
// Exposes moddable data on window.EchoesOfSanguoMod so that
// external mod scripts can add cards, opponents, and effects
// without touching internal ES module imports.
// ============================================================
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS } from './cards.js';
import { EFFECT_REGISTRY, registerEffect } from './effect-registry.js';

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
};

window.EchoesOfSanguoMod = modApi;
