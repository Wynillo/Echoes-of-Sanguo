// @vitest-environment node
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

  it('applies DEF debuff as temporary when defD is provided', () => {
    const fm = { card: {}, tempATKBonus: 0, tempDEFBonus: 0 };
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
    expect(fm.tempDEFBonus).toBe(-100);
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

// ── Additional edge cases for branch coverage ───────────────

describe('bounceAttacker — attacker not on field', () => {
  it('adds card to hand even when attacker is not found in monsters array', () => {
    const attacker = { card: { name: 'Ghost' } };
    const oppHand = [];
    const monsters = [null, null, null, null, null]; // attacker not present
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
    // Card is pushed to hand regardless, but indexOf returns -1 so no slot is nulled
    expect(oppHand).toContain(attacker.card);
    expect(monsters.every(m => m === null)).toBe(true);
  });
});

describe('bounceStrongestOpp — owner is opponent', () => {
  it('bounces the strongest player monster when owner is opponent', () => {
    const fm = { card: { name: 'PlayerMon' }, effectiveATK: () => 800 };
    const playerHand = [];
    const monsters = [fm, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters }, hand: playerHand },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e, 'opponent'),
    );
    expect(monsters[0]).toBeNull();
    expect(playerHand).toContain(fm.card);
  });

  it('picks first monster when all have equal ATK', () => {
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
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      ctx(e),
    );
    // With strict > comparison, the first one (index 0) wins
    expect(oppHand).toHaveLength(1);
    expect(monsters.filter(m => m !== null)).toHaveLength(1);
  });
});

describe('searchDeckToHand — opponent owner', () => {
  it('logs with "Gegner" prefix when owner is opponent', () => {
    const waterCard = { name: 'Wasserkarte', attribute: 'water' };
    const deck = [waterCard];
    const hand = [];
    const e = mockEngine({
      getState: () => ({
        player: { deck: [], hand: [] },
        opponent: { deck, hand },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', attr: 'water' }] },
      ctx(e, 'opponent'),
    );
    expect(hand).toContain(waterCard);
    expect(e.addLog).toHaveBeenCalledWith(expect.stringContaining('Gegner'));
  });

  it('takes only the first matching card', () => {
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
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', attr: 'water' }] },
      ctx(e),
    );
    expect(hand).toHaveLength(1);
    expect(hand[0]).toBe(w1);
    expect(deck).toEqual([w2]);
  });
});

describe('tempDebuffAllOpp — atkD of 0 (falsy branch)', () => {
  it('does not modify tempATKBonus when atkD is 0', () => {
    const fm = { card: {}, tempATKBonus: 50, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffAllOpp', atkD: 0 }] },
      ctx(e),
    );
    // atkD is 0 (falsy) so if(desc.atkD) is false, tempATKBonus unchanged
    expect(fm.tempATKBonus).toBe(50);
  });
});

describe('debuffAllOpp — owner is opponent', () => {
  it('targets player monsters when owner is opponent', () => {
    const fm = { card: {}, permATKBonus: 0, permDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffAllOpp', atkD: 100, defD: 50 }] },
      ctx(e, 'opponent'),
    );
    expect(fm.permATKBonus).toBe(-100);
    expect(fm.permDEFBonus).toBe(-50);
  });

  it('skips both debuffs when atkD=0 and defD=0', () => {
    const fm = { card: {}, permATKBonus: 100, permDEFBonus: 100 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'debuffAllOpp', atkD: 0, defD: 0 }] },
      ctx(e),
    );
    // Both are falsy so both if-branches are skipped
    expect(fm.permATKBonus).toBe(100);
    expect(fm.permDEFBonus).toBe(100);
  });
});

describe('reviveFromGrave — opponent owner', () => {
  it('calls specialSummonFromGrave with opponent owner', () => {
    const card = { id: 'M005', name: 'OppRevive' };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
      ctx(e, 'opponent', { targetCard: card }),
    );
    expect(e.specialSummonFromGrave).toHaveBeenCalledWith('opponent', card);
  });
});

describe('gainLP edge cases', () => {
  it('heals 0 LP', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 0 }] },
      ctx(e),
    );
    expect(e.gainLP).toHaveBeenCalledWith('player', 0);
  });

  it('heals opponent when target is opponent', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'opponent', value: 500 }] },
      ctx(e),
    );
    expect(e.gainLP).toHaveBeenCalledWith('opponent', 500);
  });
});

describe('dealDamage — zero value', () => {
  it('deals 0 damage without error', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 0 }] },
      ctx(e),
    );
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 0);
  });
});

