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
  field_spell_earth: {
    id: 'TST_FS_EARTH', name: 'Mountain Fortress', type: CardType.Spell,
    description: 'All Earth monsters gain +200 ATK/DEF', spellType: 'field',
    effect: { trigger: 'passive', actions: [{ type: 'buffField', value: 200, filter: { race: 5 } }] },
  },
  field_spell_dragon: {
    id: 'TST_FS_DRAGON', name: 'Dragon Domain', type: CardType.Spell,
    description: 'All Dragon monsters gain +300 ATK/DEF', spellType: 'field',
    effect: { trigger: 'passive', actions: [{ type: 'buffField', value: 300, filter: { race: 1 } }] },
  },
  earth_monster: {
    id: 'TST_EARTH', name: 'EarthWarrior', type: CardType.Monster, atk: 1000, def: 800,
    description: 'An earth monster', race: 5, attribute: 5,
  },
  dragon_monster: {
    id: 'TST_DRAGON', name: 'DragonBeast', type: CardType.Monster, atk: 1500, def: 1000,
    description: 'A dragon monster', race: 1, attribute: 3,
  },
};

// ── setMonster ───────────────────────────────────────────────

describe('setMonster', () => {
  it('places monster in face-down DEF position', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });
    await engine.setMonster('player', 0, 0);

    const fc = engine.state.player.field.monsters[0];
    expect(fc).not.toBeNull();
    expect(fc.position).toBe('def');
    expect(fc.faceDown).toBe(true);
  });

  it('removes card from hand', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });
    const handBefore = engine.state.player.hand.length;
    await engine.setMonster('player', 0, 0);
    expect(engine.state.player.hand.length).toBe(handBefore - 1);
  });

  it('sets normalSummonUsed', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.monster });
    expect(engine.state.player.normalSummonUsed).toBe(false);
    await engine.setMonster('player', 0, 0);
    expect(engine.state.player.normalSummonUsed).toBe(true);
  });

  it('triggers onSummon effect even when set face-down', async () => {
    const { engine } = makeEngine();
    const effectCard = {
      id: 'TST_FD_EFF', name: 'FDEffect', type: CardType.Monster, atk: 800, def: 600,
      description: 'Burns on summon',
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
    };
    engine.state.player.hand.unshift(effectCard);
    const oppLP = engine.state.opponent.lp;
    await engine.setMonster('player', 0, 0);
    expect(engine.state.opponent.lp).toBe(oppLP - 500);
  });

  it('rejects an occupied zone', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', CARD.monster, 0);
    engine.state.player.hand.unshift({ ...CARD.monsterB });
    const result = await engine.setMonster('player', 0, 0);
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
  it('revives a monster from graveyard to the field', async () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    const result = await engine.specialSummonFromGrave('player', card);

    expect(result).toBe(true);
    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc).not.toBeNull();
  });

  it('removes the card from graveyard', async () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    await engine.specialSummonFromGrave('player', card);

    const graveIds = engine.state.player.graveyard.map(c => c.id);
    expect(graveIds).not.toContain('TST_MON');
  });

  it('revived monster has no summoning sickness', async () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    await engine.specialSummonFromGrave('player', card);

    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc.summonedThisTurn).toBe(false);
  });

  it('revived monster is placed in ATK position', async () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);

    await engine.specialSummonFromGrave('player', card);

    const fc = engine.state.player.field.monsters.find(m => m !== null && m.card.id === 'TST_MON');
    expect(fc.position).toBe('atk');
  });

  it('returns false if card is not in graveyard', async () => {
    const { engine } = makeEngine();

    const result = await engine.specialSummonFromGrave('player', CARD.monster);

    expect(result).toBe(false);
  });

  it('returns false when no free monster zone', async () => {
    const { engine } = makeEngine();
    const card = { ...CARD.monster };
    engine.state.player.graveyard.push(card);
    for (let z = 0; z < 5; z++) placeMonster(engine, 'player', CARD.monsterB, z);

    const result = await engine.specialSummonFromGrave('player', card);

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

// ── activateFieldSpell ──────────────────────────────────────

describe('activateFieldSpell', () => {
  it('places field spell in the fieldSpell slot', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.field_spell_earth });

    const result = await engine.activateFieldSpell('player', 0);

    expect(result).toBe(true);
    expect(engine.state.player.field.fieldSpell).not.toBeNull();
    expect(engine.state.player.field.fieldSpell.card.id).toBe('TST_FS_EARTH');
    expect(engine.state.player.field.fieldSpell.faceDown).toBe(false);
  });

  it('removes field spell from hand', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.field_spell_earth });
    const handBefore = engine.state.player.hand.length;

    await engine.activateFieldSpell('player', 0);

    expect(engine.state.player.hand.length).toBe(handBefore - 1);
  });

  it('buffs matching monsters on the field', async () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', { ...CARD.earth_monster }, 0);
    engine.state.player.hand.unshift({ ...CARD.field_spell_earth });

    await engine.activateFieldSpell('player', 0);

    expect(fc.fieldSpellATKBonus).toBe(200);
    expect(fc.fieldSpellDEFBonus).toBe(200);
    expect(fc.effectiveATK()).toBe(1200); // 1000 + 200
    expect(fc.effectiveDEF()).toBe(1000); // 800 + 200
  });

  it('does not buff non-matching monsters', async () => {
    const { engine } = makeEngine();
    const fc = placeMonster(engine, 'player', { ...CARD.dragon_monster }, 0);
    engine.state.player.hand.unshift({ ...CARD.field_spell_earth }); // Earth buff

    await engine.activateFieldSpell('player', 0);

    expect(fc.fieldSpellATKBonus).toBe(0);
    expect(fc.fieldSpellDEFBonus).toBe(0);
    expect(fc.effectiveATK()).toBe(1500); // unchanged
  });

  it('replaces old field spell and sends it to graveyard', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.field_spell_dragon });
    await engine.activateFieldSpell('player', 0);

    expect(engine.state.player.field.fieldSpell.card.id).toBe('TST_FS_DRAGON');

    engine.state.player.hand.unshift({ ...CARD.field_spell_earth });
    await engine.activateFieldSpell('player', 0);

    expect(engine.state.player.field.fieldSpell.card.id).toBe('TST_FS_EARTH');
    const graveIds = engine.state.player.graveyard.map(c => c.id);
    expect(graveIds).toContain('TST_FS_DRAGON');
  });

  it('removes old buffs and applies new ones when replacing', async () => {
    const { engine } = makeEngine();
    const earthMon = placeMonster(engine, 'player', { ...CARD.earth_monster }, 0);
    const dragonMon = placeMonster(engine, 'player', { ...CARD.dragon_monster }, 1);

    // Activate dragon field spell
    engine.state.player.hand.unshift({ ...CARD.field_spell_dragon });
    await engine.activateFieldSpell('player', 0);

    expect(dragonMon.fieldSpellATKBonus).toBe(300);
    expect(earthMon.fieldSpellATKBonus).toBe(0);

    // Replace with earth field spell
    engine.state.player.hand.unshift({ ...CARD.field_spell_earth });
    await engine.activateFieldSpell('player', 0);

    // Dragon buff removed, earth buff applied
    expect(dragonMon.fieldSpellATKBonus).toBe(0);
    expect(earthMon.fieldSpellATKBonus).toBe(200);
  });

  it('applies buff to monster summoned after field spell is active', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.field_spell_earth });
    await engine.activateFieldSpell('player', 0);

    // Now summon an earth monster
    engine.state.player.hand.unshift({ ...CARD.earth_monster });
    engine.state.player.normalSummonUsed = false;
    await engine.summonMonster('player', 0, 0, 'atk');

    const fc = engine.state.player.field.monsters[0];
    expect(fc.fieldSpellATKBonus).toBe(200);
    expect(fc.effectiveATK()).toBe(1200);
  });

  it('rejects non-field-spell card', async () => {
    const { engine } = makeEngine();
    engine.state.player.hand.unshift({ ...CARD.spell_burn });

    const result = await engine.activateFieldSpell('player', 0);

    expect(result).toBe(false);
  });
});

