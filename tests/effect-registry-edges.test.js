// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { executeEffectBlock, extractPassiveFlags, EFFECT_REGISTRY, registerEffect } from '../src/effect-registry.js';

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
    removeEquipmentForMonster: vi.fn(),
    removeFieldSpell: vi.fn(),
    removeFromHand: vi.fn(),
    removeFromDeck: vi.fn(),
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

// ── Edge-case Tests ─────────────────────────────────────────

describe('resolveValue edge cases', () => {
  it('returns 0 for unknown value expression', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'unknown.field', multiply: 1, round: 'floor' } }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });

  it('returns 0 when attacker.effectiveATK is used but attacker is missing', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } }] },
      ctx(e, 'player'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });

  it('returns 0 when summoned.atk is used but summoned is missing', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 1, round: 'floor' } }] },
      ctx(e, 'player'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });

  it('uses ceil rounding when round is not floor', async () => {
    const e = mockEngine();
    const attacker = { effectiveATK: () => 1001, card: { atk: 1001 } };
    await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'ceil' } }] },
      ctx(e, 'player', { attacker }),
    );
    // 1001 * 0.5 = 500.5, ceil → 501
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 501);
  });

  it('handles summoned monster with undefined atk as 0', async () => {
    const e = mockEngine();
    const summoned = { card: {} }; // atk is undefined
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 2, round: 'floor' } }] },
      ctx(e, 'player', { summoned }),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });
});

describe('resolveTarget edge cases', () => {
  it('resolves opponent target when owner is opponent', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }] },
      ctx(e, 'opponent'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('player', 100);
  });

  it('resolves self target when owner is opponent', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'self', value: 100 }] },
      ctx(e, 'opponent'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 100);
  });
});

describe('resolveStatTarget edge cases', () => {
  it('returns no-op when stat target is missing from context', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempAtkBonus', target: 'attacker', value: 500 }] },
      ctx(e, 'player'),
    );
  });

  it('returns no-op for unknown stat target', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempAtkBonus', target: 'nonExistent', value: 500 }] },
      ctx(e, 'player'),
    );
  });
});

describe('executeEffectBlock edge cases', () => {
  it('skips unknown action types gracefully', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'unknownEffect' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('handles empty actions array', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onSummon', actions: [] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('merges signals from multiple actions correctly', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }, { type: 'destroyAttacker' }] },
      ctx(e),
    );
    expect(signal.cancelAttack).toBe(true);
    expect(signal.destroyAttacker).toBe(true);
  });

  it('later actions overwrite earlier signal fields', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }, { type: 'dealDamage', target: 'opponent', value: 100 }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalled();
    expect(signal.cancelAttack).toBe(true);
  });
});

describe('tempBuffField', () => {
  it('applies temp ATK buff to monsters of matching race only', async () => {
    const fm1 = { card: { race: 'krieger' }, tempATKBonus: 0 };
    const fm2 = { card: { race: 'drache' }, tempATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm1, fm2, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempBuffField', value: 300, filter: { race: 'krieger' } }] },
      ctx(e),
    );
    expect(fm1.tempATKBonus).toBe(300);
    expect(fm2.tempATKBonus).toBe(0);
  });

  it('stacks with existing temp ATK bonus', async () => {
    const fm = { card: { race: 'krieger' }, tempATKBonus: 100 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempBuffField', value: 200, filter: { race: 'krieger' } }] },
      ctx(e),
    );
    expect(fm.tempATKBonus).toBe(300);
  });
});

describe('tempDebuffField', () => {
  it('applies temp ATK debuff to all opponent monsters', async () => {
    const fm1 = { card: { name: 'A' }, tempATKBonus: 0 };
    const fm2 = { card: { name: 'B' }, tempATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm1, fm2, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 400 }] },
      ctx(e),
    );
    expect(fm1.tempATKBonus).toBe(-400);
    expect(fm2.tempATKBonus).toBe(-400);
  });

  it('applies DEF debuff as temporary when defD is provided', async () => {
    const fm = { card: {}, tempATKBonus: 0, tempDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 200, defD: 100 }] },
      ctx(e),
    );
    expect(fm.tempATKBonus).toBe(-200);
    expect(fm.tempDEFBonus).toBe(-100);
  });

  it('skips null slots without error', async () => {
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    const signal = await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 100 }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });
});

