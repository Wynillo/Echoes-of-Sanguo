// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { executeEffectBlock, extractPassiveFlags, EFFECT_REGISTRY, registerEffect } from '../js/effect-registry.js';

// ── Helpers ─────────────────────────────────────────────────

function mockEngine(overrides = {}) {
  return {
    dealDamage: vi.fn(),
    gainLP: vi.fn(),
    drawCard: vi.fn(),
    addLog: vi.fn(),
    specialSummonFromGrave: vi.fn(),
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
  it('returns 0 for unknown value expression', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'unknown.field', multiply: 1, round: 'floor' } }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });

  it('returns 0 when attacker.effectiveATK is used but attacker is missing', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } }] },
      ctx(e, 'player'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });

  it('returns 0 when summoned.atk is used but summonedFC is missing', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 1, round: 'floor' } }] },
      ctx(e, 'player'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });

  it('uses ceil rounding when round is not floor', () => {
    const e = mockEngine();
    const attacker = { effectiveATK: () => 1001, card: { atk: 1001 } };
    executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'ceil' } }] },
      ctx(e, 'player', { attacker }),
    );
    // 1001 * 0.5 = 500.5, ceil → 501
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 501);
  });

  it('handles summoned monster with undefined atk as 0', () => {
    const e = mockEngine();
    const summonedFC = { card: {} }; // atk is undefined
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 2, round: 'floor' } }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });
});

describe('resolveTarget edge cases', () => {
  it('resolves opponent target when owner is opponent', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 100 }] },
      ctx(e, 'opponent'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('player', 100);
  });

  it('resolves self target when owner is opponent', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'self', value: 100 }] },
      ctx(e, 'opponent'),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 100);
  });
});

describe('resolveStatTarget edge cases', () => {
  it('returns no-op when stat target is missing from context', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempAtkBonus', target: 'attacker', value: 500 }] },
      ctx(e, 'player'), // no attacker in context
    );
    // should not throw
  });

  it('returns no-op for unknown stat target', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempAtkBonus', target: 'nonExistent', value: 500 }] },
      ctx(e, 'player'),
    );
    // should not throw
  });
});

describe('executeEffectBlock edge cases', () => {
  it('skips unknown action types gracefully', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'totallyFakeEffect', value: 999 }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('handles empty actions array', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onSummon', actions: [] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('merges signals from multiple actions correctly', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [
        { type: 'cancelAttack' },
        { type: 'destroyAttacker' },
      ]},
      ctx(e),
    );
    expect(signal.cancelAttack).toBe(true);
    expect(signal.destroyAttacker).toBe(true);
  });

  it('later actions overwrite earlier signal fields', () => {
    // cancelAttack sets cancelAttack: true, and destroyAttacker also sets it
    // Both should be true — this confirms Object.assign merge order
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [
        { type: 'dealDamage', target: 'opponent', value: 100 },
        { type: 'destroyAttacker' },
      ]},
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalled();
    expect(signal.cancelAttack).toBe(true);
    expect(signal.destroyAttacker).toBe(true);
  });
});

describe('tempBuffAtkRace', () => {
  it('applies temp ATK buff to monsters of matching race only', () => {
    const fm1 = { card: { race: 'krieger' }, tempATKBonus: 0 };
    const fm2 = { card: { race: 'drache' }, tempATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm1, fm2, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempBuffAtkRace', race: 'krieger', value: 300 }] },
      ctx(e),
    );
    expect(fm1.tempATKBonus).toBe(300);
    expect(fm2.tempATKBonus).toBe(0);
  });

  it('stacks with existing temp ATK bonus', () => {
    const fm = { card: { race: 'krieger' }, tempATKBonus: 100 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempBuffAtkRace', race: 'krieger', value: 200 }] },
      ctx(e),
    );
    expect(fm.tempATKBonus).toBe(300);
  });
});

describe('tempDebuffAllOpp', () => {
  it('applies temp ATK debuff to all opponent monsters', () => {
    const fm1 = { card: {}, tempATKBonus: 0, permDEFBonus: 0 };
    const fm2 = { card: {}, tempATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm1, null, fm2, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffAllOpp', atkD: 400 }] },
      ctx(e),
    );
    expect(fm1.tempATKBonus).toBe(-400);
    expect(fm2.tempATKBonus).toBe(-400);
  });

  it('applies DEF debuff as permanent when defD is provided', () => {
    const fm = { card: {}, tempATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffAllOpp', atkD: 200, defD: 100 }] },
      ctx(e),
    );
    expect(fm.tempATKBonus).toBe(-200);
    expect(fm.permDEFBonus).toBe(-100);
  });

  it('skips null slots without error', () => {
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    const signal = executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffAllOpp', atkD: 100 }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });
});

describe('bounceStrongestOpp edge cases', () => {
  it('does nothing when opponent has no monsters', () => {
    const oppHand = [];
    const monsters = [null, null, null, null, null];
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
    expect(oppHand).toHaveLength(0);
    expect(e.addLog).not.toHaveBeenCalled();
  });

  it('bounces the only monster present', () => {
    const fm = { card: { name: 'Solo' }, effectiveATK: () => 1000 };
    const oppHand = [];
    const monsters = [null, null, fm, null, null];
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
    expect(monsters[2]).toBeNull();
    expect(oppHand).toContain(fm.card);
  });
});

describe('bounceAttacker edge cases', () => {
  it('does nothing when attacker is not provided', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'bounceAttacker' }] },
      ctx(e, 'player'),
    );
    expect(signal).toEqual({});
  });
});

