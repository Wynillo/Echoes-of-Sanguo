// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  serializeEffect,
  deserializeEffect,
  serializeEffects,
  deserializeEffects,
  isValidEffectString,
  isMultiBlockEffect,
  parseEffectString,
} from '../src/effect-serializer.js';
import { CardType, Attribute, Race } from '../src/types.js';
import { attributeToInt, raceToInt, cardTypeToInt } from '../src/enums.js';

// ── isValidEffectString — rejection cases ────────────────────

describe('isValidEffectString — rejections', () => {
  it('rejects empty string', () => {
    expect(isValidEffectString('')).toBe(false);
  });

  it('rejects string with no colon separator', () => {
    expect(isValidEffectString('noSeparatorHere')).toBe(false);
  });

  it('rejects unknown trigger', () => {
    expect(isValidEffectString('badTrigger:dealDamage(opponent,300)')).toBe(false);
  });

  it('rejects malformed action — missing closing paren', () => {
    expect(isValidEffectString('onSummon:dealDamage(opponent,300')).toBe(false);
  });

  it('rejects malformed action — no parens at all', () => {
    expect(isValidEffectString('onSummon:dealDamage')).toBe(false);
  });

  it('rejects unknown action type', () => {
    expect(isValidEffectString('onSummon:unknownAction()')).toBe(false);
  });

  it('rejects unknown CardFilter key', () => {
    expect(isValidEffectString('onSummon:buffField(200,{x=5})')).toBe(false);
  });

  it('rejects unknown ValueExpr source', () => {
    expect(isValidEffectString('onSummon:dealDamage(opponent,unknown.field*0.5f)')).toBe(false);
  });

  it('rejects invalid ValueExpr format (not a number, not an expr)', () => {
    expect(isValidEffectString('onSummon:dealDamage(opponent,notanumber)')).toBe(false);
  });

  it('rejects invalid StatTarget', () => {
    expect(isValidEffectString('onSummon:tempAtkBonus(badTarget,100)')).toBe(false);
  });

  it('rejects multi-block where second block has invalid trigger', () => {
    expect(isValidEffectString('onSummon:dealDamage(opponent,300)|badTrigger:gainLP(self,500)')).toBe(false);
  });

  it('rejects multi-block where first block has invalid trigger', () => {
    expect(isValidEffectString('bad:gainLP(self,100)|onSummon:dealDamage(opponent,200)')).toBe(false);
  });
});

// ── isValidEffectString — acceptance cases ───────────────────

describe('isValidEffectString — acceptances', () => {
  it('accepts all valid monster triggers', () => {
    const triggers = ['onSummon', 'onDestroyByBattle', 'onDestroyByOpponent', 'passive', 'onFlip', 'onDealBattleDamage', 'onSentToGrave'];
    for (const t of triggers) {
      expect(isValidEffectString(`${t}:dealDamage(opponent,100)`)).toBe(true);
    }
  });

  it('accepts all valid trap/spell triggers', () => {
    const triggers = ['onAttack', 'onOwnMonsterAttacked', 'onOpponentSummon', 'manual', 'onOpponentSpell', 'onAnySummon'];
    for (const t of triggers) {
      expect(isValidEffectString(`${t}:gainLP(self,100)`)).toBe(true);
    }
  });

  it('accepts effect with lp cost', () => {
    expect(isValidEffectString('manual[cost:lp=500]:gainLP(self,1000)')).toBe(true);
  });

  it('accepts effect with lpHalf cost', () => {
    expect(isValidEffectString('onOpponentSummon[cost:lpHalf]:cancelEffect()')).toBe(true);
  });

  it('accepts effect with tributeSelf cost', () => {
    expect(isValidEffectString('onSummon[cost:tributeSelf]:destroyStrongestOpp()')).toBe(true);
  });

  it('accepts effect with discard cost', () => {
    expect(isValidEffectString('onSummon[cost:discard=2]:draw(self,3)')).toBe(true);
  });

  it('accepts effect with combined lp+discard cost', () => {
    expect(isValidEffectString('manual[cost:lp=1000,discard=2]:draw(self,1)')).toBe(true);
  });

  it('accepts valid multi-block effect', () => {
    expect(isValidEffectString('passive:passive_piercing()|onSummon:dealDamage(opponent,300)')).toBe(true);
  });

  it('accepts multi-block with three blocks', () => {
    expect(isValidEffectString('onSummon:gainLP(self,500)|passive:passive_piercing()|onDestroyByBattle:draw(self,1)')).toBe(true);
  });

  it('accepts empty filter', () => {
    expect(isValidEffectString('onSummon:searchDeckToHand({})')).toBe(true);
  });

  it('accepts attacker.effectiveATK ValueExpr with floor', () => {
    expect(isValidEffectString('onAttack:dealDamage(opponent,attacker.effectiveATK*0.5f);cancelAttack()')).toBe(true);
  });

  it('accepts attacker.effectiveATK ValueExpr with ceil', () => {
    expect(isValidEffectString('onAttack:dealDamage(opponent,attacker.effectiveATK*0.5c)')).toBe(true);
  });

  it('accepts summoned.atk ValueExpr', () => {
    expect(isValidEffectString('onSummon:dealDamage(opponent,summoned.atk*1f)')).toBe(true);
  });

  it('accepts passive trigger with passive_ action', () => {
    expect(isValidEffectString('passive:passive_piercing()')).toBe(true);
  });
});

