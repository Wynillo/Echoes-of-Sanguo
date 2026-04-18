// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/engine.js';
import { GAME_RULES } from '../src/rules.js';
import type { GameState, UICallbacks } from '../src/types.js';

describe('rate-limiting', () => {
  let mockUI: UICallbacks;
  let engine: GameEngine;

  beforeEach(() => {
    mockUI = {
      render: () => { },
      log: () => { },
    };
    engine = new GameEngine(mockUI);
  });

  describe('checkRateLimit', () => {
    it('allows actions within rate limit', () => {
      expect((engine as any).checkRateLimit('summon')).toBe(true);
    });

    it('blocks actions exceeding rate limit', () => {
      const limit = (engine as any).ACTION_RATE_LIMIT.summon;
      for (let i = 0; i < limit.maxActions; i++) {
        expect((engine as any).checkRateLimit('summon')).toBe(true);
      }
      expect((engine as any).checkRateLimit('summon')).toBe(false);
    });

    it('allows actions after window expires', () => {
      const limit = (engine as any).ACTION_RATE_LIMIT.summon;
      for (let i = 0; i < limit.maxActions; i++) {
        (engine as any).checkRateLimit('summon');
      }
      const now = Date.now();
      (engine as any)._actionTimestamps.set('summon', [now - limit.windowMs - 100]);
      expect((engine as any).checkRateLimit('summon')).toBe(true);
    });
  });

  describe('action counters', () => {
    it('initializes action counters to 0', async () => {
      await engine.initGame(['BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON'], null);
      expect(engine.state.player.summonsThisTurn).toBe(0);
      expect(engine.state.player.attacksThisTurn).toBe(0);
      expect(engine.state.player.effectActivationsThisTurn).toBe(0);
    });

    it('increments summonsThisTurn on summon', async () => {
      await engine.initGame(['BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON'], null);
      const initialCount = engine.state.player.summonsThisTurn;
      await engine.summonMonster('player', 0, 0);
      expect(engine.state.player.summonsThisTurn).toBe(initialCount + 1);
    });

    it('resets action counters via reset method', async () => {
      await engine.initGame(['BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON', 'BLUE_EYES_WHITE_DRAGON'], null);
      await engine.summonMonster('player', 0, 0);
      expect(engine.state.player.summonsThisTurn).toBeGreaterThan(0);
      (engine as any)._resetActionCounters('player');
      expect(engine.state.player.summonsThisTurn).toBe(0);
    });
  });

  describe('per-turn limits', () => {
    it('enforces maxSummonsPerTurn', async () => {
      await engine.initGame(
        Array(10).fill('BLUE_EYES_WHITE_DRAGON'),
        null
      );
      
      for (let i = 0; i < GAME_RULES.maxSummonsPerTurn; i++) {
        const result = await engine.summonMonster('player', 0, i);
        expect(result).toBe(true);
      }
      
      const result = await engine.summonMonster('player', 0, 4);
      expect(result).toBe(false);
      expect(engine.state.log).toContainEqual(
        expect.stringContaining('Maximum summon limit')
      );
    });
  });
});
