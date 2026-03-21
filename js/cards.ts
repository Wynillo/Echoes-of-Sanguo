// ============================================================
// AETHERIAL CLASH - Kartendatenbank
// Runtime data store — populated at startup by loading base.ac
// ============================================================
import type { CardData, FusionRecipe, OpponentConfig } from './types.js';
import { CardType, Attribute, Race, Rarity } from './types.js';

// Convenience aliases — these map the old constant names to the new enum values.
export const ATTR = Attribute;
export const TYPE = CardType;
export const RACE = Race;
export const RARITY = Rarity;

export const RACE_NAME: Record<number, string> = {
  [Race.Fire]: 'Feuer', [Race.Dragon]: 'Drache', [Race.Flyer]: 'Flug', [Race.Stone]: 'Stein',
  [Race.Plant]: 'Pflanze', [Race.Warrior]: 'Krieger', [Race.Spellcaster]: 'Magier',
  [Race.Elf]: 'Elfe', [Race.Demon]: 'Dämon', [Race.Water]: 'Wasser',
};

export const RACE_ICON: Record<number, string> = {
  [Race.Fire]: '🔥', [Race.Dragon]: '🐲', [Race.Flyer]: '🦅', [Race.Stone]: '🪨',
  [Race.Plant]: '🌿', [Race.Warrior]: '⚔️', [Race.Spellcaster]: '🔮',
  [Race.Elf]: '✨', [Race.Demon]: '💀', [Race.Water]: '🌊',
};

export const RARITY_NAME: Record<number, string> = {
  [Rarity.Common]: 'Common', [Rarity.Uncommon]: 'Uncommon', [Rarity.Rare]: 'Rare',
  [Rarity.SuperRare]: 'Super Rare', [Rarity.UltraRare]: 'Ultra Rare',
};

export const RARITY_COLOR: Record<number, string> = {
  [Rarity.Common]: '#aaa', [Rarity.Uncommon]: '#7ec8e3', [Rarity.Rare]: '#f5c518',
  [Rarity.SuperRare]: '#c084fc', [Rarity.UltraRare]: '#f97316',
};

export const ATTR_SYMBOL: Record<number, string> = {
  [Attribute.Fire]: '♨', [Attribute.Water]: '◎', [Attribute.Earth]: '◆',
  [Attribute.Wind]: '∿', [Attribute.Light]: '☀', [Attribute.Dark]: '☽',
};

export const ATTR_NAME: Record<number, string> = {
  [Attribute.Fire]: 'Feuer', [Attribute.Water]: 'Wasser', [Attribute.Earth]: 'Erde',
  [Attribute.Wind]: 'Wind', [Attribute.Light]: 'Licht', [Attribute.Dark]: 'Dunkel',
};

// ── Runtime data stores (populated by ac-loader from base.ac) ──
export const CARD_DB: Record<string, CardData> = {};
export const FUSION_RECIPES: FusionRecipe[] = [];
export const OPPONENT_CONFIGS: OpponentConfig[] = [];
export const STARTER_DECKS: Record<number, string[]> = {};

// ── Fallback decks (used when no saved deck exists) ──────────
export const PLAYER_DECK_IDS: string[] = [
  'M001','M001','M002','M002','M003','M003',
  'M004','M005','M006','M008',
  'M009','M019','M020','M022','M023',
  'S001','S002','S003','S005',
  'T001','T003'
];

export const OPPONENT_DECK_IDS: string[] = [
  'M002','M002','M003','M003','M004','M004',
  'M007','M007','M009','M009',
  'M024','M025','M026','M006',
  'M011','M016',
  'S001','S002','S004',
  'T002','T004'
];

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
