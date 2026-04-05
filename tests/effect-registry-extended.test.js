// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { executeEffectBlock, EFFECT_REGISTRY } from '../src/effect-registry.js';

// ── Helpers ──

function makeFC(atk, def = 0, extras = {}) {
  return {
    card: { name: 'Test', atk, def, type: 1 },
    position: 'atk',
    faceDown: false,
    hasAttacked: false,
    hasFlipSummoned: false,
    summonedThisTurn: false,
    equippedCards: [],
    cannotBeTargeted: false,
    permATKBonus: 0,
    tempATKBonus: 0,
    fieldSpellATKBonus: 0,
    permDEFBonus: 0,
    tempDEFBonus: 0,
    fieldSpellDEFBonus: 0,
    effectiveATK() {
      return Math.max(0, this.card.atk + this.permATKBonus + this.tempATKBonus + this.fieldSpellATKBonus);
    },
    effectiveDEF() {
      return Math.max(0, this.card.def + this.permDEFBonus + this.tempDEFBonus + this.fieldSpellDEFBonus);
    },
    ...extras,
  };
}

function makeST(name, type = 4) {
  return { card: { name, type }, faceDown: false, used: false };
}

function mockEngine(overrides = {}) {
  const defaultState = {
    player: {
      lp: 4000,
      deck: [],
      hand: [],
      field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
      graveyard: [],
    },
    opponent: {
      lp: 4000,
      deck: [],
      hand: [],
      field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
      graveyard: [],
    },
  };
  let getStateFn = vi.fn(() => defaultState);
  const specialSummonFromGraveSpy = vi.fn((owner, card, fromOwner) => {
    const state = getStateFn();
    const gy = state[fromOwner ?? owner].graveyard;
    const idx = gy.findIndex(c => c === card || c.name === card.name);
    if (idx !== -1) gy.splice(idx, 1);
    return Promise.resolve(true);
  });
  const engine = {
    dealDamage: vi.fn(),
    gainLP: vi.fn(),
    drawCard: vi.fn(),
    addLog: vi.fn(),
    specialSummonFromGrave: specialSummonFromGraveSpy,
    specialSummon: vi.fn().mockResolvedValue(true),
    _removeEquipmentForMonster: vi.fn(),
    _removeFieldSpell: vi.fn(),
    removeEquipmentForMonster: vi.fn(),
    removeFieldSpell: vi.fn(),
    removeFromHand: (owner, index) => {
      const state = getStateFn();
      const hand = state[owner].hand;
      return hand.splice(index, 1)[0];
    },
    removeFromDeck: (owner, index) => {
      const state = getStateFn();
      const deck = state[owner].deck;
      return deck.splice(index, 1)[0];
    },
    getState: getStateFn,
  };
  if (overrides.getState) {
    getStateFn = overrides.getState;
    engine.getState = getStateFn;
  }
  Object.assign(engine, overrides);
  return engine;
}

function ctx(engine, owner = 'player', extras = {}) {
  return { engine, owner, ...extras };
}

// ── Phase 1: Signals ──

describe('cancelEffect', () => {
  it('returns cancelEffect signal', async () => {
    const e = mockEngine();
    const sig = await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'cancelEffect' }] }, ctx(e));
    expect(sig.cancelEffect).toBe(true);
  });
});

describe('reflectBattleDamage', () => {
  it('returns cancelAttack and reflectDamage signals', async () => {
    const e = mockEngine();
    const sig = await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'reflectBattleDamage' }] }, ctx(e));
    expect(sig.cancelAttack).toBe(true);
    expect(sig.reflectDamage).toBe(true);
  });
});

describe('preventBattleDamage', () => {
  it('sets battleProtection and returns cancelAttack', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    const sig = await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'preventBattleDamage' }] }, ctx(e));
    expect(sig.cancelAttack).toBe(true);
    expect(state.player.battleProtection).toBe(true);
  });
});

