// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { GAME_RULES, applyRules } from '../src/rules.ts';

const DEFAULTS = { ...GAME_RULES };

afterEach(() => {
  applyRules(DEFAULTS);
});

describe('GAME_RULES', () => {
  it('has correct default values', () => {
    expect(GAME_RULES.STARTING_LP).toBe(8000);
    expect(GAME_RULES.maxLP).toBe(99999);
    expect(GAME_RULES.handLimitDraw).toBe(10);
    expect(GAME_RULES.handLimitEnd).toBe(8);
    expect(GAME_RULES.fieldZones).toBe(5);
    expect(GAME_RULES.maxDeckSize).toBe(40);
    expect(GAME_RULES.maxCardCopies).toBe(3);
    expect(GAME_RULES.drawPerTurn).toBe(1);
    expect(GAME_RULES.handRefillSize).toBe(5);
    expect(GAME_RULES.refillHandEnabled).toBe(true);
  });
});

describe('applyRules', () => {
  it('overrides specified fields', () => {
    applyRules({ STARTING_LP: 4000, maxLP: 50000 });
    expect(GAME_RULES.STARTING_LP).toBe(4000);
    expect(GAME_RULES.maxLP).toBe(50000);
  });

  it('preserves unspecified fields', () => {
    applyRules({ STARTING_LP: 4000 });
    expect(GAME_RULES.maxLP).toBe(99999);
    expect(GAME_RULES.fieldZones).toBe(5);
    expect(GAME_RULES.handLimitEnd).toBe(8);
  });

  it('handles empty partial', () => {
    applyRules({});
    expect(GAME_RULES.STARTING_LP).toBe(8000);
  });

  it('can disable hand refill', () => {
    applyRules({ refillHandEnabled: false });
    expect(GAME_RULES.refillHandEnabled).toBe(false);
  });
});
