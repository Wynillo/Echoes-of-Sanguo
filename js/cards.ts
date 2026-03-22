// ============================================================
// ECHOES OF SANGUO - Kartendatenbank
// Runtime data store — populated at startup by loading base.ac
// ============================================================
import type { CardData, FusionRecipe, OpponentConfig } from './types.js';
import { CardType, Attribute, Race, Rarity } from './types.js';

export const TYPE = CardType;
export const RARITY = Rarity;

// ── Display helpers (static, used by React screens) ──────────
export const RARITY_COLOR: Record<number, string> = {
  [Rarity.Common]:    '#aaa',
  [Rarity.Uncommon]:  '#7ec8e3',
  [Rarity.Rare]:      '#f5c518',
  [Rarity.SuperRare]: '#c084fc',
  [Rarity.UltraRare]: '#f97316',
};

export const RARITY_NAME: Record<number, string> = {
  [Rarity.Common]:    'Common',
  [Rarity.Uncommon]:  'Uncommon',
  [Rarity.Rare]:      'Rare',
  [Rarity.SuperRare]: 'Super Rare',
  [Rarity.UltraRare]: 'Ultra Rare',
};

// Keys match i18n suffixes (cards.race_<key>) and old card string values
export const RACE_ICON: Record<string, string> = {
  feuer: '🔥', drache: '🐲', flug: '🦅', stein: '🪨',
  pflanze: '🌿', krieger: '⚔️', magier: '🔮',
  elfe: '✨', daemon: '💀', wasser: '🌊',
};

export const RACE_NAME: Record<string, string> = {
  feuer: 'Feuer', drache: 'Drache', flug: 'Flug', stein: 'Stein',
  pflanze: 'Pflanze', krieger: 'Krieger', magier: 'Magier',
  elfe: 'Elfe', daemon: 'Dämon', wasser: 'Wasser',
};

export const ATTR_SYMBOL: Record<string, string> = {
  fire: '♨', water: '◎', earth: '◆', wind: '∿', light: '☀', dark: '☽',
};

export const ATTR_NAME: Record<string, string> = {
  fire: 'Feuer', water: 'Wasser', earth: 'Erde', wind: 'Wind', light: 'Licht', dark: 'Dunkel',
};

// ── Runtime data stores (populated by ac-loader from base.ac) ──
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