describe('bounceStrongestOpp edge cases', () => {
  it('does nothing when opponent has no monsters', async () => {
    const oppHand = [];
    const monsters = [null, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e),
    );
    expect(oppHand).toHaveLength(0);
    expect(e.addLog).not.toHaveBeenCalled();
  });

  it('bounces the only monster present', async () => {
    const fm = { card: { name: 'Solo' }, effectiveATK: () => 1000 };
    const oppHand = [];
    const monsters = [null, null, fm, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e),
    );
    expect(monsters[2]).toBeNull();
    expect(oppHand).toContain(fm.card);
  });
});

describe('bounceAttacker edge cases', () => {
  it('does nothing when attacker is not provided', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'bounceAttacker' }] },
      ctx(e, 'player'),
    );
    expect(signal).toEqual({});
  });
});

describe('searchDeckToHand edge cases', () => {
  it('does nothing when no card matches the attribute', async () => {
    const fireCard = { name: 'Feuerkarte', attribute: 'fire' };
    const deck = [fireCard];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, hand },
        opponent: { deck: [], hand: [] },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', filter: { attr: 'water' } }] },
      ctx(e),
    );
    expect(hand).toHaveLength(0);
    expect(deck).toHaveLength(1);
  });

  it('does nothing when deck is empty', async () => {
    const deck = [];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, hand },
        opponent: { deck: [], hand: [] },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', filter: { attr: 'water' } }] },
      ctx(e),
    );
    expect(hand).toHaveLength(0);
  });
});

describe('reviveFromGrave edge cases', () => {
  it('does nothing when targetCard is not provided', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
      ctx(e, 'player'),
    );
    expect(e.specialSummonFromGrave).not.toHaveBeenCalled();
  });
});

describe('destroySummonedIf edge cases', () => {
  it('does not destroy when summoned is missing', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
      ctx(e, 'player'),
    );
    expect(signal.destroySummoned).toBeUndefined();
  });

  it('does not destroy when atk is exactly at threshold', async () => {
    const summoned = { card: { name: 'Exact', atk: 1000 } };
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
      ctx(e, 'player', { summoned }),
    );
    expect(signal.destroySummoned).toBe(true);
  });

  it('does not destroy when atk is undefined', async () => {
    const summoned = { card: { name: 'NoAtk' } };
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 0 }] },
      ctx(e, 'player', { summoned }),
    );
    expect(signal.destroySummoned).toBeUndefined();
  });
});

describe('permAtkBonus edge cases', () => {
  it('applies bonus without filter', async () => {
    const target = { card: { attribute: 'fire' }, permATKBonus: 0 };
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 300 }] },
      ctx(e, 'player', { target: target }),
    );
    expect(target.permATKBonus).toBe(300);
  });

  it('stacks with existing bonus', async () => {
    const target = { card: { attribute: 'dark' }, permATKBonus: 200 };
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 300, filter: { attr: 'dark' } }] },
      ctx(e, 'player', { target: target }),
    );
    expect(target.permATKBonus).toBe(500);
  });
});

describe('buffField edge cases', () => {
  it('skips null monster slots', async () => {
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    const signal = await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffField', value: 200, filter: { race: 'krieger' } }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('stacks with existing permATKBonus', async () => {
    const fm = { card: { race: 'krieger' }, permATKBonus: 100 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffField', value: 200, filter: { race: 'krieger' } }] },
      ctx(e),
    );
    expect(fm.permATKBonus).toBe(300);
  });
});

