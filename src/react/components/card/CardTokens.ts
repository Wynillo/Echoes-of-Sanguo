export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardSizeTokens {
  width: number;
  height: number;
  fontName: number;
  fontLevel: number;
  fontType: number;
  fontDesc: number;
  fontStats: number;
  fontNameSmall: number;
  orbSize: number;
  orbFont: number;
  badgePaddingH: number;
  badgePaddingV: number;
  badgeFont: number;
  artMargin: number;
  artGap: number;
  bodyMaxHeight: number;
  bodyPaddingH: number;
  bodyPaddingV: number;
  statsPaddingH: number;
  statsPaddingV: number;
  statsGap: number;
}

export const CARD_TOKENS: Record<CardSize, CardSizeTokens> = {
  xs: {
    width: 68,
    height: 94,
    fontName: 6,
    fontLevel: 5,
    fontType: 4,
    fontDesc: 4,
    fontStats: 6,
    fontNameSmall: 5,
    orbSize: 10,
    orbFont: 6,
    badgePaddingH: 2,
    badgePaddingV: 1,
    badgeFont: 5,
    artMargin: 2,
    artGap: 1,
    bodyMaxHeight: 0,
    bodyPaddingH: 2,
    bodyPaddingV: 1,
    statsPaddingH: 2,
    statsPaddingV: 1,
    statsGap: 1,
  },
  sm: {
    width: 104,
    height: 144,
    fontName: 9,
    fontLevel: 8,
    fontType: 6,
    fontDesc: 6,
    fontStats: 8,
    fontNameSmall: 7,
    orbSize: 14,
    orbFont: 9,
    badgePaddingH: 3,
    badgePaddingV: 1,
    badgeFont: 7,
    artMargin: 5,
    artGap: 1,
    bodyMaxHeight: 36,
    bodyPaddingH: 4,
    bodyPaddingV: 2,
    statsPaddingH: 5,
    statsPaddingV: 2,
    statsGap: 4,
  },
  md: {
    width: 140,
    height: 195,
    fontName: 11,
    fontLevel: 10,
    fontType: 8,
    fontDesc: 8,
    fontStats: 10,
    fontNameSmall: 9,
    orbSize: 16,
    orbFont: 11,
    badgePaddingH: 4,
    badgePaddingV: 1,
    badgeFont: 8,
    artMargin: 6,
    artGap: 2,
    bodyMaxHeight: 46,
    bodyPaddingH: 5,
    bodyPaddingV: 3,
    statsPaddingH: 6,
    statsPaddingV: 3,
    statsGap: 4,
  },
  lg: {
    width: 180,
    height: 248,
    fontName: 11,
    fontLevel: 12,
    fontType: 9,
    fontDesc: 9,
    fontStats: 12,
    fontNameSmall: 11,
    orbSize: 20,
    orbFont: 12,
    badgePaddingH: 5,
    badgePaddingV: 1,
    badgeFont: 9,
    artMargin: 6,
    artGap: 2,
    bodyMaxHeight: 56,
    bodyPaddingH: 6,
    bodyPaddingV: 3,
    statsPaddingH: 8,
    statsPaddingV: 4,
    statsGap: 4,
  },
  xl: {
    width: 220,
    height: 307,
    fontName: 13,
    fontLevel: 14,
    fontType: 11,
    fontDesc: 11,
    fontStats: 14,
    fontNameSmall: 13,
    orbSize: 24,
    orbFont: 14,
    badgePaddingH: 6,
    badgePaddingV: 2,
    badgeFont: 11,
    artMargin: 8,
    artGap: 3,
    bodyMaxHeight: 72,
    bodyPaddingH: 8,
    bodyPaddingV: 4,
    statsPaddingH: 10,
    statsPaddingV: 5,
    statsGap: 6,
  },
};

export function getCardTokens(size: CardSize): CardSizeTokens {
  return CARD_TOKENS[size];
}
