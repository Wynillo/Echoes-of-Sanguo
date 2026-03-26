// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CARD_DB } from '../js/cards.js';
import { Rarity, Race, CardType } from '../js/types.js';
import { PACK_TYPES, openPack } from '../js/react/utils/pack-logic.js';
import { Progression } from '../js/progression.js';

// ── Helpers ────────────────────────────────────────────────

/** Collect all cards from CARD_DB as an array. */
function allCards() {
  return Object.values(CARD_DB);
}

/** Open many packs and flatten results into a single array. */
function openMany(packType, count, race = null) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    cards.push(...openPack(packType, race));
  }
  return cards;
}

// ── PACK_TYPES structure ──────────────────────────────────

describe('PACK_TYPES', () => {
  it('contains the expected pack type keys', () => {
    expect(Object.keys(PACK_TYPES)).toEqual(
      expect.arrayContaining(['starter', 'race', 'aether', 'rarity'])
    );
  });

  it('each pack type has required fields with correct types', () => {
    for (const [key, pack] of Object.entries(PACK_TYPES)) {
      expect(pack.id).toBe(key);
      expect(typeof pack.name).toBe('string');
      expect(pack.name.length).toBeGreaterThan(0);
      expect(typeof pack.desc).toBe('string');
      expect(typeof pack.price).toBe('number');
      expect(pack.price).toBeGreaterThan(0);
      expect(typeof pack.icon).toBe('string');
      expect(typeof pack.color).toBe('string');
      expect(pack.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('pack prices are ordered: starter < race < aether < rarity', () => {
    expect(PACK_TYPES.starter.price).toBeLessThan(PACK_TYPES.race.price);
    expect(PACK_TYPES.race.price).toBeLessThan(PACK_TYPES.aether.price);
    expect(PACK_TYPES.aether.price).toBeLessThan(PACK_TYPES.rarity.price);
  });
});

// ── openPack — basic behavior ─────────────────────────────

describe('openPack', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns exactly 9 cards for each pack type', () => {
    for (const packType of Object.keys(PACK_TYPES)) {
      const cards = openPack(packType);
      expect(cards).toHaveLength(9);
    }
  });

  it('all returned cards are valid CardData objects from CARD_DB', () => {
    for (const packType of Object.keys(PACK_TYPES)) {
      const cards = openPack(packType);
      for (const card of cards) {
        expect(card).toHaveProperty('id');
        expect(card).toHaveProperty('name');
        expect(card).toHaveProperty('type');
        expect(CARD_DB[card.id]).toBeDefined();
      }
    }
  });

  it('returns CardData objects (not undefined or null)', () => {
    const cards = openPack('aether');
    cards.forEach(card => {
      expect(card).toBeDefined();
      expect(card).not.toBeNull();
    });
  });
});

// ── openPack — race filtering ─────────────────────────────

describe('openPack race filtering', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('race pack returns only cards matching the specified race', () => {
    const race = Race.Dragon;
    // Open many packs to get a good sample
    const cards = openMany('race', 20, race);
    for (const card of cards) {
      // Cards without a race (spells/traps) should not appear because
      // the filter requires c.race === race. But if fallback kicks in
      // due to empty pools, any card is valid. We check with generous bounds.
      if (card.race !== undefined) {
        expect(card.race).toBe(race);
      }
    }
  });

  it('race pack works for multiple different races', () => {
    const races = [Race.Warrior, Race.Spellcaster, Race.Beast];
    for (const race of races) {
      const cards = openPack('race', race);
      for (const card of cards) {
        if (card.race !== undefined) {
          expect(card.race).toBe(race);
        }
      }
    }
  });

  it('starter pack uses the saved starter race from Progression', () => {
    // Set a starter race in localStorage
    Progression.markStarterChosen(String(Race.Dragon));
    const cards = openMany('starter', 20);
    for (const card of cards) {
      if (card.race !== undefined) {
        expect(card.race).toBe(Race.Dragon);
      }
    }
  });

  it('starter pack with no saved race and no explicit race returns all-race cards', () => {
    // No starter race set, no race argument → targetRace is null
    const cards = openPack('starter');
    // Should still return 9 cards — no crash
    expect(cards).toHaveLength(9);
  });

  it('aether pack ignores race parameter and returns cards from any race', () => {
    const cards = openMany('aether', 20);
    const races = new Set(cards.map(c => c.race).filter(r => r !== undefined));
    // Aether packs should include multiple races over many openings
    expect(races.size).toBeGreaterThan(1);
  });
});

// ── openPack — rarity distribution ────────────────────────

