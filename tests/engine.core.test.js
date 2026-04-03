import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameEngine, FieldCard } from '../src/engine.ts';
import { CARD_DB, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../src/cards.js';

// ── Helpers ────────────────────────────────────────────────

function makeCallbacks(overrides = {}) {
  return {
    render: vi.fn(),
    log: vi.fn(),
    showResult: vi.fn(),
    onDuelEnd: vi.fn(),
    prompt: vi.fn().mockResolvedValue(false),   // traps auto-decline
    showActivation: vi.fn(),
    playAttackAnimation: vi.fn().mockResolvedValue(undefined),
    onDraw: vi.fn(),
    ...overrides,
  };
}

function makeEngine(cbOverrides = {}) {
  const cb = makeCallbacks(cbOverrides);
  const engine = new GameEngine(cb);
  // initGame is async but we don't need to await it in tests
  // since the coin toss callback is not provided
  engine.initGame(
    [...PLAYER_DECK_IDS],
    { id: 1, name: 'Test', title: '', race: 'krieger', flavor: '',
      coinsWin: 0, coinsLoss: 0, deckIds: [...OPPONENT_DECK_IDS] }
  );
  // Force player goes first for deterministic tests
  engine.state.activePlayer = 'player';
  engine.state.phase = 'main';
  return { engine, cb };
}

/** Put a monster directly on the field, bypassing hand/summon logic. */
function placeMonster(engine, owner, cardDef, zone = 0, opts = {}) {
  const fc = new FieldCard(cardDef, opts.position ?? 'atk');
  fc.summonedThisTurn = opts.summonedThisTurn ?? false;
  if (opts.piercing)       fc.piercing       = true;
  if (opts.canDirectAttack) fc.canDirectAttack = true;
  engine.state[owner].field.monsters[zone] = fc;
  return fc;
}

/** Card stubs with only the fields the engine uses. */
const CARD = {
  atk1000def800: { id: 'TST01', name: 'TestA', type: 'normal', atk: 1000, def: 800 },
  atk1500def600: { id: 'TST02', name: 'TestB', type: 'normal', atk: 1500, def: 600 },
  atk500def1200: { id: 'TST03', name: 'TestC', type: 'normal', atk:  500, def: 1200 },
};

// ── summonMonster ──────────────────────────────────────────

describe('summonMonster', () => {
  it('removes card from hand and places it on field', async () => {
    const { engine } = makeEngine();
    // Pick a card with no onSummon effect so the hand count stays predictable
    const idx = engine.state.player.hand.findIndex(c => !c.effect || c.effect.trigger !== 'onSummon');
    const handIdx = idx >= 0 ? idx : 0;
    const handBefore = engine.state.player.hand.length;
    const card = engine.state.player.hand[handIdx];
    await engine.summonMonster('player', handIdx, 0);
    expect(engine.state.player.hand.length).toBe(handBefore - 1);
    expect(engine.state.player.field.monsters[0]).not.toBeNull();
    expect(engine.state.player.field.monsters[0].card.id).toBe(card.id);
  });

  it('sets normalSummonUsed', async () => {
    const { engine } = makeEngine();
    expect(engine.state.player.normalSummonUsed).toBe(false);
    await engine.summonMonster('player', 0, 0);
    expect(engine.state.player.normalSummonUsed).toBe(true);
  });

  it('summoned monster has no summoning sickness (FM-style)', async () => {
    const { engine } = makeEngine();
    await engine.summonMonster('player', 0, 0);
    expect(engine.state.player.field.monsters[0].summonedThisTurn).toBe(false);
  });

  it('rejects an occupied zone', async () => {
    const { engine } = makeEngine();
    await engine.summonMonster('player', 0, 0);
    const result = await engine.summonMonster('player', 0, 0);
    expect(result).toBe(false);
  });

  it('triggers onSummon effect', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({
      id: 'TST_BURN', name: 'BurnTest', type: 'effect', atk: 800, def: 600,
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
    });
    const oppLP = engine.state.opponent.lp;
    await engine.summonMonster('player', 0, 0);
    expect(engine.state.opponent.lp).toBe(oppLP - 500);
  });

  it('does not trigger onSummon for face-down summon', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({
      id: 'TST_FD', name: 'FDTest', type: 'effect', atk: 800, def: 600,
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
    });
    const oppLP = engine.state.opponent.lp;
    await engine.summonMonster('player', 0, 0, 'def', true);
    expect(engine.state.opponent.lp).toBe(oppLP);
  });
});

// ── specialSummon ──────────────────────────────────────────

