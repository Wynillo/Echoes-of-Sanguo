import type { AIGoal, BoardSnapshot, PlayerState } from './types.js';
import { AI_SCORE } from './ai-behaviors.js';
import { GAME_RULES } from './rules.js';

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
 *
 * Threat score combines three factors:
 * - LP ratio: scaled by GAME_RULES.STARTING_LP so the (opponentLp/playerLp - 1) ratio lives in
 *   the same ~8000-point range as board power (ATK totals typically 2000–6000), keeping
 *   LP relevant without dominating the score.
 * - Board differential: raw ATK difference weighted by THREAT_BOARD_WEIGHT
 * - Hand advantage: per-card value weighted by THREAT_HAND_WEIGHT
 */
export function computeBoardThreat(snap: BoardSnapshot): number {
  const playerLpSafe = snap.playerLp > 0 ? snap.playerLp : 1;
  const lpRatio = (snap.opponentLp / playerLpSafe - 1) * AI_SCORE.THREAT_LP_WEIGHT * GAME_RULES.STARTING_LP;
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
 * Goal alignment multipliers - represent priority weighting for each action type.
 * Multipliers scale the goal's alignmentBonus based on how well the action supports the strategy.
 * 
 * Scale: 1.0 = core to strategy (100% bonus), 0.5-0.8 = supportive (50-80% bonus), 0.3-0.4 = situational (30-40% bonus)
 */
const GOAL_ALIGNMENT = {
  fusion_otk: {
    /** Fusion is the primary win condition - full bonus */
    fusion:       1.0,
    /** Damage spells help secure OTK - high priority */
    spell_damage: 0.7,
    /** Trap is distraction only - low priority */
    set_trap:     0.3,
  },
  stall_drain: {
    /** Healing extends the stall - full bonus */
    spell_heal:   1.0,
    /** Traps protect while stalling - high priority */
    set_trap:     0.8,
    /** Attacks risky during stall - low priority */
    attack:       0.4,
  },
  swarm_aggro: {
    /** Swarming monsters is core strategy - full bonus */
    summon:       1.0,
    /** Aggressive attacks are win condition - full bonus */
    attack:       1.0,
    /** Fusion helps but slows swarming - moderate priority */
    fusion:       0.6,
  },
  control: {
    /** Damage/control spells are primary tools - full bonus */
    spell_damage: 1.0,
    /** Attacks after establishing control - high priority */
    attack:       0.8,
    /** Fusion is situational in control - moderate priority */
    fusion:       0.5,
  },
} as const;

/**
 * Returns the alignment bonus when the action type matches the active goal,
 * or 0 if there is no goal or no match.
 * 
 * The bonus is scaled by the goal-action multipliers in GOAL_ALIGNMENT.
 * Example: fusion_otk goal with 1200 bonus gives:
 * - fusion action: 1200 * 1.0 = 1200
 * - spell_damage:  1200 * 0.7 = 840
 * - set_trap:      1200 * 0.3 = 360
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
      if (actionType === 'spell_damage') return Math.round(b * GOAL_ALIGNMENT.fusion_otk.spell_damage);
      if (actionType === 'set_trap')     return Math.round(b * GOAL_ALIGNMENT.fusion_otk.set_trap);
      return 0;
    case 'stall_drain':
      if (actionType === 'spell_heal')   return b;
      if (actionType === 'set_trap')     return Math.round(b * GOAL_ALIGNMENT.stall_drain.set_trap);
      if (actionType === 'attack')       return Math.round(b * GOAL_ALIGNMENT.stall_drain.attack);
      return 0;
    case 'swarm_aggro':
      if (actionType === 'summon')       return b;
      if (actionType === 'attack')       return b;
      if (actionType === 'fusion')       return Math.round(b * GOAL_ALIGNMENT.swarm_aggro.fusion);
      return 0;
    case 'control':
      if (actionType === 'spell_damage') return b;
      if (actionType === 'attack')       return Math.round(b * GOAL_ALIGNMENT.control.attack);
      if (actionType === 'fusion')       return Math.round(b * GOAL_ALIGNMENT.control.fusion);
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