// ── Phase 2: Destroy effects ──

describe('destroyWeakestOpp', () => {
  it('destroys lowest ATK opponent monster', async () => {
    const fc1 = makeFC(500, 0, { card: { name: 'Weak', atk: 500, def: 0, type: 1 } });
    const fc2 = makeFC(1200, 0, { card: { name: 'Strong', atk: 1200, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyWeakestOpp' }] }, ctx(e));
    expect(state.opponent.field.monsters[0]).toBeNull();
    expect(state.opponent.field.monsters[1]).toBe(fc2);
    expect(state.opponent.graveyard).toContain(fc1.card);
    expect(e.removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 0);
  });
});

describe('destroyStrongestOpp', () => {
  it('destroys highest ATK opponent monster', async () => {
    const fc1 = makeFC(500, 0, { card: { name: 'Weak', atk: 500, def: 0, type: 1 } });
    const fc2 = makeFC(1200, 0, { card: { name: 'Strong', atk: 1200, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyStrongestOpp' }] }, ctx(e));
    expect(state.opponent.field.monsters[1]).toBeNull();
    expect(state.opponent.field.monsters[0]).toBe(fc1);
    expect(state.opponent.graveyard).toContain(fc2.card);
    expect(e.removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 1);
  });
});

describe('destroyOppFieldSpell', () => {
  it('calls _removeFieldSpell on opponent', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyOppFieldSpell' }] }, ctx(e));
    expect(e.removeFieldSpell).toHaveBeenCalledWith('opponent');
  });
});

describe('destroyByFilter', () => {
  it('mode weakest destroys weakest opponent monster', async () => {
    const fc1 = makeFC(300, 0, { card: { name: 'Tiny', atk: 300, def: 0, type: 1 } });
    const fc2 = makeFC(800, 0, { card: { name: 'Mid', atk: 800, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyByFilter', mode: 'weakest' }] }, ctx(e));
    expect(state.opponent.field.monsters[0]).toBeNull();
    expect(state.opponent.graveyard).toContain(fc1.card);
  });

  it('mode strongest destroys strongest opponent monster', async () => {
    const fc1 = makeFC(300, 0, { card: { name: 'Tiny', atk: 300, def: 0, type: 1 } });
    const fc2 = makeFC(800, 0, { card: { name: 'Mid', atk: 800, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyByFilter', mode: 'strongest' }] }, ctx(e));
    expect(state.opponent.field.monsters[1]).toBeNull();
  });

  it('mode highestDef with filter respects filter', async () => {
    const fc1 = makeFC(100, 2000, { card: { name: 'Wall', atk: 100, def: 2000, type: 1, race: 1 } });
    const fc2 = makeFC(100, 3000, { card: { name: 'BigWall', atk: 100, def: 3000, type: 1, race: 2 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyByFilter', mode: 'highestDef', filter: { race: 1 } }] }, ctx(e));
    expect(state.opponent.field.monsters[0]).toBeNull();
    expect(state.opponent.field.monsters[1]).toBe(fc2);
  });

  it('mode first picks first matching monster', async () => {
    const fc1 = makeFC(100, 0, { card: { name: 'A', atk: 100, def: 0, type: 1 } });
    const fc2 = makeFC(200, 0, { card: { name: 'B', atk: 200, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyByFilter', mode: 'first' }] }, ctx(e));
    expect(state.opponent.field.monsters[0]).toBeNull();
  });

  it('side self destroys own monster', async () => {
    const fc1 = makeFC(1000, 0, { card: { name: 'Own', atk: 1000, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyByFilter', mode: 'strongest', side: 'self' }] }, ctx(e));
    expect(state.player.field.monsters[0]).toBeNull();
    expect(state.player.graveyard).toContain(fc1.card);
  });
});

describe('destroyAndDamageBoth', () => {
  it('destroys strongest and deals ATK damage to both players', async () => {
    const fc = makeFC(1500, 0, { card: { name: 'Target', atk: 1500, def: 0, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyAndDamageBoth', side: 'opponent' }] }, ctx(e));
    expect(state.opponent.field.monsters[0]).toBeNull();
    expect(state.opponent.graveyard).toContain(fc.card);
    expect(e.dealDamage).toHaveBeenCalledWith('player', 1500);
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 1500);
  });

  it('no-op when target field empty', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'destroyAndDamageBoth', side: 'opponent' }] }, ctx(e));
    expect(e.dealDamage).not.toHaveBeenCalled();
  });
});

// ── Phase 3: Position / face-down / ATK manipulation ──

describe('changePositionOpp', () => {
  it('flips strongest opp monster from atk to def', async () => {
    const fc = makeFC(1000, 500, { card: { name: 'Fighter', atk: 1000, def: 500, type: 1 }, position: 'atk' });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'changePositionOpp' }] }, ctx(e));
    expect(fc.position).toBe('def');
  });

  it('flips from def to atk', async () => {
    const fc = makeFC(1000, 500, { card: { name: 'Fighter', atk: 1000, def: 500, type: 1 }, position: 'def' });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'changePositionOpp' }] }, ctx(e));
    expect(fc.position).toBe('atk');
  });
});

describe('setFaceDown', () => {
  it('sets targetFC face-down in def position', async () => {
    const fc = makeFC(1000, 500, { card: { name: 'Target', atk: 1000, def: 500, type: 1 }, position: 'atk', faceDown: false, hasFlipSummoned: true });
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'setFaceDown' }] }, ctx(e, 'player', { targetFC: fc }));
    expect(fc.faceDown).toBe(true);
    expect(fc.position).toBe('def');
    expect(fc.hasFlipSummoned).toBe(false);
  });

  it('no-op without targetFC', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'setFaceDown' }] }, ctx(e));
    expect(e.addLog).not.toHaveBeenCalled();
  });
});