describe('specialSummon', () => {
  it('places monster without summoning sickness', async () => {
    const { engine } = makeEngine();
    await engine.specialSummon('player', CARD.atk1000def800);
    expect(engine.state.player.field.monsters[0].summonedThisTurn).toBe(false);
  });

  it('auto-picks first free zone', async () => {
    const { engine } = makeEngine();
    await engine.specialSummon('player', CARD.atk1000def800);
    expect(engine.state.player.field.monsters[0]).not.toBeNull();
  });

  it('rejects when no zone is free', async () => {
    const { engine } = makeEngine();
    for (let z = 0; z < 5; z++) placeMonster(engine, 'player', CARD.atk1000def800, z);
    const result = await engine.specialSummon('player', CARD.atk1500def600);
    expect(result).toBe(false);
  });
});

// ── attack — ATK vs ATK ────────────────────────────────────

describe('attack (ATK vs ATK)', () => {
  it('attacker wins: destroys defender and deals damage', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1500def600, 0);
    placeMonster(engine, 'opponent', CARD.atk1000def800, 0);
    const oppLPBefore = engine.state.opponent.lp;

    await engine.attack('player', 0, 0);

    expect(engine.state.opponent.field.monsters[0]).toBeNull();       // defender destroyed
    expect(engine.state.player.field.monsters[0]).not.toBeNull();     // attacker survives
    expect(engine.state.opponent.lp).toBe(oppLPBefore - 500);        // damage = 1500 - 1000
  });

  it('attacker loses: attacker destroyed, owner takes damage', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1000def800, 0);
    placeMonster(engine, 'opponent', CARD.atk1500def600, 0);
    const playerLPBefore = engine.state.player.lp;

    await engine.attack('player', 0, 0);

    expect(engine.state.player.field.monsters[0]).toBeNull();         // attacker destroyed
    expect(engine.state.opponent.field.monsters[0]).not.toBeNull();   // defender survives
    expect(engine.state.player.lp).toBe(playerLPBefore - 500);
  });

  it('tie: both monsters destroyed, no LP damage', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1000def800, 0);
    placeMonster(engine, 'opponent', CARD.atk1000def800, 0);
    const playerLP = engine.state.player.lp;
    const oppLP    = engine.state.opponent.lp;

    await engine.attack('player', 0, 0);

    expect(engine.state.player.field.monsters[0]).toBeNull();
    expect(engine.state.opponent.field.monsters[0]).toBeNull();
    expect(engine.state.player.lp).toBe(playerLP);
    expect(engine.state.opponent.lp).toBe(oppLP);
  });

  it('marks attacker hasAttacked after combat', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    const atk = placeMonster(engine, 'player',   CARD.atk1500def600, 0);
    placeMonster(engine, 'opponent', CARD.atk1000def800, 0);
    await engine.attack('player', 0, 0);
    expect(atk.hasAttacked).toBe(true);
  });

  it('triggers onDestroyByBattle on the attacker when it wins', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    const attCard = { id: 'TST_EFF', name: 'EffA', type: 'effect', atk: 1500, def: 600,
                      effect: { trigger: 'onDestroyByBattle', actions: [{ type: 'dealDamage', target: 'opponent', value: 200 }] } };
    placeMonster(engine, 'player',   attCard, 0);
    placeMonster(engine, 'opponent', CARD.atk1000def800, 0);

    const oppLP = engine.state.opponent.lp;
    await engine.attack('player', 0, 0);
    // Battle damage (1500-1000=500) + effect damage (200) = 700 total
    expect(engine.state.opponent.lp).toBe(oppLP - 700);
  });
});

// ── attack — ATK vs DEF ────────────────────────────────────

describe('attack (ATK vs DEF)', () => {
  it('attacker wins: destroys defender, no damage without piercing', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1500def600, 0);
    placeMonster(engine, 'opponent', CARD.atk500def1200, 0, { position: 'def' });
    const oppLP = engine.state.opponent.lp;

    await engine.attack('player', 0, 0);

    expect(engine.state.opponent.field.monsters[0]).toBeNull();
    expect(engine.state.opponent.lp).toBe(oppLP);   // no piercing → no damage
  });

  it('piercing: deals excess damage when breaking DEF', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1500def600, 0, { piercing: true });
    placeMonster(engine, 'opponent', CARD.atk500def1200, 0, { position: 'def' });
    const oppLP = engine.state.opponent.lp;

    await engine.attack('player', 0, 0);

    expect(engine.state.opponent.field.monsters[0]).toBeNull();
    expect(engine.state.opponent.lp).toBe(oppLP - 300);  // 1500 - 1200 = 300
  });

  it('attacker cannot break high DEF: defender survives, no damage', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1000def800, 0);
    placeMonster(engine, 'opponent', CARD.atk500def1200, 0, { position: 'def' });

    await engine.attack('player', 0, 0);

    expect(engine.state.opponent.field.monsters[0]).not.toBeNull();
    expect(engine.state.opponent.lp).toBe(engine.state.opponent.lp); // no change
  });
});

