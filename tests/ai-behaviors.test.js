// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  resolveAIBehavior,
  AI_BEHAVIOR_REGISTRY,
  pickSummonCandidate,
  pickSmartSummonCandidate,
  decideSummonPosition,
  shouldActivateNormalSpell,
  findLethal,
  planAttacks,
  pickEquipTarget,
  pickDebuffTarget,
  pickBestGraveyardMonster,
  pickSpellBuffTarget,
} from '../src/ai-behaviors.js';
import { CardType } from '../src/types.js';

// ── Helpers ────────────────────────────────────────────────

/** Minimal monster card stub. */
function monster(overrides = {}) {
  return {
    id: 'TST01',
    name: 'TestMonster',
    type: CardType.Monster,
    atk: 1000,
    def: 800,
    level: 4,
    description: '',
    ...overrides,
  };
}

/** Minimal spell card stub. */
function spell(overrides = {}) {
  return {
    id: 'test-spell',
    name: 'TestSpell',
    type: CardType.Spell,
    description: '',
    ...overrides,
  };
}

// ── resolveAIBehavior ─────────────────────────────────────

describe('resolveAIBehavior', () => {
  it('returns default behavior when called with no arguments', () => {
    const b = resolveAIBehavior();
    expect(b.summonPriority).toBe('highestATK');
    expect(b.positionStrategy).toBe('smart');
    expect(b.battleStrategy).toBe('smart');
    expect(b.fusionFirst).toBe(true);
    expect(b.fusionMinATK).toBe(0);
    expect(b.defaultSpellActivation).toBe('smart');
  });

  it('returns default behavior when called with undefined', () => {
    const b = resolveAIBehavior(undefined);
    expect(b.summonPriority).toBe('highestATK');
    expect(b.positionStrategy).toBe('smart');
  });

  it('resolves "aggressive" profile', () => {
    const b = resolveAIBehavior('aggressive');
    expect(b.positionStrategy).toBe('aggressive');
    expect(b.battleStrategy).toBe('aggressive');
    expect(b.defaultSpellActivation).toBe('always');
  });

  it('resolves "defensive" profile', () => {
    const b = resolveAIBehavior('defensive');
    expect(b.summonPriority).toBe('highestDEF');
    expect(b.positionStrategy).toBe('defensive');
    expect(b.battleStrategy).toBe('conservative');
    expect(b.fusionMinATK).toBe(2000);
  });

  it('resolves "smart" profile', () => {
    const b = resolveAIBehavior('smart');
    expect(b.summonPriority).toBe('effectFirst');
    expect(b.positionStrategy).toBe('smart');
    expect(b.defaultSpellActivation).toBe('always');
  });

  it('resolves "cheating" profile', () => {
    const b = resolveAIBehavior('cheating');
    expect(b.positionStrategy).toBe('aggressive');
    expect(b.battleStrategy).toBe('aggressive');
    expect(b.defaultSpellActivation).toBe('always');
  });

  it('falls back to default for an invalid/unknown ID', () => {
    const b = resolveAIBehavior('nonexistent_id');
    const d = resolveAIBehavior();
    expect(b).toEqual(d);
  });

  it('returns a fully Required<AIBehavior> with all fields defined', () => {
    const b = resolveAIBehavior('aggressive');
    const keys = ['fusionFirst', 'fusionMinATK', 'summonPriority',
                  'positionStrategy', 'battleStrategy', 'spellRules',
                  'defaultSpellActivation'];
    for (const key of keys) {
      expect(b[key]).toBeDefined();
    }
  });

  it('registry contains expected profiles', () => {
    expect(AI_BEHAVIOR_REGISTRY.has('default')).toBe(true);
    expect(AI_BEHAVIOR_REGISTRY.has('aggressive')).toBe(true);
    expect(AI_BEHAVIOR_REGISTRY.has('defensive')).toBe(true);
    expect(AI_BEHAVIOR_REGISTRY.has('smart')).toBe(true);
    expect(AI_BEHAVIOR_REGISTRY.has('cheating')).toBe(true);
  });
});

// ── pickSummonCandidate ───────────────────────────────────

