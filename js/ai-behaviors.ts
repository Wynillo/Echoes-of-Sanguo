// ============================================================
// ECHOES OF SANGUO — AI Behavior Registry
// Data-driven opponent behavior profiles.
// Usage: In opponent JSON, set "behavior": "aggressive" etc.
// ============================================================

import type { AIBehavior, AISpellRule, CardData, PlayerState } from './types.js';
import { CardType, meetsEquipRequirement } from './types.js';
import type { FieldCard } from './field.js';

// ── AI Scoring Constants ────────────────────────────────────

export const AI_SCORE = {
  /** Bonus for effect monsters during summon priority evaluation */
  EFFECT_CARD_BONUS:      10000,
  /** Base bonus when an attacker can destroy a target */
  DESTROY_TARGET:         1000,
  /** Bonus for strong attackers probing face-down monsters */
  STRONG_PROBE:           200,
  /** ATK threshold for safely probing face-down monsters */
  PROBE_ATK_THRESHOLD:    1800,
  /** Penalty for weak attackers vs face-down monsters */
  FACEDOWN_RISK:          300,
  /** Bonus when equipment unlocks a kill */
  EQUIP_UNLOCK_KILL:      2000,
  /** Bonus when revived monster beats strongest opponent */
  REVIVE_BEATS_STRONGEST: 1000,
  /** Bonus when buff spell could unlock a kill */
  BUFF_UNLOCK_KILL:       800,
  /** Max gap between ATK and opponent for buff to matter */
  BUFF_KILL_THRESHOLD:    1000,
  /** Bonus for surviving when AI is low LP */
  LOW_LP_SURVIVAL:        300,
  /** Estimated DEF for face-down monsters (AI can't see real stats) */
  FACEDOWN_DEF_ESTIMATE:  1200,
} as const;

export const AI_LP_THRESHOLD = {
  /** LP below which AI is considered dangerously low */
  LOW:       3000,
  /** LP below which AI activates defensive spells */
  DEFENSIVE: 5000,
} as const;

// ── Face-Down Stat Helpers (AI cannot see hidden stats) ─

/** Returns estimated combat value for face-down cards, real value otherwise. */
export function aiCombatValue(fc: FieldCard): number {
  return fc.faceDown ? AI_SCORE.FACEDOWN_DEF_ESTIMATE : fc.combatValue();
}

/** Returns 0 for face-down cards (they can't attack), real ATK otherwise. */
export function aiEffectiveATK(fc: FieldCard): number {
  return fc.faceDown ? 0 : fc.effectiveATK();
}

/** Returns estimated DEF for face-down cards, real DEF otherwise. */
export function aiEffectiveDEF(fc: FieldCard): number {
  return fc.faceDown ? AI_SCORE.FACEDOWN_DEF_ESTIMATE : fc.effectiveDEF();
}

// ── Behavior Profiles ───────────────────────────────────────

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
};

const DEFENSIVE: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           2000,
  summonPriority:         'highestDEF',
  positionStrategy:       'defensive',
  battleStrategy:         'conservative',
  spellRules:             {},
  defaultSpellActivation: 'smart',
};

const SMART: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'effectFirst',
  positionStrategy:       'smart',
  battleStrategy:         'smart',
  spellRules:             {},
  defaultSpellActivation: 'always',
};

const CHEATING: AIBehavior = {
  fusionFirst:            true,
  fusionMinATK:           0,
  summonPriority:         'highestATK',
  positionStrategy:       'aggressive',
  battleStrategy:         'aggressive',
  spellRules:             {},
  defaultSpellActivation: 'always',
};

// ── Registry ────────────────────────────────────────────────

export const AI_BEHAVIOR_REGISTRY = new Map<string, AIBehavior>([
  ['default',      DEFAULT],
  ['aggressive',   AGGRESSIVE],
  ['defensive',    DEFENSIVE],
  ['smart',        SMART],
  ['cheating',     CHEATING],
]);

// ── Resolver ────────────────────────────────────────────────

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
  };
}

// ── Helper: Spell activation decision ───────────────────────

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

// ── Helper: Pick monster to summon from hand ────────────────

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
        // Effect monsters get a large bonus, then sort by ATK
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

// ── Helper: Decide summon position ──────────────────────────

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
      // If player has monsters that can destroy us in ATK, go DEF to avoid LP damage
      if (playerHasMonsters && monsterATK < playerFieldMaxATK) {
        return 'def';
      }
      return 'atk';
  }
}

// ── Smart Summon Candidate (board-aware) ────────────────────

export interface BoardContext {
  aiField: Array<FieldCard | null>;
  playerField: Array<FieldCard | null>;
  playerLP: number;
  aiLP: number;
}

