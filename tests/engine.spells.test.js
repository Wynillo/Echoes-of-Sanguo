// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { GameEngine, FieldCard, FieldSpellTrap } from '../js/engine.ts';
import { CARD_DB, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../js/cards.js';
import { CardType } from '../js/types.ts';

// ── Helpers (same pattern as engine.core.test.js) ─────────

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

/** Card stubs for test scenarios. */
const CARD = {
  monster: { id: 'TST_MON', name: 'TestMonster', type: CardType.Monster, atk: 1000, def: 800, description: 'A test monster' },
  monsterB: { id: 'TST_MON2', name: 'TestMonsterB', type: CardType.Monster, atk: 1500, def: 600, description: 'Another test monster' },
  spell_burn: {
    id: 'TST_SPELL_BURN', name: 'TestBurnSpell', type: CardType.Spell,
    description: 'Deal 500 damage', spellType: 'normal',
    effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
  },
  spell_heal: {
    id: 'TST_SPELL_HEAL', name: 'TestHealSpell', type: CardType.Spell,
    description: 'Heal 300 LP', spellType: 'normal',
    effect: { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 300 }] },
  },
  spell_revive: {
    id: 'TST_SPELL_REVIVE', name: 'TestReviveSpell', type: CardType.Spell,
    description: 'Revive from graveyard', spellType: 'fromGrave',
    effect: { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
  },
  trap: {
    id: 'TST_TRAP', name: 'TestTrap', type: CardType.Trap,
    description: 'Cancel attack', trapTrigger: 'onAttack',
    effect: { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }] },
  },
  phoenix_monster: {
    id: 'TST_PHOENIX', name: 'PhoenixBird', type: CardType.Monster, atk: 1200, def: 800,
    description: 'Revives once after battle destruction',
    effect: { trigger: 'passive', actions: [{ type: 'passive_phoenixRevival' }] },
  },
};

// ── setMonster ───────────────────────────────────────────────

describe('setMonster', () => {
  it('places monster in face-down DEF position', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });
    engine.setMonster('player', 0, 0);

    const fc = engine.state.player.field.monsters[0];
    expect(fc).not.toBeNull();
    expect(fc.position).toBe('def');
    expect(fc.faceDown).toBe(true);
  });

  it('removes card from hand', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });
    const handBefore = engine.state.player.hand.length;
    engine.setMonster('player', 0, 0);
    expect(engine.state.player.hand.length).toBe(handBefore - 1);
  });

  it('sets normalSummonUsed', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });
    expect(engine.state.player.normalSummonUsed).toBe(false);
    engine.setMonster('player', 0, 0);
    expect(engine.state.player.normalSummonUsed).toBe(true);
  });

  it('does NOT trigger onSummon effect when set face-down', () => {
    const { engine } = makeEngine();
    const effectCard = {
      id: 'TST_FD_EFF', name: 'FDEffect', type: CardType.Monster, atk: 800, def: 600,
      description: 'Burns on summon',
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
    };
    engine.state.player.hand.unshift(effectCard);
    const oppLP = engine.state.opponent.lp;
    engine.setMonster('player', 0, 0);
    expect(engine.state.opponent.lp).toBe(oppLP);
  });

  it('rejects an occupied zone', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.monster, 0);
    engine.state.player.hand.unshift({ ...CARD.monsterB });
    const result = engine.setMonster('player', 0, 0);
    expect(result).toBe(false);
  });
});

// ── setSpellTrap ─────────────────────────────────────────────

describe('setSpellTrap', () => {
  it('places a spell card in the spellTrap zone face-down', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    engine.setSpellTrap('player', 0, 0);

    const fst = engine.state.player.field.spellTraps[0];
    expect(fst).not.toBeNull();
    expect(fst.card.id).toBe('TST_SPELL_BURN');
    expect(fst.faceDown).toBe(true);
  });

  it('places a trap card in the spellTrap zone face-down', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.trap });
    engine.setSpellTrap('player', 0, 0);

    const fst = engine.state.player.field.spellTraps[0];
    expect(fst).not.toBeNull();
    expect(fst.card.id).toBe('TST_TRAP');
    expect(fst.faceDown).toBe(true);
  });

  it('removes card from hand', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    const handBefore = engine.state.player.hand.length;
    engine.setSpellTrap('player', 0, 0);
    expect(engine.state.player.hand.length).toBe(handBefore - 1);
  });

  it('rejects placement when zone is occupied', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    engine.setSpellTrap('player', 0, 0);

    engine.state.player.hand.unshift({ ...CARD.trap });
    const result = engine.setSpellTrap('player', 0, 0);
    expect(result).toBe(false);
  });

  it('rejects invalid zone index (negative)', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    const result = engine.setSpellTrap('player', 0, -1);
    expect(result).toBe(false);
  });

  it('rejects invalid zone index (out of range)', () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    const result = engine.setSpellTrap('player', 0, 5);
    expect(result).toBe(false);
  });

  it('can fill all 5 spell/trap zones', () => {
    const { engine } = makeEngine();
    for (let z = 0; z < 5; z++) {
      engine.state.player.hand.unshift({ ...CARD.spell_burn, id: `TST_SP${z}` });
      const result = engine.setSpellTrap('player', 0, z);
      expect(result).toBe(true);
    }
    // All zones occupied
    expect(engine.state.player.field.spellTraps.every(fst => fst !== null)).toBe(true);
  });
});

// ── activateSpell ────────────────────────────────────────────

