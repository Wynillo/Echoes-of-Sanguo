import type { AIBehavior, AISpellRule, CardData, PlayerState } from './types.js';
import { CardType, meetsEquipRequirement } from './types.js';
import type { FieldCard } from './field.js';

export const AI_SCORE = {
  EFFECT_CARD_BONUS:      10000,
  DESTROY_TARGET:         1000,
  STRONG_PROBE:           200,
  PROBE_ATK_THRESHOLD:    1800,
  FACEDOWN_RISK:          300,
  EQUIP_UNLOCK_KILL:      2000,
  REVIVE_BEATS_STRONGEST: 1000,
  BUFF_UNLOCK_KILL:       800,
  BUFF_KILL_THRESHOLD:    1000,
  LOW_LP_SURVIVAL:        300,
  FACEDOWN_DEF_ESTIMATE:  1200,
  // ── Threat / Future Value weights ──
  /** Weight for LP ratio contribution to threat score */
  THREAT_LP_WEIGHT:       0.4,
  /** Weight for monster power differential in threat score */
  THREAT_BOARD_WEIGHT:    1.2,
  /** Per-card hand advantage weight in threat score */
  THREAT_HAND_WEIGHT:     150,
  /** Default discount factor for future board value */
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
  summonPriority:         'highestATK',
  positionStrategy:       'smart',
  battleStrategy:         'smart',
  spellRules:             {},
  defaultSpellActivation: 'smart',
};

const AGGRESSIVE: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'highestATK',
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
  summonPriority:         'highestDEF',
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
  summonPriority:         'highestATK',
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
    summonPriority:         base.summonPriority         ?? 'highestATK',
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
  playerLP: number,
  aiLP: number,
): boolean {
  const rule = behavior.spellRules[cardId];
  if (rule) {
    return evaluateSpellRule(rule, playerLP, aiLP);
  }
  switch (behavior.defaultSpellActivation) {
    case 'always': return true;
    case 'never':  return false;
    case 'smart':  return aiLP < playerLP || aiLP < AI_LP_THRESHOLD.DEFENSIVE;
  }
}

function evaluateSpellRule(rule: AISpellRule, playerLP: number, aiLP: number): boolean {
  const t = rule.threshold ?? 0;
  switch (rule.when) {
    case 'always':   return true;
    case 'oppLP>N':  return playerLP > t;
    case 'selfLP<N': return aiLP < t;
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
      case 'highestATK':
        score = card.atk ?? 0;
        break;
      case 'highestDEF':
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
  playerLP: number;
  aiLP: number;
}

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

    const atk = card.atk ?? 0;
    const def = card.def ?? 0;
    let score = 0;

    score += atk * 0.5;

    for (const pfc of playerMonsters) {
      const pVal = aiCombatValue(pfc);
      if (atk > pVal) score += 300;
    }

    if (atk >= playerMaxATK) score += 200;
    else if (def >= playerMaxThreat) score += 100;

    if (playerMonsters.length === 0) score += atk;

    if (card.effect) score += 400;

    if (ctx.aiLP < AI_LP_THRESHOLD.LOW && def > playerMaxThreat) score += AI_SCORE.LOW_LP_SURVIVAL;

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
  playerLP: number,
): AttackPlan[] | null {
  const attackers: { zone: number; atk: number; canDirect: boolean }[] = [];
  for (let z = 0; z < aiMonsters.length; z++) {
    const fc = aiMonsters[z];
    if (!fc || fc.position !== 'atk' || fc.turnState.hasAttacked || fc.turnState.summonedThisTurn) continue;
    attackers.push({ zone: z, atk: fc.effectiveATK(), canDirect: fc.canDirectAttack });
  }

  if (attackers.length === 0) return null;

  const defenders: { zone: number; val: number; inAtk: boolean; cantBeAttacked: boolean }[] = [];
  for (let z = 0; z < plrMonsters.length; z++) {
    const fc = plrMonsters[z];
    if (!fc) continue;
    defenders.push({
      zone: z,
      val: aiCombatValue(fc),
      inAtk: fc.position === 'atk',
      cantBeAttacked: fc.cantBeAttacked,
    });
  }

  const attackableDefenders = defenders.filter(d => !d.cantBeAttacked);

  const directAttackers = attackers.filter(a => a.canDirect);
  if (attackableDefenders.length === 0) {
    const totalDmg = attackers.reduce((s, a) => s + a.atk, 0);
    if (totalDmg >= playerLP) {
      const sorted = [...attackers].sort((a, b) => b.atk - a.atk);
      return sorted.map(a => ({ attackerZone: a.zone, targetZone: -1 }));
    }
    return null;
  }

  const plan = _simulateLethal(attackers, attackableDefenders, playerLP);
  return plan;
}

