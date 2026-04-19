import { CARD_DB, checkFusion } from './cards.js';
import type { CardData } from './types.js';
import type { FieldCard } from './field.js';
import { isMonsterType } from './types.js';
export type { FusionChainCandidate, FusionChainScoring };
export { buildFusionChainFromPair, findAllFusionChains, findBestFusionChain, findBestHandFieldFusion };

/**
 * Result of a single fusion chain attempt.
 */
export interface FusionChainCandidate {
  /** Indices of cards in hand used in the chain */
  indices: number[];
  /** Card IDs consumed in the chain (all materials except final result if it existed in hand) */
  consumedIds: string[];
  /** Final card ID after all fusions */
  finalCardId: string;
  /** Final card's ATK */
  finalATK: number;
  /** Field zone index if hand+field fusion, undefined for hand-only */
  fieldZone?: number;
}

/**
 * Scoring function interface for custom chain evaluation.
 * Different callers can provide different scoring strategies.
 */
export interface FusionChainScoring {
  /**
   * Score a fusion chain candidate.
   * Higher score = better chain.
   */
  scoreChain: (chain: FusionChainCandidate) => number;
}

/**
 * Build a fusion chain starting from two cards and extending with remaining hand cards.
 * This is the core algorithm extracted from the original duplications.
 *
 * @param hand - All cards in hand
 * @param startIdx1 - Index of first fusion material in hand
 * @param startIdx2 - Index of second fusion material in hand
 * @returns FusionChainCandidate with the best chain (max ATK) from this starting pair
 */
export function buildFusionChainFromPair(
  hand: CardData[],
  startIdx1: number,
  startIdx2: number,
): FusionChainCandidate {
  const recipe = checkFusion(hand[startIdx1].id, hand[startIdx2].id);
  if (!recipe) {
    // Should not happen if caller checked, but safety fallback
    return {
      indices: [],
      consumedIds: [],
      finalCardId: '',
      finalATK: 0,
    };
  }

  const resultCard = CARD_DB[recipe.result];
  if (!resultCard) {
    return {
      indices: [],
      consumedIds: [],
      finalCardId: '',
      finalATK: 0,
    };
  }

  // Start the chain with the two materials
  let chain = [startIdx1, startIdx2];
  let currentId = recipe.result;
  let currentATK = resultCard.atk ?? 0;

  const used = new Set(chain);

  // Extend chain as long as we can find better ATK results
  let improved = true;
  while (improved) {
    improved = false;
    let bestExtIdx = -1;
    let bestExtATK = currentATK;
    let bestExtId = currentId;

    // Try extending with each unused card in hand
    for (let k = 0; k < hand.length; k++) {
      if (used.has(k)) continue;

      const extRecipe = checkFusion(currentId, hand[k].id);
      if (!extRecipe) continue;

      const extCard = CARD_DB[extRecipe.result];
      if (!extCard) continue;

      const extATK = extCard.atk ?? 0;
      if (extATK > bestExtATK) {
        bestExtATK = extATK;
        bestExtIdx = k;
        bestExtId = extRecipe.result;
      }
    }

    // If we found a better extension, apply it
    if (bestExtIdx !== -1) {
      chain = [...chain, bestExtIdx];
      used.add(bestExtIdx);
      currentId = bestExtId;
      currentATK = bestExtATK;
      improved = true;
    }
  }

  // Build consumedIds: all cards in the chain except the final result
  // (The final result card stays as the result, others go to graveyard)
  const consumedIds = chain
    .filter(idx => hand[idx].id !== currentId)
    .map(idx => hand[idx].id);

  return {
    indices: chain,
    consumedIds,
    finalCardId: currentId,
    finalATK: currentATK,
  };
}

/**
 * Find all possible fusion chains from hand cards.
 *
 * @param hand - All cards in hand
 * @param scoring - Optional scoring strategy (defaults to ATK-only)
 * @returns Array of fusion chain candidates, sorted by score (highest first)
 */
export function findAllFusionChains(
  hand: CardData[],
  scoring?: FusionChainScoring,
): FusionChainCandidate[] {
  const defaultScoring: FusionChainScoring = {
    scoreChain: (chain) => chain.finalATK,
  };

  const scorer = scoring ?? defaultScoring;
  const candidates: FusionChainCandidate[] = [];

  // Try all pairs in hand
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const recipe = checkFusion(hand[i].id, hand[j].id);
      if (!recipe) continue;

      const candidate = buildFusionChainFromPair(hand, i, j);
      if (candidate.indices.length > 0) {
        candidates.push(candidate);
      }
    }
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => {
    const scoreA = scorer.scoreChain(a);
    const scoreB = scorer.scoreChain(b);
    return scoreB - scoreA;
  });

  return candidates;
}

/**
 * Find the best fusion chain from hand cards using custom scoring.
 *
 * @param hand - All cards in hand
 * @param scoring - Scoring strategy (required for meaningful results)
 * @param minScore - Minimum score threshold (chains below this are rejected)
 * @returns Best chain candidate or null if none meet threshold
 */
export function findBestFusionChain(
  hand: CardData[],
  scoring: FusionChainScoring,
  minScore: number = 0,
): FusionChainCandidate | null {
  const candidates = findAllFusionChains(hand, scoring);

  if (candidates.length === 0) return null;

  const best = candidates[0];
  const score = scoring.scoreChain(best);

  if (score < minScore) return null;

  return best;
}

/**
 * Find the best fusion chain involving hand + field monster.
 *
 * @param hand - All cards in hand
 * @param fieldMonsters - Field monsters (array where null = empty zone)
 * @param scoring - Scoring strategy
 * @param minScore - Minimum score threshold
 * @returns Best chain with field zone info, or null if none meet threshold
 */
export function findBestHandFieldFusion(
  hand: CardData[],
  fieldMonsters: Array<FieldCard | null>,
  scoring: FusionChainScoring,
  minScore: number = 0,
): { indices: number[]; fieldZone: number; resultCardId: string; resultATK: number } | null {
  let bestResult: {
    indices: number[];
    fieldZone: number;
    resultCardId: string;
    resultATK: number;
    score: number;
  } | null = null;

  for (let i = 0; i < hand.length; i++) {
    if (!isMonsterType(hand[i].type)) continue;

    for (let z = 0; z < fieldMonsters.length; z++) {
      const fieldFC = fieldMonsters[z];
      if (!fieldFC) continue;

      const recipe = checkFusion(hand[i].id, fieldFC.card.id);
      if (!recipe) continue;

      const resultCard = CARD_DB[recipe.result];
      if (!resultCard) continue;

      const resultATK = resultCard.atk ?? 0;
      const fieldATK = fieldFC.effectiveATK();

      // Only fuse if result is better than current field monster
      if (resultATK <= fieldATK) continue;

      const candidate: FusionChainCandidate = {
        indices: [i],
        consumedIds: [hand[i].id, fieldFC.card.id],
        finalCardId: recipe.result,
        finalATK: resultATK,
        fieldZone: z,
      };

      const score = scoring.scoreChain(candidate);

      if (bestResult === null || score > bestResult.score) {
        bestResult = {
          indices: [i],
          fieldZone: z,
          resultCardId: recipe.result,
          resultATK,
          score,
        };
      }
    }
  }

  if (!bestResult || bestResult.score < minScore) return null;

  return {
    indices: bestResult.indices,
    fieldZone: bestResult.fieldZone,
    resultCardId: bestResult.resultCardId,
    resultATK: bestResult.resultATK,
  };
}