describe('debuffField edge cases', () => {
  it('applies only ATK debuff when defD is 0', async () => {
    const fm = { card: {}, permATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffField', atkD: 500, defD: 0 }] },
      ctx(e),
    );
    expect(fm.permATKBonus).toBe(-500);
    expect(fm.permDEFBonus).toBe(0);
  });
});

describe('draw edge cases', () => {
  it('draws for opponent when target is opponent', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'draw', target: 'opponent', count: 1 }] },
      ctx(e),
    );
    expect(e.drawCard).toHaveBeenCalledWith('opponent', 1);
  });
});

describe('registerEffect', () => {
  it('registers and executes a custom effect', async () => {
    const customImpl = vi.fn(() => ({ customSignal: true }));
    registerEffect('customTestEffect', customImpl);
    expect(EFFECT_REGISTRY.has('customTestEffect')).toBe(true);

    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'customTestEffect', data: 42 }] },
      ctx(e),
    );
    expect(customImpl).toHaveBeenCalled();
    expect(signal.customSignal).toBe(true);

    EFFECT_REGISTRY.delete('customTestEffect');
  });

  it('overwrites an existing effect', async () => {
    const original = EFFECT_REGISTRY.get('cancelAttack');
    const replacement = vi.fn(() => ({ replaced: true }));
    registerEffect('cancelAttack', replacement);

    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }] },
      ctx(e),
    );
    expect(signal.replaced).toBe(true);

    EFFECT_REGISTRY.set('cancelAttack', original);
  });
});

describe('extractPassiveFlags edge cases', () => {
  it('returns all false for empty actions', () => {
    const flags = extractPassiveFlags({ trigger: 'passive', actions: [] });
    expect(flags.piercing).toBe(false);
    expect(flags.cannotBeTargeted).toBe(false);
    expect(flags.canDirectAttack).toBe(false);
    expect(flags.vsAttrBonus).toBeNull();
    expect(flags.hasPhoenixRevival).toBe(false);
  });

  it('extracts directAttack flag', () => {
    const flags = extractPassiveFlags({ trigger: 'passive', actions: [{ type: 'passive_directAttack' }] });
    expect(flags.canDirectAttack).toBe(true);
  });

  it('extracts phoenixRevival flag', () => {
    const flags = extractPassiveFlags({ trigger: 'passive', actions: [{ type: 'passive_phoenixRevival' }] });
    expect(flags.hasPhoenixRevival).toBe(true);
  });

  it('extracts all flags at once', () => {
    const flags = extractPassiveFlags({
      trigger: 'passive',
      actions: [
        { type: 'passive_piercing' },
        { type: 'passive_untargetable' },
        { type: 'passive_directAttack' },
        { type: 'passive_vsAttrBonus', attr: 'water', atk: 300 },
        { type: 'passive_phoenixRevival' },
      ],
    });
    expect(flags.piercing).toBe(true);
    expect(flags.cannotBeTargeted).toBe(true);
    expect(flags.canDirectAttack).toBe(true);
    expect(flags.vsAttrBonus).toEqual({ attr: 'water', atk: 300 });
    expect(flags.hasPhoenixRevival).toBe(true);
  });

  it('ignores non-passive action types', () => {
    const flags = extractPassiveFlags({
      trigger: 'passive',
      actions: [
        { type: 'dealDamage', target: 'opponent', value: 500 },
        { type: 'passive_piercing' },
      ],
    });
    expect(flags.piercing).toBe(true);
    expect(flags.cannotBeTargeted).toBe(false);
  });
});

// ── Additional edge cases for branch coverage ───────────────

describe('bounceAttacker — attacker not on field', () => {
  it('adds card to hand even when attacker is not found in monsters array', async () => {
    const attacker = { card: { name: 'Ghost' } };
    const oppHand = [];
    const monsters = [null, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'bounceAttacker' }] },
      ctx(e, 'player', { attacker }),
    );
    expect(oppHand).toContain(attacker.card);
    expect(monsters.every(m => m === null)).toBe(true);
  });
});

