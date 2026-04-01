import { CARD_DB } from '../../cards.js';
import { Rarity } from '../../types.js';
import { Progression } from '../../progression.js';
import { SHOP_DATA } from '../../shop-data.js';
import type { PackSlotDef, PackageDef, CardFilter, CardPoolDef } from '../../shop-data.js';
import type { CardData } from '../../types.js';

/** Default drop-chance distribution used for any slot without an explicit rarity or distribution. */
export const RARITY_DROP_RATES: Record<string, number> = {
  [Rarity.Common]:    0.60,
  [Rarity.Uncommon]:  0.30,
  [Rarity.Rare]:      0.089,
  [Rarity.SuperRare]: 0.01,
  [Rarity.UltraRare]: 0.001,
};

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

function _expandSlots(packDef: { slots: PackSlotDef[] }): Rarity[] {
  const rarities: Rarity[] = [];
  for (const slot of packDef.slots) {
    for (let i = 0; i < slot.count; i++) {
      rarities.push(_pickRarityFromSlot(slot));
    }
  }
  return rarities;
}

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

/** Open a curated card package by ID. Uses the package's cardPool filter. */
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
