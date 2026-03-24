// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  resolveAIBehavior,
  AI_BEHAVIOR_REGISTRY,
  pickSummonCandidate,
  decideSummonPosition,
  shouldActivateNormalSpell,
} from '../js/ai-behaviors.js';
import { CardType } from '../js/types.js';

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
    id: 'S999',
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
      const hand = [spell(), spell({ id: 'S998' })];
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
  describe('aggressive strategy', () => {
    it('always returns atk regardless of ATK value', () => {
      expect(decideSummonPosition(100, 2000, true, 'aggressive')).toBe('atk');
      expect(decideSummonPosition(3000, 2000, true, 'aggressive')).toBe('atk');
      expect(decideSummonPosition(500, 0, false, 'aggressive')).toBe('atk');
    });
  });

  describe('defensive strategy', () => {
    it('always returns def regardless of ATK value', () => {
      expect(decideSummonPosition(3000, 100, true, 'defensive')).toBe('def');
      expect(decideSummonPosition(100, 2000, true, 'defensive')).toBe('def');
      expect(decideSummonPosition(500, 0, false, 'defensive')).toBe('def');
    });
  });

  describe('smart strategy', () => {
    it('returns def when player has monsters and monster ATK < player min val', () => {
      expect(decideSummonPosition(500, 1000, true, 'smart')).toBe('def');
    });

    it('returns atk when monster ATK >= player min val', () => {
      expect(decideSummonPosition(1000, 1000, true, 'smart')).toBe('atk');
      expect(decideSummonPosition(1500, 1000, true, 'smart')).toBe('atk');
    });

    it('returns atk when player has no monsters (even with low ATK)', () => {
      expect(decideSummonPosition(100, 0, false, 'smart')).toBe('atk');
    });

    it('returns atk when player has monsters but monster ATK equals playerFieldMinVal', () => {
      expect(decideSummonPosition(800, 800, true, 'smart')).toBe('atk');
    });

    it('returns def when monster ATK is 0 and player has monsters with non-zero min', () => {
      expect(decideSummonPosition(0, 500, true, 'smart')).toBe('def');
    });
  });
});

// ── shouldActivateNormalSpell ─────────────────────────────

describe('shouldActivateNormalSpell', () => {
  describe('with matching spell rule', () => {
    it('activates when rule condition "always" is met', () => {
      const behavior = resolveAIBehavior('default');
      // S005 has { when: 'always' } in legacy spell rules
      expect(shouldActivateNormalSpell('S005', behavior, 8000, 8000)).toBe(true);
    });

    it('activates S001 (oppLP>N) when player LP exceeds threshold', () => {
      const behavior = resolveAIBehavior('default');
      // S001: { when: 'oppLP>N', threshold: 800 }
      expect(shouldActivateNormalSpell('S001', behavior, 1000, 8000)).toBe(true);
    });

    it('does not activate S001 when player LP is at or below threshold', () => {
      const behavior = resolveAIBehavior('default');
      expect(shouldActivateNormalSpell('S001', behavior, 800, 8000)).toBe(false);
      expect(shouldActivateNormalSpell('S001', behavior, 500, 8000)).toBe(false);
    });

    it('activates S002 (selfLP<N) when AI LP is below threshold', () => {
      const behavior = resolveAIBehavior('default');
      // S002: { when: 'selfLP<N', threshold: 5000 }
      expect(shouldActivateNormalSpell('S002', behavior, 8000, 4000)).toBe(true);
    });

    it('does not activate S002 when AI LP is at or above threshold', () => {
      const behavior = resolveAIBehavior('default');
      expect(shouldActivateNormalSpell('S002', behavior, 8000, 5000)).toBe(false);
      expect(shouldActivateNormalSpell('S002', behavior, 8000, 6000)).toBe(false);
    });
  });

  describe('without matching spell rule (fallback to defaultSpellActivation)', () => {
    it('returns true when defaultSpellActivation is "always"', () => {
      const behavior = resolveAIBehavior('aggressive');
      // aggressive has defaultSpellActivation: 'always' and empty spellRules
      expect(shouldActivateNormalSpell('S999', behavior, 8000, 8000)).toBe(true);
    });

    it('returns true when defaultSpellActivation is "smart"', () => {
      const behavior = resolveAIBehavior('default');
      // default has defaultSpellActivation: 'smart'
      // 'S999' is not in legacy rules, so falls through to default
      expect(shouldActivateNormalSpell('S999', behavior, 8000, 8000)).toBe(true);
    });

    it('returns false when defaultSpellActivation is "never"', () => {
      // Manually construct a behavior with 'never'
      const behavior = {
        ...resolveAIBehavior('default'),
        defaultSpellActivation: 'never',
        spellRules: {},
      };
      expect(shouldActivateNormalSpell('S999', behavior, 8000, 8000)).toBe(false);
    });
  });

  describe('spell rule takes precedence over default activation', () => {
    it('uses rule even when defaultSpellActivation is "always"', () => {
      const behavior = {
        ...resolveAIBehavior('aggressive'),
        spellRules: { 'S999': { when: 'selfLP<N', threshold: 3000 } },
      };
      // defaultSpellActivation is 'always' but S999 has a specific rule
      // AI LP 8000 >= 3000, so rule returns false
      expect(shouldActivateNormalSpell('S999', behavior, 8000, 8000)).toBe(false);
    });

    it('uses rule even when defaultSpellActivation is "never"', () => {
      const behavior = {
        ...resolveAIBehavior('default'),
        defaultSpellActivation: 'never',
        spellRules: { 'S999': { when: 'always' } },
      };
      // defaultSpellActivation is 'never' but S999 has 'always' rule
      expect(shouldActivateNormalSpell('S999', behavior, 8000, 8000)).toBe(true);
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
      const b = behaviorWithRule({ when: 'oppLP>N', threshold: 4000 });
      expect(shouldActivateNormalSpell('TEST', b, 4001, 8000)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 8000)).toBe(true);
    });

    it('returns false when playerLP <= threshold', () => {
      const b = behaviorWithRule({ when: 'oppLP>N', threshold: 4000 });
      expect(shouldActivateNormalSpell('TEST', b, 4000, 8000)).toBe(false);
      expect(shouldActivateNormalSpell('TEST', b, 3000, 8000)).toBe(false);
    });

    it('uses 0 as default threshold when threshold is undefined', () => {
      const b = behaviorWithRule({ when: 'oppLP>N' });
      // playerLP > 0
      expect(shouldActivateNormalSpell('TEST', b, 1, 8000)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 0, 8000)).toBe(false);
    });
  });

  describe('condition: selfLP<N', () => {
    it('returns true when aiLP < threshold', () => {
      const b = behaviorWithRule({ when: 'selfLP<N', threshold: 5000 });
      expect(shouldActivateNormalSpell('TEST', b, 8000, 4999)).toBe(true);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 1)).toBe(true);
    });

    it('returns false when aiLP >= threshold', () => {
      const b = behaviorWithRule({ when: 'selfLP<N', threshold: 5000 });
      expect(shouldActivateNormalSpell('TEST', b, 8000, 5000)).toBe(false);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 8000)).toBe(false);
    });

    it('uses 0 as default threshold when threshold is undefined', () => {
      const b = behaviorWithRule({ when: 'selfLP<N' });
      // aiLP < 0 → never true for non-negative LP
      expect(shouldActivateNormalSpell('TEST', b, 8000, 0)).toBe(false);
      expect(shouldActivateNormalSpell('TEST', b, 8000, 1)).toBe(false);
    });
  });
});
