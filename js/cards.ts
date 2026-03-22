// ============================================================
// AETHERIAL CLASH - Kartendatenbank
// Runtime data store — populated at startup by loading base.ac
// ============================================================
import type { CardData, FusionRecipe, OpponentConfig } from './types.js';
import { CardType, Attribute, Race, Rarity } from './types.js';

export const TYPE = CardType;
export const RARITY = Rarity;

// ── Runtime data stores (populated by ac-loader from base.ac) ──
export const CARD_DB: Record<string, CardData> = {};
export const FUSION_RECIPES: FusionRecipe[] = [];
export const OPPONENT_CONFIGS: OpponentConfig[] = [];
export const STARTER_DECKS: Record<number, string[]> = {};

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