describe('pickSummonCandidate', () => {
  describe('empty hand', () => {
    it('returns -1 for an empty hand', () => {
      expect(pickSummonCandidate([], 'highestATK')).toBe(-1);
    });
  });

  describe('hand with no monsters', () => {
    it('returns -1 when hand has only spells', () => {
      const hand = [spell(), spell({ id: 'test-spell-2' })];
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(-1);
    });
  });

  describe('single monster', () => {
    it('returns its index regardless of priority', () => {
      const hand = [monster()];
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(0);
      expect(pickSummonCandidate(hand, 'highestDEF')).toBe(0);
      expect(pickSummonCandidate(hand, 'effectFirst')).toBe(0);
      expect(pickSummonCandidate(hand, 'lowestLevel')).toBe(0);
    });
  });

  describe('highestATK priority', () => {
    it('picks the monster with highest ATK', () => {
      const hand = [
        monster({ id: 'A', atk: 800 }),
        monster({ id: 'B', atk: 1500 }),
        monster({ id: 'C', atk: 1200 }),
      ];
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(1);
    });

    it('picks first monster on ATK tie (first encountered wins)', () => {
      const hand = [
        monster({ id: 'A', atk: 1500 }),
        monster({ id: 'B', atk: 1500 }),
      ];
      // Both have score 1500; first one (index 0) sets bestScore, second does NOT beat it (strict >)
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(0);
    });

    it('skips non-monster cards', () => {
      const hand = [
        spell(),
        monster({ id: 'M', atk: 500 }),
      ];
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(1);
    });

    it('handles monster with undefined atk (treated as 0)', () => {
      const hand = [
        monster({ id: 'A', atk: undefined }),
        monster({ id: 'B', atk: 100 }),
      ];
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(1);
    });
  });

  describe('highestDEF priority', () => {
    it('picks the monster with highest DEF', () => {
      const hand = [
        monster({ id: 'A', def: 600 }),
        monster({ id: 'B', def: 2000 }),
        monster({ id: 'C', def: 1500 }),
      ];
      expect(pickSummonCandidate(hand, 'highestDEF')).toBe(1);
    });

    it('handles monster with undefined def (treated as 0)', () => {
      const hand = [
        monster({ id: 'A', def: undefined }),
        monster({ id: 'B', def: 50 }),
      ];
      expect(pickSummonCandidate(hand, 'highestDEF')).toBe(1);
    });
  });

  describe('effectFirst priority', () => {
    it('prefers effect monster over higher ATK non-effect', () => {
      const hand = [
        monster({ id: 'A', atk: 2000 }),
        monster({
          id: 'B', atk: 500,
          effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] },
        }),
      ];
      // B gets 10000 + 500 = 10500, A gets 0 + 2000 = 2000
      expect(pickSummonCandidate(hand, 'effectFirst')).toBe(1);
    });

    it('among effect monsters, picks highest ATK', () => {
      const hand = [
        monster({
          id: 'A', atk: 800,
          effect: { trigger: 'onSummon', actions: [] },
        }),
        monster({
          id: 'B', atk: 1200,
          effect: { trigger: 'onSummon', actions: [] },
        }),
      ];
      // A: 10800, B: 11200
      expect(pickSummonCandidate(hand, 'effectFirst')).toBe(1);
    });

    it('among non-effect monsters, picks highest ATK', () => {
      const hand = [
        monster({ id: 'A', atk: 1500 }),
        monster({ id: 'B', atk: 1800 }),
      ];
      expect(pickSummonCandidate(hand, 'effectFirst')).toBe(1);
    });
  });

  describe('lowestLevel priority', () => {
    it('picks the monster with lowest level', () => {
      const hand = [
        monster({ id: 'A', level: 6 }),
        monster({ id: 'B', level: 2 }),
        monster({ id: 'C', level: 4 }),
      ];
      // Scores: A = 13-6 = 7, B = 13-2 = 11, C = 13-4 = 9
      expect(pickSummonCandidate(hand, 'lowestLevel')).toBe(1);
    });

    it('handles undefined level (treated as 1)', () => {
      const hand = [
        monster({ id: 'A', level: 2 }),
        monster({ id: 'B', level: undefined }),
      ];
      // A: 13-2 = 11, B: 13-1 = 12 → B wins (level 1 is lowest)
      expect(pickSummonCandidate(hand, 'lowestLevel')).toBe(1);
    });

    it('on tie picks first encountered', () => {
      const hand = [
        monster({ id: 'A', level: 3 }),
        monster({ id: 'B', level: 3 }),
      ];
      expect(pickSummonCandidate(hand, 'lowestLevel')).toBe(0);
    });
  });

  describe('mixed hand with spells and monsters', () => {
    it('only considers monsters for selection', () => {
      const hand = [
        spell({ id: 'S1' }),
        spell({ id: 'S2' }),
        monster({ id: 'M1', atk: 500 }),
        spell({ id: 'S3' }),
        monster({ id: 'M2', atk: 1000 }),
      ];
      expect(pickSummonCandidate(hand, 'highestATK')).toBe(4);
    });
  });
});