describe('flipAllOppFaceDown', () => {
  it('sets all opp monsters face-down', async () => {
    const fc1 = makeFC(1000, 0, { card: { name: 'A', atk: 1000, def: 0, type: 1 }, position: 'atk', faceDown: false, hasFlipSummoned: true });
    const fc2 = makeFC(500, 0, { card: { name: 'B', atk: 500, def: 0, type: 1 }, position: 'atk', faceDown: false, hasFlipSummoned: true });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc1, fc2, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'flipAllOppFaceDown' }] }, ctx(e));
    expect(fc1.faceDown).toBe(true);
    expect(fc1.position).toBe('def');
    expect(fc1.hasFlipSummoned).toBe(false);
    expect(fc2.faceDown).toBe(true);
  });

  it('skips already face-down monsters', async () => {
    const fc = makeFC(1000, 0, { card: { name: 'A', atk: 1000, def: 0, type: 1 }, position: 'def', faceDown: true, hasFlipSummoned: false });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'flipAllOppFaceDown' }] }, ctx(e));
    expect(fc.faceDown).toBe(true);
    expect(fc.position).toBe('def');
  });
});

describe('halveAtk', () => {
  it('halves effective ATK via tempATKBonus reduction', async () => {
    const fc = makeFC(1000, 0, { card: { name: 'Big', atk: 1000, def: 0, type: 1 } });
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'halveAtk', target: 'attacker' }] }, ctx(e, 'player', { attacker: fc }));
    expect(fc.effectiveATK()).toBe(500);
  });

  it('floors odd ATK values', async () => {
    const fc = makeFC(999, 0, { card: { name: 'Odd', atk: 999, def: 0, type: 1 } });
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'halveAtk', target: 'attacker' }] }, ctx(e, 'player', { attacker: fc }));
    expect(fc.effectiveATK()).toBe(499);
  });

  it('no-op without target', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'halveAtk', target: 'attacker' }] }, ctx(e));
    expect(e.addLog).not.toHaveBeenCalled();
  });
});

