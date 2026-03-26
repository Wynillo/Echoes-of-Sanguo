import { describe, it, expect } from 'vitest';
import { FieldCard } from '../js/engine.ts';

const baseCard = { id:'M001', name:'Test', type:'normal', atk:1000, def:800 };

describe('FieldCard', () => {
  it('defaults to atk position', () => {
    const fc = new FieldCard(baseCard);
    expect(fc.position).toBe('atk');
  });

  it('effectiveATK sums bonuses', () => {
    const fc = new FieldCard(baseCard);
    fc.tempATKBonus = 200;
    fc.permATKBonus = 100;
    expect(fc.effectiveATK()).toBe(1300);
  });

  it('effectiveATK clamps to 0 on heavy debuff', () => {
    const fc = new FieldCard(baseCard);
    fc.permATKBonus = -5000;
    expect(fc.effectiveATK()).toBe(0);
  });

  it('effectiveDEF clamps to 0', () => {
    const fc = new FieldCard(baseCard);
    fc.permDEFBonus = -5000;
    expect(fc.effectiveDEF()).toBe(0);
  });

  it('deep-copies card to prevent CARD_DB mutation', () => {
    const card = { ...baseCard };
    const fc = new FieldCard(card);
    fc.card.atk = 9999;
    expect(card.atk).toBe(1000);
  });

  it('deep-copies effect so mutations on one FieldCard do not affect another', () => {
    const card = { ...baseCard, effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] } };
    const fc1 = new FieldCard(card);
    const fc2 = new FieldCard(card);
    fc1.card.effect.actions[0].value = 9999;
    expect(fc2.card.effect.actions[0].value).toBe(300);
    expect(card.effect.actions[0].value).toBe(300); // original also untouched
  });

  it('deep-copies effect so mutations on one FieldCard do not affect the source card', () => {
    const card = { ...baseCard, effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] } };
    const fc = new FieldCard(card);
    fc.card.effect.actions.push({ type: 'draw', target: 'self', count: 1 });
    expect(card.effect.actions).toHaveLength(1);
    expect(fc.card.effect.actions).toHaveLength(2);
  });

  it('summonedThisTurn is false by default (FM-style no sickness)', () => {
    const fc = new FieldCard(baseCard);
    expect(fc.summonedThisTurn).toBe(false);
  });

  it('reads piercing passive flag', () => {
    const card = { ...baseCard, effect: { trigger:'passive', actions:[{ type:'passive_piercing' }] } };
    const fc = new FieldCard(card);
    expect(fc.piercing).toBe(true);
    expect(fc.canDirectAttack).toBe(false);
  });

  it('reads vsAttrBonus passive flag', () => {
    const card = { ...baseCard, effect: { trigger:'passive', actions:[{ type:'passive_vsAttrBonus', attr:'dark', atk:500 }] } };
    const fc = new FieldCard(card);
    expect(fc.vsAttrBonus).toEqual({ attr:'dark', atk:500 });
  });

  it('reads phoenixRevival passive flag', () => {
    const card = { ...baseCard, effect: { trigger:'passive', actions:[{ type:'passive_phoenixRevival' }] } };
    const fc = new FieldCard(card);
    expect(fc.phoenixRevival).toBe(true);
  });

  it('non-passive effect card gets null vsAttrBonus and false phoenixRevival', () => {
    const card = { ...baseCard, effect: { trigger:'onSummon', actions:[{ type:'dealDamage', target:'opponent', value:300 }] } };
    const fc = new FieldCard(card);
    expect(fc.vsAttrBonus).toBeNull();
    expect(fc.phoenixRevival).toBe(false);
  });
});
