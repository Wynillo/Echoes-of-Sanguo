// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  snapshotBoard,
  computeBoardThreat,
  estimateFutureValue,
  classifyGoalAlignment,
  evaluateTurnGoal,
} from '../src/ai-threat.ts';
import { FieldCard } from '../src/field.ts';
import { AI_SCORE } from '../src/ai-behaviors.ts';

function monster(atk, def = 0) {
  return { id: 'M1', name: 'Mon', type: 1, atk, def };
}

function makePlayerState(overrides = {}) {
  return {
    lp: 8000,
    hand: [],
    field: { monsters: [null, null, null, null, null], spellTraps: [] },
    graveyard: [],
    deck: [],
    ...overrides,
  };
}

describe('snapshotBoard', () => {
  it('returns zeros for empty fields', () => {
    const ai = makePlayerState();
    const plr = makePlayerState();
    const snap = snapshotBoard(ai, plr);
    expect(snap.opponentLp).toBe(8000);
    expect(snap.playerLp).toBe(8000);
    expect(snap.aiMonsterPower).toBe(0);
    expect(snap.plrMonsterPower).toBe(0);
    expect(snap.aiHandSize).toBe(0);
    expect(snap.plrHandSize).toBe(0);
  });

  it('sums effective ATK of monsters on both sides', () => {
    const ai = makePlayerState();
    const plr = makePlayerState();
    ai.field.monsters[0] = new FieldCard(monster(1500));
    ai.field.monsters[2] = new FieldCard(monster(1000));
    plr.field.monsters[1] = new FieldCard(monster(2000));

    const snap = snapshotBoard(ai, plr);
    expect(snap.aiMonsterPower).toBe(2500);
    expect(snap.plrMonsterPower).toBe(2000);
  });

  it('skips null monster slots', () => {
    const ai = makePlayerState();
    ai.field.monsters = [null, new FieldCard(monster(500)), null, null, null];
    const snap = snapshotBoard(ai, makePlayerState());
    expect(snap.aiMonsterPower).toBe(500);
  });

  it('reflects hand sizes', () => {
    const ai = makePlayerState({ hand: [monster(100), monster(200)] });
    const plr = makePlayerState({ hand: [monster(300)] });
    const snap = snapshotBoard(ai, plr);
    expect(snap.aiHandSize).toBe(2);
    expect(snap.plrHandSize).toBe(1);
  });
});

describe('computeBoardThreat', () => {
  it('returns 0 for perfectly equal state', () => {
    const threat = computeBoardThreat({
      opponentLp: 8000, playerLp: 8000,
      aiMonsterPower: 0, plrMonsterPower: 0,
      aiHandSize: 0, plrHandSize: 0,
    });
    expect(threat).toBe(0);
  });

  it('returns positive when AI is ahead in LP', () => {
    const threat = computeBoardThreat({
      opponentLp: 8000, playerLp: 4000,
      aiMonsterPower: 0, plrMonsterPower: 0,
      aiHandSize: 0, plrHandSize: 0,
    });
    expect(threat).toBeGreaterThan(0);
  });

  it('returns negative when AI is behind in LP', () => {
    const threat = computeBoardThreat({
      opponentLp: 4000, playerLp: 8000,
      aiMonsterPower: 0, plrMonsterPower: 0,
      aiHandSize: 0, plrHandSize: 0,
    });
    expect(threat).toBeLessThan(0);
  });

  it('handles playerLp <= 0 safely (no divide by zero)', () => {
    const threat = computeBoardThreat({
      opponentLp: 8000, playerLp: 0,
      aiMonsterPower: 0, plrMonsterPower: 0,
      aiHandSize: 0, plrHandSize: 0,
    });
    expect(Number.isFinite(threat)).toBe(true);
    expect(threat).toBeGreaterThan(0);
  });

  it('factors in board power difference', () => {
    const aiBoardAhead = computeBoardThreat({
      opponentLp: 8000, playerLp: 8000,
      aiMonsterPower: 2000, plrMonsterPower: 0,
      aiHandSize: 0, plrHandSize: 0,
    });
    expect(aiBoardAhead).toBeGreaterThan(0);

    const plrBoardAhead = computeBoardThreat({
      opponentLp: 8000, playerLp: 8000,
      aiMonsterPower: 0, plrMonsterPower: 2000,
      aiHandSize: 0, plrHandSize: 0,
    });
    expect(plrBoardAhead).toBeLessThan(0);
  });

  it('factors in hand advantage', () => {
    const moreCards = computeBoardThreat({
      opponentLp: 8000, playerLp: 8000,
      aiMonsterPower: 0, plrMonsterPower: 0,
      aiHandSize: 5, plrHandSize: 2,
    });
    expect(moreCards).toBeGreaterThan(0);
  });

  it('uses correct weight constants', () => {
    const snap = {
      opponentLp: 8000, playerLp: 8000,
      aiMonsterPower: 1000, plrMonsterPower: 0,
      aiHandSize: 0, plrHandSize: 0,
    };
    const threat = computeBoardThreat(snap);
    const expectedBoard = 1000 * AI_SCORE.THREAT_BOARD_WEIGHT;
    expect(threat).toBe(expectedBoard);
  });
});

