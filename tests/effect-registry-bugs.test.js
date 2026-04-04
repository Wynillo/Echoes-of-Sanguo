// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { canPayCost, executeEffectBlock, EFFECT_REGISTRY } from '../src/effect-registry.js';

function mockEngine(overrides = {}) {
  const state = {
    player: {
      lp: 4000,
      deck: [],
      hand: [],
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
  const mock = {
    dealDamage: vi.fn((target, amount) => {
      state[target].lp = Math.max(0, state[target].lp - amount);
    }),
    gainLP: vi.fn(),
    drawCard: vi.fn(),
    addLog: vi.fn(),
    specialSummonFromGrave: vi.fn(),
    specialSummon: vi.fn(),
    chainTribute: vi.fn(),
    _removeEquipmentForMonster: vi.fn(),
    removeEquipmentForMonster: vi.fn(),
    _removeFieldSpell: vi.fn(),
    removeFieldSpell: vi.fn(),
    getState: vi.fn(() => state),
    _state: state,
    _removeEquipmentForMonster: vi.fn(),
    _removeFieldSpell: vi.fn(),
    getState: vi.fn(() => state),
    _state: state,
    ...overrides,
  };
  return mock;
}

function ctx(engine, owner = 'player', extras = {}) {
  return { engine, owner, state: engine._state, ...extras };
}

function makeFieldCard(card, opts = {}) {
  return {
    card,
    position: opts.position ?? 'atk',
    faceDown: false,
    hasAttacked: false,
    summonedThisTurn: false,
    tempATKBonus: 0,
    tempDEFBonus: 0,
    permATKBonus: 0,
    permDEFBonus: 0,
    equippedCards: [],
    cannotBeTargeted: opts.cannotBeTargeted ?? false,
    effectiveATK() { return (this.card.atk ?? 0) + this.permATKBonus + this.tempATKBonus; },
    effectiveDEF() { return (this.card.def ?? 0) + this.permDEFBonus + this.tempDEFBonus; },
    ...opts,
  };
}

describe('Bug fix: canPayCost LP check allows exact amount', () => {
  it('returns true when LP exactly equals cost', () => {
    const e = mockEngine();
    e._state.player.lp = 1000;
    const block = { trigger: 'onSummon', actions: [], cost: { lp: 1000 } };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });

  it('returns false when LP is less than cost', () => {
    const e = mockEngine();
    e._state.player.lp = 999;
    const block = { trigger: 'onSummon', actions: [], cost: { lp: 1000 } };
    expect(canPayCost(block, ctx(e))).toBe(false);
  });

  it('returns true when LP is greater than cost', () => {
    const e = mockEngine();
    e._state.player.lp = 1001;
    const block = { trigger: 'onSummon', actions: [], cost: { lp: 1000 } };
    expect(canPayCost(block, ctx(e))).toBe(true);
  });
});

describe('Bug fix: stealMonster sets originalOwner', () => {
  it('sets originalOwner on the stolen monster', () => {
    const e = mockEngine();
    const oppMonster = makeFieldCard({ id: 'OPP1', name: 'OppMonster', atk: 1500, def: 1000 });
    e._state.opponent.field.monsters[0] = oppMonster;

    const impl = EFFECT_REGISTRY.get('stealMonster');
    impl({}, ctx(e, 'player'));

    expect(e._state.opponent.field.monsters[0]).toBeNull();
    const stolen = e._state.player.field.monsters[0];
    expect(stolen).not.toBeNull();
    expect(stolen.card.name).toBe('OppMonster');
    expect(stolen.originalOwner).toBe('opponent');
  });

  it('resets hasAttacked on stolen monster', () => {
    const e = mockEngine();
    const oppMonster = makeFieldCard({ id: 'OPP1', name: 'OppMonster', atk: 1500, def: 1000 });
    oppMonster.hasAttacked = true;
    e._state.opponent.field.monsters[0] = oppMonster;

    const impl = EFFECT_REGISTRY.get('stealMonster');
    impl({}, ctx(e, 'player'));

    const stolen = e._state.player.field.monsters[0];
    expect(stolen.hasAttacked).toBe(false);
  });

  it('calls _removeEquipmentForMonster on the original zone', () => {
    const e = mockEngine();
    const oppMonster = makeFieldCard({ id: 'OPP1', name: 'OppMonster', atk: 1500, def: 1000 });
    e._state.opponent.field.monsters[2] = oppMonster;

    const impl = EFFECT_REGISTRY.get('stealMonster');
    impl({}, ctx(e, 'player'));

    expect(e._removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 2);
  });
});

describe('Bug fix: destroyAllOppSpellTraps cleans up equipment', () => {
  it('sends all opp spell/traps to graveyard and calls _removeEquipmentForMonster', () => {
    const e = mockEngine();
    const trap1 = { card: { id: 'T1', name: 'Trap1' } };
    const trap2 = { card: { id: 'T2', name: 'Trap2' } };
    e._state.opponent.field.spellTraps[0] = trap1;
    e._state.opponent.field.spellTraps[2] = trap2;

    const impl = EFFECT_REGISTRY.get('destroyAllOppSpellTraps');
    impl({}, ctx(e, 'player'));

    expect(e._state.opponent.field.spellTraps[0]).toBeNull();
    expect(e._state.opponent.field.spellTraps[2]).toBeNull();
    expect(e._state.opponent.graveyard).toHaveLength(2);
    expect(e._removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 0);
    expect(e._removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 2);
  });

  it('does nothing on empty spell/trap zones', () => {
    const e = mockEngine();

    const impl = EFFECT_REGISTRY.get('destroyAllOppSpellTraps');
    impl({}, ctx(e, 'player'));

    expect(e._removeEquipmentForMonster).not.toHaveBeenCalled();
    expect(e._state.opponent.graveyard).toHaveLength(0);
  });
});

describe('Bug fix: destroyAllSpellTraps cleans up equipment on both sides', () => {
  it('destroys all spell/traps on both sides and calls _removeEquipmentForMonster for each', () => {
    const e = mockEngine();
    const playerTrap = { card: { id: 'PT1', name: 'PlayerTrap' } };
    const oppTrap = { card: { id: 'OT1', name: 'OppTrap' } };
    e._state.player.field.spellTraps[1] = playerTrap;
    e._state.opponent.field.spellTraps[3] = oppTrap;

    const impl = EFFECT_REGISTRY.get('destroyAllSpellTraps');
    impl({}, ctx(e, 'player'));

    expect(e._state.player.field.spellTraps[1]).toBeNull();
    expect(e._state.opponent.field.spellTraps[3]).toBeNull();
    expect(e._state.player.graveyard).toHaveLength(1);
    expect(e._state.opponent.graveyard).toHaveLength(1);
    expect(e._removeEquipmentForMonster).toHaveBeenCalledWith('player', 1);
    expect(e._removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 3);
  });
});
