// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CARD_DB } from '../js/cards.js';
import { Rarity, Race, CardType } from '../js/types.js';
import { RARITY_DROP_RATES, openPackage, buildCardPool } from '../js/react/utils/pack-logic.js';
import { SHOP_DATA } from '../js/shop-data.js';
import { Progression } from '../js/progression.js';

// ── RARITY_DROP_RATES ────────────────────────────────────

describe('RARITY_DROP_RATES', () => {
  it('probabilities sum to 1.0', () => {
    const sum = Object.values(RARITY_DROP_RATES).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('contains all five rarities', () => {
    expect(Object.keys(RARITY_DROP_RATES).map(Number).sort((a, b) => a - b)).toEqual([
      Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.SuperRare, Rarity.UltraRare,
    ]);
  });
});

// ── openPackage ──────────────────────────────────────────

describe('openPackage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array for unknown package ID', () => {
    const cards = openPackage('nonexistent');
    expect(cards).toHaveLength(0);
  });

  it('returns correct number of cards for each package', () => {
    for (const pkg of SHOP_DATA.packages) {
      const cards = openPackage(pkg.id);
      const expectedCount = pkg.slots.reduce((sum, s) => sum + s.count, 0);
      expect(cards).toHaveLength(expectedCount);
    }
  });

  it('all returned cards are valid CardData objects from CARD_DB', () => {
    for (const pkg of SHOP_DATA.packages) {
      const cards = openPackage(pkg.id);
      for (const card of cards) {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(card).toHaveProperty('type');
        expect(CARD_DB[card.id]).toBeDefined();
      }
    }
  });

  it('respects cardPool maxAtk filter', () => {
    const pkg = SHOP_DATA.packages.find(p => p.cardPool?.include?.maxAtk);
    if (!pkg) return; // skip if no package has maxAtk filter
    const maxAtk = pkg.cardPool.include.maxAtk;
    // Open many times to get a good sample
    for (let i = 0; i < 20; i++) {
      const cards = openPackage(pkg.id);
      for (const card of cards) {
        if (card.atk !== undefined) {
          expect(card.atk).toBeLessThanOrEqual(maxAtk);
        }
      }
    }
  });
});

// ── buildCardPool ────────────────────────────────────────

describe('buildCardPool', () => {
  it('returns all cards when no filter is provided', () => {
    const pool = buildCardPool(undefined);
    expect(pool.length).toBe(Object.values(CARD_DB).length);
  });

  it('filters by maxAtk', () => {
    const pool = buildCardPool({ include: { maxAtk: 1500 } });
    for (const card of pool) {
      if (card.atk !== undefined) {
        expect(card.atk).toBeLessThanOrEqual(1500);
      }
    }
  });

  it('filters by maxRarity', () => {
    const pool = buildCardPool({ include: { maxRarity: Rarity.Rare } });
    for (const card of pool) {
      const rarity = card.rarity ?? Rarity.Common;
      expect(rarity).toBeLessThanOrEqual(Rarity.Rare);
    }
  });
});
