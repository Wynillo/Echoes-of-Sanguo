import { CARD_DB, checkFusion } from './cards';
import type { CardData } from './types';
import type { FieldCard } from './field';
import { isMonsterType } from './types';

export interface FusionChainCandidate {
  indices: number[];
  consumedIds: string[];
  finalCardId: string;
  finalATK: number;
  fieldZone?: number;
}

export interface FusionChainScoring {
  scoreChain: (chain: FusionChainCandidate) => number;
}

export function buildFusionChainFromPair(
  hand: CardData[],
  startIdx1: number,
  startIdx2: number,
): FusionChainCandidate {
  const recipe = checkFusion(hand[startIdx1].id, hand[startIdx2].id);
  if (!recipe) {
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

  let chain = [startIdx1, startIdx2];
  let currentId = recipe.result;
  let currentATK = resultCard.atk ?? 0;

  const used = new Set(chain);

  let improved = true;
  while (improved) {
    improved = false;
    let bestExtIdx = -1;
    let bestExtATK = currentATK;
    let bestExtId = currentId;

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

    if (bestExtIdx !== -1) {
      chain = [...chain, bestExtIdx];
      used.add(bestExtIdx);
      currentId = bestExtId;
      currentATK = bestExtATK;
      improved = true;
    }
  }

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

export function findAllFusionChains(
  hand: CardData[],
  scoring?: FusionChainScoring,
): FusionChainCandidate[] {
  const defaultScoring: FusionChainScoring = {
    scoreChain: (chain) => chain.finalATK,
  };

  const scorer = scoring ?? defaultScoring;
  const candidates: FusionChainCandidate[] = [];

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

  candidates.sort((a, b) => {
    const scoreA = scorer.scoreChain(a);
    const scoreB = scorer.scoreChain(b);
    return scoreB - scoreA;
  });

  return candidates;
}

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
