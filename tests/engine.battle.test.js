import { describe, it, expect, vi } from 'vitest';
import { GameEngine } from '../src/engine.ts';
import { PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../src/cards.js';

function makeEngine() {
  const cb = { render: vi.fn(), log: vi.fn(), showResult: vi.fn(), onDuelEnd: vi.fn() };
  const engine = new GameEngine(cb);
  engine.initGame(
    [...PLAYER_DECK_IDS],
    { id:1, name:'Test', title:'', race:'krieger', flavor:'', coinsWin:0, coinsLoss:0, deckIds: [...OPPONENT_DECK_IDS] }
  );
  // Force player goes first for deterministic tests
  engine.state.activePlayer = 'player';
  engine.state.phase = 'main';
  return engine;
}

describe('dealDamage', () => {
  it('reduces target LP by given amount', () => {
    const engine = makeEngine();
    const before = engine.state.player.lp;
    engine.dealDamage('player', 500);
    expect(engine.state.player.lp).toBe(before - 500);
  });

  it('clamps LP at 0, never goes negative', () => {
    const engine = makeEngine();
    engine.dealDamage('player', 99999);
    expect(engine.state.player.lp).toBeGreaterThanOrEqual(0);
  });

  it('damages opponent independently of player', () => {
    const engine = makeEngine();
    const playerBefore = engine.state.player.lp;
    engine.dealDamage('opponent', 300);
    expect(engine.state.player.lp).toBe(playerBefore); // player unchanged
    expect(engine.state.opponent.lp).toBeLessThan(8000);
  });
});

describe('gainLP', () => {
  it('increases target LP', () => {
    const engine = makeEngine();
    engine.state.player.lp = 7000;
    engine.gainLP('player', 500);
    expect(engine.state.player.lp).toBe(7500);
  });
});

describe('drawCard', () => {
  it('moves one card from deck to hand', () => {
    const engine = makeEngine();
    const deckBefore = engine.state.player.deck.length;
    const handBefore = engine.state.player.hand.length;
    engine.drawCard('player', 1);
    expect(engine.state.player.deck.length).toBe(deckBefore - 1);
    expect(engine.state.player.hand.length).toBe(handBefore + 1);
  });

  it('drawing from empty deck does not crash', () => {
    const engine = makeEngine();
    engine.state.player.deck = [];
    expect(() => engine.drawCard('player', 1)).not.toThrow();
  });

  it('hand never exceeds HAND_LIMIT_DRAW (10) after mass draw', () => {
    const engine = makeEngine();
    engine.drawCard('player', 50);
    expect(engine.state.player.hand.length).toBeLessThanOrEqual(10);
  });
});
