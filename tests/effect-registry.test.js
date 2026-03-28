// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeEffectBlock, extractPassiveFlags, EFFECT_REGISTRY, matchesFilter } from '../js/effect-registry.js';

// ── Helpers ─────────────────────────────────────────────────

function mockEngine(overrides = {}) {
  return {
    dealDamage: vi.fn(),
    gainLP: vi.fn(),
    drawCard: vi.fn(),
    addLog: vi.fn(),
    specialSummonFromGrave: vi.fn(),
    specialSummon: vi.fn(),
    _removeEquipmentForMonster: vi.fn(),
    getState: vi.fn(() => ({
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
    })),
    ...overrides,
  };
}

function ctx(engine, owner = 'player', extras = {}) {
  return { engine, owner, ...extras };
}

// ── Tests ───────────────────────────────────────────────────

describe('Effect Registry', () => {
  it('has implementations for all descriptor types', () => {
    const expectedTypes = [
      'dealDamage', 'gainLP', 'draw',
      'buffField', 'tempBuffField', 'debuffField', 'tempDebuffField',
      'bounceStrongestOpp', 'bounceAttacker', 'bounceAllOppMonsters',
      'searchDeckToHand',
      'tempAtkBonus', 'permAtkBonus', 'tempDefBonus', 'permDefBonus',
      'reviveFromGrave',
      'cancelAttack', 'destroyAttacker', 'destroySummonedIf',
      'destroyAllOpp', 'destroyAll', 'destroyWeakestOpp', 'destroyStrongestOpp',
      'sendTopCardsToGrave', 'sendTopCardsToGraveOpp',
      'salvageFromGrave', 'recycleFromGraveToDeck',
      'shuffleGraveIntoDeck', 'shuffleDeck', 'peekTopCard',
      'specialSummonFromHand',
      'discardFromHand', 'discardOppHand',
      'passive_piercing', 'passive_untargetable', 'passive_directAttack',
      'passive_vsAttrBonus', 'passive_phoenixRevival',
      'passive_indestructible', 'passive_effectImmune', 'passive_cantBeAttacked',
    ];
    for (const t of expectedTypes) {
      expect(EFFECT_REGISTRY.has(t), `missing: ${t}`).toBe(true);
    }
  });
});

describe('matchesFilter', () => {
  it('matches by race', () => {
    expect(matchesFilter({ race: 1, attribute: 2, type: 1, level: 4, atk: 1200, def: 800 }, { race: 1 })).toBe(true);
    expect(matchesFilter({ race: 2, attribute: 2, type: 1, level: 4, atk: 1200, def: 800 }, { race: 1 })).toBe(false);
  });

  it('matches by attribute', () => {
    expect(matchesFilter({ race: 1, attribute: 2, type: 1 }, { attr: 2 })).toBe(true);
    expect(matchesFilter({ race: 1, attribute: 3, type: 1 }, { attr: 2 })).toBe(false);
  });

  it('matches by maxAtk', () => {
    expect(matchesFilter({ atk: 1200 }, { maxAtk: 1500 })).toBe(true);
    expect(matchesFilter({ atk: 2000 }, { maxAtk: 1500 })).toBe(false);
  });

  it('matches by multiple filters', () => {
    expect(matchesFilter({ race: 1, attribute: 2, atk: 1000 }, { race: 1, attr: 2, maxAtk: 1500 })).toBe(true);
    expect(matchesFilter({ race: 1, attribute: 3, atk: 1000 }, { race: 1, attr: 2, maxAtk: 1500 })).toBe(false);
  });

  it('empty filter matches everything', () => {
    expect(matchesFilter({ race: 1, attribute: 2 }, {})).toBe(true);
  });
});

