// ============================================================
// ECHOES OF SANGUO — AI Behavior Registry
// Data-driven opponent behavior profiles.
// Usage: In opponent JSON, set "behavior": "aggressive" etc.
// ============================================================

import type { AIBehavior, AISpellRule, CardData } from './types.js';
import { CardType } from './types.js';

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
    case 'smart':  return aiLP < playerLP || aiLP < 5000;
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
        score = (card.effect ? 10000 : 0) + (card.atk ?? 0);
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
  playerFieldMinVal: number,
  playerHasMonsters: boolean,
  strategy: Required<AIBehavior>['positionStrategy'],
): 'atk' | 'def' {
  switch (strategy) {
    case 'aggressive':
      return 'atk';
    case 'defensive':
      return 'def';
    case 'smart':
      return (playerHasMonsters && monsterATK < playerFieldMinVal) ? 'def' : 'atk';
  }
}