// ── decideSummonPosition ──────────────────────────────────

describe('decideSummonPosition', () => {
  // Signature: decideSummonPosition(monsterATK, monsterDEF, playerFieldMaxATK, playerHasMonsters, strategy)
  describe('aggressive strategy', () => {
    it('always returns atk regardless of ATK value', () => {
      expect(decideSummonPosition(100, 800, 2000, true, 'aggressive')).toBe('atk');
      expect(decideSummonPosition(3000, 2000, 2000, true, 'aggressive')).toBe('atk');
      expect(decideSummonPosition(500, 400, 0, false, 'aggressive')).toBe('atk');
    });
  });

  describe('defensive strategy', () => {
    it('always returns def regardless of ATK value', () => {
      expect(decideSummonPosition(3000, 2000, 100, true, 'defensive')).toBe('def');
      expect(decideSummonPosition(100, 800, 2000, true, 'defensive')).toBe('def');
      expect(decideSummonPosition(500, 400, 0, false, 'defensive')).toBe('def');
    });
  });

  describe('smart strategy', () => {
    it('returns def when monster ATK < player max ATK and DEF can survive', () => {
      // ATK 500 < maxATK 1500, DEF 2000 >= 1500 → def
      expect(decideSummonPosition(500, 2000, 1500, true, 'smart')).toBe('def');
    });

    it('returns def when monster ATK < player max ATK even if DEF cannot survive', () => {
      // ATK 500 < maxATK 1500, DEF 800 < 1500 → still def (avoid LP damage)
      expect(decideSummonPosition(500, 800, 1500, true, 'smart')).toBe('def');
    });

    it('returns atk when monster ATK >= player max ATK', () => {
      expect(decideSummonPosition(1500, 800, 1000, true, 'smart')).toBe('atk');
      expect(decideSummonPosition(2000, 1000, 1000, true, 'smart')).toBe('atk');
    });

    it('returns atk when player has no monsters (even with low ATK)', () => {
      expect(decideSummonPosition(100, 200, 0, false, 'smart')).toBe('atk');
    });

    it('returns atk when monster ATK equals playerFieldMaxATK', () => {
      expect(decideSummonPosition(800, 600, 800, true, 'smart')).toBe('atk');
    });

    it('returns def when monster ATK is 0 and player has monsters', () => {
      expect(decideSummonPosition(0, 500, 500, true, 'smart')).toBe('def');
    });
  });
});

// ── shouldActivateNormalSpell ─────────────────────────────

