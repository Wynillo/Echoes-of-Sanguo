/**
 * Centralized economy configuration for Echoes of Sanguo.
 *
 * DESIGN RATIONALE:
 * Economy uses "Jade Coins" (coins) where players earn by winning duels (50-200 base)
 * and spend on card packs. Pricing: Basic=100 (1 win), Premium=500 (5 wins),
 * Elite=1000+ (10+ wins). Chapter progression unlocks new currencies.
 */

export const DEFAULT_CHAPTER = 'ch1' as const;

export const CURRENCY_IDS = {
  COINS: 'coins',
  MODERN_COINS: 'moderncoins',
  ANCIENT_COINS: 'ancientcoins',
} as const;

export const CURRENCY_UNLOCK_CHAPTERS: Record<string, number> = {
  [CURRENCY_IDS.COINS]: 1,
  [CURRENCY_IDS.MODERN_COINS]: 3,
  [CURRENCY_IDS.ANCIENT_COINS]: 6,
} as const;

export const STARTING_COINS = 0;

export const WIN_REWARD_COINS = {
  MIN: 50,
  MAX: 200,
} as const;

export const WIN_REWARD_CARDS = {
  MIN: 0,
  MAX: 3,
} as const;

export const PACK_PRICES = {
  BASIC: 100,
  PREMIUM: 500,
  ELITE: 1000,
  ULTIMATE: 2500,
} as const;

export const PREMIUM_PACK_PRICES = {
  MODERN_TIER: 50,
  ANCIENT_TIER: 5,
} as const;

export const MAX_CURRENCY_AMOUNT = 999_999;

export const MAX_CARD_COPIES = 99;

export const MAX_EFFECT_ITEMS = 999;

export const MAX_COLLECTION_SIZE = 1000;

export const SHOP_TABS = {
  PACKS: 'packs',
  CRAFTING: 'crafting',
} as const;

export const ECONOMY_HELPERS = {
  winsForPack: (packPrice: number, avgWinReward = 100): number => {
    return Math.ceil(packPrice / avgWinReward);
  },

  isBaseCurrency: (currencyId: string): boolean => {
    return currencyId === CURRENCY_IDS.COINS;
  },

  chapterNumber: (chapterId: string): number => {
    return parseInt(chapterId.replace('ch', ''), 10) || 1;
  },

  isChapterAtLeast: (chapterId: string, minChapter: number): boolean => {
    return ECONOMY_HELPERS.chapterNumber(chapterId) >= minChapter;
  },
} as const;

export const ECONOMY = {
  DEFAULT_CHAPTER,
  CURRENCY_COINS: CURRENCY_IDS.COINS,
  CURRENCY_MODERN_COINS: CURRENCY_IDS.MODERN_COINS,
  CURRENCY_ANCIENT_COINS: CURRENCY_IDS.ANCIENT_COINS,
  CURRENCY_UNLOCK_CHAPTERS,
  STARTING_COINS,
  WIN_REWARD_MIN: WIN_REWARD_COINS.MIN,
  WIN_REWARD_MAX: WIN_REWARD_COINS.MAX,
  WIN_REWARD_CARDS_MIN: WIN_REWARD_CARDS.MIN,
  WIN_REWARD_CARDS_MAX: WIN_REWARD_CARDS.MAX,
  BASIC_PACK_PRICE: PACK_PRICES.BASIC,
  PREMIUM_PACK_PRICE: PACK_PRICES.PREMIUM,
  ELITE_PACK_PRICE: PACK_PRICES.ELITE,
  ULTIMATE_PACK_PRICE: PACK_PRICES.ULTIMATE,
  PREMIUM_PACK_MODERN_PRICE: PREMIUM_PACK_PRICES.MODERN_TIER,
  PREMIUM_PACK_ANCIENT_PRICE: PREMIUM_PACK_PRICES.ANCIENT_TIER,
  MAX_CURRENCY_AMOUNT,
  MAX_CARD_COPIES,
  MAX_EFFECT_ITEMS,
  MAX_COLLECTION_SIZE,
  SHOP_TAB_PACKS: SHOP_TABS.PACKS,
  SHOP_TAB_CRAFTING: SHOP_TABS.CRAFTING,
  HELPERS: ECONOMY_HELPERS,
} as const;

export type CurrencyId = typeof CURRENCY_IDS[keyof typeof CURRENCY_IDS];
export type ShopTab = typeof SHOP_TABS[keyof typeof SHOP_TABS];
