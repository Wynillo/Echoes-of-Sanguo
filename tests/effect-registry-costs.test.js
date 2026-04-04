// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { canPayCost, executeEffectBlock } from '../src/effect-registry.js';

function mockEngine(overrides = {}) {
  const removeEquipMock = vi.fn();
  const state = {
    player: {
      lp: 4000,
      deck: [],
      hand: [{ id: 'H1', name: 'HandCard1' }, { id: 'H2', name: 'HandCard2' }],
      field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null] },
      graveyard: [],
    },
    opponent: {
      lp: 4000,
      deck: [],
      hand: [],
      field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null] },
      graveyard: [],
    },
  };
  return {
    dealDamage: vi.fn((target, amount) => {
      state[target].lp = Math.max(0, state[target].lp - amount);
    }),
    gainLP: vi.fn(),
    drawCard: vi.fn(),
    addLog: vi.fn(),
    specialSummonFromGrave: vi.fn(),
    specialSummon: vi.fn(),
    chainTribute: vi.fn(async (owner, card) => {
      const field = state[owner].field.monsters;
      for (let i = 0; i < field.length; i++) {
        if (field[i]?.card.id === card.id) {
          field[i] = null;
          state[owner].graveyard.push(card);
          removeEquipMock(owner, i);
          break;
        }
      }
    }),
    _removeEquipmentForMonster: removeEquipMock,
    removeEquipmentForMonster: removeEquipMock,
    getState: vi.fn(() => state),
    _state: state,
    ...overrides,
  };
}

function ctx(engine, owner = 'player', extras = {}) {
  return { engine, owner, ...extras };
}

describe('canPayCost', () => {
  it('returns true when block has no cost', () => {
    const e = mockEngine();
    const block = { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });

  it('returns true when LP is greater than cost', () => {
    const e = mockEngine();
    e._state.player.lp = 2000;
    const block = { trigger: 'onSummon', actions: [], cost: { lp: 1000 } };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });

  it('returns true when LP equals cost (can pay exact amount)', () => {
    const e = mockEngine();
    e._state.player.lp = 1000;
    const block = { trigger: 'onSummon', actions: [], cost: { lp: 1000 } };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });

  it('returns false when LP is less than cost', () => {
    const e = mockEngine();
    e._state.player.lp = 500;
    const block = { trigger: 'onSummon', actions: [], cost: { lp: 1000 } };
    expect(canPayCost(block, ctx(e))).toBe(false);
  });

  it('returns true when hand has enough cards for discard', () => {
    const e = mockEngine();
    e._state.player.hand = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const block = { trigger: 'onSummon', actions: [], cost: { discard: 2 } };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });

  it('returns false when hand has fewer cards than discard cost', () => {
    const e = mockEngine();
    e._state.player.hand = [{ id: 'A' }];
    const block = { trigger: 'onSummon', actions: [], cost: { discard: 2 } };
    expect(canPayCost(block, ctx(e))).toBe(false);
  });

  it('returns true for cost with undefined lp and discard', () => {
    const e = mockEngine();
    const block = { trigger: 'onSummon', actions: [], cost: {} };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });
});

describe('payCost (tested via executeEffectBlock)', () => {
  describe('lpHalf cost', () => {
    it('deals half LP as damage (even LP)', async () => {
      const e = mockEngine();
      e._state.player.lp = 4000;
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }],
        cost: { lpHalf: true },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e.dealDamage).toHaveBeenCalledWith('player', 2000);
    });

    it('uses floor division for odd LP', async () => {
      const e = mockEngine();
      e._state.player.lp = 4001;
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }],
        cost: { lpHalf: true },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e.dealDamage).toHaveBeenCalledWith('player', 2000);
    });

    it('costs 0 when LP is 1', async () => {
      const e = mockEngine();
      e._state.player.lp = 1;
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }],
        cost: { lpHalf: true },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e.dealDamage).toHaveBeenCalledWith('player', 0);
    });
  });

  describe('fixed lp cost', () => {
    it('deals exact LP damage', async () => {
      const e = mockEngine();
      e._state.player.lp = 8000;
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }],
        cost: { lp: 2000 },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e.dealDamage).toHaveBeenCalledWith('player', 2000);
    });
  });

  describe('discard cost', () => {
    it('removes cards from hand and adds to graveyard', async () => {
      const e = mockEngine();
      e._state.player.hand = [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' }];
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }],
        cost: { discard: 2 },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e._state.player.hand.length).toBe(1);
      expect(e._state.player.graveyard.length).toBe(2);
    });

    it('does not error when discarding from empty hand', async () => {
      const e = mockEngine();
      e._state.player.hand = [];
      e._state.player.lp = 9999;
      const block = {
        trigger: 'onSummon',
        actions: [],
        cost: { discard: 0 },
      };
      await expect(executeEffectBlock(block, ctx(e))).resolves.not.toThrow();
    });
  });

  describe('tributeSelf cost', () => {
    it('tributes matching monster from field', async () => {
      const e = mockEngine();
      const effectCard = {
        id: 'E1', name: 'EffectMon',
        effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
      };
      e._state.player.field.monsters[2] = { card: effectCard, position: 'atk' };
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }],
        cost: { tributeSelf: true },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e._state.player.field.monsters[2]).toBeNull();
      expect(e._state.player.graveyard).toContain(effectCard);
      expect(e._removeEquipmentForMonster).toHaveBeenCalledWith('player', 2);
    });

    it('does nothing if no matching monster on field', async () => {
      const e = mockEngine();
      const block = {
        trigger: 'onSummon',
        actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }],
        cost: { tributeSelf: true },
      };
      await executeEffectBlock(block, ctx(e));
      expect(e._removeEquipmentForMonster).not.toHaveBeenCalled();
    });
  });
});

describe('executeEffectBlock cost integration', () => {
  it('blocks execution when cost cannot be paid', async () => {
    const e = mockEngine();
    e._state.player.lp = 500;
    const block = {
      trigger: 'onSummon',
      actions: [{ type: 'dealDamage', target: 'opponent', value: 1000 }],
      cost: { lp: 1000 },
    };
    const signal = await executeEffectBlock(block, ctx(e));
    expect(signal).toEqual({});
    expect(e.addLog).toHaveBeenCalledWith('Cannot pay effect cost!');
  });

  it('pays cost then executes actions', async () => {
    const e = mockEngine();
    e._state.player.lp = 8000;
    const block = {
      trigger: 'onSummon',
      actions: [{ type: 'dealDamage', target: 'opponent', value: 1000 }],
      cost: { lp: 2000 },
    };
    await executeEffectBlock(block, ctx(e));
    // First call: cost payment, second call: effect action
    expect(e.dealDamage).toHaveBeenCalledTimes(2);
    expect(e.dealDamage).toHaveBeenCalledWith('player', 2000);
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 1000);
  });

  it('merges signals from multiple actions', async () => {
    const e = mockEngine();
    const block = {
      trigger: 'onSummon',
      actions: [
        { type: 'cancelAttack' },
        { type: 'destroyAttacker' },
      ],
    };
    const signal = await executeEffectBlock(block, ctx(e));
    expect(signal.cancelAttack).toBe(true);
    expect(signal.destroyAttacker).toBe(true);
  });
});
