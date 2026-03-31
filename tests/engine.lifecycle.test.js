// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine, FieldCard } from '../src/engine.ts';
import { CARD_DB, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../src/cards.js';
import { GAME_RULES, applyRules } from '../src/rules.ts';

function makeCallbacks(overrides = {}) {
  return {
    render: vi.fn(),
    log: vi.fn(),
    showResult: vi.fn(),
    onDuelEnd: vi.fn(),
    prompt: vi.fn().mockResolvedValue(false),
    showActivation: vi.fn(),
    playAttackAnimation: vi.fn().mockResolvedValue(undefined),
    onDraw: vi.fn(),
    ...overrides,
  };
}

function makeEngine(cbOverrides = {}) {
  const cb = makeCallbacks(cbOverrides);
  const engine = new GameEngine(cb);
  engine.initGame(
    [...PLAYER_DECK_IDS],
    { id: 1, name: 'Test', title: '', race: 'krieger', flavor: '',
      coinsWin: 0, coinsLoss: 0, deckIds: [...OPPONENT_DECK_IDS] }
  );
  engine.state.activePlayer = 'player';
  engine.state.phase = 'main';
  return { engine, cb };
}

function monster(atk, def = 0, extras = {}) {
  return { id: 'TST' + atk, name: `Mon${atk}`, type: 1, atk, def, ...extras };
}

function placeMonster(engine, owner, cardDef, zone = 0, opts = {}) {
  const fc = new FieldCard(cardDef, opts.position ?? 'atk');
  fc.summonedThisTurn = opts.summonedThisTurn ?? false;
  if (opts.hasAttacked) fc.hasAttacked = true;
  if (opts.tempATKBonus) fc.tempATKBonus = opts.tempATKBonus;
  if (opts.tempDEFBonus) fc.tempDEFBonus = opts.tempDEFBonus;
  if (opts.originalOwner) fc.originalOwner = opts.originalOwner;
  engine.state[owner].field.monsters[zone] = fc;
  return fc;
}

describe('dealDamage', () => {
  it('reduces target LP', () => {
    const { engine } = makeEngine();
    engine.state.player.lp = 8000;
    engine.dealDamage('player', 1500);
    expect(engine.state.player.lp).toBe(6500);
  });

  it('clamps LP at 0', () => {
    const { engine } = makeEngine();
    engine.state.player.lp = 1000;
    engine.dealDamage('player', 5000);
    expect(engine.state.player.lp).toBe(0);
  });

  it('triggers checkWin on lethal damage', () => {
    const { engine, cb } = makeEngine();
    engine.state.opponent.lp = 500;
    engine.dealDamage('opponent', 500);
    expect(engine.state.opponent.lp).toBe(0);
    expect(cb.onDuelEnd).toHaveBeenCalled();
  });
});

describe('gainLP', () => {
  it('increases target LP', () => {
    const { engine } = makeEngine();
    engine.state.player.lp = 5000;
    engine.gainLP('player', 2000);
    expect(engine.state.player.lp).toBe(7000);
  });

  it('caps LP at maxLP', () => {
    const { engine } = makeEngine();
    engine.state.player.lp = 99000;
    engine.gainLP('player', 5000);
    expect(engine.state.player.lp).toBe(GAME_RULES.maxLP);
  });
});

describe('checkWin', () => {
  it('returns false when no win condition met', () => {
    const { engine } = makeEngine();
    engine.state.player.lp = 8000;
    engine.state.opponent.lp = 8000;
    expect(engine.checkWin()).toBe(false);
  });

  it('detects defeat when player LP is 0', () => {
    const { engine, cb } = makeEngine();
    engine.state.player.lp = 0;
    expect(engine.checkWin()).toBe(true);
    expect(cb.onDuelEnd).toHaveBeenCalled();
  });

  it('detects victory when opponent LP is 0', () => {
    const { engine, cb } = makeEngine();
    engine.state.opponent.lp = 0;
    expect(engine.checkWin()).toBe(true);
    expect(cb.onDuelEnd).toHaveBeenCalled();
  });

  it('detects defeat on player deck out only in draw phase', () => {
    const { engine } = makeEngine();
    engine.state.player.deck = [];
    engine.state.phase = 'main';
    expect(engine.checkWin()).toBe(false);

    engine.state.phase = 'draw';
    expect(engine.checkWin()).toBe(true);
  });

  it('detects victory on opponent deck out in any phase', () => {
    const { engine } = makeEngine();
    engine.state.opponent.deck = [];
    engine.state.phase = 'main';
    expect(engine.checkWin()).toBe(true);
  });

  it('returns true if duel already ended', () => {
    const { engine, cb } = makeEngine();
    engine.state.opponent.lp = 0;
    engine.checkWin();
    cb.onDuelEnd.mockClear();
    expect(engine.checkWin()).toBe(true);
    // Should not call onDuelEnd again
    expect(cb.onDuelEnd).not.toHaveBeenCalled();
  });
});

describe('changePosition', () => {
  it('toggles from atk to def', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', monster(1500, 1200), 0);
    engine.changePosition('player', 0);
    expect(engine.state.player.field.monsters[0].position).toBe('def');
  });

  it('toggles from def to atk', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', monster(1500, 1200), 0, { position: 'def' });
    engine.changePosition('player', 0);
    expect(engine.state.player.field.monsters[0].position).toBe('atk');
  });

  it('blocks position change when summonedThisTurn', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', monster(1500, 1200), 0, { summonedThisTurn: true });
    engine.changePosition('player', 0);
    expect(engine.state.player.field.monsters[0].position).toBe('atk');
  });

  it('does nothing on empty zone', () => {
    const { engine } = makeEngine();
    engine.state.player.field.monsters[3] = null;
    expect(() => engine.changePosition('player', 3)).not.toThrow();
  });
});