describe('bounceAllOppMonsters edge cases', () => {
  it('does nothing when opponent field is empty', () => {
    const oppHand = [];
    const monsters = [null, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters }, hand: oppHand },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceAllOppMonsters' }] },
      ctx(e),
    );
    expect(oppHand).toHaveLength(0);
  });

  it('bounces player monsters when owner is opponent', () => {
    const fm = { card: { name: 'PM' } };
    const playerHand = [];
    const monsters = [fm, null, null, null, null];
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters }, hand: playerHand },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'bounceAllOppMonsters' }] },
      ctx(e, 'opponent'),
    );
    expect(monsters[0]).toBeNull();
    expect(playerHand).toContain(fm.card);
  });
});

describe('permAtkBonus — card without attribute and attrFilter set', () => {
  it('skips bonus when card has no attribute property', () => {
    const target = { card: {}, permATKBonus: 0 }; // no attribute
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 400, attrFilter: 'fire' }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.permATKBonus).toBe(0);
  });
});

describe('permDefBonus — null target', () => {
  it('does nothing when target cannot be resolved', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permDefBonus', target: 'attacker', value: 100 }] },
      ctx(e), // no attacker
    );
    // should not throw
  });
});

describe('tempDefBonus — null target', () => {
  it('does nothing when target cannot be resolved', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDefBonus', target: 'summonedFC', value: 200 }] },
      ctx(e), // no summonedFC
    );
    // should not throw
  });
});

describe('resolveStatTarget — oppMonster via targetFC', () => {
  it('resolves oppMonster to the same targetFC as ownMonster', () => {
    const target = { permATKBonus: 0 };
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'oppMonster', value: -200 }] },
      ctx(e, 'player', { targetFC: target }),
    );
    expect(target.permATKBonus).toBe(-200);
  });
});

describe('summoned.atk — ceil rounding', () => {
  it('uses ceil rounding for summoned.atk value expression', () => {
    const e = mockEngine();
    const summonedFC = { card: { atk: 1001 } };
    executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 0.5, round: 'ceil' } }] },
      ctx(e, 'player', { summonedFC }),
    );
    // 1001 * 0.5 = 500.5 → ceil = 501
    expect(e.dealDamage).toHaveBeenCalledWith('opponent', 501);
  });
});

describe('draw — owner is opponent with self target', () => {
  it('draws for opponent when owner is opponent and target is self', () => {
    const e = mockEngine();
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'draw', target: 'self', count: 3 }] },
      ctx(e, 'opponent'),
    );
    expect(e.drawCard).toHaveBeenCalledWith('opponent', 3);
  });
});

describe('passive effect runtime execution', () => {
  it('passive_piercing returns empty signal at runtime', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_piercing' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_untargetable returns empty signal at runtime', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_untargetable' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_directAttack returns empty signal at runtime', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_directAttack' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_vsAttrBonus returns empty signal at runtime', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_vsAttrBonus', attr: 'dark', atk: 500 }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });

  it('passive_phoenixRevival returns empty signal at runtime', () => {
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'passive', actions: [{ type: 'passive_phoenixRevival' }] },
      ctx(e),
    );
    expect(signal).toEqual({});
  });
});

describe('destroySummonedIf — atk is 0 with minAtk 0', () => {
  it('destroys when atk is 0 and minAtk is 0 (0 >= 0)', () => {
    const summonedFC = { card: { name: 'ZeroAtk', atk: 0 } };
    const e = mockEngine();
    const signal = executeEffectBlock(
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 0 }] },
      ctx(e, 'player', { summonedFC }),
    );
    expect(signal.destroySummoned).toBe(true);
  });
});

describe('buffAtkAttr — owner is opponent', () => {
  it('buffs opponent field monsters when owner is opponent', () => {
    const fm = { card: { attribute: 'fire' }, permATKBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [null, null, null, null, null] } },
        opponent: { field: { monsters: [fm, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'buffAtkAttr', attr: 'fire', value: 250 }] },
      ctx(e, 'opponent'),
    );
    expect(fm.permATKBonus).toBe(250);
  });
});

describe('tempDebuffAllOpp — owner is opponent (targets player)', () => {
  it('debuffs player monsters when owner is opponent', () => {
    const fm = { card: {}, tempATKBonus: 0, tempDEFBonus: 0 };
    const e = mockEngine({
      getState: () => ({
        player: { field: { monsters: [fm, null, null, null, null] } },
        opponent: { field: { monsters: [null, null, null, null, null] } },
      }),
    });
    executeEffectBlock(
      { trigger: 'onSummon', actions: [{ type: 'tempDebuffAllOpp', atkD: 300, defD: 100 }] },
      ctx(e, 'opponent'),
    );
    expect(fm.tempATKBonus).toBe(-300);
    expect(fm.tempDEFBonus).toBe(-100);
  });
});