/**
 * Smart monster summoning that considers the board state.
 * Scores each monster based on how useful it would be RIGHT NOW.
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

    const atk = card.atk ?? 0;
    const def = card.def ?? 0;
    let score = 0;

    // Base: raw stats matter
    score += atk * 0.5;

    // Can this monster beat any player monster? Big bonus
    for (const pfc of playerMonsters) {
      const pVal = aiCombatValue(pfc);
      if (atk > pVal) score += 300; // can destroy a target
    }

    // Can it survive the player's strongest ATK? Defensive viability
    if (atk > playerMaxATK) score += 200;
    else if (def > playerMaxThreat) score += 100; // DEF wall potential

    // No player monsters? Prefer high ATK for direct damage
    if (playerMonsters.length === 0) score += atk;

    // Effect monsters get a bonus
    if (card.effect) score += 400;

    // If we're low on LP, prefer monsters that can survive
    if (ctx.aiLP < AI_LP_THRESHOLD.LOW && def > playerMaxThreat) score += AI_SCORE.LOW_LP_SURVIVAL;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ── Lethal Detection ────────────────────────────────────────

export interface AttackPlan {
  attackerZone: number;
  targetZone: number; // -1 = direct attack
}

/**
 * Check if the AI can kill the player this turn.
 * Returns an ordered list of attacks for the kill, or null if no lethal.
 */
export function findLethal(
  aiMonsters: Array<FieldCard | null>,
  plrMonsters: Array<FieldCard | null>,
  playerLP: number,
): AttackPlan[] | null {
  // Collect available attackers
  const attackers: { zone: number; atk: number; canDirect: boolean }[] = [];
  for (let z = 0; z < aiMonsters.length; z++) {
    const fc = aiMonsters[z];
    if (!fc || fc.position !== 'atk' || fc.hasAttacked || fc.summonedThisTurn) continue;
    attackers.push({ zone: z, atk: fc.effectiveATK(), canDirect: fc.canDirectAttack });
  }

  if (attackers.length === 0) return null;

  // Collect player defenders
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

  // Case 1: No defenders or all have canDirectAttack — sum ATK vs LP
  const directAttackers = attackers.filter(a => a.canDirect);
  if (attackableDefenders.length === 0) {
    const totalDmg = attackers.reduce((s, a) => s + a.atk, 0);
    if (totalDmg >= playerLP) {
      // Sort strongest first for style points & to guarantee overkill
      const sorted = [...attackers].sort((a, b) => b.atk - a.atk);
      return sorted.map(a => ({ attackerZone: a.zone, targetZone: -1 }));
    }
    return null;
  }

  // Case 2: Try to clear the board and then deal lethal direct damage
  // Use a greedy simulation — try all permutations for small counts
  const plan = _simulateLethal(attackers, attackableDefenders, playerLP);
  return plan;
}

/**
 * Greedy lethal simulation. Tries to find an attack sequence that kills the player.
 * For performance, uses a smart greedy approach rather than full permutation.
 */