// ── deserializeEffect — throws on bad input ──────────────────

describe('deserializeEffect — error throwing', () => {
  it('throws on empty string', () => {
    expect(() => deserializeEffect('')).toThrow(/no trigger separator/i);
  });

  it('throws when no colon separator exists', () => {
    expect(() => deserializeEffect('nocohere')).toThrow(/no trigger separator/i);
  });

  it('throws on unknown trigger', () => {
    expect(() => deserializeEffect('invalidTrigger:gainLP(self,100)')).toThrow(/Invalid trigger/i);
  });

  it('throws on malformed action syntax (no parens)', () => {
    expect(() => deserializeEffect('onSummon:cancelAttack')).toThrow(/Invalid action syntax/i);
  });

  it('throws on unknown action type', () => {
    expect(() => deserializeEffect('onSummon:flyAway()')).toThrow(/Unknown action type/i);
  });

  it('throws on unknown CardFilter key', () => {
    expect(() => deserializeEffect('onSummon:buffField(200,{z=1})')).toThrow(/Unknown CardFilter key/i);
  });

  it('throws on unknown ValueExpr source', () => {
    expect(() => deserializeEffect('onSummon:dealDamage(opponent,magic.field*0.5f)')).toThrow(/Unknown ValueExpr source/i);
  });

  it('throws on invalid ValueExpr format', () => {
    expect(() => deserializeEffect('onSummon:dealDamage(opponent,abc)')).toThrow(/Invalid ValueExpr/i);
  });

  it('throws on invalid StatTarget', () => {
    expect(() => deserializeEffect('onSummon:tempAtkBonus(whoops,200)')).toThrow(/Invalid StatTarget/i);
  });
});

// ── Round-trips for cost blocks ──────────────────────────────