function _simulateLethal(
  attackers: { zone: number; atk: number; canDirect: boolean }[],
  defenders: { zone: number; val: number; inAtk: boolean }[],
  playerLP: number,
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

  return dmgToLP >= playerLP ? plan : null;
}

export function planAttacks(
  aiMonsters: Array<FieldCard | null>,
  plrMonsters: Array<FieldCard | null>,
  playerLP: number,
  behavior: Required<AIBehavior>,
): AttackPlan[] {
  const lethal = findLethal(aiMonsters, plrMonsters, playerLP);
  if (lethal) return lethal;

  const strategy = behavior.battleStrategy;
  const plans: AttackPlan[] = [];
  const usedAttackers = new Set<number>();

  const attackers: { zone: number; fc: FieldCard }[] = [];
  for (let z = 0; z < aiMonsters.length; z++) {
    const fc = aiMonsters[z];
    if (!fc || fc.position !== 'atk' || fc.turnState.hasAttacked || fc.turnState.summonedThisTurn) continue;
    attackers.push({ zone: z, fc });
  }

  const defenders: { zone: number; fc: FieldCard }[] = [];
  for (let z = 0; z < plrMonsters.length; z++) {
    const fc = plrMonsters[z];
    if (!fc || fc.cantBeAttacked) continue;
    defenders.push({ zone: z, fc });
  }

  // canDirectAttack monsters always go direct regardless of defenders
  for (const a of attackers) {
    if (a.fc.canDirectAttack) {
      plans.push({ attackerZone: a.zone, targetZone: -1 });
      usedAttackers.add(a.zone);
    }
  }

  if (defenders.length === 0) {
    for (const a of attackers) {
      if (!usedAttackers.has(a.zone)) {
        plans.push({ attackerZone: a.zone, targetZone: -1 });
      }
    }
    return plans;
  }

  const attackOptions: { aZone: number; dZone: number; score: number }[] = [];
  for (const a of attackers) {
    if (usedAttackers.has(a.zone)) continue;
    for (const d of defenders) {
      const dVal = aiCombatValue(d.fc);
      const aAtk = a.fc.effectiveATK();
      let score = 0;

      if (aAtk > dVal) {
        score += AI_SCORE.DESTROY_TARGET;
        if (d.fc.position === 'atk') score += (aAtk - dVal);
        // Prioritize destroying effect monsters (they're dangerous)
        if (d.fc.card.effect) score += 500;
        score += aiEffectiveATK(d.fc) * 0.5;
        // Prefer efficient attacks (don't waste a 3000ATK monster on a 100DEF target)
        score -= (aAtk - dVal) * 0.1;
        if (d.fc.indestructible) score = -Infinity;
      } else if (aAtk === dVal && d.fc.position === 'atk') {
        if (strategy === 'aggressive') score += 100;
        else score -= 200;
      } else {
        if (strategy === 'aggressive') {
          score -= 500;
        } else {
          score = -Infinity;
        }
      }

      // Face-down DEF monsters are risky (unknown stats)
      if (d.fc.faceDown) {
        if (strategy === 'conservative') score = -Infinity;
        else if (aAtk >= AI_SCORE.PROBE_ATK_THRESHOLD) score += AI_SCORE.STRONG_PROBE;
        else score -= AI_SCORE.FACEDOWN_RISK;
      }

      attackOptions.push({ aZone: a.zone, dZone: d.zone, score });
    }
  }

  attackOptions.sort((a, b) => b.score - a.score);
  const usedDefenders = new Set<number>();

  for (const opt of attackOptions) {
    if (usedAttackers.has(opt.aZone) || usedDefenders.has(opt.dZone)) continue;
    if (opt.score <= 0 && strategy !== 'aggressive') continue;
    if (opt.score === -Infinity) continue;

    plans.push({ attackerZone: opt.aZone, targetZone: opt.dZone });
    usedAttackers.add(opt.aZone);
    usedDefenders.add(opt.dZone);
  }

  const allDefendersCovered = defenders.every(d => usedDefenders.has(d.zone));
  if (allDefendersCovered) {
    for (const a of attackers) {
      if (usedAttackers.has(a.zone)) continue;
      plans.push({ attackerZone: a.zone, targetZone: -1 });
      usedAttackers.add(a.zone);
    }
  }

  if (strategy === 'aggressive') {
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
  }

  return plans;
}