describe('_resetMonsterFlags', () => {
  it('clears all per-turn flags on monsters', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', monster(1500), 0, {
      summonedThisTurn: true,
      hasAttacked: true,
      tempATKBonus: 500,
      tempDEFBonus: 300,
    });
    engine._resetMonsterFlags('player');
    expect(fc.tempATKBonus).toBe(0);
    expect(fc.tempDEFBonus).toBe(0);
    expect(fc.hasAttacked).toBe(false);
    expect(fc.summonedThisTurn).toBe(false);
  });

  it('clears battleProtection', () => {
    const { engine } = makeEngine();
    engine.state.player.battleProtection = true;
    engine._resetMonsterFlags('player');
    expect(engine.state.player.battleProtection).toBe(false);
  });

  it('handles empty field without error', () => {
    const { engine } = makeEngine();
    engine.state.player.field.monsters = [null, null, null, null, null];
    expect(() => engine._resetMonsterFlags('player')).not.toThrow();
  });
});

describe('_returnTempStolenMonsters', () => {
  it('returns stolen monster to opponent free zone', () => {
    const { engine } = makeEngine();
    const card = monster(2000);
    const fc = placeMonster(engine, 'player', card, 1, { originalOwner: 'opponent' });
    engine.state.opponent.field.monsters = [null, null, null, null, null];

    engine._returnTempStolenMonsters('player');

    expect(engine.state.player.field.monsters[1]).toBeNull();
    expect(engine.state.opponent.field.monsters[0]).toBe(fc);
    expect(fc.hasAttacked).toBe(true);
    expect(fc.originalOwner).toBeUndefined();
  });

  it('sends to graveyard when opponent field is full', () => {
    const { engine } = makeEngine();
    const stolenCard = monster(2000);
    placeMonster(engine, 'player', stolenCard, 0, { originalOwner: 'opponent' });
    // Fill opponent field
    for (let i = 0; i < 5; i++) {
      placeMonster(engine, 'opponent', monster(1000 + i), i);
    }

    engine._returnTempStolenMonsters('player');

    expect(engine.state.player.field.monsters[0]).toBeNull();
    expect(engine.state.opponent.graveyard.length).toBeGreaterThan(0);
  });

  it('does not affect monsters without originalOwner', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', monster(1500), 0);
    engine._returnTempStolenMonsters('player');
    expect(engine.state.player.field.monsters[0]).toBe(fc);
  });

  it('calls _removeEquipmentForMonster', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', monster(2000), 2, { originalOwner: 'opponent' });
    engine.state.opponent.field.monsters = [null, null, null, null, null];
    const spy = vi.spyOn(engine, '_removeEquipmentForMonster');
    engine._returnTempStolenMonsters('player');
    expect(spy).toHaveBeenCalledWith('player', 2);
  });
});

