import { describe, it, expect } from 'vitest';
import { calculateBattleBadges, rollBadgeCardDrops, rollFromDropPool } from '../src/battle-badges.ts';
import { Rarity } from '../src/types.ts';

// ── Helpers ────────────────────────────────────────────────

function makeStats(overrides = {}) {
  return {
    turns: 10,
    monstersPlayed: 4,
    fusionsPerformed: 1,
    spellsActivated: 2,
    trapsActivated: 0,
    cardsDrawn: 8,
    lpRemaining: 5000,
    opponentLpRemaining: 0,
    deckRemaining: 10,
    graveyardSize: 8,
    opponentMonstersPlayed: 5,
    opponentFusionsPerformed: 1,
    opponentSpellsActivated: 2,
    opponentTrapsActivated: 1,
    opponentDeckRemaining: 8,
    opponentGraveyardSize: 6,
    endReason: 'lp_zero',
    ...overrides,
  };
}

// ── POW tests ────────────────────────────────────────────────

describe('calculateBattleBadges – POW scoring', () => {
  it('gives POW-S for fast, dominant victory', () => {
    const stats = makeStats({
      turns: 3,
      monstersPlayed: 2,
      fusionsPerformed: 1,
      cardsDrawn: 3,
      lpRemaining: 8000,
      opponentLpRemaining: 0,
      endReason: 'lp_zero',
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.pow.rank).toBe('S');
    expect(badges.pow.score).toBeGreaterThanOrEqual(80);
  });

  it('gives POW-B for slow, grindy victory', () => {
    const stats = makeStats({
      turns: 30,
      monstersPlayed: 14,
      fusionsPerformed: 0,
      cardsDrawn: 25,
      lpRemaining: 500,
      opponentLpRemaining: 0,
      endReason: 'lp_zero',
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.pow.rank).toBe('B');
    expect(badges.pow.score).toBeLessThan(60);
  });

  it('penalizes deck-out victories for POW', () => {
    const lpStats = makeStats({ endReason: 'lp_zero' });
    const deckOutStats = makeStats({ endReason: 'deck_out' });
    const lpBadges = calculateBattleBadges(lpStats);
    const deckOutBadges = calculateBattleBadges(deckOutStats);
    expect(lpBadges.pow.score - deckOutBadges.pow.score).toBe(22);
  });
});

// ── TEC tests ────────────────────────────────────────────────

describe('calculateBattleBadges – TEC scoring', () => {
  it('gives TEC-S for tactical play with spells, traps, and fusions', () => {
    const stats = makeStats({
      turns: 10,
      fusionsPerformed: 2,
      spellsActivated: 2,
      trapsActivated: 2,
      lpRemaining: 6000,
      graveyardSize: 12,
      endReason: 'lp_zero',
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.tec.rank).toBe('S');
    expect(badges.tec.score).toBeGreaterThanOrEqual(80);
  });

  it('penalizes TEC for using no spells or traps', () => {
    const stats = makeStats({
      turns: 3,
      fusionsPerformed: 0,
      spellsActivated: 0,
      trapsActivated: 0,
      lpRemaining: 8000,
      graveyardSize: 2,
      endReason: 'lp_zero',
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.tec.rank).toBe('B');
    expect(badges.tec.score).toBeLessThan(60);
  });

  it('gives TEC-B for excessive resource use', () => {
    const stats = makeStats({
      turns: 25,
      fusionsPerformed: 6,
      spellsActivated: 9,
      trapsActivated: 6,
      lpRemaining: 1000,
      graveyardSize: 22,
      endReason: 'lp_zero',
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.tec.rank).toBe('B');
    expect(badges.tec.score).toBeLessThan(60);
  });

  it('penalizes deck-out for TEC (-12 point swing)', () => {
    const lpStats = makeStats({ endReason: 'lp_zero' });
    const deckOutStats = makeStats({ endReason: 'deck_out' });
    const lpScore = calculateBattleBadges(lpStats).tec.score;
    const deckOutScore = calculateBattleBadges(deckOutStats).tec.score;
    expect(lpScore - deckOutScore).toBe(12);
  });
});

// ── Best rank & multiplier ───────────────────────────────────

describe('calculateBattleBadges – best rank & multiplier', () => {
  it('picks the best rank across both badges (POW-S from fast win)', () => {
    const stats = makeStats({
      turns: 3, monstersPlayed: 2, fusionsPerformed: 1,
      spellsActivated: 0, trapsActivated: 0,
      cardsDrawn: 3, lpRemaining: 8000, graveyardSize: 2,
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.pow.rank).toBe('S');
    expect(badges.tec.rank).toBe('B');
    expect(badges.best).toBe('S');
    expect(badges.coinMultiplier).toBe(2.5);
  });

  it('returns 0.8 multiplier for B-rank', () => {
    const stats = makeStats({
      turns: 30, monstersPlayed: 14, fusionsPerformed: 6,
      spellsActivated: 10, trapsActivated: 5,
      cardsDrawn: 30, lpRemaining: 500, graveyardSize: 25,
      endReason: 'deck_out',
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.best).toBe('B');
    expect(badges.coinMultiplier).toBe(0.8);
  });

  it('returns S from TEC when tactical play is used', () => {
    const stats = makeStats({
      turns: 10, monstersPlayed: 5, fusionsPerformed: 2,
      spellsActivated: 3, trapsActivated: 2,
      cardsDrawn: 10, lpRemaining: 7000, graveyardSize: 10,
      opponentLpRemaining: 0,
    });
    const badges = calculateBattleBadges(stats);
    expect(badges.tec.rank).toBe('S');
    expect(badges.best).toBe('S');
    expect(badges.coinMultiplier).toBe(2.5);
  });

  it('includes cardDropCount from default config', () => {
    const sStats = makeStats({
      turns: 3, monstersPlayed: 2, fusionsPerformed: 1,
      spellsActivated: 0, trapsActivated: 0,
      cardsDrawn: 3, lpRemaining: 8000, graveyardSize: 2,
    });
    const sBadges = calculateBattleBadges(sStats);
    expect(sBadges.best).toBe('S');
    expect(sBadges.cardDropCount).toBe(3);

    const bStats = makeStats({
      turns: 30, monstersPlayed: 14, fusionsPerformed: 6,
      spellsActivated: 10, trapsActivated: 5,
      cardsDrawn: 30, lpRemaining: 500, graveyardSize: 25,
      endReason: 'deck_out',
    });
    const bBadges = calculateBattleBadges(bStats);
    expect(bBadges.best).toBe('B');
    expect(bBadges.cardDropCount).toBe(0);
  });

  it('uses custom reward config when provided', () => {
    const customConfig = {
      ranks: {
        S: { coinMultiplier: 3.0, cardDropCount: 5 },
        A: { coinMultiplier: 1.5, cardDropCount: 2 },
        B: { coinMultiplier: 1.0, cardDropCount: 1 },
      },
    };
    const stats = makeStats({
      turns: 30, monstersPlayed: 14, fusionsPerformed: 6,
      spellsActivated: 10, trapsActivated: 5,
      cardsDrawn: 30, lpRemaining: 500, graveyardSize: 25,
      endReason: 'deck_out',
    });
    const badges = calculateBattleBadges(stats, customConfig);
    expect(badges.best).toBe('B');
    expect(badges.coinMultiplier).toBe(1.0);
    expect(badges.cardDropCount).toBe(1);
  });
});

// ── Card drops ───────────────────────────────────────────────

describe('rollBadgeCardDrops', () => {
  it('returns the requested number of card IDs', () => {
    const drops = rollBadgeCardDrops(['1', '2', '3', '54', '55'], 3);
    expect(drops).toHaveLength(3);
    drops.forEach(id => expect(typeof id).toBe('string'));
  });

  it('returns empty array for empty deck', () => {
    const drops = rollBadgeCardDrops([], 3);
    expect(drops).toEqual([]);
  });

  it('de-duplicates deck IDs before picking', () => {
    // Even with dupes, should still return valid picks
    const drops = rollBadgeCardDrops(['54', '54', '54', '55', '55'], 3);
    expect(drops).toHaveLength(3);
  });

  it('handles numeric deck IDs', () => {
    const drops = rollBadgeCardDrops([54, 55, 56], 2);
    expect(drops).toHaveLength(2);
  });
});

describe('rollFromDropPool', () => {
  it('returns the requested number of card IDs', () => {
    const pool = [
      { cardId: '10', weight: 100 },
      { cardId: '20', weight: 50 },
      { cardId: '30', weight: 1 },
    ];
    const drops = rollFromDropPool(pool, 3);
    expect(drops).toHaveLength(3);
    drops.forEach(id => expect(['10', '20', '30']).toContain(id));
  });

  it('returns empty array for empty pool', () => {
    expect(rollFromDropPool([], 3)).toEqual([]);
  });

  it('returns empty array for zero-weight pool', () => {
    expect(rollFromDropPool([{ cardId: '1', weight: 0 }], 3)).toEqual([]);
  });

  it('always picks the only entry when pool has one item', () => {
    const pool = [{ cardId: '42', weight: 7 }];
    const drops = rollFromDropPool(pool, 5);
    expect(drops).toHaveLength(5);
    drops.forEach(id => expect(id).toBe('42'));
  });

  it('respects weights (heavily weighted item dominates)', () => {
    const pool = [
      { cardId: 'common', weight: 9999 },
      { cardId: 'rare', weight: 1 },
    ];
    const drops = rollFromDropPool(pool, 100);
    const rareCount = drops.filter(id => id === 'rare').length;
    expect(rareCount).toBeLessThan(10);
  });
});
