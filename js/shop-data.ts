// ============================================================
// ECHOES OF SANGUO — Shop Data Store
// Runtime store for pack definitions and shop configuration.
// Loaded from shop.json inside .tcg archives; defaults match
// the original hardcoded pack-logic values.
// ============================================================

// ── Card Pool Filtering ─────────────────────────────────────

/** Filter criteria for a card pool. All specified fields use AND logic within the same filter object. */
export interface CardFilter {
  races?: number[];       // Race enum values — only applies to cards that have a race field
  attributes?: number[];  // Attribute enum values
  types?: number[];       // CardType enum values (1=Monster, 2=Fusion, 3=Spell, 4=Trap)
  maxRarity?: number;     // Rarity enum upper bound (inclusive)
  minRarity?: number;     // Rarity enum lower bound (inclusive)
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

/** Condition that must be true for a package to appear as purchasable in the shop. */
export type UnlockCondition =
  | { type: 'nodeComplete'; nodeId: string }
  | { type: 'winsCount'; count: number }
  | null;

/** A thematically curated card package with a filtered pool and optional unlock condition. */
export interface PackageDef {
  id: string;
  name: string;
  desc: string;
  nameKey?: string;
  descKey?: string;
  price: number;
  icon: string;
  color: string;
  slots: PackSlotDef[];
  cardPool?: CardPoolDef;
  unlockCondition?: UnlockCondition;
}

// ── Pack Slot ───────────────────────────────────────────────

export interface PackSlotDef {
  count: number;
  rarity?: number;                      // Rarity enum int (1=C, 2=U, 4=R, 6=SR, 8=UR)
  pool?: string;                        // e.g. 'guaranteed_rare_plus', 'guaranteed_sr_plus'
  distribution?: Record<string, number>; // rarity int -> probability
}

export interface PackDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  icon: string;
  color: string;
  slots: PackSlotDef[];
  filter?: string;                      // 'byRace' or undefined
  cardPool?: CardPoolDef;               // optional card pool filter (same as packages)
}

export interface ShopData {
  packs: PackDef[];
  packages: PackageDef[];
  currency: { nameKey: string; icon: string };
  backgrounds: Record<string, string>;  // chapter key -> resolved URL
}

// ── Default shop data ───────────────────────────────────────

export const SHOP_DATA: ShopData = {
  backgrounds: {},
  packages: [],
  packs: [],
  currency: { nameKey: 'common.coins', icon: '\u25c8' },
};

/**
 * Merge externally loaded shop data into the runtime store.
 * Partial updates are supported — only provided fields are overwritten.
 */
export function applyShopData(data: Partial<ShopData>): void {
  if (data.packs) {
    SHOP_DATA.packs = data.packs;
  }
  if (data.packages) {
    SHOP_DATA.packages = data.packages;
  }
  if (data.currency) {
    Object.assign(SHOP_DATA.currency, data.currency);
  }
  if (data.backgrounds) {
    Object.assign(SHOP_DATA.backgrounds, data.backgrounds);
  }
}