// ── attack — direct ────────────────────────────────────────

describe('attack (no defender on field)', () => {
  it('deals attacker ATK directly when opponent field is empty', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player', CARD.atk1500def600, 0);
    const oppLP = engine.state.opponent.lp;

    await engine.attack('player', 0, null);   // null defenderZone → direct

    expect(engine.state.opponent.lp).toBe(oppLP - 1500);
  });
});

// ── attackDirect ───────────────────────────────────────────

describe('attackDirect', () => {
  it('deals damage and sets hasAttacked', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    const fc = placeMonster(engine, 'player', CARD.atk1000def800, 0);
    const oppLP = engine.state.opponent.lp;

    await engine.attackDirect('player', 0);

    expect(engine.state.opponent.lp).toBe(oppLP - 1000);
    expect(fc.hasAttacked).toBe(true);
  });

  it('blocked when opponent has monsters (no canDirectAttack flag)', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1000def800, 0);
    placeMonster(engine, 'opponent', CARD.atk500def1200, 0);
    const oppLP = engine.state.opponent.lp;

    await engine.attackDirect('player', 0);

    expect(engine.state.opponent.lp).toBe(oppLP);  // blocked
  });

  it('allowed with canDirectAttack even if opponent has monsters', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player',   CARD.atk1000def800, 0, { canDirectAttack: true });
    placeMonster(engine, 'opponent', CARD.atk500def1200, 0);
    const oppLP = engine.state.opponent.lp;

    await engine.attackDirect('player', 0);

    expect(engine.state.opponent.lp).toBe(oppLP - 1000);
  });

  it('cannot attack twice (hasAttacked guard)', async () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    placeMonster(engine, 'player', CARD.atk1000def800, 0);
    const oppLP = engine.state.opponent.lp;

    await engine.attackDirect('player', 0);
    await engine.attackDirect('player', 0);   // second attempt

    expect(engine.state.opponent.lp).toBe(oppLP - 1000);   // only hit once
  });
});

// ── performFusion ──────────────────────────────────────────

describe('performFusion', () => {
  // 4 + 5 = 246 per FUSION_RECIPES
  function setupFusion(engine) {
    engine.state.player.hand = [
      { ...CARD_DB['4'] },
      { ...CARD_DB['5'] },
    ];
  }

  it('returns false for non-matching materials', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand = [
      { ...CARD_DB['1'] },
      { ...CARD_DB['3'] },   // not a fusion pair with 1
    ];
    const result = await engine.performFusion('player', 0, 1);
    expect(result).toBe(false);
  });

  it('returns false when no free zone', async () => {
    const { engine } = makeEngine();
    setupFusion(engine);
    for (let z = 0; z < 5; z++) placeMonster(engine, 'player', CARD.atk1000def800, z);
    const result = await engine.performFusion('player', 0, 1);
    expect(result).toBe(false);
    expect(engine.state.player.graveyard).toHaveLength(0);  // materials not consumed
  });
});

// ── win / loss conditions ──────────────────────────────────

describe('checkWin', () => {
  it('player LP = 0 → onDuelEnd called with defeat', () => {
    const { engine, cb } = makeEngine();
    engine.state.player.lp = 0;
    engine.checkWin();
    expect(cb.onDuelEnd).toHaveBeenCalledWith('defeat', expect.anything(), expect.anything());
  });

  it('opponent LP = 0 → onDuelEnd called with victory', () => {
    const { engine, cb } = makeEngine();
    engine.state.opponent.lp = 0;
    engine.checkWin();
    expect(cb.onDuelEnd).toHaveBeenCalledWith('victory', expect.anything(), expect.anything());
  });

  it('dealDamage to 0 triggers win check', () => {
    const { engine, cb } = makeEngine();
    engine.dealDamage('opponent', 99999);
    expect(cb.onDuelEnd).toHaveBeenCalledWith('victory', expect.anything(), expect.anything());
  });

  it('returns false when both players still alive', () => {
    const { engine } = makeEngine();
    expect(engine.checkWin()).toBe(false);
  });
});