describe('bounceStrongestOpp — owner is opponent', () => {
  it('bounces the strongest player monster when owner is opponent', async () => {
    const fm = { card: { name: 'PlayerMon' }, effectiveATK: () => 800 };
    const playerHand = [];
    const monsters = [fm, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters }, hand: playerHand },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e, 'opponent'),
    );
    expect(monsters[0]).toBeNull();
    expect(playerHand).toContain(fm.card);
  });

  it('picks first monster when all have equal ATK', async () => {
    const fm1 = { card: { name: 'A' }, effectiveATK: () => 1500 };
    const fm2 = { card: { name: 'B' }, effectiveATK: () => 1500 };
    const oppHand = [];
    const monsters = [fm1, null, fm2, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e),
    );
    // With strict > comparison, the first one (index 0) wins
    expect(oppHand).toHaveLength(1);
    expect(monsters.filter(m => m !== null)).toHaveLength(1);
  });
});

describe('searchDeckToHand — opponent owner', () => {
  it('logs with "Opponent" prefix when owner is opponent', async () => {
    const waterCard = { name: 'Wasserkarte', attribute: 'water' };
    const deck = [waterCard];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck: [], hand: [] },
        opponent: { deck, hand },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', filter: { attr: 'water' } }] },
      ctx(e, 'opponent'),
    );
    expect(hand).toContain(waterCard);
    expect(e.addLog).toHaveBeenCalledWith(expect.stringContaining('Opponent'));
  });

  it('takes only the first matching card', async () => {
    const w1 = { name: 'W1', attribute: 'water' };
    const w2 = { name: 'W2', attribute: 'water' };
    const deck = [w1, w2];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, hand },
        opponent: { deck: [], hand: [] },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', filter: { attr: 'water' } }] },
      ctx(e),
    );
    expect(hand).toHaveLength(1);
    expect(hand[0]).toBe(w1);
    expect(deck).toEqual([w2]);
  });
});

describe('tempDebuffField — atkD of 0 (falsy branch)', () => {
  it('does not modify tempATKBonus when atkD is 0', async () => {
    const fm = { card: {}, tempATKBonus: 50, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 0 }] },
      ctx(e),
    );
    expect(fm.tempATKBonus).toBe(50);
  });
});

describe('debuffField — owner is opponent', () => {
  it('targets player monsters when owner is opponent', async () => {
    const fm = { card: {}, permATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffField', atkD: 100, defD: 50 }] },
      ctx(e, 'opponent'),
    );
    expect(fm.permATKBonus).toBe(-100);
    expect(fm.permDEFBonus).toBe(-50);
  });

  it('skips both debuffs when atkD=0 and defD=0', async () => {
    const fm = { card: {}, permATKBonus: 100, permDEFBonus: 100 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffField', atkD: 0, defD: 0 }] },
      ctx(e),
    );
    expect(fm.permATKBonus).toBe(100);
    expect(fm.permDEFBonus).toBe(100);
  });
});

describe('reviveFromGrave — opponent owner', () => {
  it('calls specialSummonFromGrave with opponent owner', async () => {
    const card = { id: '5', name: 'OppRevive' };
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
      ctx(e, 'opponent', { targetCard: card }),
    );
    expect(e.specialSummonFromGrave).toHaveBeenCalledWith('opponent', card, undefined);
  });
});

describe('gainLP edge cases', () => {
  it('heals 0 LP', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 0 }] },
      ctx(e),
    );
    expect(e.gainLP).toHaveBeenCalledWith('player', 0);
  });

  it('heals opponent when target is opponent', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'opponent', value: 500 }] },
      ctx(e),
    );
    expect(e.gainLP).toHaveBeenCalledWith('opponent', 500);
  });
});

describe('dealDamage — zero value', () => {
  it('deals 0 damage without error', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 0 }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });
});

