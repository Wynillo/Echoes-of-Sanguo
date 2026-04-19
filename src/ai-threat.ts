import type { AIGoal, BoardSnapshot, PlayerState } from './types.js';
import { AI_SCORE } from './ai-behaviors.js';

/** Create a lightweight board snapshot from live player states. */
export function snapshotBoard(ai: PlayerState, plr: PlayerState): BoardSnapshot {
  let aiMonsterPower = 0;
  for (const fc of ai.field.monsters) {
    if (fc) aiMonsterPower += fc.effectiveATK();
  }
  let plrMonsterPower = 0;
  for (const fc of plr.field.monsters) {
    if (fc) plrMonsterPower += fc.effectiveATK();
  }
  return {
    opponentLp:      ai.lp,
    playerLp:        plr.lp,
    aiMonsterPower,
    plrMonsterPower,
    aiHandSize:      ai.hand.length,
    plrHandSize:     plr.hand.length,
  };
}

/**
 * Compute a signed threat score from a board snapshot.
 * Positive = AI is ahead. Negative = AI is losing.
 */
export function computeBoardThreat(snap: BoardSnapshot): number {
  const plrLpSafe = snap.playerLp > 0 ? snap.playerLp : 1;
  const lpRatio = (snap.opponentLp / plrLpSafe - 1) * AI_SCORE.THREAT_LP_WEIGHT * 8000;
  const boardDiff = (snap.aiMonsterPower - snap.plrMonsterPower) * AI_SCORE.THREAT_BOARD_WEIGHT;
  const handAdv = (snap.aiHandSize - snap.plrHandSize) * AI_SCORE.THREAT_HAND_WEIGHT;
  return lpRatio + boardDiff + handAdv;
}

/**
 * One-step lookahead: how much does the board threat improve after an action?
 * Returns gamma * delta, or 0 when lookahead is disabled (gamma === 0).
 */
export function estimateFutureValue(
  snapBefore: BoardSnapshot,
  snapAfter:  BoardSnapshot,
  gamma:      number,
): number {
  if (gamma === 0) return 0;
  const delta = computeBoardThreat(snapAfter) - computeBoardThreat(snapBefore);
  return gamma * delta;
}

export type AIActionType =
  | 'fusion'
  | 'summon'
  | 'spell_damage'
  | 'spell_heal'
  | 'set_trap'
  | 'attack';

/**
 * Returns the alignment bonus when the action type matches the active goal,
 * or 0 if there is no goal or no match.
 */
export function classifyGoalAlignment(
  actionType: AIActionType,
  goal: AIGoal | undefined,
): number {
  if (!goal) return 0;
  const b = goal.alignmentBonus;
  switch (goal.id) {
    case 'fusion_otk':
      if (actionType === 'fusion')       return b;
      if (actionType === 'spell_damage') return Math.round(b * 0.7);
      if (actionType === 'set_trap')     return Math.round(b * 0.3);
      return 0;
    case 'stall_drain':
      if (actionType === 'spell_heal')   return b;
      if (actionType === 'set_trap')     return Math.round(b * 0.8);
      if (actionType === 'attack')       return Math.round(b * 0.4);
      return 0;
    case 'swarm_aggro':
      if (actionType === 'summon')       return b;
      if (actionType === 'attack')       return b;
      if (actionType === 'fusion')       return Math.round(b * 0.6);
      return 0;
    case 'control':
      if (actionType === 'spell_damage') return b;
      if (actionType === 'attack')       return Math.round(b * 0.8);
      if (actionType === 'fusion')       return Math.round(b * 0.5);
      return 0;
  }
}

/**
 * Evaluate whether the goal is still active this turn.
 * Returns undefined when switchTurn has been reached (goal deactivates).
 */
export function evaluateTurnGoal(turn: number, goal: AIGoal | undefined): AIGoal | undefined {
  if (!goal) return undefined;
  if (goal.switchTurn !== undefined && turn >= goal.switchTurn) return undefined;
  return goal;
}