describe('_returnSpiritMonsters', () => {
  it('returns spirit monster to hand', () => {
    const { engine } = makeEngine();
    const spiritCard = monster(1000, 500, { spirit: true });
    placeMonster(engine, 'player', spiritCard, 0);
    const handBefore = engine.state.player.hand.length;

    engine._returnSpiritMonsters('player');

    expect(engine.state.player.field.monsters[0]).toBeNull();
    expect(engine.state.player.hand.length).toBe(handBefore + 1);
  });

  it('does not affect non-spirit monsters', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', monster(1500), 0);
    engine._returnSpiritMonsters('player');
    expect(engine.state.player.field.monsters[0]).toBe(fc);
  });

  it('returns multiple spirit monsters', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', monster(800, 500, { spirit: true }), 0);
    placeMonster(engine, 'player', monster(600, 400, { spirit: true }), 2);
    const handBefore = engine.state.player.hand.length;

    engine._returnSpiritMonsters('player');

    expect(engine.state.player.field.monsters[0]).toBeNull();
    expect(engine.state.player.field.monsters[2]).toBeNull();
    expect(engine.state.player.hand.length).toBe(handBefore + 2);
  });
});

describe('_tickTurnCounters', () => {
  it('decrements turnsRemaining', () => {
    const { engine } = makeEngine();
    engine.state.player.turnCounters = [{ effect: 'preventAttacks', turnsRemaining: 3 }];
    engine._tickTurnCounters('player');
    expect(engine.state.player.turnCounters[0].turnsRemaining).toBe(2);
  });

  it('removes expired counter', () => {
    const { engine } = makeEngine();
    engine.state.player.turnCounters = [{ effect: 'preventAttacks', turnsRemaining: 1 }];
    engine._tickTurnCounters('player');
    expect(engine.state.player.turnCounters.length).toBe(0);
  });

  it('handles multiple counters with different durations', () => {
    const { engine } = makeEngine();
    engine.state.player.turnCounters = [
      { effect: 'effectA', turnsRemaining: 1 },
      { effect: 'effectB', turnsRemaining: 3 },
      { effect: 'effectC', turnsRemaining: 1 },
    ];
    engine._tickTurnCounters('player');
    expect(engine.state.player.turnCounters.length).toBe(1);
    expect(engine.state.player.turnCounters[0].effect).toBe('effectB');
    expect(engine.state.player.turnCounters[0].turnsRemaining).toBe(2);
  });

  it('does nothing when turnCounters is undefined', () => {
    const { engine } = makeEngine();
    engine.state.player.turnCounters = undefined;
    expect(() => engine._tickTurnCounters('player')).not.toThrow();
  });

  it('does nothing when turnCounters is empty', () => {
    const { engine } = makeEngine();
    engine.state.player.turnCounters = [];
    engine._tickTurnCounters('player');
    expect(engine.state.player.turnCounters.length).toBe(0);
  });
});

