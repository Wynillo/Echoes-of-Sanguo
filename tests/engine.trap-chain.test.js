// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { GameEngine, FieldCard, FieldSpellTrap } from '../src/engine.ts';
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

function placeTrap(engine, owner, trapDef, zone = 0) {
  const fst = new FieldSpellTrap(trapDef);
  fst.faceDown = true;
  engine.state[owner].field.spellTraps[zone] = fst;
  return fst;
}

const CARD = {
  atk1500: { id: 'TC_ATK1500', name: 'Attacker', type: CardType.Monster, atk: 1500, def: 600 },
  atk1000: { id: 'TC_ATK1000', name: 'Defender', type: CardType.Monster, atk: 1000, def: 800 },
  atk500:  { id: 'TC_ATK500',  name: 'Weakling', type: CardType.Monster, atk: 500,  def: 400 },
};

const TRAP = {
  destroyAttacker: {
    id: 'TC_TRAP_DESTROY', name: 'DestroyTrap', type: CardType.Trap,
    description: 'Destroy attacker', trapTrigger: 'onAttack',
    effect: { trigger: 'onAttack', actions: [{ type: 'destroyAttacker' }] },
  },
  destroyAllOpp: {
    id: 'TC_TRAP_DESTROYALL', name: 'DestroyAllTrap', type: CardType.Trap,
    description: 'Destroy all opponent monsters', trapTrigger: 'onAttack',
    effect: { trigger: 'onAttack', actions: [{ type: 'destroyAllOpp' }] },
  },
  cancelAttack: {
    id: 'TC_TRAP_CANCEL', name: 'CancelTrap', type: CardType.Trap,
    description: 'Cancel attack', trapTrigger: 'onAttack',
    effect: { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }] },
  },
  counterNegate: {
    id: 'TC_COUNTER_NEGATE', name: 'CounterNegate', type: CardType.Trap,
    description: 'Negate trap', trapTrigger: 'onOpponentTrap',
    effect: { trigger: 'onOpponentTrap', actions: [{ type: 'cancelEffect' }] },
  },
};