describe('round-trips — cost blocks', () => {
  it('round-trips lp cost', () => {
    const block = { trigger: 'manual', actions: [{ type: 'gainLP', target: 'self', value: 1000 }], cost: { lp: 500 } };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('round-trips discard cost', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'draw', target: 'self', count: 3 }], cost: { discard: 2 } };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('round-trips tributeSelf cost', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'destroyStrongestOpp' }], cost: { tributeSelf: true } };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('round-trips lpHalf cost', () => {
    const block = { trigger: 'onOpponentSummon', actions: [{ type: 'cancelEffect' }], cost: { lpHalf: true } };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('round-trips combined lp + discard cost', () => {
    const block = { trigger: 'manual', actions: [{ type: 'draw', target: 'self', count: 1 }], cost: { lp: 200, discard: 1 } };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('serializes cost before the colon', () => {
    const block = { trigger: 'manual', actions: [{ type: 'gainLP', target: 'self', value: 1000 }], cost: { lp: 500 } };
    expect(serializeEffect(block)).toBe('manual[cost:lp=500]:gainLP(self,1000)');
  });
});

// ── Multi-block effects ──────────────────────────────────────

describe('multi-block effects', () => {
  it('isMultiBlockEffect returns true for pipe-delimited string', () => {
    expect(isMultiBlockEffect('passive:passive_piercing()|onSummon:dealDamage(opponent,300)')).toBe(true);
  });

  it('isMultiBlockEffect returns false for single block', () => {
    expect(isMultiBlockEffect('onSummon:dealDamage(opponent,300)')).toBe(false);
  });

  it('round-trips two-block effect', () => {
    const blocks = [
      { trigger: 'passive', actions: [{ type: 'passive_piercing' }] },
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] },
    ];
    expect(deserializeEffects(serializeEffects(blocks))).toEqual(blocks);
  });

  it('round-trips three-block effect', () => {
    const blocks = [
      { trigger: 'passive', actions: [{ type: 'passive_piercing' }] },
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 500 }] },
      { trigger: 'onDestroyByBattle', actions: [{ type: 'draw', target: 'self', count: 1 }] },
    ];
    expect(deserializeEffects(serializeEffects(blocks))).toEqual(blocks);
  });

  it('round-trips multi-block with cost on one block', () => {
    const blocks = [
      { trigger: 'passive', actions: [{ type: 'passive_untargetable' }] },
      { trigger: 'manual', actions: [{ type: 'destroyStrongestOpp' }], cost: { lp: 1000 } },
    ];
    expect(deserializeEffects(serializeEffects(blocks))).toEqual(blocks);
  });
});

// ── parseEffectString ────────────────────────────────────────

describe('parseEffectString', () => {
  it('single-block: sets card.effect only', () => {
    const card = {};
    parseEffectString('onSummon:dealDamage(opponent,300)', card);
    expect(card.effect).toBeDefined();
    expect(card.effect.trigger).toBe('onSummon');
    expect(card.effects).toBeUndefined();
  });

  it('multi-block: sets card.effects array and card.effect to first block', () => {
    const card = {};
    parseEffectString('passive:passive_piercing()|onSummon:gainLP(self,500)', card);
    expect(Array.isArray(card.effects)).toBe(true);
    expect(card.effects).toHaveLength(2);
    expect(card.effect).toEqual(card.effects[0]);
    expect(card.effect.trigger).toBe('passive');
  });
});

// ── Round-trips for under-covered action types ───────────────

