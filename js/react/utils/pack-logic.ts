import { CARD_DB } from '../../cards.js';
import { Rarity, Race } from '../../types.js';
import { Progression } from '../../progression.js';
import { SHOP_DATA } from '../../shop-data.js';
import type { PackDef, PackSlotDef, PackageDef, CardFilter, CardPoolDef } from '../../shop-data.js';
import type { CardData } from '../../types.js';

// ── Public API (same shape as before) ───────────────────────

export type PackTypeInfo = { id: string; name: string; desc: string; price: number; icon: string; color: string };

/** Derive PACK_TYPES record from SHOP_DATA so existing consumers keep working. */
export const PACK_TYPES: Record<string, PackTypeInfo> = new Proxy({} as Record<string, PackTypeInfo>, {
  get(_target, prop: string) {
    const pack = SHOP_DATA.packs.find(p => p.id === prop);
    if (!pack) return undefined;
    return { id: pack.id, name: pack.name, desc: pack.desc, price: pack.price, icon: pack.icon, color: pack.color };
  },
  ownKeys() {
    return SHOP_DATA.packs.map(p => p.id);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const pack = SHOP_DATA.packs.find(p => p.id === prop);
    if (!pack) return undefined;
    return { configurable: true, enumerable: true, value: { id: pack.id, name: pack.name, desc: pack.desc, price: pack.price, icon: pack.icon, color: pack.color } };
  },
  has(_target, prop: string) {
    return SHOP_DATA.packs.some(p => p.id === prop);
  },
});

// ── Global rarity drop rates ────────────────────────────────

/** Default drop-chance distribution used for any slot without an explicit rarity or distribution. */
export const RARITY_DROP_RATES: Record<string, number> = {
  [Rarity.Common]:    0.60,
  [Rarity.Uncommon]:  0.30,
  [Rarity.Rare]:      0.089,
  [Rarity.SuperRare]: 0.01,
  [Rarity.UltraRare]: 0.001,
};

// ── Data-driven rarity picker ───────────────────────────────

function _pickRarityFromSlot(slot: PackSlotDef): Rarity {
  const dist = slot.distribution ?? (slot.rarity == null ? RARITY_DROP_RATES : undefined);
  if (dist) {
    const r = Math.random();
    let cumulative = 0;
    const entries = Object.entries(dist)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort((a, b) => a[1] - b[1]);
    for (const [rarity, prob] of entries) {
      cumulative += prob;
      if (r < cumulative) return rarity as Rarity;
    }
    return entries[entries.length - 1][0] as Rarity;
  }
  return slot.rarity as Rarity;
}

// ── Card pool helpers ───────────────────────────────────────

function _allCardsByRarity(rarity: Rarity, race: Race | null): CardData[] {
  return (Object.values(CARD_DB) as CardData[]).filter(c =>
    c.rarity === rarity && (!race || c.race === race)
  );
}