describe('doubleAtk', () => {
  it('doubles effective ATK via tempATKBonus', async () => {
    const fc = makeFC(600, 0, { card: { name: 'Mid', atk: 600, def: 0, type: 1 } });
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'doubleAtk', target: 'attacker' }] }, ctx(e, 'player', { attacker: fc }));
    expect(fc.effectiveATK()).toBe(1200);
  });

  it('no-op without target', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'doubleAtk', target: 'attacker' }] }, ctx(e));
    expect(e.addLog).not.toHaveBeenCalled();
  });
});

describe('swapAtkDef', () => {
  it('swaps ATK and DEF for opponent side', async () => {
    const fc = makeFC(1000, 2000, { card: { name: 'Swap', atk: 1000, def: 2000, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'swapAtkDef', side: 'opponent' }] }, ctx(e));
    expect(fc.effectiveATK()).toBe(2000);
    expect(fc.effectiveDEF()).toBe(1000);
  });

  it('swaps for self side', async () => {
    const fc = makeFC(500, 1500, { card: { name: 'Own', atk: 500, def: 1500, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'swapAtkDef', side: 'self' }] }, ctx(e));
    expect(fc.effectiveATK()).toBe(1500);
    expect(fc.effectiveDEF()).toBe(500);
  });

  it('swaps for all sides', async () => {
    const pfc = makeFC(100, 900, { card: { name: 'P', atk: 100, def: 900, type: 1 } });
    const ofc = makeFC(800, 200, { card: { name: 'O', atk: 800, def: 200, type: 1 } });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [pfc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [ofc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'swapAtkDef', side: 'all' }] }, ctx(e));
    expect(pfc.effectiveATK()).toBe(900);
    expect(pfc.effectiveDEF()).toBe(100);
    expect(ofc.effectiveATK()).toBe(200);
    expect(ofc.effectiveDEF()).toBe(800);
  });
});

// ── Phase 4: Steal / control / bounce ──

describe('stealMonster', () => {
  it('moves strongest opp monster to own field', async () => {
    const fc = makeFC(1500, 0, { card: { name: 'Stolen', atk: 1500, def: 0, type: 1 }, hasAttacked: true });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'stealMonster' }] }, ctx(e));
    expect(state.opponent.field.monsters[0]).toBeNull();
    expect(state.player.field.monsters[0]).toBe(fc);
    expect(fc.originalOwner).toBe('opponent');
    expect(fc.hasAttacked).toBe(false);
    expect(e.removeEquipmentForMonster).toHaveBeenCalledWith('opponent', 0);
  });
});

describe('stealMonsterTemp', () => {
  it('temporarily steals strongest opp monster', async () => {
    const fc = makeFC(800, 0, { card: { name: 'Temp', atk: 800, def: 0, type: 1 }, hasAttacked: true });
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [fc, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'stealMonsterTemp' }] }, ctx(e));
    expect(state.player.field.monsters[0]).toBe(fc);
    expect(fc.originalOwner).toBe('opponent');
    expect(fc.hasAttacked).toBe(false);
  });
});

describe('bounceOppHandToDeck', () => {
  it('sends N cards from opp hand to deck', async () => {
    const c1 = { name: 'Card1', type: 1 };
    const c2 = { name: 'Card2', type: 1 };
    const c3 = { name: 'Card3', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [c1, c2, c3], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'bounceOppHandToDeck', count: 2 }] }, ctx(e));
    expect(state.opponent.hand).toHaveLength(1);
    expect(state.opponent.deck).toHaveLength(2);
  });

  it('handles count larger than hand size', async () => {
    const c1 = { name: 'Only', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [c1], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'bounceOppHandToDeck', count: 5 }] }, ctx(e));
    expect(state.opponent.hand).toHaveLength(0);
    expect(state.opponent.deck).toHaveLength(1);
  });
});