describe('round-trips — action types', () => {
  function rt(block) {
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  }

  it('tempDebuffField without optional defD', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 400 }] });
  });

  it('tempDebuffField with defD', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'tempDebuffField', atkD: 400, defD: 200 }] });
  });

  it('specialSummonFromDeck with faceDown + def position', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'specialSummonFromDeck', filter: { maxLevel: 4 }, faceDown: true, position: 'def' }] });
  });

  it('specialSummonFromDeck with no extras', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'specialSummonFromDeck', filter: {} }] });
  });

  it('specialSummonFromHand without filter', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'specialSummonFromHand' }] });
  });

  it('specialSummonFromHand with filter', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'specialSummonFromHand', filter: { race: Race.Dragon } }] });
  });

  it('destroyByFilter — mode only', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'destroyByFilter', mode: 'weakest' }] });
  });

  it('destroyByFilter — mode + side', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'destroyByFilter', mode: 'strongest', side: 'opponent' }] });
  });

  it('destroyByFilter — mode + side + filter', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'destroyByFilter', mode: 'highest_def', side: 'opponent', filter: { maxAtk: 1500 } }] });
  });

  it('permAtkBonus without filter', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 500 }] });
  });

  it('permAtkBonus with filter', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 300, filter: { attr: Attribute.Dark } }] });
  });

  it('createTokens', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'createTokens', tokenId: 'slime', count: 2, position: 'def' }] });
  });

  it('excavateAndSummon', () => {
    rt({ trigger: 'onFlip', actions: [{ type: 'excavateAndSummon', count: 5, maxLevel: 4 }] });
  });

  it('bounceOppHandToDeck', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'bounceOppHandToDeck', count: 2 }] });
  });

  it('drawThenDiscard', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'drawThenDiscard', drawCount: 3, discardCount: 2 }] });
  });

  it('preventAttacks', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'preventAttacks', turns: 1 }] });
  });

  it('discardEntireHand self', () => {
    rt({ trigger: 'manual', actions: [{ type: 'discardEntireHand', target: 'self' }] });
  });

  it('discardEntireHand opponent', () => {
    rt({ trigger: 'manual', actions: [{ type: 'discardEntireHand', target: 'opponent' }] });
  });

  it('discardEntireHand both', () => {
    rt({ trigger: 'manual', actions: [{ type: 'discardEntireHand', target: 'both' }] });
  });

  it('destroyAndDamageBoth', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'destroyAndDamageBoth', side: 'opponent' }] });
  });

  it('swapAtkDef — self', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'swapAtkDef', side: 'self' }] });
  });

  it('swapAtkDef — opponent', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'swapAtkDef', side: 'opponent' }] });
  });

  it('swapAtkDef — all', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'swapAtkDef', side: 'all' }] });
  });

  it('destroySummonedIf', () => {
    rt({ trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] });
  });

  it('passive_vsAttrBonus round-trips attr enum', () => {
    rt({ trigger: 'passive', actions: [{ type: 'passive_vsAttrBonus', attr: Attribute.Fire, atk: 300 }] });
  });

  it('halveAtk', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'halveAtk', target: 'oppMonster' }] });
  });

  it('doubleAtk', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'doubleAtk', target: 'ownMonster' }] });
  });

  it('stealMonsterTemp', () => {
    rt({ trigger: 'onAttack', actions: [{ type: 'stealMonsterTemp' }] });
  });

  it('reviveFromEitherGrave', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'reviveFromEitherGrave' }] });
  });

  it('sendTopCardsToGraveOpp', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'sendTopCardsToGraveOpp', count: 3 }] });
  });

  it('recycleFromGraveToDeck with filter', () => {
    rt({ trigger: 'onSummon', actions: [{ type: 'recycleFromGraveToDeck', filter: { race: Race.Warrior } }] });
  });

  it('salvageFromGrave with filter', () => {
    rt({ trigger: 'onDestroyByBattle', actions: [{ type: 'salvageFromGrave', filter: { maxAtk: 1000 } }] });
  });
});

// ── CardFilter round-trips ───────────────────────────────────

describe('CardFilter round-trips', () => {
  function rtFilter(filter) {
    const block = { trigger: 'onSummon', actions: [{ type: 'searchDeckToHand', filter }] };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  }

  it('filter with all fields', () => {
    rtFilter({
      race: Race.Dragon,
      attr: Attribute.Fire,
      cardType: CardType.Monster,
      maxAtk: 2000,
      minAtk: 500,
      maxDef: 1500,
      maxLevel: 6,
      minLevel: 2,
      random: 1,
    });
  });

  it('filter with single race field', () => {
    rtFilter({ race: Race.Spellcaster });
  });

  it('filter with single attr field', () => {
    rtFilter({ attr: Attribute.Light });
  });

  it('filter with single cardType field', () => {
    rtFilter({ cardType: CardType.Monster });
  });

  it('filter with maxAtk only', () => {
    rtFilter({ maxAtk: 1500 });
  });

  it('empty filter round-trips as empty object', () => {
    rtFilter({});
  });
});

// ── ValueExpr round-trips ────────────────────────────────────

describe('ValueExpr round-trips', () => {
  it('fixed integer value', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('attacker.effectiveATK with floor rounding', () => {
    const block = { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } }] };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('attacker.effectiveATK with ceil rounding', () => {
    const block = { trigger: 'onAttack', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'ceil' } }] };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('summoned.atk with floor rounding', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: { from: 'summoned.atk', multiply: 1.0, round: 'floor' } }] };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });

  it('summoned.atk with multiply 2', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: { from: 'summoned.atk', multiply: 2, round: 'floor' } }] };
    expect(deserializeEffect(serializeEffect(block))).toEqual(block);
  });
});