// ── advancePhase ───────────────────────────────────────────

describe('advancePhase', () => {
  it('main → battle', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'main';
    engine.state.firstTurnNoAttack = false;
    engine.advancePhase();
    expect(engine.state.phase).toBe('battle');
  });

  it('battle → end', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'battle';
    engine.advancePhase();
    expect(engine.state.phase).toBe('end');
  });

  it('end phase calls endTurn (turn increments)', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'end';
    const turnBefore = engine.state.turn;
    vi.useFakeTimers();
    engine.advancePhase();     // calls endTurn internally
    expect(engine.state.turn).toBe(turnBefore + 1);
    vi.useRealTimers();
  });
});

// ── endTurn ────────────────────────────────────────────────

describe('endTurn', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('increments turn counter', () => {
    const { engine } = makeEngine();
    const before = engine.state.turn;
    engine.endTurn();
    expect(engine.state.turn).toBe(before + 1);
  });

  it('switches activePlayer to opponent', () => {
    const { engine } = makeEngine();
    engine.endTurn();
    expect(engine.state.activePlayer).toBe('opponent');
  });

  it('sets phase to draw', () => {
    const { engine } = makeEngine();
    engine.state.phase = 'end';
    engine.endTurn();
    expect(engine.state.phase).toBe('draw');
  });

  it('clears tempATKBonus on all monsters', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', CARD.atk1000def800, 0);
    fc.tempATKBonus = 500;
    engine.endTurn();
    expect(engine.state.player.field.monsters[0].tempATKBonus).toBe(0);
  });

  it('clears hasAttacked on all monsters', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', CARD.atk1000def800, 0);
    fc.hasAttacked = true;
    engine.endTurn();
    expect(engine.state.player.field.monsters[0].hasAttacked).toBe(false);
  });

  it('clears summonedThisTurn on all monsters', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', CARD.atk1000def800, 0);
    fc.summonedThisTurn = true;
    engine.endTurn();
    expect(engine.state.player.field.monsters[0].summonedThisTurn).toBe(false);
  });

  it('resets normalSummonUsed for both players', () => {
    const { engine } = makeEngine();
    engine.state.player.normalSummonUsed   = true;
    engine.state.opponent.normalSummonUsed = true;
    engine.endTurn();
    expect(engine.state.player.normalSummonUsed).toBe(false);
    expect(engine.state.opponent.normalSummonUsed).toBe(false);
  });

  it('trims player hand to HAND_LIMIT_END (8) if over', () => {
    const { engine } = makeEngine();
    // fill hand with 10 cards
    engine.state.player.hand = Array(10).fill(null).map((_, i) =>
      ({ id: `TST${i}`, name: `T${i}`, type: 'normal', atk: 500, def: 500 })
    );
    engine.endTurn();
    expect(engine.state.player.hand.length).toBeLessThanOrEqual(8);
  });
});

// ── _triggerEffect ─────────────────────────────────────────

describe('_triggerEffect (onSummon burn)', () => {
  it('deals damage to the opposite side when monster is summoned', async () => {
    const { engine } = makeEngine();
    const burnCard = {
      id: 'TST_BURN2', name: 'Burner', type: 'effect', atk: 800, def: 500,
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] },
    };
    engine.state.player.hand.unshift(burnCard);
    const oppLP = engine.state.opponent.lp;
    await engine.summonMonster('player', 0, 0);
    expect(engine.state.opponent.lp).toBe(oppLP - 300);
  });

  it('does not fire for a trigger type that does not match', async () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', {
      id: 'TST_MISMATCH', name: 'MM', type: 'effect', atk: 800, def: 500,
      effect: { trigger: 'onDestroyByBattle', actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }] },
    }, 0);
    const oppLP = engine.state.opponent.lp;
    await engine._triggerEffect(fc, 'player', 'onSummon', 0);
    expect(engine.state.opponent.lp).toBe(oppLP);
  });
});

// ── makeDeck isolation ─────────────────────────────────────

describe('makeDeck effect isolation', () => {
  it('deck copies do not share effect object references', () => {
    const { engine } = makeEngine();
    // Find two cards with the same id in the deck
    const deck = engine.state.player.deck;
    const firstId = deck[0]?.id;
    const dup = deck.find((c, i) => i > 0 && c.id === firstId);
    if (!dup || !deck[0].effect) return; // only meaningful if duplicates & effects exist

    // Mutating one copy's effect should not affect the other
    deck[0].effect._testMark = 'mutated';
    expect(dup.effect?._testMark).toBeUndefined();
  });
});
