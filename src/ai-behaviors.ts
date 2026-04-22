import type { AIBehavior, AISpellRule, CardData, PlayerState, Owner } from './types.js';
import { CardType, meetsEquipRequirement } from './types.js';
import type { FieldCard } from './field.js';

export const AI_SCORE = {
  /**
   * Bonus for effect monsters - prioritizes cards with triggered abilities.
   * Set to 10000 to heavily outweigh raw ATK differences (typically 200-500 ATK).
   * Ensures AI values effect utility over pure stats.
   */
  EFFECT_CARD_BONUS:      10000,
  /**
   * Base score for destroying an opponent's monster.
   * Worth 1000 points - equivalent to ~1000 ATK advantage.
   * Removing threats is a core strategic priority.
   */
  DESTROY_TARGET:         1000,
  /**
   * Bonus for probing face-down monsters with high-ATK attackers.
   * Worth 200 points - minor incentive to reveal hidden information.
   * Applied when attacker ATK >= PROBE_ATK_THRESHOLD.
   */
  STRONG_PROBE:           200,
  /**
   * Minimum ATK required to safely probe face-down monsters.
   * Set to 1800 - high enough to survive most DEF monsters but not reckless.
   * Monsters below this threshold are penalized for probing.
   */
  PROBE_ATK_THRESHOLD:    1800,
  /**
   * Penalty for attacking face-down monsters with insufficient force.
   * Worth -300 points - discourages risky attacks that might flip into strong DEF.
   * Applied when attacker ATK < PROBE_ATK_THRESHOLD.
   */
  FACEDOWN_RISK:          300,
  /**
   * Bonus for equipment cards that enable lethal attacks.
   * Worth 2000 points - high priority for game-winning plays.
   * Applied when equipment pushes monster ATK above opponent's strongest.
   */
  EQUIP_UNLOCK_KILL:      2000,
  /**
   * Bonus for reviving monsters that outscore opponent's strongest.
   * Worth 1000 points - values field presence and immediate threat response.
   * Applied when revived monster ATK > opponent's max field ATK.
   */
  REVIVE_BEATS_STRONGEST: 1000,
  /**
   * Bonus for buff spells that enable lethal attacks.
   * Worth 800 points - values tempo plays that clear the way.
   * Applied when buff pushes monster ATK above opponent's strongest.
   */
  BUFF_UNLOCK_KILL:       800,
  /**
   * ATK deficit threshold for considering buff spells.
   * Set to 1000 - AI will buff if within 1000 ATK of threatening monster.
   * Buffs beyond this gap are considered inefficient.
   */
  BUFF_KILL_THRESHOLD:    1000,
  /**
   * Survival bonus when AI has low LP and can defend effectively.
   * Worth 300 points - modest priority on staying alive.
   * Applied when AI LP < LOW threshold and DEF > opponent's max ATK.
   */
  LOW_LP_SURVIVAL:        300,
  /**
   * Estimated DEF value for face-down monsters.
   * Set to 1200 - average DEF for mid-level monsters.
   * Used for combat calculations when actual DEF is unknown.
   */
  FACEDOWN_DEF_ESTIMATE:  1200,
  // ── Threat / Future Value weights ──
  /**
   * Weight for LP ratio contribution to threat score.
   * Set to 0.4 - LP differences matter but less than board control.
   * Multiplied by LP_NORMALIZER (8000) to scale with typical LP range.
   */
  THREAT_LP_WEIGHT:       0.4,
  /**
   * Weight for monster power differential in threat score.
   * Set to 1.2 - board control is the primary threat indicator.
   * Direct ATK comparison (~2000-6000 range) needs minimal scaling.
   */
  THREAT_BOARD_WEIGHT:    1.2,
  /**
   * Per-card hand advantage weight in threat score.
   * Set to 150 - each card is worth ~150 points of advantage.
   * Hand size typically ranges 3-8 cards, so total impact ~450-1200.
   */
  THREAT_HAND_WEIGHT:     150,
  /**
   * Default discount factor for future board value.
   * Set to 0.7 - future turns are worth 70% of current turn value.
   * Balances immediate plays vs. long-term setup.
   * Range: 0.0 (myopic) to 1.0 (far-sighted).
   */
  FUTURE_GAMMA_DEFAULT:   0.7,
} as const;