describe('shouldActivateNormalSpell', () => {
  describe('with matching spell rule', () => {
    it('activates when rule condition "always" is met', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        spellRules: { 'test-always': { when: 'always' } },
      };
      expect(shouldActivateNormalSpell('test-always', behavior, 8000, 8000)).toBe(true);
    });

    it('activates (oppLP>N) when player LP exceeds threshold', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        spellRules: { 'test-opp': { when: 'opponentLp>$N', threshold: 800 } },
      };
      expect(shouldActivateNormalSpell('test-opp', behavior, 1000, 8000)).toBe(true);
    });

    it('does not activate (oppLP>N) when player LP is at or below threshold', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        spellRules: { 'test-opp': { when: 'opponentLp>$N', threshold: 800 } },
      };
      expect(shouldActivateNormalSpell('test-opp', behavior, 800, 8000)).toBe(false);
      expect(shouldActivateNormalSpell('test-opp', behavior, 500, 8000)).toBe(false);
    });

    it('activates (selfLP<N) when AI LP is below threshold', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        spellRules: { 'test-self': { when: 'playerLp<$N', threshold: 5000 } },
      };
      expect(shouldActivateNormalSpell('test-self', behavior, 8000, 4000)).toBe(true);
    });

    it('does not activate (selfLP<N) when AI LP is at or above threshold', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        spellRules: { 'test-self': { when: 'playerLp<$N', threshold: 5000 } },
      };
      expect(shouldActivateNormalSpell('test-self', behavior, 8000, 5000)).toBe(false);
      expect(shouldActivateNormalSpell('test-self', behavior, 8000, 6000)).toBe(false);
    });
  });

  describe('without matching spell rule (fallback to defaultSpellActivation)', () => {
    it('returns true when defaultSpellActivation is "always"', () => {
      const behavior = resolveAIBehavior('aggressive');
      // aggressive has defaultSpellActivation: 'always' and empty spellRules
      expect(shouldActivateNormalSpell('test-spell', behavior, 8000, 8000)).toBe(true);
    });

    it('returns true when defaultSpellActivation is "smart" and AI is losing', () => {
      const behavior = resolveAIBehavior('default');
      // default has defaultSpellActivation: 'smart'
      // 'smart' activates when AI LP < player LP or AI LP < 5000
      expect(shouldActivateNormalSpell('test-spell', behavior, 8000, 4000)).toBe(true);
    });

    it('returns false when defaultSpellActivation is "smart" and AI is healthy', () => {
      const behavior = resolveAIBehavior('default');
      // AI LP 8000 >= player LP 8000 and AI LP >= 5000
      expect(shouldActivateNormalSpell('test-spell', behavior, 8000, 8000)).toBe(false);
    });

    it('returns false when defaultSpellActivation is "never"', () => {
      // Manually construct a behavior with 'never'
      const behavior = {
        ...resolveAIBehavior('default'),
        defaultSpellActivation: 'never',
        spellRules: {},
      };
      expect(shouldActivateNormalSpell('test-spell', behavior, 8000, 8000)).toBe(false);
    });
  });

  describe('spell rule takes precedence over default activation', () => {
    it('uses rule even when defaultSpellActivation is "always"', () => {
      const behavior = {
        ...resolveAIBehavior('aggressive'),
        spellRules: { 'test-spell': { when: 'playerLp<$N', threshold: 3000 } },
      };
      // defaultSpellActivation is 'always' but test-spell has a specific rule
      // AI LP 8000 >= 3000, so rule returns false
      expect(shouldActivateNormalSpell('test-spell', behavior, 8000, 8000)).toBe(false);
    });

    it('uses rule even when defaultSpellActivation is "never"', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        defaultSpellActivation: 'never',
        spellRules: { 'test-spell': { when: 'always' } },
      };
      // defaultSpellActivation is 'never' but test-spell has 'always' rule
      expect(shouldActivateNormalSpell('test-spell', behavior, 8000, 8000)).toBe(true);
    });
  });
});

// ── evaluateSpellRule (tested indirectly via shouldActivateNormalSpell) ──

describe('evaluateSpellRule (via shouldActivateNormalSpell)', () => {
  /** Helper to create a behavior with a single spell rule for card 'TEST'. */
  function behaviorWithRule(rule) {
    return {
      ...resolveAIBehavior('default'),
      spellRules: { TEST: rule },
      defaultSpellActivation: 'never', // ensure we test the rule, not default
    };
  }

  describe('condition: always', () => {
    it('returns true regardless of LP values', () => {
      const b = behaviorWithRule({ when: 'always' });
      expect(shouldActivateNormalSpell('TEST', b, 0, 0)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 8000)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 1, 99999)).toBe(true);
    });
  });

  describe('condition: oppLP>N', () => {
    it('returns true when playerLP > threshold', () => {
      const b = behaviorWithRule({ when: 'opponentLp>$N', threshold: 4000 });
      expect(shouldActivateNormalSpell('TEST', b, 4001, 8000)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 8000)).toBe(true);
    });

    it('returns false when playerLP <= threshold', () => {
      const b = behaviorWithRule({ when: 'opponentLp>$N', threshold: 4000 });
      expect(shouldActivateNormalSpell('TEST', b, 4000, 8000)).toBe(false);
      expect(shouldActivateNormalSpell('TEST', b, 3000, 8000)).toBe(false);
    });

    it('uses 0 as default threshold when threshold is undefined', () => {
      const b = behaviorWithRule({ when: 'opponentLp>$N' });
      // playerLP > 0
      expect(shouldActivateNormalSpell('TEST', b, 1, 8000)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 0, 8000)).toBe(false);
    });
  });

  describe('condition: selfLP<N', () => {
    it('returns true when aiLP < threshold', () => {
      const b = behaviorWithRule({ when: 'playerLp<$N', threshold: 5000 });
      expect(shouldActivateNormalSpell('TEST', b, 8000, 4999)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 1)).toBe(true);
    });

    it('returns false when aiLP >= threshold', () => {
      const b = behaviorWithRule({ when: 'playerLp<$N', threshold: 5000 });
      expect(shouldActivateNormalSpell('TEST', b, 8000, 5000)).toBe(false);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 8000)).toBe(false);
    });

    it('uses 0 as default threshold when threshold is undefined', () => {
      const b = behaviorWithRule({ when: 'playerLp<$N' });
      // aiLP < 0 → never true for non-negative LP
      expect(shouldActivateNormalSpell('TEST', b, 8000, 0)).toBe(false);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 1)).toBe(false);
    });
  });
});