describe('openPack rarity distribution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('standard packs (aether): slots 1-5 are Common, 6-7 Uncommon, 8 Rare', () => {
    // We can't directly test slot assignment, but we can verify that
    // over many packs the distribution roughly matches expectations.
    // Standard pack: 5 Common + 2 Uncommon + 1 Rare + 1 (Rare/SR/UR) = 9
    const iterations = 200;
    const counts = { common: 0, uncommon: 0, rare: 0, superRare: 0, ultraRare: 0 };
    for (let i = 0; i < iterations; i++) {
      const cards = openPack('aether');
      for (const card of cards) {
        switch (card.rarity) {
          case Rarity.Common:    counts.common++;    break;
          case Rarity.Uncommon:  counts.uncommon++;  break;
          case Rarity.Rare:      counts.rare++;      break;
          case Rarity.SuperRare: counts.superRare++; break;
          case Rarity.UltraRare: counts.ultraRare++; break;
        }
      }
    }
    const total = iterations * 9;
    // Expected: ~55.5% Common, ~22.2% Uncommon, ~17-22% Rare, some SR/UR
    expect(counts.common / total).toBeGreaterThan(0.40);
    expect(counts.common / total).toBeLessThan(0.70);
    expect(counts.uncommon / total).toBeGreaterThan(0.10);
    expect(counts.uncommon / total).toBeLessThan(0.35);
    expect(counts.rare / total).toBeGreaterThan(0.05);
    // SR + UR should appear but be relatively rare
    expect(counts.superRare + counts.ultraRare).toBeGreaterThan(0);
  });

  it('rarity packs: all cards are at least Rare', () => {
    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      const cards = openPack('rarity');
      for (const card of cards) {
        expect(card.rarity).toBeGreaterThanOrEqual(Rarity.Rare);
      }
    }
  });

  it('rarity packs have higher SR/UR rate than standard packs', () => {
    const iterations = 200;
    let rarityHighCount = 0;
    let aetherHighCount = 0;

    for (let i = 0; i < iterations; i++) {
      const rarityCards = openPack('rarity');
      const aetherCards = openPack('aether');
      rarityHighCount += rarityCards.filter(c =>
        c.rarity === Rarity.SuperRare || c.rarity === Rarity.UltraRare
      ).length;
      aetherHighCount += aetherCards.filter(c =>
        c.rarity === Rarity.SuperRare || c.rarity === Rarity.UltraRare
      ).length;
    }

    expect(rarityHighCount).toBeGreaterThan(aetherHighCount);
  });

  it('rarity pack slot 9 has elevated SR/UR chance', () => {
    // Slot 9 in rarity pack: 15% UR, 30% SR, 55% Rare
    // Over many trials, we should see SR+UR in roughly 45% of slot-9 draws
    const iterations = 300;
    let highRarityCount = 0;
    for (let i = 0; i < iterations; i++) {
      const cards = openPack('rarity');
      const lastCard = cards[8]; // slot 9 (0-indexed)
      if (lastCard.rarity === Rarity.SuperRare || lastCard.rarity === Rarity.UltraRare) {
        highRarityCount++;
      }
    }
    // Expected ~45%, allow generous bounds: 20% - 70%
    const rate = highRarityCount / iterations;
    expect(rate).toBeGreaterThan(0.20);
    expect(rate).toBeLessThan(0.70);
  });

  it('standard pack slot 9 can produce UltraRare cards', () => {
    // 5% chance per pack for UR in slot 9; over 500 packs should see at least one
    const iterations = 500;
    let foundUR = false;
    for (let i = 0; i < iterations; i++) {
      const cards = openPack('aether');
      if (cards[8].rarity === Rarity.UltraRare) {
        foundUR = true;
        break;
      }
    }
    expect(foundUR).toBe(true);
  });
});

// ── Edge cases ────────────────────────────────────────────

describe('openPack edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('unknown pack type returns empty array', () => {
    // Data-driven packs: unknown pack ID has no definition, so openPack returns []
    const cards = openPack('nonexistent');
    expect(cards).toHaveLength(0);
  });

  it('race with very few cards still returns 9 cards via fallback', () => {
    // Even a race with sparse rarity distribution should work due to fallback logic
    // Try every race to ensure none crashes
    for (const raceValue of Object.values(Race)) {
      if (typeof raceValue !== 'number') continue;
      const cards = openPack('race', raceValue);
      expect(cards).toHaveLength(9);
      cards.forEach(card => {
        expect(card).toBeDefined();
        expect(card).not.toBeNull();
      });
    }
  });

  it('race pack with race=null behaves like aether (no race filter)', () => {
    const cards = openMany('race', 30, null);
    const races = new Set(cards.map(c => c.race).filter(r => r !== undefined));
    // With null race, cards should come from multiple races
    expect(races.size).toBeGreaterThan(1);
  });

  it('multiple openPack calls return different results (randomness)', () => {
    // Open 10 packs and verify they are not all identical
    const packs = [];
    for (let i = 0; i < 10; i++) {
      packs.push(openPack('aether').map(c => c.id).join(','));
    }
    const unique = new Set(packs);
    expect(unique.size).toBeGreaterThan(1);
  });

  it('starter pack falls back to race argument when no saved starter race', () => {
    // No starter race in localStorage; pass race explicitly
    const cards = openMany('starter', 20, Race.Warrior);
    for (const card of cards) {
      if (card.race !== undefined) {
        expect(card.race).toBe(Race.Warrior);
      }
    }
  });
});

// ── _pickCard fallback behavior (tested indirectly) ───────

describe('rarity fallback behavior', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('race pack for a race missing UltraRare cards still returns 9 cards', () => {
    // Find a race that has no UR cards (if any)
    for (const raceValue of Object.values(Race)) {
      if (typeof raceValue !== 'number') continue;
      const urCards = allCards().filter(
        c => c.rarity === Rarity.UltraRare && c.race === raceValue
      );
      if (urCards.length === 0) {
        // This race has no UR cards — rarity pack with this race should still work
        const cards = openPack('race', raceValue);
        expect(cards).toHaveLength(9);
        break;
      }
    }
  });

  it('all cards returned have valid rarity values', () => {
    const validRarities = [
      Rarity.Common, Rarity.Uncommon, Rarity.Rare,
      Rarity.SuperRare, Rarity.UltraRare,
    ];
    for (const packType of Object.keys(PACK_TYPES)) {
      const cards = openPack(packType);
      for (const card of cards) {
        if (card.rarity !== undefined) {
          expect(validRarities).toContain(card.rarity);
        }
      }
    }
  });

  it('all cards returned have valid card types', () => {
    const validTypes = [CardType.Monster, CardType.Fusion, CardType.Spell, CardType.Trap, CardType.Equipment];
    for (const packType of Object.keys(PACK_TYPES)) {
      const cards = openPack(packType);
      for (const card of cards) {
        expect(validTypes).toContain(card.type);
      }
    }
  });
});
