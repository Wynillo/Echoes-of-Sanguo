// ============================================================
// ECHOES OF SANGUO - Kartendatenbank
// Runtime data store — populated at startup by loading base.tcg
// ============================================================
import type { CardData, FusionRecipe, OpponentConfig } from './types.js';
import { CardType, Attribute, Race, Rarity } from './types.js';
import {
  getRaceByKey, getAttrByKey, getRarityById,
  getAllRaces, getAllRarities, TYPE_META,
} from './type-metadata.js';

export const TYPE = CardType;
export const RARITY = Rarity;

// ── Display helpers (backward-compatible re-exports from type-metadata) ──

/** @deprecated Use getRarityById() from type-metadata.ts instead */
export const RARITY_COLOR: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { const id = Number(prop); return getRarityById(id)?.color ?? '#aaa'; },
  ownKeys() { return TYPE_META.rarities.map(r => String(r.id)); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getRarityById() from type-metadata.ts instead */
export const RARITY_NAME: Record<number, string> = new Proxy({} as Record<number, string>, {
  get(_t, prop) { const id = Number(prop); return getRarityById(id)?.name ?? ''; },
  ownKeys() { return TYPE_META.rarities.map(r => String(r.id)); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getRaceByKey() from type-metadata.ts instead */
export const RACE_ICON: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getRaceByKey(String(prop))?.icon ?? ''; },
  ownKeys() { return TYPE_META.races.map(r => r.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getRaceByKey() from type-metadata.ts instead */
export const RACE_NAME: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getRaceByKey(String(prop))?.abbr ?? ''; },
  ownKeys() { return TYPE_META.races.map(r => r.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getAttrByKey() from type-metadata.ts instead */
export const ATTR_SYMBOL: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getAttrByKey(String(prop))?.symbol ?? '✦'; },
  ownKeys() { return TYPE_META.attributes.map(a => a.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

/** @deprecated Use getAttrByKey() from type-metadata.ts instead */
export const ATTR_NAME: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop) { return getAttrByKey(String(prop))?.name ?? ''; },
  ownKeys() { return TYPE_META.attributes.map(a => a.key); },
  getOwnPropertyDescriptor() { return { configurable: true, enumerable: true }; },
});

// ── Runtime data stores (populated by tcg-loader from base.tcg) ──
export const CARD_DB: Record<string, CardData> = {};
export const FUSION_RECIPES: FusionRecipe[] = [];
export const OPPONENT_CONFIGS: OpponentConfig[] = [];
export const STARTER_DECKS: Record<number, string[]> = {};
// Fallback deck IDs used by engine when no deck is specified — set from first starter deck
export const PLAYER_DECK_IDS: string[] = [];
export const OPPONENT_DECK_IDS: string[] = [];

export function makeDeck(ids: string[]): CardData[] {
  return ids.map(id => {
    const card = CARD_DB[id];
    if (!card.effect) return { ...card };
    // Deep-clone effect so deck copies don't share the same object references.
    return { ...card, effect: { ...card.effect } };
  });
}

export function checkFusion(id1: string, id2: string): FusionRecipe | null {
  return FUSION_RECIPES.find(r =>
    (r.materials[0]===id1 && r.materials[1]===id2) ||
    (r.materials[0]===id2 && r.materials[1]===id1)
  ) ?? null;
}