describe('bounceAllOppMonsters edge cases', () => {
  it('does nothing when opponent field is empty', async () => {
    const oppHand = [];
    const monsters = [null, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceAllOppMonsters' }] },
      ctx(e),
    );
    expect(oppHand).toHaveLength(0);
  });

  it('bounces player monsters when owner is opponent', async () => {
    const fm = { card: { name: 'PM' } };
    const playerHand = [];
    const monsters = [fm, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters }, hand: playerHand },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceAllOppMonsters' }] },
      ctx(e, 'opponent'),
    );
    expect(monsters[0]).toBeNull();
    expect(playerHand).toContain(fm.card);
  });
});

describe('permAtkBonus — card without attribute and filter set', () => {
  it('skips bonus when card has no attribute property', async () => {
    const target = { card: {}, permATKBonus: 0 };
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 400, filter: { attr: 'fire' } }] },
      ctx(e, 'player', { target: target }),
    );
    expect(target.permATKBonus).toBe(0);
  });
});

describe('permDefBonus — null target', () => {
  it('does nothing when target cannot be resolved', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permDefBonus', target: 'attacker', value: 100 }] },
      ctx(e),
    );
  });
});

describe('tempDefBonus — null target', () => {
  it('does nothing when target cannot be resolved', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDefBonus', target: 'summonedFC', value: 200 }] },
      ctx(e),
    );
  });
});

describe('resolveStatTarget — oppMonster via targetFC', () => {
  it('resolves oppMonster to the same targetFC as ownMonster', async () => {
    const target = { permATKBonus: 0 };
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'oppMonster', value: -200 }] },
      ctx(e, 'player', { target: target }),
    );
    expect(target.permATKBonus).toBe(-200);
  });
});

describe('summoned.atk — ceil rounding', () => {
  it('uses ceil rounding for summoned.atk value expression', async () => {
    const e = mockEngine();
    const summoned = { card: { atk: 1001 } };
    await executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 0.5, round: 'ceil' } }] },
      ctx(e, 'player', { summoned }),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 501);
  });
});

describe('draw — owner is opponent with self target', () => {
  it('draws for opponent when owner is opponent and target is self', async () => {
    const e = mockEngine();
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'draw', target: 'self', count: 3 }] },
      ctx(e, 'opponent'),
    );
    expect(e.drawCard).toHaveBeenCalledWith('opponent', 3);
  });
});

describe('passive effect runtime execution', () => {
  it('passive_piercing returns empty signal at runtime', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_piercing' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_untargetable returns empty signal at runtime', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_untargetable' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_directAttack returns empty signal at runtime', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_directAttack' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_vsAttrBonus returns empty signal at runtime', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_vsAttrBonus', attr: 'dark', atk: 500 }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_phoenixRevival returns empty signal at runtime', async () => {
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_phoenixRevival' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });
});

describe('destroySummonedIf — atk is 0 with minAtk 0', () => {
  it('destroys when atk is 0 and minAtk is 0 (0 >= 0)', async () => {
    const summoned = { card: { name: 'ZeroAtk', atk: 0 } };
    const e = mockEngine();
    const signal = await executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 0 }] },
      ctx(e, 'player', { summoned }),
    );
    expect(signal.destroySummoned).toBe(true);
  });
});

describe('buffField (attr filter) — owner is opponent', () => {
  it('buffs opponent field monsters when owner is opponent', async () => {
    const fm = { card: { attribute: 'fire' }, permATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffField', value: 250, filter: { attr: 'fire' } }] },
      ctx(e, 'opponent'),
    );
    expect(fm.permATKBonus).toBe(250);
  });
});

describe('tempDebuffField — owner is opponent (targets player)', () => {
  it('debuffs player monsters when owner is opponent', async () => {
    const fm = { card: {}, tempATKBonus: 0, tempDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    await executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 300, defD: 100 }] },
      ctx(e, 'opponent'),
    );
    expect(fm.tempATKBonus).toBe(-300);
    expect(fm.tempDEFBonus).toBe(-100);
  });
});