// ── Phase 5: Draw / discard ──

describe('drawThenDiscard', () => {
  it('draws then discards random cards', async () => {
    const handCard = { name: 'Drawn', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [handCard], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'drawThenDiscard', drawCount: 2, discardCount: 1 }] }, ctx(e));
    expect(e.drawCard).toHaveBeenCalledWith('player', 2);
    expect(state.player.graveyard).toHaveLength(1);
    expect(state.player.hand).toHaveLength(0);
  });

  it('caps discard to hand size', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'drawThenDiscard', drawCount: 1, discardCount: 5 }] }, ctx(e));
    expect(state.player.graveyard).toHaveLength(0);
  });
});

describe('discardFromHand', () => {
  it('discards count random cards from own hand', async () => {
    const c1 = { name: 'A', type: 1 };
    const c2 = { name: 'B', type: 1 };
    const c3 = { name: 'C', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [c1, c2, c3], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'discardFromHand', count: 2 }] }, ctx(e));
    expect(state.player.hand).toHaveLength(1);
    expect(state.player.graveyard).toHaveLength(2);
  });

  it('no-op on empty hand', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'discardFromHand', count: 3 }] }, ctx(e));
    expect(e.addLog).not.toHaveBeenCalled();
  });
});

describe('discardEntireHand', () => {
  it('discards self hand', async () => {
    const c1 = { name: 'X', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [c1], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [{ name: 'Y', type: 1 }], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'discardEntireHand', target: 'self' }] }, ctx(e));
    expect(state.player.hand).toHaveLength(0);
    expect(state.player.graveyard).toHaveLength(1);
    expect(state.opponent.hand).toHaveLength(1);
  });

  it('discards opponent hand', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [{ name: 'P', type: 1 }], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [{ name: 'O1', type: 1 }, { name: 'O2', type: 1 }], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'discardEntireHand', target: 'opponent' }] }, ctx(e));
    expect(state.opponent.hand).toHaveLength(0);
    expect(state.opponent.graveyard).toHaveLength(2);
    expect(state.player.hand).toHaveLength(1);
  });

  it('discards both hands', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [{ name: 'P', type: 1 }], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [{ name: 'O', type: 1 }], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'discardEntireHand', target: 'both' }] }, ctx(e));
    expect(state.player.hand).toHaveLength(0);
    expect(state.opponent.hand).toHaveLength(0);
    expect(state.player.graveyard).toHaveLength(1);
    expect(state.opponent.graveyard).toHaveLength(1);
  });
});

// ── Phase 6: Deck / graveyard manipulation ──

describe('sendTopCardsToGraveOpp', () => {
  it('mills cards from opponent deck to graveyard', async () => {
    const c1 = { name: 'D1', type: 1 };
    const c2 = { name: 'D2', type: 1 };
    const c3 = { name: 'D3', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [c1, c2, c3], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'sendTopCardsToGraveOpp', count: 2 }] }, ctx(e));
    expect(state.opponent.deck).toHaveLength(1);
    expect(state.opponent.graveyard).toHaveLength(2);
    expect(state.opponent.graveyard[0]).toBe(c1);
  });

  it('respects available deck count', async () => {
    const c1 = { name: 'Only', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [c1], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'sendTopCardsToGraveOpp', count: 5 }] }, ctx(e));
    expect(state.opponent.deck).toHaveLength(0);
    expect(state.opponent.graveyard).toHaveLength(1);
  });
});

describe('salvageFromGrave', () => {
  it('moves first matching card from graveyard to hand', async () => {
    const spell = { name: 'Spell', type: 3 };
    const monster = { name: 'Mon', type: 1, race: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [spell, monster] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'salvageFromGrave', filter: { cardType: 1 } }] }, ctx(e));
    expect(state.player.hand).toContain(monster);
    expect(state.player.graveyard).toHaveLength(1);
    expect(state.player.graveyard[0]).toBe(spell);
  });

  it('no-op when no match in graveyard', async () => {
    const spell = { name: 'Spell', type: 3 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [spell] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'salvageFromGrave', filter: { cardType: 1 } }] }, ctx(e));
    expect(state.player.hand).toHaveLength(0);
    expect(state.player.graveyard).toHaveLength(1);
  });
});

