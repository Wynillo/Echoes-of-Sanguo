// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CARD_DB } from '../src/cards.js';
import { CardType } from '../src/types.js';
import { RARITY_DROP_RATES, openPack, buildCardPool } from '../src/react/utils/pack-logic.js';
import { SHOP_DATA } from '../src/shop-data.js';
import { Progression } from '../src/progression.js';

// ── RARITY_DROP_RATES ────────────────────────────────────

describe('RARITY_DROP_RATES', () => {
  it('probabilities sum to 1.0', () => {
    const sum = Object.values(RARITY_DROP_RATES).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('contains all five rarities', () => {
    expect(Object.keys(RARITY_DROP_RATES).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 4, 6, 8]);
  });
});

// ── openPack ──────────────────────────────────────────

describe('openPack', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array for unknown package ID', () => {
    const cards = openPack('nonexistent');
    expect(cards).toHaveLength(0);
  });

  it('returns correct number of cards for each package', () => {
    for (const pkg of SHOP_DATA.packs) {
      const cards = openPack(pkg.id);
      const expectedCount = pkg.slots.reduce((sum, s) => sum + s.count, 0);
      expect(cards).toHaveLength(expectedCount);
    }
  });

  it('all returned cards are valid CardData objects from CARD_DB', () => {
    for (const pkg of SHOP_DATA.packs) {
      const cards = openPack(pkg.id);
      for (const card of cards) {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(card).toHaveProperty('type');
        expect(CARD_DB[card.id]).toBeDefined();
      }
    }
  });

  it('respects cardPool maxAtk filter', () => {
    const pkg = SHOP_DATA.packs.find(p => p.cardPool?.include?.maxAtk);
    if (!pkg) return; // skip if no package has maxAtk filter
    const maxAtk = pkg.cardPool.include.maxAtk;
    // Open many times to get a good sample
    for (let i = 0; i < 20; i++) {
      const cards = openPack(pkg.id);
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
    const pool = buildCardPool({ include: { maxRarity: 4 } });
    for (const card of pool) {
      const rarity = card.rarity ?? 1;
      expect(rarity).toBeLessThanOrEqual(4);
    }
  });
});
