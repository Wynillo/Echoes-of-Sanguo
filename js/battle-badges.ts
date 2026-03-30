import type { DuelStats } from './types.js';
import { Rarity } from './types.js';
import { CARD_DB } from './cards.js';
import { RARITY_DROP_RATES } from './react/utils/pack-logic.js';

// ── Types ────────────────────────────────────────────────────

export type BadgeRank = 'S' | 'A' | 'B';
export type BadgeCategory = 'POW' | 'TEC';

export interface BadgeResult {
  category: BadgeCategory;
  rank: BadgeRank;
  score: number;
}

export interface BattleBadges {
  pow: BadgeResult;
  tec: BadgeResult;
  best: BadgeRank;
  coinMultiplier: number;
}

// ── Helpers ──────────────────────────────────────────────────

/** Pick the first matching range value. Ranges are [max, modifier] checked with <=. */
function rangeScore(value: number, ranges: [number, number][]): number {
  for (const [max, mod] of ranges) {
    if (value <= max) return mod;
  }
  return ranges[ranges.length - 1][1];
}

const RANK_ORDER: Record<BadgeRank, number> = { S: 3, A: 2, B: 1 };

function bestRank(a: BadgeRank, b: BadgeRank): BadgeRank {
  return RANK_ORDER[a] >= RANK_ORDER[b] ? a : b;
}

function multiplierForRank(rank: BadgeRank): number {
  switch (rank) {
    case 'S': return 2.5;
    case 'A': return 1.0;
    case 'B': return 0.8;
  }
}

// ── POW scoring ──────────────────────────────────────────────

function scorePOW(stats: DuelStats): number {
  let score = 50;

  // Victory condition
  score += stats.endReason === 'lp_zero' ? 2 : -20;

  // Turns
  score += rangeScore(stats.turns, [
    [4, 12], [8, 8], [16, 0], [24, -8], [Infinity, -12],
  ]);

  // Monsters played
  score += rangeScore(stats.monstersPlayed, [
    [3, 4], [6, 2], [10, 0], [15, -4], [Infinity, -8],
  ]);

  // Fusions performed (fusions = power)
  score += rangeScore(stats.fusionsPerformed, [
    [0, -2], [2, 4], [4, 2], [Infinity, 0],
  ]);

  // LP remaining
  score += rangeScore(stats.lpRemaining, [
    [999, -4], [3999, 0], [6999, 2], [7999, 6], [Infinity, 8],
  ]);

  // Opponent LP remaining (lower = better for POW)
  score += rangeScore(stats.opponentLpRemaining, [
    [0, 2], [999, 0], [Infinity, -4],
  ]);

  // Cards drawn (fewer = faster game)
  score += rangeScore(stats.cardsDrawn, [
    [5, 4], [10, 2], [20, 0], [30, -4], [Infinity, -8],
  ]);

  return score;
}

function rankPOW(score: number): BadgeRank {
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  return 'B';
}

// ── TEC scoring ──────────────────────────────────────────────

function scoreTEC(stats: DuelStats): number {
  let score = 50;

  // Victory condition — LP win is clean, deck out is sloppy
  score += stats.endReason === 'lp_zero' ? 2 : -20;

  // Turns (fewer = more efficient)
  score += rangeScore(stats.turns, [
    [4, 12], [8, 8], [16, 0], [24, -8], [Infinity, -12],
  ]);

  // Spells activated (fewer = more technical)
  score += rangeScore(stats.spellsActivated, [
    [0, 8], [2, 4], [4, 0], [8, -6], [Infinity, -12],
  ]);

  // Traps activated (fewer = more technical, heavy penalty)
  score += rangeScore(stats.trapsActivated, [
    [0, 6], [1, 0], [3, -10], [5, -18], [Infinity, -26],
  ]);

  // Fusions performed (fewer = more technical)
  score += rangeScore(stats.fusionsPerformed, [
    [0, 6], [2, 0], [4, -4], [8, -8], [Infinity, -12],
  ]);

  // Monsters played (fewer = more efficient)
  score += rangeScore(stats.monstersPlayed, [
    [3, 8], [6, 2], [10, 0], [15, -6], [Infinity, -10],
  ]);

  // LP remaining (high = clean win)
  score += rangeScore(stats.lpRemaining, [
    [999, -4], [3999, -2], [6999, 0], [7999, 4], [Infinity, 6],
  ]);

  // Graveyard size (fewer resources spent = more technical)
  score += rangeScore(stats.graveyardSize, [
    [4, 8], [8, 4], [14, 0], [20, -6], [Infinity, -10],
  ]);

  return score;
}

function rankTEC(score: number): BadgeRank {
  // Same direction as POW: higher = better
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  return 'B';
}

// ── Public API ───────────────────────────────────────────────

export function calculateBattleBadges(stats: DuelStats): BattleBadges {
  const powScore = scorePOW(stats);
  const tecScore = scoreTEC(stats);

  const pow: BadgeResult = { category: 'POW', rank: rankPOW(powScore), score: powScore };
  const tec: BadgeResult = { category: 'TEC', rank: rankTEC(tecScore), score: tecScore };
  const best = bestRank(pow.rank, tec.rank);

  return { pow, tec, best, coinMultiplier: multiplierForRank(best) };
}

// ── S-rank card drops ────────────────────────────────────────

const RARITY_FALLBACK: Rarity[] = [
  Rarity.UltraRare, Rarity.SuperRare, Rarity.Rare, Rarity.Uncommon, Rarity.Common,
];

function rollRarity(): Rarity {
  const r = Math.random();
  let cumulative = 0;
  const entries = Object.entries(RARITY_DROP_RATES)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[1] - b[1]);
  for (const [rarity, prob] of entries) {
    cumulative += prob;
    if (r < cumulative) return rarity as Rarity;
  }
  return Rarity.Common;
}

/**
 * Pick `count` random cards from the opponent's deck pool, weighted by rarity.
 * Falls back to lower rarities if no cards match the rolled rarity.
 */
export function rollBadgeCardDrops(opponentDeckIds: (string | number)[], count: number): string[] {
  // De-duplicate deck IDs and resolve card data
  const uniqueIds = [...new Set(opponentDeckIds.map(String))];
  const cards = uniqueIds.map(id => CARD_DB[id]).filter(Boolean);
  if (cards.length === 0) return [];

  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const targetRarity = rollRarity();

    // Find cards at target rarity, falling back to lower rarities
    const fallbackIdx = RARITY_FALLBACK.indexOf(targetRarity);
    let pool = cards.filter(c => c.rarity === targetRarity);

    if (pool.length === 0) {
      // Walk down the fallback chain
      for (let j = fallbackIdx + 1; j < RARITY_FALLBACK.length; j++) {
        pool = cards.filter(c => c.rarity === RARITY_FALLBACK[j]);
        if (pool.length > 0) break;
      }
    }

    // If still empty (shouldn't happen), pick any card
    if (pool.length === 0) pool = cards;

    const pick = pool[Math.floor(Math.random() * pool.length)];
    result.push(String(pick.id));
  }

  return result;
}