describe('searchDeckToHand edge cases', () => {
  it('does nothing when no card matches the attribute', () => {
    const fireCard = { name: 'Feuerkarte', attribute: 'fire' };
    const deck = [fireCard];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, hand },
        opponent: { deck: [], hand: [] },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', attr: 'water' }] },
      ctx(e),
    );
    expect(hand).toHaveLength(0);
    expect(deck).toHaveLength(1);
  });

  it('does nothing when deck is empty', () => {
    const deck = [];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck, hand },
        opponent: { deck: [], hand: [] },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', attr: 'water' }] },
      ctx(e),
    );
    expect(hand).toHaveLength(0);
  });
});

describe('reviveFromGrave edge cases', () => {
  it('does nothing when targetCard is not provided', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
      ctx(e, 'player'), // no targetCard
    );
    expect(e.specialSummonFromGrave).not.toHaveBeenCalled();
  });
});

describe('destroySummonedIf edge cases', () => {
  it('does not destroy when summonedFC is missing', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
      ctx(e, 'player'), // no summonedFC
    );
    expect(signal.destroySummoned).toBeUndefined();
  });

  it('does not destroy when atk is exactly at threshold', () => {
    const summonedFC = { card: { name: 'Exact', atk: 1000 } };
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(signal.destroySummoned).toBe(true);
  });

  it('does not destroy when atk is undefined', () => {
    const summonedFC = { card: { name: 'NoAtk' } }; // atk is undefined
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 0 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(signal.destroySummoned).toBeUndefined();
  });
});

describe('permAtkBonus edge cases', () => {
  it('applies bonus without attrFilter', () => {
    const target = { card: { attribute: 'fire' }, permATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 300 }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.permATKBonus).toBe(300);
  });

  it('stacks with existing bonus', () => {
    const target = { card: { attribute: 'dark' }, permATKBonus: 200 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 300, attrFilter: 'dark' }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.permATKBonus).toBe(500);
  });
});

describe('buffAtkRace edge cases', () => {
  it('skips null monster slots', () => {
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    const signal = executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffAtkRace', race: 'krieger', value: 200 }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('stacks with existing permATKBonus', () => {
    const fm = { card: { race: 'krieger' }, permATKBonus: 100 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffAtkRace', race: 'krieger', value: 200 }] },
      ctx(e),
    );
    expect(fm.permATKBonus).toBe(300);
  });
});

describe('debuffAllOpp edge cases', () => {
  it('applies only ATK debuff when defD is 0', () => {
    const fm = { card: {}, permATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffAllOpp', atkD: 500, defD: 0 }] },
      ctx(e),
    );
    expect(fm.permATKBonus).toBe(-500);
    expect(fm.permDEFBonus).toBe(0);
  });
});

describe('draw edge cases', () => {
  it('draws for opponent when target is opponent', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'draw', target: 'opponent', count: 1 }] },
      ctx(e),
    );
    expect(e.drawCard).toHaveBeenCalledWith('opponent', 1);
  });
});

describe('registerEffect', () => {
  it('registers and executes a custom effect', () => {
    const customImpl = vi.fn(() => ({ customSignal: true }));
    registerEffect('customTestEffect', customImpl);
    expect(EFFECT_REGISTRY.has('customTestEffect')).toBe(true);

    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'customTestEffect', data: 42 }] },
      ctx(e),
    );
    expect(customImpl).toHaveBeenCalled();
    expect(signal.customSignal).toBe(true);

    // Clean up
    EFFECT_REGISTRY.delete('customTestEffect');
  });

  it('overwrites an existing effect', () => {
    const original = EFFECT_REGISTRY.get('cancelAttack');
    const replacement = vi.fn(() => ({ replaced: true }));
    registerEffect('cancelAttack', replacement);

    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }] },
      ctx(e),
    );
    expect(signal.replaced).toBe(true);

    // Restore original
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
    expect(flags.phoenixRevival).toBe(false);
  });

  it('extracts directAttack flag', () => {
    const flags = extractPassiveFlags({ trigger: 'passive', actions: [{ type: 'passive_directAttack' }] });
    expect(flags.canDirectAttack).toBe(true);
  });

  it('extracts phoenixRevival flag', () => {
    const flags = extractPassiveFlags({ trigger: 'passive', actions: [{ type: 'passive_phoenixRevival' }] });
    expect(flags.phoenixRevival).toBe(true);
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
    expect(flags.phoenixRevival).toBe(true);
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