describe('Trap chain resolution', () => {
  describe('Post-trap monster validation', () => {
    it('destroyAttacker signal stops the attack (regression)', async () => {
      const { engine } = makeEngine({ prompt: vi.fn().mockResolvedValue(true) });
      const oppFC = placeMonster(engine, 'opponent', CARD.atk1500, 0);
      placeMonster(engine, 'player', CARD.atk1000, 0);
      placeTrap(engine, 'player', TRAP.destroyAttacker, 0);
      const playerLP = engine.state.player.lp;

      engine.state.phase = 'battle';
      await engine.attack('opponent', 0, 0);

      expect(engine.state.opponent.field.monsters[0]).toBeNull();
      expect(engine.state.player.lp).toBe(playerLP);
    });

    it('generic destroy effect (destroyAllOpp) stops the attack via field validation', async () => {
      const { engine } = makeEngine({ prompt: vi.fn().mockResolvedValue(true) });
      placeMonster(engine, 'opponent', CARD.atk1500, 0);
      placeMonster(engine, 'player', CARD.atk1000, 0);
      placeTrap(engine, 'player', TRAP.destroyAllOpp, 0);
      const playerLP = engine.state.player.lp;

      engine.state.phase = 'battle';
      await engine.attack('opponent', 0, 0);

      expect(engine.state.opponent.field.monsters[0]).toBeNull();
      expect(engine.state.player.lp).toBe(playerLP);
    });

    it('post-trap validation on direct attack', async () => {
      const { engine } = makeEngine({ prompt: vi.fn().mockResolvedValue(true) });
      placeMonster(engine, 'opponent', CARD.atk1500, 0);
      for (let i = 0; i < 5; i++) engine.state.player.field.monsters[i] = null;
      placeTrap(engine, 'player', TRAP.destroyAllOpp, 0);
      const playerLP = engine.state.player.lp;

      engine.state.phase = 'battle';
      await engine.attackDirect('opponent', 0);

      expect(engine.state.opponent.field.monsters[0]).toBeNull();
      expect(engine.state.player.lp).toBe(playerLP);
    });
  });

  describe('Counter-trap response window', () => {
    it('counter-trap negates player trap, attack proceeds normally', async () => {
      const promptCalls = [];
      const promptMock = vi.fn().mockImplementation(() => {
        promptCalls.push('called');
        return Promise.resolve(true);
      });
      const { engine } = makeEngine({ prompt: promptMock });

      placeMonster(engine, 'opponent', CARD.atk1500, 0);
      placeMonster(engine, 'player', CARD.atk1000, 0);
      placeTrap(engine, 'player', TRAP.destroyAttacker, 0);
      placeTrap(engine, 'opponent', TRAP.counterNegate, 0);

      engine.state.phase = 'battle';
      await engine.attack('opponent', 0, 0);

      // Counter-trap negated the destroy trap, so attack proceeds
      // Player monster (ATK 1000) vs Opponent monster (ATK 1500) → player loses 500 LP
      expect(engine.state.opponent.field.monsters[0]).not.toBeNull();
      expect(engine.state.player.lp).toBeLessThan(8000);
    });

    it('no counter-trap available, original trap works normally', async () => {
      const { engine } = makeEngine({ prompt: vi.fn().mockResolvedValue(true) });
      placeMonster(engine, 'opponent', CARD.atk1500, 0);
      placeMonster(engine, 'player', CARD.atk1000, 0);
      placeTrap(engine, 'player', TRAP.destroyAttacker, 0);
      // No counter-trap on opponent side
      const playerLP = engine.state.player.lp;

      engine.state.phase = 'battle';
      await engine.attack('opponent', 0, 0);

      expect(engine.state.opponent.field.monsters[0]).toBeNull();
      expect(engine.state.player.lp).toBe(playerLP);
    });

    it('counter-trap negates opponent trap when player attacks', async () => {
      const { engine } = makeEngine({ prompt: vi.fn().mockResolvedValue(true) });
      placeMonster(engine, 'player', CARD.atk1500, 0);
      placeMonster(engine, 'opponent', CARD.atk1000, 0);
      placeTrap(engine, 'opponent', TRAP.destroyAttacker, 0);
      placeTrap(engine, 'player', TRAP.counterNegate, 1);
      const oppLP = engine.state.opponent.lp;

      engine.state.phase = 'battle';
      await engine.attack('player', 0, 0);

      // Counter-trap negated opponent's destroy trap, attack proceeds
      expect(engine.state.player.field.monsters[0]).not.toBeNull();
      expect(engine.state.opponent.lp).toBeLessThan(oppLP);
    });
  });

  describe('Chain depth limit', () => {
    it('chain stops at MAX_CHAIN_DEPTH without stack overflow', async () => {
      const { engine } = makeEngine({ prompt: vi.fn().mockResolvedValue(true) });
      placeMonster(engine, 'opponent', CARD.atk1500, 0);
      placeMonster(engine, 'player', CARD.atk1000, 0);
      placeTrap(engine, 'player', TRAP.cancelAttack, 0);

      // Fill both sides with counter-traps to test depth limit
      for (let i = 0; i < 5; i++) {
        placeTrap(engine, 'opponent', { ...TRAP.counterNegate, id: `TC_OPP_COUNTER_${i}` }, i);
      }
      for (let i = 1; i < 5; i++) {
        placeTrap(engine, 'player', { ...TRAP.counterNegate, id: `TC_PLR_COUNTER_${i}` }, i);
      }

      engine.state.phase = 'battle';
      // Should not throw (no infinite recursion)
      await engine.attack('opponent', 0, 0);
    });

    it('multi-level chain resolves correctly (3 levels)', async () => {
      // Scenario:
      // 1. Opponent attacks → player activates destroyAttacker trap
      // 2. Opponent counter-trap negates player's trap → cancelEffect
      // 3. Player counter-trap negates opponent's counter-trap → cancelEffect
      // Result: opponent's counter is negated, so player's original trap works → attacker destroyed
      let promptCallCount = 0;
      const promptMock = vi.fn().mockImplementation(() => {
        promptCallCount++;
        return Promise.resolve(true);
      });
      const { engine } = makeEngine({ prompt: promptMock });

      placeMonster(engine, 'opponent', CARD.atk1500, 0);
      placeMonster(engine, 'player', CARD.atk1000, 0);

      // Player trap zone 0: destroyAttacker (triggered by onAttack)
      placeTrap(engine, 'player', TRAP.destroyAttacker, 0);
      // Opponent trap zone 0: counter-trap (triggered by onOpponentTrap)
      placeTrap(engine, 'opponent', TRAP.counterNegate, 0);
      // Player trap zone 1: counter-counter-trap (triggered by onOpponentTrap)
      placeTrap(engine, 'player', { ...TRAP.counterNegate, id: 'TC_PLR_COUNTER2' }, 1);

      const playerLP = engine.state.player.lp;
      engine.state.phase = 'battle';
      await engine.attack('opponent', 0, 0);

      // Chain resolution (LIFO):
      // Level 3: Player's counter-counter-trap negates opponent's counter-trap
      // Level 2: Opponent's counter-trap was negated → no cancelEffect
      // Level 1: Player's destroyAttacker trap resolves normally → attacker destroyed
      expect(engine.state.opponent.field.monsters[0]).toBeNull();
      expect(engine.state.player.lp).toBe(playerLP);
    });
  });
});