export const AI_LP_THRESHOLD = {
  LOW:       3000,
  DEFENSIVE: 5000,
} as const;

export function aiCombatValue(fc: FieldCard): number {
  return fc.faceDown ? AI_SCORE.FACEDOWN_DEF_ESTIMATE : fc.combatValue();
}

export function aiEffectiveATK(fc: FieldCard): number {
  return fc.faceDown ? 0 : fc.effectiveATK();
}

export function aiEffectiveDEF(fc: FieldCard): number {
  return fc.faceDown ? AI_SCORE.FACEDOWN_DEF_ESTIMATE : fc.effectiveDEF();
}

const DEFAULT: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'highestAtk',
  positionStrategy:       'smart',
  battleStrategy:         'smart',
  spellRules:             {},
  defaultSpellActivation: 'smart',
};

const AGGRESSIVE: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'highestAtk',
  positionStrategy:       'aggressive',
  battleStrategy:         'aggressive',
  spellRules:             {},
  defaultSpellActivation: 'always',
  goal:                   { id: 'swarm_aggro', alignmentBonus: 800 },
  lookaheadDepth:         1,
  gamma:                  0.7,
};

const DEFENSIVE: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           2000,
  summonPriority:         'highestDef',
  positionStrategy:       'defensive',
  battleStrategy:         'conservative',
  spellRules:             {},
  defaultSpellActivation: 'smart',
  goal:                   { id: 'stall_drain', alignmentBonus: 700, switchTurn: 8 },
  lookaheadDepth:         1,
  gamma:                  0.6,
};

const SMART: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'effectFirst',
  positionStrategy:       'smart',
  battleStrategy:         'smart',
  spellRules:             {},
  defaultSpellActivation: 'always',
  goal:                   { id: 'control', alignmentBonus: 600 },
  lookaheadDepth:         1,
  gamma:                  0.75,
  holdFusionPiece:        true,
};

const CHEATING: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'highestAtk',
  positionStrategy:       'aggressive',
  battleStrategy:         'aggressive',
  spellRules:             {},
  defaultSpellActivation: 'always',
  goal:                   { id: 'fusion_otk', alignmentBonus: 1200 },
  lookaheadDepth:         1,
  gamma:                  0.9,
  peekDeckCards:          5,
  knowsPlayerHand:        true,
  peekPlayerDeck:         1,
  holdFusionPiece:        true,
};

export const AI_BEHAVIOR_REGISTRY = new Map<string, AIBehavior>([
  ['default',      DEFAULT],
  ['aggressive',   AGGRESSIVE],
  ['defensive',    DEFENSIVE],
  ['smart',        SMART],
  ['cheating',     CHEATING],
]);

export function resolveAIBehavior(id?: string): Required<AIBehavior> {
  const base: AIBehavior = (id ? AI_BEHAVIOR_REGISTRY.get(id) : undefined) ?? DEFAULT;
  return {
    fusionFirst:            base.fusionFirst            ?? true,
    fusionMinATK:           base.fusionMinATK           ?? 0,
    summonPriority:         base.summonPriority         ?? 'highestAtk',
    positionStrategy:       base.positionStrategy       ?? 'smart',
    battleStrategy:         base.battleStrategy         ?? 'smart',
    spellRules:             base.spellRules             ?? {},
    defaultSpellActivation: base.defaultSpellActivation ?? 'smart',
    goal:                   base.goal,
    lookaheadDepth:         base.lookaheadDepth         ?? 1,
    gamma:                  base.gamma                  ?? AI_SCORE.FUTURE_GAMMA_DEFAULT,
    peekDeckCards:          base.peekDeckCards          ?? 0,
    knowsPlayerHand:        base.knowsPlayerHand        ?? false,
    peekPlayerDeck:         base.peekPlayerDeck         ?? 0,
    holdFusionPiece:        base.holdFusionPiece        ?? false,
  } as Required<AIBehavior>;
}

export function shouldActivateNormalSpell(
  cardId: string,
  behavior: Required<AIBehavior>,
  playerLp: number,
  aiLp: number,
): boolean {
  const rule = behavior.spellRules[cardId];
  if (rule) {
    return evaluateSpellRule(rule, playerLp, aiLp);
  }
  switch (behavior.defaultSpellActivation) {
    case 'always': return true;
    case 'never':  return false;
    case 'smart':  return aiLp < playerLp || aiLp < AI_LP_THRESHOLD.DEFENSIVE;
  }
}

