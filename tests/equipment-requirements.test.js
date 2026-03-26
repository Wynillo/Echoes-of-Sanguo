import { describe, it, expect, vi } from 'vitest';
import { GameEngine, FieldCard } from '../js/engine.ts';
import { CardType, Race, Attribute, meetsEquipRequirement } from '../js/types.ts';
import { CARD_DB, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from '../js/cards.js';
import { pickEquipTarget, pickDebuffTarget } from '../js/ai-behaviors.ts';

// ── Helpers ────────────────────────────────────────────────

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

function placeMonster(engine, owner, cardDef, zone = 0) {
  const fc = new FieldCard(cardDef, 'atk');
  engine.state[owner].field.monsters[zone] = fc;
  return fc;
}

// ── Card stubs ──────────────────────────────────────────────

const DRAGON_FIRE = {
  id: 'EQ_TST1', name: 'Fire Dragon', type: CardType.Monster,
  atk: 1500, def: 1000, race: Race.Dragon, attribute: Attribute.Fire,
  description: 'Test dragon',
};

const WARRIOR_EARTH = {
  id: 'EQ_TST2', name: 'Earth Warrior', type: CardType.Monster,
  atk: 1200, def: 900, race: Race.Warrior, attribute: Attribute.Earth,
  description: 'Test warrior',
};

const EQUIP_NO_REQ = {
  id: 'EQ_TST10', name: 'Basic Sword', type: CardType.Equipment,
  atkBonus: 500, description: 'No requirement',
};

const EQUIP_RACE_DRAGON = {
  id: 'EQ_TST11', name: 'Dragon Blade', type: CardType.Equipment,
  atkBonus: 700, defBonus: 300, description: 'Dragon only',
  equipRequirement: { race: Race.Dragon },
};

const EQUIP_ATTR_FIRE = {
  id: 'EQ_TST12', name: 'Flame Armor', type: CardType.Equipment,
  atkBonus: 600, description: 'Fire only',
  equipRequirement: { attr: Attribute.Fire },
};

const EQUIP_BOTH = {
  id: 'EQ_TST13', name: 'Dragon Flame Gauntlet', type: CardType.Equipment,
  atkBonus: 900, description: 'Fire Dragon only',
  equipRequirement: { race: Race.Dragon, attr: Attribute.Fire },
};

// ── meetsEquipRequirement ───────────────────────────────────

describe('meetsEquipRequirement', () => {
  it('returns true when no requirement', () => {
    expect(meetsEquipRequirement(EQUIP_NO_REQ, DRAGON_FIRE)).toBe(true);
    expect(meetsEquipRequirement(EQUIP_NO_REQ, WARRIOR_EARTH)).toBe(true);
  });

  it('returns true when race matches', () => {
    expect(meetsEquipRequirement(EQUIP_RACE_DRAGON, DRAGON_FIRE)).toBe(true);
  });

  it('returns false when race does not match', () => {
    expect(meetsEquipRequirement(EQUIP_RACE_DRAGON, WARRIOR_EARTH)).toBe(false);
  });

  it('returns true when attribute matches', () => {
    expect(meetsEquipRequirement(EQUIP_ATTR_FIRE, DRAGON_FIRE)).toBe(true);
  });

  it('returns false when attribute does not match', () => {
    expect(meetsEquipRequirement(EQUIP_ATTR_FIRE, WARRIOR_EARTH)).toBe(false);
  });

  it('returns true when both race and attribute match', () => {
    expect(meetsEquipRequirement(EQUIP_BOTH, DRAGON_FIRE)).toBe(true);
  });

  it('returns false when only race matches (both required)', () => {
    const dragonWater = { ...DRAGON_FIRE, attribute: Attribute.Water };
    expect(meetsEquipRequirement(EQUIP_BOTH, dragonWater)).toBe(false);
  });

  it('returns false when only attribute matches (both required)', () => {
    const warriorFire = { ...WARRIOR_EARTH, attribute: Attribute.Fire };
    expect(meetsEquipRequirement(EQUIP_BOTH, warriorFire)).toBe(false);
  });
});

// ── Engine equipCard enforcement ────────────────────────────

describe('equipCard with requirements', () => {
  it('equips when requirement is met', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', DRAGON_FIRE, 0);
    engine.state.player.hand = [EQUIP_RACE_DRAGON];
    const result = await engine.equipCard('player', 0, 'player', 0);
    expect(result).toBe(true);
  });

  it('rejects equip when race does not match', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', WARRIOR_EARTH, 0);
    engine.state.player.hand = [EQUIP_RACE_DRAGON];
    const result = await engine.equipCard('player', 0, 'player', 0);
    expect(result).toBe(false);
  });

  it('rejects equip when attribute does not match', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', WARRIOR_EARTH, 0);
    engine.state.player.hand = [EQUIP_ATTR_FIRE];
    const result = await engine.equipCard('player', 0, 'player', 0);
    expect(result).toBe(false);
  });

  it('equips without requirement to any monster', async () => {
    const { engine } = makeEngine();
    placeMonster(engine, 'player', WARRIOR_EARTH, 0);
    engine.state.player.hand = [EQUIP_NO_REQ];
    const result = await engine.equipCard('player', 0, 'player', 0);
    expect(result).toBe(true);
  });
});

// ── AI pick functions ───────────────────────────────────────

describe('pickEquipTarget with requirements', () => {
  it('skips monsters that do not meet requirement', () => {
    const warriors = [new FieldCard(WARRIOR_EARTH, 'atk'), null, null, null, null];
    const opp = [null, null, null, null, null];
    const zone = pickEquipTarget(warriors, opp, 700, 300, EQUIP_RACE_DRAGON);
    expect(zone).toBe(-1);
  });

  it('picks valid monster when requirement is met', () => {
    const monsters = [new FieldCard(WARRIOR_EARTH, 'atk'), null, new FieldCard(DRAGON_FIRE, 'atk'), null, null];
    const opp = [null, null, null, null, null];
    const zone = pickEquipTarget(monsters, opp, 700, 300, EQUIP_RACE_DRAGON);
    expect(zone).toBe(2);
  });

  it('works without equipCard parameter (backwards compat)', () => {
    const monsters = [new FieldCard(DRAGON_FIRE, 'atk'), null, null, null, null];
    const opp = [null, null, null, null, null];
    const zone = pickEquipTarget(monsters, opp, 500, 0);
    expect(zone).toBe(0);
  });
});

describe('pickDebuffTarget with requirements', () => {
  it('skips monsters that do not meet requirement', () => {
    const oppMonsters = [new FieldCard(WARRIOR_EARTH, 'atk'), null, null, null, null];
    const zone = pickDebuffTarget(oppMonsters, -500, EQUIP_RACE_DRAGON);
    expect(zone).toBe(-1);
  });

  it('picks valid debuff target when requirement is met', () => {
    const oppMonsters = [new FieldCard(WARRIOR_EARTH, 'atk'), null, new FieldCard(DRAGON_FIRE, 'atk'), null, null];
    const zone = pickDebuffTarget(oppMonsters, -500, EQUIP_RACE_DRAGON);
    expect(zone).toBe(2);
  });
});
