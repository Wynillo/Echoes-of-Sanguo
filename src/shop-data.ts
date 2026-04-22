import type { Rarity } from './types.js';
import { CURRENCY_IDS } from './economy-config.js';

/** Filter criteria for a card pool. All specified fields use AND logic within the same filter object. */
export interface CardFilter {
  races?: number[];       // Race enum values — only applies to cards that have a race field
  attributes?: number[];  // Attribute enum values
  types?: number[];       // CardType enum values (1=Monster, 2=Fusion, 3=Spell, 4=Trap)
  maxRarity?: Rarity;     // Rarity enum upper bound (inclusive)
  minRarity?: Rarity;     // Rarity enum lower bound (inclusive)
  maxAtk?: number;        // ATK upper bound — only applies to cards with an atk field
  maxLevel?: number;      // Level upper bound — only applies to cards with a level field
  spellTypes?: string[];  // SpellType string values ('normal', 'targeted', 'fromGrave')
  ids?: number[];         // Specific card IDs — override other filter fields
}

/** Card pool definition: include/exclude filters that together determine which cards can be drawn. */
export interface CardPoolDef {
  include?: CardFilter;   // Cards must match ALL include fields to be in the pool
  exclude?: CardFilter;   // Cards matching ALL exclude fields are removed from the pool
}

/** Condition that must be true for a pack to appear as purchasable in the shop. */
export type UnlockCondition =
  | { type: 'nodeComplete'; nodeId: string }
  | { type: 'winsCount'; count: number }
  | null;

export interface CurrencyDef {
  id: string;
  nameKey: string;
  icon: string;
  requiredChapter?: number;
}

export interface PackPrice {
  currencyId: string;
  amount: number;
}

export interface PackSlotDef {
  count: number;
  rarity?: Rarity;                      // Rarity enum value (Rarity.COMMON=1, UNCOMMON=2, RARE=4, SUPER_RARE=6, ULTRA_RARE=8)
  pool?: string;                        // e.g. 'guaranteed_rare_plus', 'guaranteed_sr_plus'
  distribution?: Record<string, number>; // rarity int -> probability
  effectItems?: boolean;                // When true, drops effect items instead of cards
}

export interface PackDef {
  id: string;
  name: string;
  desc: string;
  nameKey?: string;
  descKey?: string;
  price: number | PackPrice;
  icon: string;
  color: string;
  slots: PackSlotDef[];
  cardPool?: CardPoolDef;
  unlockCondition?: UnlockCondition;
}

export interface ShopData {
  packs: PackDef[];
  currencies: CurrencyDef[];
  backgrounds: Record<string, string>;
}

import { CURRENCY_IDS } from './economy-config.js';

export const SHOP_DATA: ShopData = {
  backgrounds: {},
  packs: [],
  currencies: [{ id: CURRENCY_IDS.COINS, nameKey: 'common.coins', icon: '\u25c8' }],
};

export function applyShopData(data: Partial<ShopData>): void {
  if (data.packs) {
    SHOP_DATA.packs = data.packs;
  }
  if (data.currencies) {
    for (const incoming of data.currencies) {
      const id = incoming.id || incoming.nameKey.split('.')[1];
      const existing = SHOP_DATA.currencies.findIndex(c => c.id === id);
      if (existing >= 0) {
        SHOP_DATA.currencies[existing] = { ...incoming, id };
      } else {
        SHOP_DATA.currencies.push({ ...incoming, id });
      }
    }
  }
  if (data.backgrounds) {
    Object.assign(SHOP_DATA.backgrounds, data.backgrounds);
  }
}