describe('dealDamage', () => {
  it('deals flat damage to opponent', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 500);
  });

  it('deals damage to self', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'self', value: 300 }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('player', 300);
  });

  it('resolves attacker.effectiveATK value expression', () => {
    const e = mockEngine();
    const attacker = { effectiveATK: () => 1800, card: { atk: 1800 } };
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } }] },
      ctx(e, 'player', { attacker }),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 900);
  });

  it('resolves summoned.atk value expression', () => {
    const e = mockEngine();
    const summonedFC = { card: { atk: 1500 } };
    executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 0.5, round: 'floor' } }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 750);
  });
});

describe('gainLP', () => {
  it('heals flat LP', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 1000 }] },
      ctx(e),
    );
    expect(e.gainLP).toHaveBeenCalledWith('player', 1000);
  });

  it('heals LP from attacker ATK expression', () => {
    const e = mockEngine();
    const attacker = { effectiveATK: () => 2000, card: { atk: 2000 } };
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'gainLP', target: 'self', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } }] },
      ctx(e, 'player', { attacker }),
    );
    expect(e.gainLP).toHaveBeenCalledWith('player', 1000);
  });
});

describe('draw', () => {
  it('draws cards for self', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'draw', target: 'self', count: 2 }] },
      ctx(e),
    );
    expect(e.drawCard).toHaveBeenCalledWith('player', 2);
  });
});

describe('buffField', () => {
  it('buffs all own monsters matching race filter', () => {
    const fm1 = { card: { race: 4 }, permATKBonus: 0 };
    const fm2 = { card: { race: 1 }, permATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm1, fm2, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffField', value: 200, filter: { race: 4 } }] },
      ctx(e),
    );
    expect(fm1.permATKBonus).toBe(200);
    expect(fm2.permATKBonus).toBe(0);
  });

  it('buffs all own monsters matching attribute filter', () => {
    const fm1 = { card: { attribute: 5 }, permATKBonus: 0 };
    const fm2 = { card: { attribute: 4 }, permATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm1, fm2, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffField', value: 300, filter: { attr: 5 } }] },
      ctx(e),
    );
    expect(fm1.permATKBonus).toBe(300);
    expect(fm2.permATKBonus).toBe(0);
  });

  it('buffs all own monsters when no filter', () => {
    const fm1 = { card: { race: 1 }, permATKBonus: 0 };
    const fm2 = { card: { race: 2 }, permATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm1, fm2, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffField', value: 100 }] },
      ctx(e),
    );
    expect(fm1.permATKBonus).toBe(100);
    expect(fm2.permATKBonus).toBe(100);
  });
});

describe('debuffField', () => {
  it('debuffs all opponent monsters', () => {
    const fm = { card: {}, permATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffField', atkD: 300, defD: 200 }] },
      ctx(e),
    );
    expect(fm.permATKBonus).toBe(-300);
    expect(fm.permDEFBonus).toBe(-200);
  });
});

describe('bounceStrongestOpp', () => {
  it('bounces the strongest opponent monster to hand', () => {
    const fm1 = { card: { name: 'Weak' }, effectiveATK: () => 500 };
    const fm2 = { card: { name: 'Strong' }, effectiveATK: () => 2000 };
    const oppHand = [];
    const monsters = [fm1, fm2, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e),
    );
    expect(monsters[1]).toBeNull();
    expect(oppHand).toContain(fm2.card);
  });
});

describe('bounceAttacker', () => {
  it('returns the attacking monster to its owner hand', () => {
    const attacker = { card: { name: 'Atk' } };
    const oppHand = [];
    const monsters = [attacker, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'bounceAttacker' }] },
      ctx(e, 'player', { attacker }),
    );
    expect(monsters[0]).toBeNull();
    expect(oppHand).toContain(attacker.card);
  });
});

describe('bounceAllOppMonsters', () => {
  it('returns all opponent monsters to hand', () => {
    const fm1 = { card: { name: 'A' } };
    const fm2 = { card: { name: 'B' } };
    const oppHand = [];
    const monsters = [fm1, null, fm2, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'bounceAllOppMonsters' }] },
      ctx(e, 'player'),
    );
    expect(monsters.every(m => m === null)).toBe(true);
    expect(oppHand).toHaveLength(2);
  });
});

