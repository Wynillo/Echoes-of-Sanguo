import type { DuelStats } from './types.js';
import { CARD_DB } from './cards.js';
import { DEFAULT_RARITY_PROBABILITIES, RARITY_DROP_RATES } from './react/utils/pack-logic.js';
import type { DuelRewardConfig, BadgeRank, DropPoolEntry } from './reward-config.js';
import { DEFAULT_REWARD_CONFIG, getRankEffect } from './reward-config.js';

export type { BadgeRank } from './reward-config.js';
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
  cardDropCount: number;
}

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

function scorePOW(stats: DuelStats): number {
  let score = 50;

  score += stats.endReason === 'lp_zero' ? 2 : -20;

  score += rangeScore(stats.turns, [
    [4, 14], [8, 8], [12, 2], [20, -4], [28, -10], [Infinity, -14],
  ]);

  score += rangeScore(stats.fusionsPerformed, [
    [0, -4], [1, 4], [3, 6], [5, 2], [Infinity, 0],
  ]);

  score += rangeScore(stats.lpRemaining, [
    [999, -6], [3999, 0], [5999, 2], [7999, 6], [Infinity, 10],
  ]);

  score += rangeScore(stats.opponentLpRemaining, [
    [0, 4], [999, 0], [Infinity, -6],
  ]);

  score += rangeScore(stats.cardsDrawn, [
    [5, 6], [10, 2], [15, 0], [25, -4], [Infinity, -8],
  ]);

  score += rangeScore(stats.monstersPlayed, [
    [3, 2], [6, 0], [10, -2], [Infinity, -6],
  ]);

  return score;
}

function rankPOW(score: number): BadgeRank {
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  return 'B';
}

function scoreTEC(stats: DuelStats): number {
  let score = 50;

  score += stats.endReason === 'lp_zero' ? 2 : -10;

  score += rangeScore(stats.spellsActivated, [
    [0, -6], [1, 2], [3, 8], [5, 4], [8, 0], [Infinity, -6],
  ]);

  score += rangeScore(stats.trapsActivated, [
    [0, -4], [1, 4], [3, 8], [5, 2], [Infinity, -4],
  ]);

  score += rangeScore(stats.fusionsPerformed, [
    [0, -4], [1, 2], [3, 6], [5, 2], [Infinity, -2],
  ]);

  score += rangeScore(stats.lpRemaining, [
    [999, -4], [3999, 0], [5999, 2], [7999, 4], [Infinity, 6],
  ]);

  score += rangeScore(stats.turns, [
    [4, 2], [8, 4], [12, 6], [16, 2], [24, -2], [Infinity, -6],
  ]);

  score += rangeScore(stats.graveyardSize, [
    [4, -2], [8, 2], [14, 4], [20, 0], [Infinity, -4],
  ]);

  return score;
}

function rankTEC(score: number): BadgeRank {
  // Same direction as POW: higher = better
  if (score >= 80) return 'S';
  if (score >= 60) return 'A';
  return 'B';
}

export function calculateBattleBadges(stats: DuelStats, rewardConfig?: DuelRewardConfig): BattleBadges {
  const powScore = scorePOW(stats);
  const tecScore = scoreTEC(stats);

  const pow: BadgeResult = { category: 'POW', rank: rankPOW(powScore), score: powScore };
  const tec: BadgeResult = { category: 'TEC', rank: rankTEC(tecScore), score: tecScore };
  const best = bestRank(pow.rank, tec.rank);
  const effect = getRankEffect(rewardConfig ?? DEFAULT_REWARD_CONFIG, best);

  return { pow, tec, best, coinMultiplier: effect.coinMultiplier, cardDropCount: effect.cardDropCount };
}

const RARITY_FALLBACK: Rarity[] = [
  8, 6, 4, 2, 1,
];

function rollRarity(customRates?: Partial<Record<Rarity, number>>): Rarity {
  const rates = customRates
    ? { ...DEFAULT_RARITY_PROBABILITIES, ...Object.fromEntries(Object.entries(customRates).map(([k, v]) => [k, v])) }
    : DEFAULT_RARITY_PROBABILITIES;
  const r = Math.random();
  let cumulative = 0;
  const entries = Object.entries(rates)
    .map(([k, v]) => [Number(k), v] as [number, number])
    .sort((a, b) => a[1] - b[1]);
  for (const [rarity, prob] of entries) {
    cumulative += prob;
    if (r < cumulative) return rarity as Rarity;
  }
  return 1;
}

/**
 * Pick `count` random cards from the opponent's deck pool, weighted by rarity.
 * Falls back to lower rarities if no cards match the rolled rarity.
 */
export function rollBadgeCardDrops(
  opponentDeckIds: (string | number)[],
  count: number,
  customRarityRates?: Partial<Record<Rarity, number>>,
): string[] {
  // De-duplicate deck IDs and resolve card data
  const uniqueIds = [...new Set(opponentDeckIds.map(String))];
  const cards = uniqueIds.map(id => CARD_DB[id]).filter(Boolean);
  if (cards.length === 0) return [];

  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const targetRarity = rollRarity(customRarityRates);

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

export function rollFromDropPool(pool: DropPoolEntry[], count: number): string[] {
  if (pool.length === 0) return [];

  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) return [];

  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let roll = Math.random() * totalWeight;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) {
        result.push(entry.cardId);
        break;
      }
    }
    if (result.length <= i) result.push(pool[pool.length - 1].cardId);
  }
  return result;
}