// ── Mock FieldCard for smart AI tests ─────────────────────

function mockFieldCard(overrides = {}) {
  const defaults = {
    card: { id: 'M01', name: 'Mock', type: CardType.Monster, atk: 1000, def: 800, level: 4 },
    position: 'atk',
    faceDown: false,
    hasAttacked: false,
    summonedThisTurn: false,
    canDirectAttack: false,
    cantBeAttacked: false,
    indestructible: false,
    piercing: false,
    effectiveATK() { return this.card.atk + (this._atkBonus ?? 0); },
    effectiveDEF() { return this.card.def + (this._defBonus ?? 0); },
    combatValue() { return this.position === 'atk' ? this.effectiveATK() : this.effectiveDEF(); },
    _atkBonus: 0,
    _defBonus: 0,
    ...overrides,
  };
  // Re-bind effectiveATK/DEF to use the correct `this`
  if (overrides.card) defaults.card = { ...defaults.card, ...overrides.card };
  return defaults;
}

// ── pickSmartSummonCandidate ─────────────────────────────

describe('pickSmartSummonCandidate', () => {
  it('returns -1 for empty hand', () => {
    expect(pickSmartSummonCandidate([], {
      aiField: [null, null, null, null, null],
      playerField: [null, null, null, null, null],
      playerLp: 8000,
      aiLp: 8000,
    })).toBe(-1);
  });

  it('prefers monster that can beat player monsters', () => {
    const hand = [
      monster({ id: 'A', atk: 500, def: 400 }),
      monster({ id: 'B', atk: 1800, def: 1000 }),
    ];
    const plrFC = mockFieldCard({ card: { id: 'P1', name: 'P1', type: CardType.Monster, atk: 1500, def: 1200 } });
    const result = pickSmartSummonCandidate(hand, {
      aiField: [null, null, null, null, null],
      playerField: [plrFC, null, null, null, null],
      playerLp: 8000,
      aiLp: 8000,
    });
    expect(result).toBe(1); // B can beat P1
  });

  it('prefers effect monsters', () => {
    const hand = [
      monster({ id: 'A', atk: 1200, def: 1000 }),
      monster({
        id: 'B', atk: 1000, def: 800,
        effect: { trigger: 'onSummon', actions: [] },
      }),
    ];
    const result = pickSmartSummonCandidate(hand, {
      aiField: [null, null, null, null, null],
      playerField: [null, null, null, null, null],
      playerLp: 8000,
      aiLp: 8000,
    });
    expect(result).toBe(1); // B has effect bonus
  });

  it('skips non-monster cards', () => {
    const hand = [spell(), monster({ id: 'M', atk: 1000 })];
    const result = pickSmartSummonCandidate(hand, {
      aiField: [null, null, null, null, null],
      playerField: [null, null, null, null, null],
      playerLp: 8000,
      aiLp: 8000,
    });
    expect(result).toBe(1);
  });
});

// ── findLethal ────────────────────────────────────────────