describe('estimateFutureValue', () => {
  const baseBefore = {
    opponentLp: 8000, playerLp: 8000,
    aiMonsterPower: 0, plrMonsterPower: 0,
    aiHandSize: 3, plrHandSize: 3,
  };

  it('returns 0 when gamma is 0 (lookahead disabled)', () => {
    const after = { ...baseBefore, aiMonsterPower: 2000 };
    expect(estimateFutureValue(baseBefore, after, 0)).toBe(0);
  });

  it('returns positive for improving board state', () => {
    const after = { ...baseBefore, aiMonsterPower: 2000 };
    const val = estimateFutureValue(baseBefore, after, 0.7);
    expect(val).toBeGreaterThan(0);
  });

  it('returns negative for worsening board state', () => {
    const after = { ...baseBefore, plrMonsterPower: 2000 };
    const val = estimateFutureValue(baseBefore, after, 0.7);
    expect(val).toBeLessThan(0);
  });

  it('scales result by gamma', () => {
    const after = { ...baseBefore, aiMonsterPower: 1000 };
    const val07 = estimateFutureValue(baseBefore, after, 0.7);
    const val10 = estimateFutureValue(baseBefore, after, 1.0);
    expect(val10).toBeGreaterThan(val07);
    expect(Math.abs(val07 / val10 - 0.7)).toBeLessThan(0.001);
  });
});

describe('classifyGoalAlignment', () => {
  const makeGoal = (id, bonus = 1000) => ({ id, alignmentBonus: bonus, switchTurn: undefined });

  it('returns 0 when goal is undefined', () => {
    expect(classifyGoalAlignment('fusion', undefined)).toBe(0);
    expect(classifyGoalAlignment('attack', undefined)).toBe(0);
  });

  describe('fusion_otk', () => {
    const goal = makeGoal('fusion_otk');
    it('gives full bonus for fusion', () => {
      expect(classifyGoalAlignment('fusion', goal)).toBe(1000);
    });
    it('gives 70% for spell_damage', () => {
      expect(classifyGoalAlignment('spell_damage', goal)).toBe(700);
    });
    it('gives 30% for set_trap', () => {
      expect(classifyGoalAlignment('set_trap', goal)).toBe(300);
    });
    it('gives 0 for non-matching actions', () => {
      expect(classifyGoalAlignment('summon', goal)).toBe(0);
      expect(classifyGoalAlignment('spell_heal', goal)).toBe(0);
      expect(classifyGoalAlignment('attack', goal)).toBe(0);
    });
  });

  describe('stall_drain', () => {
    const goal = makeGoal('stall_drain');
    it('gives full bonus for spell_heal', () => {
      expect(classifyGoalAlignment('spell_heal', goal)).toBe(1000);
    });
    it('gives 80% for set_trap', () => {
      expect(classifyGoalAlignment('set_trap', goal)).toBe(800);
    });
    it('gives 40% for attack', () => {
      expect(classifyGoalAlignment('attack', goal)).toBe(400);
    });
    it('gives 0 for non-matching', () => {
      expect(classifyGoalAlignment('fusion', goal)).toBe(0);
      expect(classifyGoalAlignment('summon', goal)).toBe(0);
    });
  });

  describe('swarm_aggro', () => {
    const goal = makeGoal('swarm_aggro');
    it('gives full bonus for summon and attack', () => {
      expect(classifyGoalAlignment('summon', goal)).toBe(1000);
      expect(classifyGoalAlignment('attack', goal)).toBe(1000);
    });
    it('gives 60% for fusion', () => {
      expect(classifyGoalAlignment('fusion', goal)).toBe(600);
    });
    it('gives 0 for non-matching', () => {
      expect(classifyGoalAlignment('spell_heal', goal)).toBe(0);
    });
  });

  describe('control', () => {
    const goal = makeGoal('control');
    it('gives full bonus for spell_damage', () => {
      expect(classifyGoalAlignment('spell_damage', goal)).toBe(1000);
    });
    it('gives 80% for attack', () => {
      expect(classifyGoalAlignment('attack', goal)).toBe(800);
    });
    it('gives 50% for fusion', () => {
      expect(classifyGoalAlignment('fusion', goal)).toBe(500);
    });
    it('gives 0 for non-matching', () => {
      expect(classifyGoalAlignment('summon', goal)).toBe(0);
      expect(classifyGoalAlignment('spell_heal', goal)).toBe(0);
      expect(classifyGoalAlignment('set_trap', goal)).toBe(0);
    });
  });

  it('rounds alignment bonus correctly', () => {
    const goal = makeGoal('fusion_otk', 333);
    expect(classifyGoalAlignment('spell_damage', goal)).toBe(Math.round(333 * 0.7));
  });
});

describe('evaluateTurnGoal', () => {
  it('returns undefined when goal is undefined', () => {
    expect(evaluateTurnGoal(5, undefined)).toBeUndefined();
  });

  it('returns goal when turn is before switchTurn', () => {
    const goal = { id: 'fusion_otk', alignmentBonus: 1000, switchTurn: 10 };
    expect(evaluateTurnGoal(5, goal)).toBe(goal);
  });

  it('returns undefined when turn reaches switchTurn', () => {
    const goal = { id: 'fusion_otk', alignmentBonus: 1000, switchTurn: 10 };
    expect(evaluateTurnGoal(10, goal)).toBeUndefined();
  });

  it('returns undefined when turn exceeds switchTurn', () => {
    const goal = { id: 'fusion_otk', alignmentBonus: 1000, switchTurn: 5 };
    expect(evaluateTurnGoal(8, goal)).toBeUndefined();
  });

  it('returns goal when switchTurn is undefined (permanent goal)', () => {
    const goal = { id: 'stall_drain', alignmentBonus: 500, switchTurn: undefined };
    expect(evaluateTurnGoal(100, goal)).toBe(goal);
  });
});