describe('searchDeckToHand', () => {
  it('searches deck for a card with matching filter', () => {
    const waterCard = { name: 'Wasserkarte', attribute: 4 };
    const fireCard = { name: 'Feuerkarte', attribute: 3 };
    const deck = [fireCard, waterCard];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, hand },
        opponent: { deck: [], hand: [] },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', filter: { attr: 4 } }] },
      ctx(e),
    );
    expect(hand).toContain(waterCard);
    expect(deck).not.toContain(waterCard);
  });
});

describe('tempAtkBonus', () => {
  it('applies temp ATK bonus to targeted monster', () => {
    const target = { tempATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempAtkBonus', target: 'ownMonster', value: 700 }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.tempATKBonus).toBe(700);
  });

  it('applies negative temp ATK bonus to attacker', () => {
    const attacker = { tempATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'tempAtkBonus', target: 'attacker', value: -800 }] },
      ctx(e, 'player', { attacker }),
    );
    expect(attacker.tempATKBonus).toBe(-800);
  });

  it('applies temp ATK bonus to defender', () => {
    const defender = { tempATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onOwnMonsterAttacked', actions: [{ type: 'tempAtkBonus', target: 'defender', value: 1000 }] },
      ctx(e, 'player', { defender }),
    );
    expect(defender.tempATKBonus).toBe(1000);
  });
});

describe('permAtkBonus', () => {
  it('applies permanent ATK bonus with filter', () => {
    const target = { card: { attribute: 2 }, permATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 500, filter: { attr: 2 } }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.permATKBonus).toBe(500);
  });

  it('skips if filter does not match', () => {
    const target = { card: { attribute: 3 }, permATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 500, filter: { attr: 2 } }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.permATKBonus).toBe(0);
  });

  it('applies perm ATK debuff to summonedFC', () => {
    const summonedFC = { card: { name: 'Test' }, permATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'permAtkBonus', target: 'summonedFC', value: -500 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(summonedFC.permATKBonus).toBe(-500);
  });
});

describe('permDefBonus', () => {
  it('applies permanent DEF debuff to summonedFC', () => {
    const summonedFC = { card: { name: 'Test' }, permDEFBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'permDefBonus', target: 'summonedFC', value: -400 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(summonedFC.permDEFBonus).toBe(-400);
  });
});

describe('tempDefBonus', () => {
  it('applies temp DEF bonus to defender', () => {
    const defender = { tempDEFBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onOwnMonsterAttacked', actions: [{ type: 'tempDefBonus', target: 'defender', value: 1500 }] },
      ctx(e, 'player', { defender }),
    );
    expect(defender.tempDEFBonus).toBe(1500);
  });
});

describe('reviveFromGrave', () => {
  it('calls specialSummonFromGrave with target card', () => {
    const card = { id: '1', name: 'Test' };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
      ctx(e, 'player', { targetCard: card }),
    );
    expect(e.specialSummonFromGrave).toHaveBeenCalledWith('player', card);
  });
});

describe('cancelAttack', () => {
  it('returns cancelAttack signal', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }] },
      ctx(e),
    );
    expect(signal.cancelAttack).toBe(true);
  });
});

describe('destroyAttacker', () => {
  it('returns destroyAttacker and cancelAttack signals', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'destroyAttacker' }] },
      ctx(e),
    );
    expect(signal.cancelAttack).toBe(true);
    expect(signal.destroyAttacker).toBe(true);
  });
});

describe('destroySummonedIf', () => {
  it('destroys summoned monster if ATK >= threshold', () => {
    const summonedFC = { card: { name: 'Big', atk: 2000 } };
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(signal.destroySummoned).toBe(true);
  });

  it('does not destroy if ATK < threshold', () => {
    const summonedFC = { card: { name: 'Small', atk: 500 } };
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(signal.destroySummoned).toBeUndefined();
  });
});