describe('recycleFromGraveToDeck', () => {
  it('moves first matching card from graveyard to deck', async () => {
    const monster = { name: 'Mon', type: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [monster] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'recycleFromGraveToDeck', filter: { cardType: 1 } }] }, ctx(e));
    expect(state.player.deck).toContain(monster);
    expect(state.player.graveyard).toHaveLength(0);
  });

  it('no-op when no match', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'recycleFromGraveToDeck', filter: { cardType: 1 } }] }, ctx(e));
    expect(e.addLog).not.toHaveBeenCalled();
  });
});

describe('shuffleGraveIntoDeck', () => {
  it('empties graveyard into deck', async () => {
    const c1 = { name: 'G1', type: 1 };
    const c2 = { name: 'G2', type: 1 };
    const state = {
      player: { lp: 4000, deck: [{ name: 'D1', type: 1 }], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [c1, c2] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'shuffleGraveIntoDeck' }] }, ctx(e));
    expect(state.player.graveyard).toHaveLength(0);
    expect(state.player.deck).toHaveLength(3);
  });
});

describe('shuffleDeck', () => {
  it('logs deck shuffled without error', async () => {
    const state = {
      player: { lp: 4000, deck: [{ name: 'A', type: 1 }, { name: 'B', type: 1 }], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'shuffleDeck' }] }, ctx(e));
    expect(e.addLog).toHaveBeenCalledWith('Deck shuffled.');
    expect(state.player.deck).toHaveLength(2);
  });
});

describe('peekTopCard', () => {
  it('logs top card name', async () => {
    const state = {
      player: { lp: 4000, deck: [{ name: 'TopCard', type: 1 }], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'peekTopCard' }] }, ctx(e));
    expect(e.addLog).toHaveBeenCalledWith('Top card: TopCard');
  });

  it('logs empty when deck is empty', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'peekTopCard' }] }, ctx(e));
    expect(e.addLog).toHaveBeenCalledWith('Deck is empty!');
  });
});

describe('skipOppDraw', () => {
  it('sets skipNextDraw to opponent', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'skipOppDraw' }] }, ctx(e));
    expect(state.skipNextDraw).toBe('opponent');
  });
});

// ── Phase 7: Summoning ──

describe('specialSummonFromHand', () => {
  it('summons first matching monster from hand', async () => {
    const spell = { name: 'Spell', type: 3 };
    const monster = { name: 'Mon', type: 1, race: 1 };
    const state = {
      player: { lp: 4000, deck: [], hand: [spell, monster], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'specialSummonFromHand' }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledTimes(1);
    expect(e.specialSummon.mock.calls[0][0]).toBe('player');
    expect(e.specialSummon.mock.calls[0][1]).toBe(monster);
    expect(state.player.hand).toHaveLength(1);
    expect(state.player.hand[0]).toBe(spell);
  });

  it('respects filter', async () => {
    const m1 = { name: 'Wrong', type: 1, race: 1 };
    const m2 = { name: 'Right', type: 1, race: 2 };
    const state = {
      player: { lp: 4000, deck: [], hand: [m1, m2], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'specialSummonFromHand', filter: { race: 2 } }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledTimes(1);
    expect(e.specialSummon.mock.calls[0][0]).toBe('player');
    expect(e.specialSummon.mock.calls[0][1]).toBe(m2);
    expect(state.player.hand).toEqual([m1]);
  });
});

describe('specialSummonFromDeck', () => {
  it('summons first matching card from deck', async () => {
    const monster = { name: 'DeckMon', type: 1, race: 1 };
    const state = {
      player: { lp: 4000, deck: [monster], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'specialSummonFromDeck', filter: { cardType: 1 } }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledWith('player', monster, undefined, 'atk', false);
    expect(state.player.deck).toHaveLength(0);
  });

  it('supports faceDown option', async () => {
    const monster = { name: 'Hidden', type: 1 };
    const state = {
      player: { lp: 4000, deck: [monster], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'specialSummonFromDeck', filter: { cardType: 1 }, faceDown: true, position: 'def' }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledWith('player', monster, undefined, 'def', true);
  });

  it('no-op when no match in deck', async () => {
    const e = mockEngine();
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'specialSummonFromDeck', filter: { cardType: 1 } }] }, ctx(e));
    expect(e.specialSummon).not.toHaveBeenCalled();
  });
});

