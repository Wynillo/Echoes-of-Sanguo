/**
 * Centralized color constants for rarity tiers and VFX.
 *
 * Design rationale:
 * - Rare (blue): Trust, stability, common magic elements
 * - Super Rare (gold): Prestige, value, achievement
 * - Ultra Rare (purple): Mystery, power, exclusivity
 *
 * Used across: CSS (PackOpeningScreen.module.css), PixiJS VFX (packReveal.ts), metadata (type-metadata.ts)
 */

export const RARITY_COLORS_HEX = {
  COMMON: '#a0a0a0',
  UNCOMMON: '#90b050',
  RARE: '#7090ff',
  SUPER_RARE: '#ffd700',
  ULTRA_RARE: '#e070ff',
} as const;

export const RARITY_PALETTE_HEX = {
  RARE: {
    PRIMARY: '#7090ff',
    SECONDARY: '#4060cc',
    HIGHLIGHT: '#a0c0ff',
    WHITE: '#ffffff',
    ACCENT: '#8888ff',
  },
  SUPER_RARE: {
    PRIMARY: '#ffd700',
    SECONDARY: '#ffaa00',
    HIGHLIGHT: '#fff0a0',
    WHITE: '#ffffff',
    ACCENT: '#ff8800',
  },
  ULTRA_RARE: {
    PRIMARY: '#e070ff',
    SECONDARY: '#9030cc',
    HIGHLIGHT: '#ff80ff',
    WHITE: '#ffffff',
    ACCENT: '#c040ff',
    EXTRA: '#ff60ff',
  },
} as const;

export function hexToInt(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

export function buildPalette(colors: readonly string[]): number[] {
  return colors.map(hexToInt);
}

export const RARITY_PALETTE_PIXEL = {
  RARE: buildPalette([
    RARITY_PALETTE_HEX.RARE.PRIMARY,
    RARITY_PALETTE_HEX.RARE.SECONDARY,
    RARITY_PALETTE_HEX.RARE.HIGHLIGHT,
    RARITY_PALETTE_HEX.RARE.WHITE,
    RARITY_PALETTE_HEX.RARE.ACCENT,
  ]),
  SUPER_RARE: buildPalette([
    RARITY_PALETTE_HEX.SUPER_RARE.PRIMARY,
    RARITY_PALETTE_HEX.SUPER_RARE.SECONDARY,
    RARITY_PALETTE_HEX.SUPER_RARE.HIGHLIGHT,
    RARITY_PALETTE_HEX.SUPER_RARE.WHITE,
    RARITY_PALETTE_HEX.SUPER_RARE.ACCENT,
  ]),
  ULTRA_RARE: buildPalette([
    RARITY_PALETTE_HEX.ULTRA_RARE.PRIMARY,
    RARITY_PALETTE_HEX.ULTRA_RARE.SECONDARY,
    RARITY_PALETTE_HEX.ULTRA_RARE.HIGHLIGHT,
    RARITY_PALETTE_HEX.ULTRA_RARE.WHITE,
    RARITY_PALETTE_HEX.ULTRA_RARE.ACCENT,
    RARITY_PALETTE_HEX.ULTRA_RARE.EXTRA,
  ]),
} as const;

export const SPIRAL_PALETTE_PIXEL = buildPalette([
  '#ff6060',
  '#ffcc00',
  '#60ff60',
  '#60a0ff',
  '#e070ff',
]);

export const FLASH_CREAM_PIXEL = hexToInt('#fffee8');

export function getRarityTier(rarityId: number): 'rare' | 'superRare' | 'ultraRare' | null {
  switch (rarityId) {
    case 4: return 'rare';
    case 6: return 'superRare';
    case 8: return 'ultraRare';
    default: return null;
  }
}

export function getRarityPalette(rarityId: number): number[] | null {
  const tier = getRarityTier(rarityId);
  if (!tier) return null;
  return RARITY_PALETTE_PIXEL[tier];
}