export function pickEquipTarget(
  ownMonsters: Array<FieldCard | null>,
  oppMonsters: Array<FieldCard | null>,
  atkBonus: number,
  defBonus: number,
  equipCard?: CardData,
): number {
  const oppMaxVal = oppMonsters
    .filter((fc): fc is FieldCard => fc !== null)
    .reduce((max, fc) => Math.max(max, fc.combatValue()), 0);

  let bestZone = -1;
  let bestScore = -Infinity;

  for (let z = 0; z < ownMonsters.length; z++) {
    const fc = ownMonsters[z];
    if (!fc || fc.faceDown) continue;
    if (equipCard && !meetsEquipRequirement(equipCard, fc.card)) continue;

    const curATK = fc.effectiveATK();
    const boostedATK = curATK + atkBonus;
    let score = 0;

    if (curATK <= oppMaxVal && boostedATK > oppMaxVal) {
      score += AI_SCORE.EQUIP_UNLOCK_KILL;
    }

    score += curATK * 0.3;

    if (!fc.turnState.hasAttacked && fc.position === 'atk') score += 500;

    if (fc.position === 'def' && defBonus > 0) score += 300;

    if (score > bestScore) {
      bestScore = score;
      bestZone = z;
    }
  }
  return bestZone;
}

export function pickDebuffTarget(
  oppMonsters: Array<FieldCard | null>,
  atkDebuff: number,
  equipCard?: CardData,
): number {
  let bestZone = -1;
  let bestScore = -Infinity;

  for (let z = 0; z < oppMonsters.length; z++) {
    const fc = oppMonsters[z];
    if (!fc || fc.faceDown) continue;
    if (equipCard && !meetsEquipRequirement(equipCard, fc.card)) continue;

    let score = 0;
    const curATK = fc.effectiveATK();

    score += curATK;

    if (fc.card.effect) score += 500;

    if (score > bestScore) {
      bestScore = score;
      bestZone = z;
    }
  }
  return bestZone;
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

    // Fusion monsters tend to be stronger and were expensive to create
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
  const oppMaxATK = oppMonsters
    .filter((fc): fc is FieldCard => fc !== null)
    .reduce((max, fc) => Math.max(max, fc.effectiveATK()), 0);

  let best: FieldCard | null = null;
  let bestScore = -Infinity;

  for (const fc of ownMonsters) {
    if (!fc || fc.faceDown) continue;
    let score = fc.effectiveATK();

    if (!fc.turnState.hasAttacked && fc.position === 'atk') score += 500;

    const diff = oppMaxATK - fc.effectiveATK();
    if (diff > 0 && diff < AI_SCORE.BUFF_KILL_THRESHOLD) score += AI_SCORE.BUFF_UNLOCK_KILL;

    if (score > bestScore) {
      bestScore = score;
      best = fc;
    }
  }
  return best;
}