describe('advancePhase', () => {
  it('advances from main to battle', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'main';
    engine.state.firstTurnNoAttack = false;
    engine.advancePhase();
    expect(engine.state.phase).toBe('battle');
  });

  it('advances from battle to end', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    engine.advancePhase();
    expect(engine.state.phase).toBe('end');
  });

  it('skips battle phase on first turn (FM-style)', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'main';
    engine.state.firstTurnNoAttack = true;
    engine.advancePhase();
    expect(engine.state.phase).toBe('end');
    expect(engine.state.firstTurnNoAttack).toBe(false);
  });
});

describe('endTurn', () => {
  it('transitions to opponent draw phase', () => {
    const { engine } = makeEngine();
    // Prevent AI turn from actually executing
    vi.useFakeTimers();
    engine.endTurn();
    expect(engine.state.activePlayer).toBe('opponent');
    expect(engine.state.phase).toBe('draw');
    vi.useRealTimers();
  });

  it('increments turn counter', () => {
    const { engine } = makeEngine();
    const turnBefore = engine.state.turn;
    vi.useFakeTimers();
    engine.endTurn();
    expect(engine.state.turn).toBe(turnBefore + 1);
    vi.useRealTimers();
  });

  it('resets normalSummonUsed for both players', () => {
    const { engine } = makeEngine();
    engine.state.player.normalSummonUsed = true;
    engine.state.opponent.normalSummonUsed = true;
    vi.useFakeTimers();
    engine.endTurn();
    expect(engine.state.player.normalSummonUsed).toBe(false);
    expect(engine.state.opponent.normalSummonUsed).toBe(false);
    vi.useRealTimers();
  });

  it('enforces hand limit of 8 cards', () => {
    const { engine } = makeEngine();
    engine.state.player.hand = Array.from({ length: 12 }, (_, i) => ({ id: `C${i}`, name: `Card${i}` }));
    vi.useFakeTimers();
    engine.endTurn();
    expect(engine.state.player.hand.length).toBe(GAME_RULES.handLimitEnd);
    vi.useRealTimers();
  });

  it('does not trim hand at or below limit', () => {
    const { engine } = makeEngine();
    engine.state.player.hand = [{ id: 'A' }, { id: 'B' }];
    vi.useFakeTimers();
    engine.endTurn();
    expect(engine.state.player.hand.length).toBe(2);
    vi.useRealTimers();
  });
});

describe('_recalcFieldFlags', () => {
  it('detects passive negate traps on monster', () => {
    const { engine } = makeEngine();
    const card = {
      id: 'NEG1', name: 'Negator', type: 1, atk: 1000, def: 1000,
      effect: { trigger: 'passive', actions: [{ type: 'passive_negateTraps' }] },
    };
    placeMonster(engine, 'player', card, 0);
    engine._recalcFieldFlags();
    expect(engine.state.player.fieldFlags.negateTraps).toBe(true);
    expect(engine.state.player.fieldFlags.negateSpells).toBe(false);
  });

  it('starts with all flags false when no passive effects', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', monster(1500), 0);
    engine._recalcFieldFlags();
    expect(engine.state.player.fieldFlags.negateTraps).toBe(false);
    expect(engine.state.player.fieldFlags.negateSpells).toBe(false);
    expect(engine.state.player.fieldFlags.negateMonsterEffects).toBe(false);
  });

  it('detects multiple negate flags', () => {
    const { engine } = makeEngine();
    const card = {
      id: 'NEG2', name: 'MegaNegator', type: 1, atk: 2000, def: 2000,
      effects: [
        { trigger: 'passive', actions: [{ type: 'passive_negateSpells' }] },
        { trigger: 'passive', actions: [{ type: 'passive_negateMonsterEffects' }] },
      ],
    };
    placeMonster(engine, 'player', card, 0);
    engine._recalcFieldFlags();
    expect(engine.state.player.fieldFlags.negateSpells).toBe(true);
    expect(engine.state.player.fieldFlags.negateMonsterEffects).toBe(true);
  });
});