describe('findLethal', () => {
  it('returns null when no attackers available', () => {
    expect(findLethal([null, null, null, null, null], [null, null, null, null, null], 8000)).toBeNull();
  });

  it('finds lethal with direct attacks when no defenders', () => {
    const atk1 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 5000 } });
    const atk2 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 4000 } });
    const result = findLethal(
      [atk1, atk2, null, null, null],
      [null, null, null, null, null],
      8000,
    );
    expect(result).not.toBeNull();
    expect(result.length).toBe(2);
    // All should be direct attacks
    expect(result.every(p => p.targetZone === -1)).toBe(true);
  });

  it('returns null when not enough ATK for lethal', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 3000 } });
    const result = findLethal(
      [atk, null, null, null, null],
      [null, null, null, null, null],
      8000,
    );
    expect(result).toBeNull();
  });

  it('finds lethal by clearing defender then going direct', () => {
    const atk1 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2500 } });
    const atk2 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 3000 } });
    const def = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2000 } });
    // ATK1 kills def (2500>2000, 500 LP dmg) + ATK2 goes direct (3000 LP dmg) = 3500 >= 3500
    const result = findLethal(
      [atk1, atk2, null, null, null],
      [def, null, null, null, null],
      3500,
    );
    expect(result).not.toBeNull();
  });

  it('skips monsters that already attacked', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 9000 }, hasAttacked: true });
    expect(findLethal([atk, null, null, null, null], [null, null, null, null, null], 1000)).toBeNull();
  });

  it('skips DEF position monsters', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 9000 }, position: 'def' });
    expect(findLethal([atk, null, null, null, null], [null, null, null, null, null], 1000)).toBeNull();
  });
});

// ── planAttacks ───────────────────────────────────────────

describe('planAttacks', () => {
  const smartBehavior = resolveAIBehavior('smart');
  const aggressiveBehavior = resolveAIBehavior('aggressive');

  it('returns empty array with no attackers', () => {
    expect(planAttacks(
      [null, null, null, null, null],
      [null, null, null, null, null],
      8000,
      smartBehavior,
    )).toEqual([]);
  });

  it('plans direct attacks when no defenders', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1500 } });
    const plans = planAttacks([atk, null, null, null, null], [null, null, null, null, null], 8000, smartBehavior);
    expect(plans.length).toBe(1);
    expect(plans[0].targetZone).toBe(-1);
  });

  it('smart strategy avoids attacking into stronger monsters', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1000 } });
    const def = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2000 } });
    const plans = planAttacks([atk, null, null, null, null], [def, null, null, null, null], 8000, smartBehavior);
    // Should not attack into a 2000ATK monster with 1000ATK
    expect(plans.length).toBe(0);
  });

  it('aggressive strategy attacks even unfavorable targets', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1000 } });
    const def = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2000 } });
    const plans = planAttacks([atk, null, null, null, null], [def, null, null, null, null], 8000, aggressiveBehavior);
    expect(plans.length).toBe(1);
  });

  it('uses lethal plan when available', () => {
    const atk = mockFieldCard({ card: { ...mockFieldCard().card, atk: 5000 } });
    const plans = planAttacks([atk, null, null, null, null], [null, null, null, null, null], 3000, smartBehavior);
    expect(plans.length).toBe(1);
    expect(plans[0].targetZone).toBe(-1); // direct attack for lethal
  });

  it('remaining attackers go direct after all defenders are assigned (face-down bug)', () => {
    // Bug scenario: AI has 4x 2200 ATK monsters, player has 1 face-down 800 DEF monster.
    // AI should destroy the face-down card AND direct attack with the remaining 3 monsters.
    const ai0 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2200 } });
    const ai1 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2200 } });
    const ai2 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2200 } });
    const ai3 = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2200 } });
    const faceDownDef = mockFieldCard({
      card: { ...mockFieldCard().card, atk: 800, def: 800 },
      position: 'def',
      faceDown: true,
    });

    const plans = planAttacks(
      [ai0, ai1, ai2, ai3, null],
      [faceDownDef, null, null, null, null],
      8000,
      smartBehavior,
    );

    // One attack should target the face-down defender (zone 0)
    const targetedAttacks = plans.filter(p => p.targetZone === 0);
    expect(targetedAttacks.length).toBe(1);

    // The remaining 3 attackers should go direct (targetZone -1)
    const directAttacks = plans.filter(p => p.targetZone === -1);
    expect(directAttacks.length).toBe(3);

    // Total: 4 attacks planned
    expect(plans.length).toBe(4);
  });
});

// ── pickEquipTarget ─────────────────────────────────────