function evaluateSpellRule(rule: AISpellRule, playerLp: number, aiLp: number): boolean {
  const t = rule.threshold ?? 0;
  switch (rule.when) {
    case 'always':      return true;
    case 'opponentLp>$N': return playerLp > t;
    case 'playerLp<$N':  return aiLp < t;
  }
}

export function pickSummonCandidate(hand: CardData[], priority: Required<AIBehavior>['summonPriority']): number {
  let bestIdx = -1;
  let bestScore = -1;

  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];
    if (card.type !== CardType.Monster) continue;

    let score: number;
    switch (priority) {
      case 'highestAtk':
        score = card.atk ?? 0;
        break;
      case 'highestDef':
        score = card.def ?? 0;
        break;
      case 'effectFirst':
        score = (card.effect ? AI_SCORE.EFFECT_CARD_BONUS : 0) + (card.atk ?? 0);
        break;
      case 'lowestLevel':
        // Invert level so lower = higher score (max level 12)
        score = 13 - (card.level ?? 1);
        break;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function decideSummonPosition(
  monsterATK: number,
  monsterDEF: number,
  playerFieldMaxATK: number,
  playerHasMonsters: boolean,
  strategy: Required<AIBehavior>['positionStrategy'],
): 'atk' | 'def' {
  switch (strategy) {
    case 'aggressive':
      return 'atk';
    case 'defensive':
      return 'def';
    case 'smart':
      if (playerHasMonsters && monsterATK < playerFieldMaxATK) {
        return 'def';
      }
      return 'atk';
  }
}

export interface BoardContext {
  aiField: Array<FieldCard | null>;
  playerField: Array<FieldCard | null>;
  playerLp: number;
  aiLp: number;
}

/**
 * Scoring constants for smart summon candidate selection.
 */
export const AI_SUMMON_SCORE = {
  ATK_BASE_MULTIPLIER: 0.5,
  WEAKER_MONSTER_BONUS: 300,
  OUTCLASS_OPPONENT_BONUS: 200,
  DEFENSIVE_BONUS: 100,
  DIRECT_ATTACK_BONUS_MULTIPLIER: 1,
  EFFECT_MONSTER_BONUS: 400,
} as const;

/**
 * Calculate offensive scoring for a summon candidate.
 * Includes base ATK score, bonuses for weaker monsters, and outclass bonus.
 */
function calculateOffensiveScore(
  card: CardData,
  opponentMonsters: FieldCard[],
  opponentMaxATK: number,
): number {
  const atk = card.atk ?? 0;
  let score = atk * AI_SUMMON_SCORE.ATK_BASE_MULTIPLIER;

  for (const pfc of opponentMonsters) {
    const pVal = aiCombatValue(pfc);
    if (atk > pVal) {
      score += AI_SUMMON_SCORE.WEAKER_MONSTER_BONUS;
    }
  }

  if (atk >= opponentMaxATK) {
    score += AI_SUMMON_SCORE.OUTCLASS_OPPONENT_BONUS;
  }

  return score;
}

/**
 * Calculate defensive scoring for a summon candidate.
 * Includes DEF-based bonus and low LP survival bonus.
 */
function calculateDefensiveScore(
  card: CardData,
  opponentMaxATK: number,
  opponentMaxThreat: number,
  aiLp: number,
): number {
  const atk = card.atk ?? 0;
  const def = card.def ?? 0;
  let score = 0;

  if (atk < opponentMaxATK && def >= opponentMaxThreat) {
    score += AI_SUMMON_SCORE.DEFENSIVE_BONUS;
  }

  if (aiLp < AI_LP_THRESHOLD.LOW && def > opponentMaxThreat) {
    score += AI_SCORE.LOW_LP_SURVIVAL;
  }

  return score;
}

/**
 * Calculate direct attack bonus when opponent has no monsters.
 */
function calculateDirectAttackBonus(
  card: CardData,
  hasOpponentMonsters: boolean,
): number {
  if (hasOpponentMonsters) {
    return 0;
  }
  const atk = card.atk ?? 0;
  return atk * AI_SUMMON_SCORE.DIRECT_ATTACK_BONUS_MULTIPLIER;
}

/**
 * Select best monster to summon using multi-factor scoring.
 * Evaluates ATK, DEF, effects, board state, and LP thresholds.
 */
export function pickSmartSummonCandidate(hand: CardData[], ctx: BoardContext): number {
  const playerMonsters = ctx.playerField.filter((fc): fc is FieldCard => fc !== null);
  const playerMaxATK = playerMonsters.reduce((max, fc) =>
    Math.max(max, fc.position === 'atk' ? aiEffectiveATK(fc) : 0), 0);
  const playerMaxThreat = playerMonsters.reduce((max, fc) =>
    Math.max(max, aiEffectiveATK(fc)), 0);

  let bestIdx = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];
    if (card.type !== CardType.Monster) continue;

    let score = 0;

    score += calculateOffensiveScore(card, playerMonsters, playerMaxATK);
    score += calculateDefensiveScore(card, playerMaxATK, playerMaxThreat, ctx.aiLp);
    score += calculateDirectAttackBonus(card, playerMonsters.length > 0);

    if (card.effect) {
      score += AI_SUMMON_SCORE.EFFECT_MONSTER_BONUS;
    }

    if (atk >= playerMaxATK) score += 200;
    else if (def >= playerMaxThreat) score += 100;

    if (playerMonsters.length === 0) score += atk;

    if (card.effect) score += 400;

    if (ctx.aiLp < AI_LP_THRESHOLD.LOW && def > playerMaxThreat) score += AI_SCORE.LOW_LP_SURVIVAL;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export interface AttackPlan {
  attackerZone: number;
  targetZone: number; // -1 = direct attack
}

export function findLethal(
  aiMonsters: Array<FieldCard | null>,
  plrMonsters: Array<FieldCard | null>,
  playerLp: number,
): AttackPlan[] | null {
  const attackers: { zone: number; atk: number; canDirect: boolean }[] = [];
  for (let z = 0; z < aiMonsters.length; z++) {
    const fc = aiMonsters[z];
    if (!fc || fc.position !== 'atk' || fc.hasAttacked || fc.summonedThisTurn) continue;
    attackers.push({ zone: z, atk: fc.effectiveATK(), canDirect: fc.canDirectAttack });
  }

  if (attackers.length === 0) return null;

  const defenders: { zone: number; val: number; inAtk: boolean; cannotBeAttacked: boolean }[] = [];
  for (let z = 0; z < plrMonsters.length; z++) {
    const fc = plrMonsters[z];
    if (!fc) continue;
    defenders.push({
      zone: z,
      val: aiCombatValue(fc),
      inAtk: fc.position === 'atk',
      cannotBeAttacked: fc.cannotBeAttacked,
    });
  }

  const attackableDefenders = defenders.filter(d => !d.cannotBeAttacked);

  const directAttackers = attackers.filter(a => a.canDirect);
  if (attackableDefenders.length === 0) {
    const totalDmg = attackers.reduce((s, a) => s + a.atk, 0);
    if (totalDmg >= playerLp) {
      const sorted = [...attackers].sort((a, b) => b.atk - a.atk);
      return sorted.map(a => ({ attackerZone: a.zone, targetZone: -1 }));
    }
    return null;
  }

  const plan = _simulateLethal(attackers, attackableDefenders, playerLp);
  return plan;
}

function _simulateLethal(
  attackers: { zone: number; atk: number; canDirect: boolean }[],
  defenders: { zone: number; val: number; inAtk: boolean }[],
  playerLp: number,
): AttackPlan[] | null {
  const sorted = [...attackers].sort((a, b) => b.atk - a.atk);
  const remainingDefs = defenders.map(d => ({ ...d, alive: true }));
  const plan: AttackPlan[] = [];
  let dmgToLP = 0;
  const usedAttackers = new Set<number>();

  const atkDefs = remainingDefs.filter(d => d.inAtk).sort((a, b) => a.val - b.val);
  for (const def of atkDefs) {
    const attacker = sorted
      .filter(a => !usedAttackers.has(a.zone) && a.atk > def.val)
      .sort((a, b) => a.atk - b.atk)[0];
    if (attacker) {
      plan.push({ attackerZone: attacker.zone, targetZone: def.zone });
      dmgToLP += attacker.atk - def.val;
      usedAttackers.add(attacker.zone);
      def.alive = false;
    }
  }

  const defDefs = remainingDefs.filter(d => !d.inAtk && d.alive).sort((a, b) => a.val - b.val);
  for (const def of defDefs) {
    const attacker = sorted
      .filter(a => !usedAttackers.has(a.zone) && a.atk > def.val)
      .sort((a, b) => a.atk - b.atk)[0];
    if (attacker) {
      plan.push({ attackerZone: attacker.zone, targetZone: def.zone });
      usedAttackers.add(attacker.zone);
      def.alive = false;
    }
  }

  const allCleared = remainingDefs.every(d => !d.alive);
  const remainingAttackers = sorted.filter(a => !usedAttackers.has(a.zone));
  if (allCleared) {
    for (const a of remainingAttackers) {
      plan.push({ attackerZone: a.zone, targetZone: -1 });
      dmgToLP += a.atk;
    }
  } else {
    for (const a of remainingAttackers) {
      if (a.canDirect) {
        plan.push({ attackerZone: a.zone, targetZone: -1 });
        dmgToLP += a.atk;
      }
    }
  }

  return dmgToLP >= playerLp ? plan : null;
}

// ── Helper Functions for planAttacks ───────────────────────────────────────

interface AttackOption {
  aZone: number;
  dZone: number;
  score: number;
}

interface AttackSelection {
  plans: AttackPlan[];
  usedAttackers: Set<number>;
  usedDefenders: Set<number>;
}

interface BattleContext {
  attacker: FieldCard;
  defender: FieldCard;
  aAtk: number;
  dVal: number;
}

interface BattleStrategy {
  scoreAttack(ctx: BattleContext): number;
  shouldAttemptNonPositiveScore(): boolean;
  handleRemainingAttackers(
    attackers: Array<{ zone: number; fc: FieldCard }>,
    defenders: Array<{ zone: number; fc: FieldCard }>,
    usedAttackers: Set<number>,
    usedDefenders: Set<number>,
  ): AttackPlan[];
}

class AggressiveStrategy implements BattleStrategy {
  scoreAttack(ctx: BattleContext): number {
    const { aAtk, dVal, defender } = ctx;
    let score = 0;

    if (aAtk > dVal) {
      score += AI_SCORE.DESTROY_TARGET;
      if (defender.position === 'atk') score += (aAtk - dVal);
      if (defender.card.effect) score += 500;
      score += aiEffectiveATK(defender) * 0.5;
      score -= (aAtk - dVal) * 0.1;
      if (defender.indestructible) score = -Infinity;
    } else if (aAtk === dVal && defender.position === 'atk') {
      score += 100;
    } else {
      score -= 500;
    }

    if (defender.faceDown) {
      if (aAtk >= AI_SCORE.PROBE_ATK_THRESHOLD) score += AI_SCORE.STRONG_PROBE;
      else score -= AI_SCORE.FACEDOWN_RISK;
    }

    return score;
  }

  shouldAttemptNonPositiveScore(): boolean {
    return true;
  }

  handleRemainingAttackers(
    attackers: Array<{ zone: number; fc: FieldCard }>,
    defenders: Array<{ zone: number; fc: FieldCard }>,
    usedAttackers: Set<number>,
    usedDefenders: Set<number>,
  ): AttackPlan[] {
    const plans: AttackPlan[] = [];
    
    for (const a of attackers) {
      if (usedAttackers.has(a.zone)) continue;
      
      let weakest: { zone: number; val: number } | null = null;
      for (const d of defenders) {
        if (usedDefenders.has(d.zone)) continue;
        const dVal = aiCombatValue(d.fc);
        if (!weakest || dVal < weakest.val) weakest = { zone: d.zone, val: dVal };
      }
      
      if (weakest) {
        plans.push({ attackerZone: a.zone, targetZone: weakest.zone });
        usedAttackers.add(a.zone);
        usedDefenders.add(weakest.zone);
      }
    }
    
    return plans;
  }
}

class ConservativeStrategy implements BattleStrategy {
  scoreAttack(ctx: BattleContext): number {
    const { aAtk, dVal, defender } = ctx;
    let score = 0;

    if (aAtk > dVal) {
      score += AI_SCORE.DESTROY_TARGET;
      if (defender.position === 'atk') score += (aAtk - dVal);
      if (defender.card.effect) score += 500;
      score += aiEffectiveATK(defender) * 0.5;
      score -= (aAtk - dVal) * 0.1;
      if (defender.indestructible) score = -Infinity;
    } else if (aAtk === dVal && defender.position === 'atk') {
      score -= 200;
    } else {
      score = -Infinity;
    }

    if (defender.faceDown) {
      score = -Infinity;
    }

    return score;
  }

  shouldAttemptNonPositiveScore(): boolean {
    return false;
  }

  handleRemainingAttackers(
    _attackers: Array<{ zone: number; fc: FieldCard }>,
    _defenders: Array<{ zone: number; fc: FieldCard }>,
    _usedAttackers: Set<number>,
    _usedDefenders: Set<number>,
  ): AttackPlan[] {
    return [];
  }
}

class SmartStrategy implements BattleStrategy {
  scoreAttack(ctx: BattleContext): number {
    const { aAtk, dVal, defender } = ctx;
    let score = 0;

    if (aAtk > dVal) {
      score += AI_SCORE.DESTROY_TARGET;
      if (defender.position === 'atk') score += (aAtk - dVal);
      if (defender.card.effect) score += 500;
      score += aiEffectiveATK(defender) * 0.5;
      score -= (aAtk - dVal) * 0.1;
      if (defender.indestructible) score = -Infinity;
    } else if (aAtk === dVal && defender.position === 'atk') {
      score -= 200;
    } else {
      score = -Infinity;
    }

    if (defender.faceDown) {
      if (aAtk >= AI_SCORE.PROBE_ATK_THRESHOLD) score += AI_SCORE.STRONG_PROBE;
      else score -= AI_SCORE.FACEDOWN_RISK;
    }

    return score;
  }

  shouldAttemptNonPositiveScore(): boolean {
    return false;
  }

  handleRemainingAttackers(
    _attackers: Array<{ zone: number; fc: FieldCard }>,
    _defenders: Array<{ zone: number; fc: FieldCard }>,
    _usedAttackers: Set<number>,
    _usedDefenders: Set<number>,
  ): AttackPlan[] {
    return [];
  }
}

const STRATEGY_REGISTRY = new Map<string, BattleStrategy>([
  ['aggressive', new AggressiveStrategy()],
  ['conservative', new ConservativeStrategy()],
  ['smart', new SmartStrategy()],
]);

function getStrategy(strategyName: string): BattleStrategy {
  return STRATEGY_REGISTRY.get(strategyName) ?? STRATEGY_REGISTRY.get('smart')!;
}

function buildAttackerList(
  aiMonsters: Array<FieldCard | null>,
): Array<{ zone: number; fc: FieldCard }> {
  const attackers: Array<{ zone: number; fc: FieldCard }> = [];
  for (let z = 0; z < aiMonsters.length; z++) {
    const fc = aiMonsters[z];
    if (!fc || fc.position !== 'atk' || fc.hasAttacked || fc.summonedThisTurn) continue;
    attackers.push({ zone: z, fc });
  }
  return attackers;
}

function buildDefenderList(
  plrMonsters: Array<FieldCard | null>,
): Array<{ zone: number; fc: FieldCard }> {
  const defenders: Array<{ zone: number; fc: FieldCard }> = [];
  for (let z = 0; z < plrMonsters.length; z++) {
    const fc = plrMonsters[z];
    if (!fc || fc.cantBeAttacked) continue;
    defenders.push({ zone: z, fc });
  }
  return defenders;
}

function handleDirectAttackers(
  attackers: Array<{ zone: number; fc: FieldCard }>,
  usedAttackers: Set<number>,
): AttackPlan[] {
  const plans: AttackPlan[] = [];
  for (const a of attackers) {
    if (a.fc.canDirectAttack) {
      plans.push({ attackerZone: a.zone, targetZone: -1 });
      usedAttackers.add(a.zone);
    }
  }
  return plans;
}

function scoreAttack(
  attacker: FieldCard,
  defender: FieldCard,
  strategy: BattleStrategy,
): number {
  const dVal = aiCombatValue(defender);
  const aAtk = attacker.effectiveATK();
  return strategy.scoreAttack({ attacker, defender, aAtk, dVal });
}

function _buildAttackOptions(
  attackers: Array<{ zone: number; fc: FieldCard }>,
  defenders: Array<{ zone: number; fc: FieldCard }>,
  usedAttackers: Set<number>,
  strategy: BattleStrategy,
): AttackOption[] {
  const attackOptions: AttackOption[] = [];
  
  for (const a of attackers) {
    if (usedAttackers.has(a.zone)) continue;
    for (const d of defenders) {
      const score = scoreAttack(a.fc, d.fc, strategy);
      attackOptions.push({ aZone: a.zone, dZone: d.zone, score });
    }
  }
  
  return attackOptions;
}

function _selectAttacks(
  attackOptions: AttackOption[],
  usedAttackers: Set<number>,
  strategy: BattleStrategy,
): { plans: AttackPlan[]; usedDefenders: Set<number> } {
  attackOptions.sort((a, b) => b.score - a.score);
  
  const plans: AttackPlan[] = [];
  const usedDefenders = new Set<number>();
  const shouldAttemptNonPositive = strategy.shouldAttemptNonPositiveScore();

  for (const opt of attackOptions) {
    if (usedAttackers.has(opt.aZone) || usedDefenders.has(opt.dZone)) continue;
    if (!shouldAttemptNonPositive && opt.score <= 0) continue;
    if (opt.score === -Infinity) continue;

    plans.push({ attackerZone: opt.aZone, targetZone: opt.dZone });
    usedAttackers.add(opt.aZone);
    usedDefenders.add(opt.dZone);
  }

  return { plans, usedDefenders };
}

function selectAttacks(
  attackers: Array<{ zone: number; fc: FieldCard }>,
  defenders: Array<{ zone: number; fc: FieldCard }>,
  usedAttackers: Set<number>,
  strategy: BattleStrategy,
): AttackSelection {
  const attackOptions = _buildAttackOptions(attackers, defenders, usedAttackers, strategy);
  const { plans, usedDefenders } = _selectAttacks(attackOptions, usedAttackers, strategy);
  return { plans, usedAttackers, usedDefenders };
}

function assignRemainingAttacks(
  attackers: Array<{ zone: number; fc: FieldCard }>,
  defenders: Array<{ zone: number; fc: FieldCard }>,
  usedAttackers: Set<number>,
  usedDefenders: Set<number>,
  strategy: BattleStrategy,
): AttackPlan[] {
  const allDefendersCovered = defenders.every(d => usedDefenders.has(d.zone));
  
  if (allDefendersCovered) {
    const plans: AttackPlan[] = [];
    for (const a of attackers) {
      if (usedAttackers.has(a.zone)) continue;
      plans.push({ attackerZone: a.zone, targetZone: -1 });
      usedAttackers.add(a.zone);
    }
    return plans;
  }
  
  return strategy.handleRemainingAttackers(attackers, defenders, usedAttackers, usedDefenders);
}

export function planAttacks(
  aiMonsters: Array<FieldCard | null>,
  plrMonsters: Array<FieldCard | null>,
  playerLp: number,
  behavior: Required<AIBehavior>,
): AttackPlan[] {
  const lethal = findLethal(aiMonsters, plrMonsters, playerLp);
  if (lethal) return lethal;

  const strategy = getStrategy(behavior.battleStrategy);
  const plans: AttackPlan[] = [];
  const usedAttackers = new Set<number>();

  const attackers = buildAttackerList(aiMonsters);
  const defenders = buildDefenderList(plrMonsters);

  const directPlans = handleDirectAttackers(attackers, usedAttackers);
  plans.push(...directPlans);

  if (defenders.length === 0) {
    for (const a of attackers) {
      if (!usedAttackers.has(a.zone)) {
        plans.push({ attackerZone: a.zone, targetZone: -1 });
      }
    }
    return plans;
  }

  const selection = selectAttacks(attackers, defenders, usedAttackers, strategy);
  plans.push(...selection.plans);

  const remaining = assignRemainingAttacks(
    attackers,
    defenders,
    selection.usedAttackers,
    selection.usedDefenders,
    strategy,
  );
  plans.push(...remaining);

  return plans;
}

export function pickEquipTarget(
  ownMonsters: Array<FieldCard | null>,
  oppMonsters: Array<FieldCard | null>,
  atkBonus: number,
  defBonus: number,
  equipCard?: CardData,
): number {
  const oppMaxVal = getMaxMonsterValue(oppMonsters, 'combatValue');

  const result = findBestFieldTarget(ownMonsters, 'effectiveATK', ({ card }) => {
    if (equipCard && !meetsEquipRequirement(equipCard, card.card)) {
      return -Infinity;
    }

    let score = 0;
    const curATK = card.effectiveATK();
    const boostedATK = curATK + atkBonus;

    if (curATK <= oppMaxVal && boostedATK > oppMaxVal) {
      score += AI_SCORE.EQUIP_UNLOCK_KILL;
    }

    score += curATK * 0.3;
    if (!card.hasAttacked && card.position === 'atk') score += 500;
    if (card.position === 'def' && defBonus > 0) score += 300;

    return score;
  }, { oppMonsters, ownMonsters });

  return result?.zone ?? -1;
}

export function pickDebuffTarget(
  oppMonsters: Array<FieldCard | null>,
  _atkDebuff: number,
  equipCard?: CardData,
): number {
  const result = findBestFieldTarget(oppMonsters, 'effectiveATK', ({ card }) => {
    if (equipCard && !meetsEquipRequirement(equipCard, card.card)) {
      return -Infinity;
    }

    let score = 0;
    score += card.effectiveATK();
    if (card.card.effect) score += 500;

    return score;
  }, { oppMonsters, ownMonsters: [] });

  return result?.zone ?? -1;
}

export function pickBestGraveyardMonster(
  graveyard: CardData[],
  oppMonsters: Array<FieldCard | null>,
): CardData | null {
  const monsters = graveyard.filter(c => c.type === CardType.Monster || c.type === CardType.Fusion);
  if (monsters.length === 0) return null;

  const oppMaxATK = oppMonsters
    .filter((fc): fc is FieldCard => fc !== null && fc.position === 'atk')
    .reduce((max, fc) => Math.max(max, fc.effectiveATK()), 0);

  let best: CardData | null = null;
  let bestScore = -Infinity;

  for (const card of monsters) {
    const atk = card.atk ?? 0;
    let score = atk;

    if (atk > oppMaxATK && oppMaxATK > 0) score += AI_SCORE.REVIVE_BEATS_STRONGEST;
    if (card.effect) score += 500;
    if (card.type === CardType.Fusion) score += 300;

    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

export function pickSpellBuffTarget(
  ownMonsters: Array<FieldCard | null>,
  oppMonsters: Array<FieldCard | null>,
): FieldCard | null {
  const oppMaxATK = getMaxMonsterValue(oppMonsters, 'effectiveATK');

  const result = findBestFieldTarget(ownMonsters, 'effectiveATK', ({ card }) => {
    let score = card.effectiveATK();
    if (!card.hasAttacked && card.position === 'atk') score += 500;
    const diff = oppMaxATK - card.effectiveATK();
    if (diff > 0 && diff < AI_SCORE.BUFF_KILL_THRESHOLD) score += AI_SCORE.BUFF_UNLOCK_KILL;
    return score;
  });

  return result?.card ?? null;
}

interface FieldTargetCandidate<T = FieldCard> {
  card: T | null;
  zone: number;
}

interface TargetScoreContext {
  card: FieldCard;
  zone: number;
  side: Owner;
  oppMonsters: Array<FieldCard | null>;
  ownMonsters: Array<FieldCard | null>;
}

type TargetScorer = (ctx: TargetScoreContext) => number;

function findBestFieldTarget<TFieldCard extends FieldCard = FieldCard>(
  candidates: Array<TFieldCard | null>,
  valueProp: keyof Pick<TFieldCard, 'effectiveATK' | 'effectiveDEF' | 'combatValue'>,
  scorer: (ctx: TargetScoreContext) => number,
  context?: Partial<Omit<TargetScoreContext, 'card' | 'zone'>>,
): { card: TFieldCard; zone: number; score: number } | null {
  let bestIndex = -1;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const card = candidates[i];
    if (!card || card.faceDown) continue;

    const score = scorer({
      card,
      zone: i,
      side: context?.side ?? 'opponent',
      oppMonsters: context?.oppMonsters ?? [],
      ownMonsters: context?.ownMonsters ?? [],
    });

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex !== -1 && candidates[bestIndex]
    ? { card: candidates[bestIndex]!, zone: bestIndex, score: bestScore }
    : null;
}

function getMaxMonsterValue(
  monsters: Array<FieldCard | null>,
  valueProp: keyof Pick<FieldCard, 'effectiveATK' | 'effectiveDEF' | 'combatValue'>,
): number {
  return monsters
    .filter((fc): fc is FieldCard => fc !== null)
    .reduce((max, fc) => Math.max(max, fc[valueProp]()), 0);
}