describe('createTokens', () => {
  it('calls specialSummon for each token', async () => {
    const e = mockEngine({ specialSummon: vi.fn().mockReturnValue(true) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'createTokens', tokenId: 'sheep', count: 3, position: 'def' }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledTimes(3);
    for (const call of e.specialSummon.mock.calls) {
      expect(call[0]).toBe('player');
      expect(call[1].type).toBe(1);
      expect(call[3]).toBe('def');
    }
  });

  it('logs placed count', async () => {
    const e = mockEngine({ specialSummon: vi.fn().mockReturnValue(true) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'createTokens', tokenId: 'sheep', count: 2, position: 'def' }] }, ctx(e));
    expect(e.addLog).toHaveBeenCalledWith('2 token(s) summoned!');
  });
});

// ── Phase 8: State flags / negate passives ──

describe('preventAttacks', () => {
  it('pushes turnCounter with preventAttacks effect', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'preventAttacks', turns: 2 }] }, ctx(e));
    expect(state.opponent.turnCounters).toHaveLength(1);
    expect(state.opponent.turnCounters[0]).toEqual({ turnsRemaining: 2, effect: 'preventAttacks' });
  });

  it('initializes turnCounters array if missing', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'preventAttacks', turns: 1 }] }, ctx(e));
    expect(Array.isArray(state.opponent.turnCounters)).toBe(true);
  });
});

describe('passive_negateTraps', () => {
  it('sets fieldFlags.negateTraps to true', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'passive_negateTraps' }] }, ctx(e));
    expect(state.player.fieldFlags.negateTraps).toBe(true);
  });

  it('initializes fieldFlags if missing', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'passive_negateTraps' }] }, ctx(e));
    expect(state.player.fieldFlags).toBeDefined();
    expect(state.player.fieldFlags.negateTraps).toBe(true);
  });
});

describe('passive_negateSpells', () => {
  it('sets fieldFlags.negateSpells to true', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'passive_negateSpells' }] }, ctx(e));
    expect(state.player.fieldFlags.negateSpells).toBe(true);
  });
});

describe('passive_negateMonsterEffects', () => {
  it('sets fieldFlags.negateMonsterEffects to true', async () => {
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'passive_negateMonsterEffects' }] }, ctx(e));
    expect(state.player.fieldFlags.negateMonsterEffects).toBe(true);
  });
});

// ── Phase 9: Complex flows ──

describe('reviveFromEitherGrave', () => {
  it('revives highest ATK monster from own graveyard', async () => {
    const m1 = { name: 'Weak', type: 1, atk: 500 };
    const m2 = { name: 'Strong', type: 1, atk: 1500 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [m1, m2] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'reviveFromEitherGrave' }] }, ctx(e));
    expect(e.specialSummonFromGrave).toHaveBeenCalledWith('player', m2, 'player');
    expect(state.player.graveyard).toEqual([m1]);
  });

  it('prefers opp graveyard if higher ATK', async () => {
    const ownMon = { name: 'Own', type: 1, atk: 800 };
    const oppMon = { name: 'Opp', type: 1, atk: 2000 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [ownMon] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [oppMon] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'reviveFromEitherGrave' }] }, ctx(e));
    expect(e.specialSummonFromGrave).toHaveBeenCalledWith('player', oppMon, 'opponent');
    expect(state.opponent.graveyard).toHaveLength(0);
  });

  it('no-op when both graveyards have no monsters', async () => {
    const spell = { name: 'Spell', type: 3, atk: 0 };
    const state = {
      player: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [spell] },
      opponent: { lp: 4000, deck: [], hand: [], field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null }, graveyard: [] },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'reviveFromEitherGrave' }] }, ctx(e));
    expect(e.specialSummonFromGrave).not.toHaveBeenCalled();
  });
});