function _pickCard(rarity: Rarity, race: Race | null): CardData {
  let pool = _allCardsByRarity(rarity, race);
  if (!pool.length) {
    const fallbacks: Partial<Record<Rarity, Rarity>> = {
      [Rarity.UltraRare]: Rarity.SuperRare,
      [Rarity.SuperRare]: Rarity.Rare,
      [Rarity.Rare]:      Rarity.Uncommon,
      [Rarity.Uncommon]:  Rarity.Common,
    };
    pool = _allCardsByRarity(fallbacks[rarity] || Rarity.Common, race);
  }
  if (!pool.length) pool = Object.values(CARD_DB) as CardData[];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Expand slots into individual rarity picks ───────────────

function _expandSlots(packDef: PackDef): Rarity[] {
  const rarities: Rarity[] = [];
  for (const slot of packDef.slots) {
    for (let i = 0; i < slot.count; i++) {
      rarities.push(_pickRarityFromSlot(slot));
    }
  }
  return rarities;
}

// ── Pity system ────────────────────────────────────────────

/**
 * If no card in the array is Rare or better, replace one card with Rare.
 * Prefers replacing Uncommon over Common (highest rarity below Rare first).
 */
function _applyPity(rarities: Rarity[]): Rarity[] {
  if (rarities.some(r => r >= Rarity.Rare)) return rarities;

  let replaceIdx = 0;
  let bestRarity = -1;
  for (let i = 0; i < rarities.length; i++) {
    if (rarities[i] > bestRarity) {
      bestRarity = rarities[i];
      replaceIdx = i;
    }
  }
  rarities[replaceIdx] = Rarity.Rare;
  return rarities;
}

// ── Card Pool Filtering (for packages) ──────────────────────

/**
 * Test whether a card matches a single CardFilter using AND logic:
 * all specified fields must be satisfied.
 * `ids` is intentionally excluded here — handled separately as overrides.
 */
function _matchesFilter(card: CardData, f: CardFilter): boolean {
  if (f.types?.length && !f.types.includes(card.type)) return false;
  // races/attributes/spellTypes only apply to cards that actually have that field
  if (f.races?.length && card.race !== undefined && !f.races.includes(card.race)) return false;
  if (f.attributes?.length && card.attribute !== undefined && !f.attributes.includes(card.attribute)) return false;
  if (f.spellTypes?.length && card.spellType !== undefined && !f.spellTypes.includes(card.spellType)) return false;
  const rarity = card.rarity ?? Rarity.Common;
  if (f.maxRarity !== undefined && rarity > f.maxRarity) return false;
  if (f.minRarity !== undefined && rarity < f.minRarity) return false;
  if (f.maxAtk !== undefined && card.atk !== undefined && card.atk > f.maxAtk) return false;
  if (f.maxLevel !== undefined && card.level !== undefined && card.level > f.maxLevel) return false;
  return true;
}

/** Returns true if a CardFilter has any criteria beyond `ids`. */
function _hasNonIdCriteria(f: CardFilter): boolean {
  return !!(
    f.types?.length || f.races?.length || f.attributes?.length || f.spellTypes?.length ||
    f.maxRarity !== undefined || f.minRarity !== undefined ||
    f.maxAtk !== undefined || f.maxLevel !== undefined
  );
}

/**
 * Build the card pool for a package definition.
 *
 * Algorithm (per plan):
 * 1. Start with all cards in CARD_DB.
 * 2. Apply `include` filter — keep only cards that match it (ids in include always kept).
 * 3. Apply `exclude` filter — remove cards that match it.
 * 4. `exclude.ids` wins over everything (removed last).
 *    `include.ids` overrides exclude non-id filters (re-added after step 3).
 */
export function buildCardPool(cardPool: CardPoolDef | undefined): CardData[] {
  const all = Object.values(CARD_DB) as CardData[];
  if (!cardPool) return all;

  const { include, exclude } = cardPool;
  const includeIds = new Set((include?.ids ?? []).map(String));
  const excludeIds = new Set((exclude?.ids ?? []).map(String));

  const hasInclude = include && _hasNonIdCriteria(include);
  const hasExclude = exclude && _hasNonIdCriteria(exclude);

  let pool = all.filter(c => {
    // include.ids always keeps (unless also in excludeIds — handled below)
    if (includeIds.has(c.id)) return true;
    // Apply include filter if any non-id criteria defined
    if (hasInclude && !_matchesFilter(c, include!)) return false;
    // Apply exclude filter
    if (hasExclude && _matchesFilter(c, exclude!)) return false;
    return true;
  });

  // exclude.ids are removed last, overriding include.ids
  if (excludeIds.size) pool = pool.filter(c => !excludeIds.has(c.id));

  return pool;
}

/** Check whether a package's unlockCondition is satisfied. */
export function isPackageUnlocked(pkg: PackageDef): boolean {
  const cond = pkg.unlockCondition;
  if (!cond) return true;
  if (cond.type === 'nodeComplete') return Progression.isNodeComplete(cond.nodeId);
  if (cond.type === 'winsCount') {
    const opponents = Progression.getOpponents();
    const totalWins = Object.values(opponents).reduce((sum, o) => sum + (o.wins ?? 0), 0);
    return totalWins >= cond.count;
  }
  return false;
}

// ── Main public function ────────────────────────────────────

export function openPack(packType: string, race: Race | null = null): CardData[] {
  const packDef = SHOP_DATA.packs.find(p => p.id === packType);
  if (!packDef) return [];

  const targetRace: Race | null =
    packDef.filter === 'byRace' ? race
    : null;

  const rarities = _applyPity(_expandSlots(packDef));

  if (packDef.cardPool) {
    let pool = buildCardPool(packDef.cardPool);
    if (targetRace != null) {
      const raceFiltered = pool.filter(c => c.race === targetRace);
      if (raceFiltered.length) pool = raceFiltered;
    }
    return rarities.map(rarity => {
      let candidates = pool.filter(c => (c.rarity ?? Rarity.Common) === rarity);
      const fallbacks: Partial<Record<Rarity, Rarity>> = {
        [Rarity.UltraRare]: Rarity.SuperRare,
        [Rarity.SuperRare]: Rarity.Rare,
        [Rarity.Rare]:      Rarity.Uncommon,
        [Rarity.Uncommon]:  Rarity.Common,
      };
      while (!candidates.length && fallbacks[rarity]) {
        rarity = fallbacks[rarity]!;
        candidates = pool.filter(c => (c.rarity ?? Rarity.Common) === rarity);
      }
      if (!candidates.length) candidates = pool.length ? pool : Object.values(CARD_DB) as CardData[];
      return candidates[Math.floor(Math.random() * candidates.length)];
    });
  }

  return rarities.map(r => _pickCard(r, targetRace));
}

/** Open a curated card package by ID. Uses the package's cardPool filter instead of race filtering. */
export function openPackage(packageId: string): CardData[] {
  const pkg = SHOP_DATA.packages.find(p => p.id === packageId);
  if (!pkg) return [];

  const pool = buildCardPool(pkg.cardPool);
  const rarities = _applyPity(_expandSlots(pkg));

  return rarities.map(rarity => {
    let candidates = pool.filter(c => (c.rarity ?? Rarity.Common) === rarity);
    // Fallback chain if pool has no cards at this rarity
    const fallbacks: Partial<Record<Rarity, Rarity>> = {
      [Rarity.UltraRare]: Rarity.SuperRare,
      [Rarity.SuperRare]: Rarity.Rare,
      [Rarity.Rare]:      Rarity.Uncommon,
      [Rarity.Uncommon]:  Rarity.Common,
    };
    while (!candidates.length && fallbacks[rarity]) {
      rarity = fallbacks[rarity]!;
      candidates = pool.filter(c => (c.rarity ?? Rarity.Common) === rarity);
    }
    if (!candidates.length) candidates = pool.length ? pool : Object.values(CARD_DB) as CardData[];
    return candidates[Math.floor(Math.random() * candidates.length)];
  });
}