describe('destroyAllOpp', () => {
  it('destroys all opponent monsters', () => {
    const fm1 = { card: { name: 'A' } };
    const fm2 = { card: { name: 'B' } };
    const oppGrave = [];
    const monsters = [fm1, null, fm2, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, graveyard: oppGrave },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'destroyAllOpp' }] },
      ctx(e),
    );
    expect(monsters.every(m => m === null)).toBe(true);
    expect(oppGrave).toHaveLength(2);
  });
});

describe('destroyAll', () => {
  it('destroys all monsters on both sides', () => {
    const pfm = { card: { name: 'P' } };
    const ofm = { card: { name: 'O' } };
    const pGrave = [];
    const oGrave = [];
    const pMons = [pfm, null, null, null, null];
    const oMons = [ofm, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: pMons }, graveyard: pGrave },
        opponent: { field: { monsters: oMons }, graveyard: oGrave },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'destroyAll' }] },
      ctx(e),
    );
    expect(pMons.every(m => m === null)).toBe(true);
    expect(oMons.every(m => m === null)).toBe(true);
    expect(pGrave).toHaveLength(1);
    expect(oGrave).toHaveLength(1);
  });
});

describe('sendTopCardsToGrave', () => {
  it('mills own deck to graveyard', () => {
    const c1 = { name: 'A' };
    const c2 = { name: 'B' };
    const c3 = { name: 'C' };
    const deck = [c1, c2, c3];
    const grave = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, graveyard: grave },
        opponent: { deck: [], graveyard: [] },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'sendTopCardsToGrave', count: 2 }] },
      ctx(e),
    );
    expect(deck).toHaveLength(1);
    expect(grave).toHaveLength(2);
  });
});

describe('discardOppHand', () => {
  it('discards from opponent hand randomly', () => {
    const c1 = { name: 'A' };
    const c2 = { name: 'B' };
    const oppHand = [c1, c2];
    const oppGrave = [];
    const e = mockEngine({
      getState: () => ({
        player: { hand: [], graveyard: [] },
        opponent: { hand: oppHand, graveyard: oppGrave },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'discardOppHand', count: 1 }] },
      ctx(e),
    );
    expect(oppHand).toHaveLength(1);
    expect(oppGrave).toHaveLength(1);
  });
});

describe('Multiple actions in one block', () => {
  it('executes all actions and merges signals', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [
        { type: 'dealDamage', target: 'opponent', value: 500 },
        { type: 'cancelAttack' },
      ]},
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 500);
    expect(signal.cancelAttack).toBe(true);
  });
});

describe('extractPassiveFlags', () => {
  it('extracts piercing flag', () => {
    const flags = extractPassiveFlags({ trigger: 'passive', actions: [{ type: 'passive_piercing' }] });
    expect(flags.piercing).toBe(true);
    expect(flags.cannotBeTargeted).toBe(false);
  });

  it('extracts vsAttrBonus', () => {
    const flags = extractPassiveFlags({
      trigger: 'passive',
      actions: [{ type: 'passive_vsAttrBonus', attr: 2, atk: 500 }],
    });
    expect(flags.vsAttrBonus).toEqual({ attr: 2, atk: 500 });
  });

  it('extracts multiple flags', () => {
    const flags = extractPassiveFlags({
      trigger: 'passive',
      actions: [{ type: 'passive_piercing' }, { type: 'passive_untargetable' }],
    });
    expect(flags.piercing).toBe(true);
    expect(flags.cannotBeTargeted).toBe(true);
  });

  it('extracts new passive flags', () => {
    const flags = extractPassiveFlags({
      trigger: 'passive',
      actions: [{ type: 'passive_indestructible' }, { type: 'passive_effectImmune' }, { type: 'passive_cantBeAttacked' }],
    });
    expect(flags.indestructible).toBe(true);
    expect(flags.effectImmune).toBe(true);
    expect(flags.cantBeAttacked).toBe(true);
  });
});