function _simulateLethal(
  attackers: { zone: number; atk: number; canDirect: boolean }[],
  defenders: { zone: number; val: number; inAtk: boolean }[],
  playerLP: number,
): AttackPlan[] | null {
  // Sort attackers strongest first
  const sorted = [...attackers].sort((a, b) => b.atk - a.atk);
  const remainingDefs = defenders.map(d => ({ ...d, alive: true }));
  const plan: AttackPlan[] = [];
  let dmgToLP = 0;
  const usedAttackers = new Set<number>();

  // Phase 1: Clear ATK-position defenders first (they deal LP damage when destroyed)
  const atkDefs = remainingDefs.filter(d => d.inAtk).sort((a, b) => a.val - b.val);
  for (const def of atkDefs) {
    // Find weakest attacker that can beat this defender (efficient resource use)
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

  // Phase 2: Clear DEF-position defenders (no LP damage but clears the way)
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

  // Check if all defenders are cleared
  const allCleared = remainingDefs.every(d => !d.alive);

  // Phase 3: Remaining attackers go direct (or canDirectAttack ones skip to direct)
  const remainingAttackers = sorted.filter(a => !usedAttackers.has(a.zone));
  if (allCleared) {
    for (const a of remainingAttackers) {
      plan.push({ attackerZone: a.zone, targetZone: -1 });
      dmgToLP += a.atk;
    }
  } else {
    // Some defenders still alive — only canDirectAttack monsters can go direct
    for (const a of remainingAttackers) {
      if (a.canDirect) {
        plan.push({ attackerZone: a.zone, targetZone: -1 });
        dmgToLP += a.atk;
      }
    }
  }

  return dmgToLP >= playerLP ? plan : null;
}

// ── Optimal Attack Ordering ─────────────────────────────────

/**
 * Plan the optimal sequence of attacks to maximize damage/kills.
 * Returns ordered list of (attackerZone, targetZone) pairs.
 * targetZone -1 means direct attack.
 */
export function planAttacks(
  aiMonsters: Array<FieldCard | null>,
  plrMonsters: Array<FieldCard | null>,
  playerLP: number,
  behavior: Required<AIBehavior>,
): AttackPlan[] {
  // Step 1: Check for lethal — if we can win, just do the kill sequence
  const lethal = findLethal(aiMonsters, plrMonsters, playerLP);
  if (lethal) return lethal;

  const strategy = behavior.battleStrategy;
  const plans: AttackPlan[] = [];
  const usedAttackers = new Set<number>();

  // Collect attackers
  const attackers: { zone: number; fc: FieldCard }[] = [];
  for (let z = 0; z < aiMonsters.length; z++) {
    const fc = aiMonsters[z];
    if (!fc || fc.position !== 'atk' || fc.hasAttacked || fc.summonedThisTurn) continue;
    attackers.push({ zone: z, fc });
  }

  // Collect live defenders
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
    // No defenders — everyone attacks directly
    for (const a of attackers) {
      if (!usedAttackers.has(a.zone)) {
        plans.push({ attackerZone: a.zone, targetZone: -1 });
      }
    }
    return plans;
  }

  // Score each possible attack assignment
  const attackOptions: { aZone: number; dZone: number; score: number }[] = [];
  for (const a of attackers) {
    if (usedAttackers.has(a.zone)) continue;
    for (const d of defenders) {
      const dVal = aiCombatValue(d.fc);
      const aAtk = a.fc.effectiveATK();
      let score = 0;

      if (aAtk > dVal) {
        // Can destroy — good
        score += AI_SCORE.DESTROY_TARGET;
        // Bonus for LP damage (only in ATK position)
        if (d.fc.position === 'atk') score += (aAtk - dVal);
        // Prioritize destroying effect monsters (they're dangerous)
        if (d.fc.card.effect) score += 500;
        // Prioritize destroying high-ATK threats
        score += aiEffectiveATK(d.fc) * 0.5;
        // Prefer efficient attacks (don't waste a 3000ATK monster on a 100DEF target)
        score -= (aAtk - dVal) * 0.1;
        // Indestructible monsters can't be destroyed
        if (d.fc.indestructible) score = -Infinity;
      } else if (aAtk === dVal && d.fc.position === 'atk') {
        // Trade — worth it if we're trading up (our monster is weaker overall)
        if (strategy === 'aggressive') score += 100;
        else score -= 200; // conservative/smart avoid trades
      } else {
        // We lose — bad
        if (strategy === 'aggressive') {
          score -= 500;
        } else {
          score = -Infinity; // never attack into a loss for smart/conservative
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

  // Greedy assignment: pick best attack, remove attacker+defender, repeat
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

  // Remaining attackers go direct if all defenders are covered by the plan
  const allDefendersCovered = defenders.every(d => usedDefenders.has(d.zone));
  if (allDefendersCovered) {
    for (const a of attackers) {
      if (usedAttackers.has(a.zone)) continue;
      plans.push({ attackerZone: a.zone, targetZone: -1 });
      usedAttackers.add(a.zone);
    }
  }

  // Aggressive: remaining unused attackers attack weakest remaining defender
  if (strategy === 'aggressive') {
    for (const a of attackers) {
      if (usedAttackers.has(a.zone)) continue;
      // Find weakest remaining defender
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

// ── Smart Equipment Target Selection ─────────────────────────

/**
 * Pick the best monster to equip a positive buff to.
 * Considers upcoming battles, not just raw strongest.
 */
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

    // Can this equipment enable a new kill?
    if (curATK <= oppMaxVal && boostedATK > oppMaxVal) {
      score += AI_SCORE.EQUIP_UNLOCK_KILL; // Unlocks a kill — highest priority
    }

    // Higher base ATK benefits more from staying alive to attack
    score += curATK * 0.3;

    // Bonus if monster hasn't attacked yet (will use the buff this turn)
    if (!fc.hasAttacked && fc.position === 'atk') score += 500;

    // Bonus if in DEF and DEF buff helps survival
    if (fc.position === 'def' && defBonus > 0) score += 300;

    if (score > bestScore) {
      bestScore = score;
      bestZone = z;
    }
  }
  return bestZone;
}

/**
 * Pick the best opponent monster to debuff with negative equipment.
 * Prioritize the biggest threat that could be neutralized.
 */
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

    // Prioritize the strongest threat
    score += curATK;

    // Extra value if this makes the monster weak enough for our monsters to kill
    if (curATK + atkDebuff < curATK) score += 300;

    // Effect monsters are higher priority targets
    if (fc.card.effect) score += 500;

    if (score > bestScore) {
      bestScore = score;
      bestZone = z;
    }
  }
  return bestZone;
}

// ── Smart Graveyard Monster Selection ───────────────────────

/**
 * Pick the best monster to revive from graveyard, considering board state.
 */
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

    // Can it beat the strongest opponent? Big bonus
    if (atk > oppMaxATK && oppMaxATK > 0) score += AI_SCORE.REVIVE_BEATS_STRONGEST;

    // Effect monsters are more valuable
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

// ── Smart Spell Targeting ───────────────────────────────────

/**
 * Pick the best own monster to target with a buff spell.
 */
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

    // Prioritize monsters that haven't attacked yet
    if (!fc.hasAttacked && fc.position === 'atk') score += 500;

    // Bonus if close to being able to beat opponent's strongest
    const diff = oppMaxATK - fc.effectiveATK();
    if (diff > 0 && diff < AI_SCORE.BUFF_KILL_THRESHOLD) score += AI_SCORE.BUFF_UNLOCK_KILL;

    if (score > bestScore) {
      bestScore = score;
      best = fc;
    }
  }
  return best;
}