describe('pickEquipTarget', () => {
  it('returns -1 when no monsters', () => {
    expect(pickEquipTarget([null, null, null, null, null], [null, null, null, null, null], 500, 0)).toBe(-1);
  });

  it('prefers monster that unlocks a kill with the buff', () => {
    const weak = mockFieldCard({ card: { ...mockFieldCard().card, atk: 800, def: 600 } });
    const strong = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1800, def: 1000 } });
    const opp = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2000, def: 1500 } });
    // +500 ATK: weak→1300 (still can't beat 2000), strong→2300 (CAN beat 2000)
    const zone = pickEquipTarget(
      [weak, strong, null, null, null],
      [opp, null, null, null, null],
      500, 0,
    );
    expect(zone).toBe(1); // strong gets the buff to unlock the kill
  });

  it('prefers monster that has not attacked', () => {
    const attacked = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1500 }, hasAttacked: true });
    const fresh = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1200 } });
    const zone = pickEquipTarget([attacked, fresh, null, null, null], [null, null, null, null, null], 300, 0);
    expect(zone).toBe(1); // fresh monster preferred
  });
});

// ── pickDebuffTarget ────────────────────────────────────

describe('pickDebuffTarget', () => {
  it('returns -1 when no opponent monsters', () => {
    expect(pickDebuffTarget([null, null, null, null, null], -500)).toBe(-1);
  });

  it('targets strongest opponent monster', () => {
    const weak = mockFieldCard({ card: { ...mockFieldCard().card, atk: 800 } });
    const strong = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2500 } });
    expect(pickDebuffTarget([weak, strong, null, null, null], -500)).toBe(1);
  });

  it('prioritizes effect monsters', () => {
    const normal = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1800 } });
    const effectMon = mockFieldCard({
      card: { ...mockFieldCard().card, atk: 1500, effect: { trigger: 'onSummon', actions: [] } },
    });
    expect(pickDebuffTarget([normal, effectMon, null, null, null], -500)).toBe(1);
  });
});

// ── pickBestGraveyardMonster ────────────────────────────

describe('pickBestGraveyardMonster', () => {
  it('returns null for empty graveyard', () => {
    expect(pickBestGraveyardMonster([], [null, null, null, null, null])).toBeNull();
  });

  it('returns null when graveyard has only spells', () => {
    expect(pickBestGraveyardMonster([spell()], [null, null, null, null, null])).toBeNull();
  });

  it('picks monster that can beat opponent strongest', () => {
    const opp = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2000 } });
    const weak = monster({ id: 'W', atk: 1000 });
    const strong = monster({ id: 'S', atk: 2500 });
    const best = pickBestGraveyardMonster([weak, strong], [opp, null, null, null, null]);
    expect(best.id).toBe('S');
  });

  it('prefers effect monsters', () => {
    const noEffect = monster({ id: 'A', atk: 1800 });
    const withEffect = monster({
      id: 'B', atk: 1500,
      effect: { trigger: 'onSummon', actions: [] },
    });
    const best = pickBestGraveyardMonster([noEffect, withEffect], [null, null, null, null, null]);
    expect(best.id).toBe('B'); // effect bonus outweighs 300ATK difference
  });
});

// ── pickSpellBuffTarget ─────────────────────────────────

describe('pickSpellBuffTarget', () => {
  it('returns null when no own monsters', () => {
    expect(pickSpellBuffTarget([null, null, null, null, null], [null, null, null, null, null])).toBeNull();
  });

  it('prefers monster that has not attacked yet over similar ATK', () => {
    const attacked = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1500 }, hasAttacked: true });
    const fresh = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1400 } });
    const target = pickSpellBuffTarget([attacked, fresh, null, null, null], [null, null, null, null, null]);
    expect(target.card.atk).toBe(1400); // fresh monster preferred (hasn't attacked bonus)
  });

  it('prefers monster close to beating opponent strongest', () => {
    const farOff = mockFieldCard({ card: { ...mockFieldCard().card, atk: 500 } });
    const closeToKill = mockFieldCard({ card: { ...mockFieldCard().card, atk: 1800 } });
    const opp = mockFieldCard({ card: { ...mockFieldCard().card, atk: 2000 } });
    const target = pickSpellBuffTarget([farOff, closeToKill, null, null, null], [opp, null, null, null, null]);
    expect(target.card.atk).toBe(1800); // close to beating 2000
  });
});
