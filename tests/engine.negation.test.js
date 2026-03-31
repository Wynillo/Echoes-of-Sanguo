// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { GameEngine, FieldCard } from '../src/engine.ts';
import { CARD_DB, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../src/cards.js';
import { CardType } from '../src/types.ts';

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

function placeMonster(engine, owner, cardDef, zone = 0, opts = {}) {
  const fc = new FieldCard(cardDef, opts.position ?? 'atk');
  fc.summonedThisTurn = opts.summonedThisTurn ?? false;
  engine.state[owner].field.monsters[zone] = fc;
  return fc;
}

const CARD = {
  monsterWithEffect: {
    id: 'TST_EFF', name: 'EffectMonster', type: CardType.Monster, atk: 1000, def: 800,
    description: 'Deals damage on summon',
    effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
  },
  negateMonsterEffects: {
    id: 'TST_NEGATE_MON', name: 'MonsterNegator', type: CardType.Monster, atk: 800, def: 800,
    description: 'Negates monster effects',
    effect: { trigger: 'passive', actions: [{ type: 'passive_negateMonsterEffects' }] },
  },
  negateSpells: {
    id: 'TST_NEGATE_SPELL', name: 'SpellNegator', type: CardType.Monster, atk: 800, def: 800,
    description: 'Negates spells',
    effect: { trigger: 'passive', actions: [{ type: 'passive_negateSpells' }] },
  },
  burnSpell: {
    id: 'TST_BURN', name: 'BurnSpell', type: CardType.Spell,
    description: 'Deal 500 damage', spellType: 'normal',
    effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
  },
  plainMonster: {
    id: 'TST_PLAIN', name: 'PlainMonster', type: CardType.Monster, atk: 1200, def: 1000,
    description: 'No effect',
  },
};

describe('Bug fix: monster effect negation is side-aware', () => {
  it('opponent negator blocks player monster effects', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'opponent', CARD.negateMonsterEffects, 0);
    engine._recalcFieldFlags();

    const oppLpBefore = engine.state.opponent.lp;
    const fc = new FieldCard(CARD.monsterWithEffect, 'atk');
    await engine._triggerEffect(fc, 'player', 'onSummon', 0);

    expect(engine.state.opponent.lp).toBe(oppLpBefore);
  });

  it('player negator blocks opponent monster effects', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.negateMonsterEffects, 0);
    engine._recalcFieldFlags();

    const playerLpBefore = engine.state.player.lp;
    const fc = new FieldCard(CARD.monsterWithEffect, 'atk');
    await engine._triggerEffect(fc, 'opponent', 'onSummon', 0);

    expect(engine.state.player.lp).toBe(playerLpBefore);
  });

  it('player negator does NOT block player own monster effects', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.negateMonsterEffects, 0);
    engine._recalcFieldFlags();

    const oppLpBefore = engine.state.opponent.lp;
    const fc = new FieldCard(CARD.monsterWithEffect, 'atk');
    await engine._triggerEffect(fc, 'player', 'onSummon', 1);

    expect(engine.state.opponent.lp).toBe(oppLpBefore - 500);
  });

  it('opponent negator does NOT block opponent own monster effects', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'opponent', CARD.negateMonsterEffects, 0);
    engine._recalcFieldFlags();

    const playerLpBefore = engine.state.player.lp;
    const fc = new FieldCard(CARD.monsterWithEffect, 'atk');
    await engine._triggerEffect(fc, 'opponent', 'onSummon', 1);

    expect(engine.state.player.lp).toBe(playerLpBefore - 500);
  });

  it('negation does not block passive trigger effects', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'opponent', CARD.negateMonsterEffects, 0);
    engine._recalcFieldFlags();

    expect(engine.state.opponent.fieldFlags.negateMonsterEffects).toBe(true);
    expect(engine.state.player.fieldFlags.negateMonsterEffects).toBe(false);
  });
});

describe('Bug fix: spell negation is side-aware', () => {
  it('opponent spell negator blocks player spells', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'opponent', CARD.negateSpells, 0);
    engine._recalcFieldFlags();

    const card = { ...CARD.burnSpell };
    engine.state.player.hand.push(card);
    const handIdx = engine.state.player.hand.length - 1;
    const oppLpBefore = engine.state.opponent.lp;

    await engine.activateSpell('player', handIdx);

    expect(engine.state.opponent.lp).toBe(oppLpBefore);
  });

  it('player spell negator does NOT block player own spells', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.negateSpells, 0);
    engine._recalcFieldFlags();

    const card = { ...CARD.burnSpell };
    engine.state.player.hand.push(card);
    const handIdx = engine.state.player.hand.length - 1;
    const oppLpBefore = engine.state.opponent.lp;

    await engine.activateSpell('player', handIdx);

    expect(engine.state.opponent.lp).toBe(oppLpBefore - 500);
  });
});