describe('activateSpell', () => {
  it('activates a burn spell from hand and deals damage', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    const oppLP = engine.state.opponent.lp;

    await engine.activateSpell('player', 0);

    expect(engine.state.opponent.lp).toBe(oppLP - 500);
  });

  it('sends activated spell to graveyard', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });

    await engine.activateSpell('player', 0);

    const graveIds = engine.state.player.graveyard.map(c => c.id);
    expect(graveIds).toContain('TST_SPELL_BURN');
  });

  it('removes spell from hand after activation', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });
    const handBefore = engine.state.player.hand.length;

    await engine.activateSpell('player', 0);

    expect(engine.state.player.hand.length).toBe(handBefore - 1);
  });

  it('activates a heal spell and restores LP', async () => {
    const { engine } = makeEngine();
    engine.state.player.lp = 7000;
    engine.state.player.hand.unshift({ ...CARD.spell_heal });

    await engine.activateSpell('player', 0);

    expect(engine.state.player.lp).toBe(7300);
  });

  it('rejects non-spell card', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });

    const result = await engine.activateSpell('player', 0);

    expect(result).toBe(false);
  });

  it('calls showActivation callback', async () => {
    const { engine, cb } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });

    await engine.activateSpell('player', 0);

    expect(cb.showActivation).toHaveBeenCalled();
  });
});

// ── specialSummonFromGrave ───────────────────────────────────

describe('specialSummonFromGrave', () => {
  it('revives a monster from graveyard to the field', () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    const result = engine.specialSummonFromGrave('player', card);

    expect(result).toBe(true);
    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc).not.toBeNull();
  });

  it('removes the card from graveyard', () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    engine.specialSummonFromGrave('player', card);

    const graveIds = engine.state.player.graveyard.map(c => c.id);
    expect(graveIds).not.toContain('TST_MON');
  });

  it('revived monster has no summoning sickness', () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    engine.specialSummonFromGrave('player', card);

    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc.summonedThisTurn).toBe(false);
  });

  it('revived monster is placed in ATK position', () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    engine.specialSummonFromGrave('player', card);

    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc.position).toBe('atk');
  });

  it('returns false if card is not in graveyard', () => {
    const { engine } = makeEngine();

    const result = engine.specialSummonFromGrave('player', CARD.monster);

    expect(result).toBe(false);
  });

  it('returns false when no free monster zone', () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);
    for (let z = 0; z < 5; z++) placeMonster(engine, 'player', CARD.monsterB, z);

    const result = engine.specialSummonFromGrave('player', card);

    expect(result).toBe(false);
  });

  it('works via reviveFromGrave spell effect', async () => {
    const { engine } = makeEngine();
    const graveCard = { ...CARD.monster };
    engine.state.player.graveyard.push(graveCard);
    engine.state.player.hand.unshift({ ...CARD.spell_revive });

    await engine.activateSpell('player', 0, graveCard);

    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc).not.toBeNull();
    expect(engine.state.player.graveyard.find(c => c.id === 'TST_MON')).toBeUndefined();
  });
});

// ── _destroyMonster with phoenixRevival ──────────────────────

describe('_destroyMonster with phoenixRevival', () => {
  it('revives the monster after battle destruction by opponent', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', CARD.phoenix_monster, 0);
    // FieldCard constructor should set phoenixRevival from passive effect
    expect(fc.phoenixRevival).toBe(true);

    engine._destroyMonster('player', 0, 'battle', 'opponent');

    // Monster should be revived in a free zone
    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).not.toBeNull();
  });

  it('revived monster has ATK reduced by 500', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.phoenix_monster, 0);

    engine._destroyMonster('player', 0, 'battle', 'opponent');

    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).not.toBeNull();
    expect(revived.card.atk).toBe(CARD.phoenix_monster.atk - 500); // 1200 - 500 = 700
  });

  it('revived monster has phoenixRevivalUsed set to true (no second revival)', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.phoenix_monster, 0);

    engine._destroyMonster('player', 0, 'battle', 'opponent');

    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).not.toBeNull();
    expect(revived.phoenixRevivalUsed).toBe(true);
  });

  it('does NOT revive if already used phoenix revival once', () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', CARD.phoenix_monster, 0);
    fc.phoenixRevivalUsed = true;

    engine._destroyMonster('player', 0, 'battle', 'opponent');

    // Original zone should be null and no revival
    expect(engine.state.player.field.monsters[0]).toBeNull();
    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).toBeUndefined();
  });

  it('does NOT revive when destroyed by own effect (byOwner === owner)', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.phoenix_monster, 0);

    engine._destroyMonster('player', 0, 'battle', 'player');

    expect(engine.state.player.field.monsters[0]).toBeNull();
    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).toBeUndefined();
  });

  it('does NOT revive when destroyed by non-battle reason', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.phoenix_monster, 0);

    engine._destroyMonster('player', 0, 'effect', 'opponent');

    expect(engine.state.player.field.monsters[0]).toBeNull();
    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).toBeUndefined();
  });

  it('sends card to graveyard when revived (original copy)', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.phoenix_monster, 0);

    engine._destroyMonster('player', 0, 'battle', 'opponent');

    // The original card should be in graveyard (phoenix summons a modified copy)
    const graveIds = engine.state.player.graveyard.map(c => c.id);
    expect(graveIds).toContain('TST_PHOENIX');
  });

  it('revived monster has no summoning sickness', () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.phoenix_monster, 0);

    engine._destroyMonster('player', 0, 'battle', 'opponent');

    const revived = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_PHOENIX');
    expect(revived).not.toBeNull();
    expect(revived.summonedThisTurn).toBe(false);
  });
});