describe('gameReset', () => {
  it('collects all cards to deck and draws 5 for both', async () => {
    const handCard = { name: 'H', type: 1 };
    const graveCard = { name: 'G', type: 1 };
    const monFC = makeFC(1000, 0, { card: { name: 'M', atk: 1000, def: 0, type: 1 } });
    const stCard = makeST('ST');
    const state = {
      player: {
        lp: 4000,
        deck: [{ name: 'D', type: 1 }],
        hand: [handCard],
        field: {
          monsters: [monFC, null, null, null, null],
          spellTraps: [stCard, null, null, null, null],
          fieldSpell: null,
        },
        graveyard: [graveCard],
      },
      opponent: {
        lp: 4000,
        deck: [{ name: 'OD', type: 1 }],
        hand: [],
        field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        graveyard: [],
      },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'gameReset' }] }, ctx(e));
    expect(state.player.hand).toHaveLength(0);
    expect(state.player.graveyard).toHaveLength(0);
    expect(state.player.field.monsters.every(m => m === null)).toBe(true);
    expect(state.player.field.spellTraps.every(s => s === null)).toBe(true);
    expect(state.player.deck.length).toBeGreaterThanOrEqual(4);
    expect(e.drawCard).toHaveBeenCalledWith('player', 5);
    expect(e.drawCard).toHaveBeenCalledWith('opponent', 5);
  });
});

describe('excavateAndSummon', () => {
  it('summons monsters at or below maxLevel and adds rest to hand', async () => {
    const lowMon = { name: 'Low', type: 1, level: 3, atk: 500 };
    const highMon = { name: 'High', type: 1, level: 8, atk: 2000 };
    const spell = { name: 'Spell', type: 3 };
    const state = {
      player: {
        lp: 4000,
        deck: [lowMon, highMon, spell],
        hand: [],
        field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        graveyard: [],
      },
      opponent: {
        lp: 4000,
        deck: [{ name: 'OMon', type: 1, level: 2, atk: 100 }],
        hand: [],
        field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        graveyard: [],
      },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'excavateAndSummon', count: 3, maxLevel: 4 }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledWith('player', lowMon, undefined, 'def', true);
    expect(state.player.hand).toContain(highMon);
    expect(state.player.hand).toContain(spell);
    expect(e.specialSummon).toHaveBeenCalledWith('opponent', expect.objectContaining({ name: 'OMon' }), undefined, 'def', true);
  });

  it('handles deck smaller than count', async () => {
    const m1 = { name: 'Only', type: 1, level: 1, atk: 100 };
    const state = {
      player: {
        lp: 4000,
        deck: [m1],
        hand: [],
        field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        graveyard: [],
      },
      opponent: {
        lp: 4000,
        deck: [],
        hand: [],
        field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        graveyard: [],
      },
    };
    const e = mockEngine({ getState: vi.fn(() => state) });
    await executeEffectBlock({ trigger: 'onActivate', actions: [{ type: 'excavateAndSummon', count: 5, maxLevel: 4 }] }, ctx(e));
    expect(e.specialSummon).toHaveBeenCalledWith('player', m1, undefined, 'def', true);
    expect(state.player.deck).toHaveLength(0);
  });
});
