import { describe, it, expect } from 'vitest';
import { buildEffectBlockText, buildEffectBlockSegments, buildCardEffectText, type TFunction } from '../src/effect-text-builder.js';
import type { CardEffectBlock, CardData, EffectDescriptor } from '../src/types.js';
import { Attribute, Race, CardType } from '../src/types.js';

const stubT: TFunction = (key, opts) => {
  let result = key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return result;
};

function makeBlock(trigger: string, actions: EffectDescriptor[], cost?: any): CardEffectBlock {
  return { trigger: trigger as any, actions, cost };
}

describe('buildEffectBlockText', () => {
  it('simple trigger + action', () => {
    const block = makeBlock('onSummon', [{ type: 'dealDamage', target: 'opponent', value: 500 }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('effectText.trigger_onSummon');
    expect(text).toContain('500');
  });

  it('includes cost before actions', () => {
    const block = makeBlock('onSummon', [{ type: 'gainLP', target: 'self', value: 1000 }], { discard: 1 });
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('effectText.cost_discard');
    expect(text).toContain('\u2192');
    expect(text).toContain('1000');
  });

  it('multiple actions are comma-separated', () => {
    const block = makeBlock('onSummon', [
      { type: 'dealDamage', target: 'opponent', value: 300 },
      { type: 'draw', target: 'self', count: 1 },
    ]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain(', ');
  });

  it('passive trigger', () => {
    const block = makeBlock('passive', [{ type: 'passive_piercing' }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('effectText.trigger_passive');
    expect(text).toContain('effectText.action_passive_piercing');
  });

  it('trap trigger', () => {
    const block = makeBlock('onAttack', [{ type: 'cancelAttack' }, { type: 'destroyAttacker' }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('effectText.trigger_onAttack');
    expect(text).toContain('effectText.action_cancelAttack');
    expect(text).toContain('effectText.action_destroyAttacker');
  });
});

describe('buildEffectBlockSegments', () => {
  it('returns structured segments with tooltips', () => {
    const block = makeBlock('onSummon', [{ type: 'dealDamage', target: 'opponent', value: 500 }]);
    const segments = buildEffectBlockSegments(block, stubT);
    const trigger = segments.find(s => s.type === 'trigger');
    expect(trigger).toBeDefined();
    expect(trigger!.tooltip).toBeDefined();
    const action = segments.find(s => s.type === 'action');
    expect(action).toBeDefined();
  });

  it('has cost segment when cost is present', () => {
    const block = makeBlock('onSummon', [{ type: 'draw', target: 'self', count: 1 }], { lp: 500 });
    const segments = buildEffectBlockSegments(block, stubT);
    const cost = segments.find(s => s.type === 'cost');
    expect(cost).toBeDefined();
    expect(cost!.text).toContain('500');
  });
});

describe('buildCardEffectText', () => {
  it('returns empty array for card without effects', () => {
    const card = { id: '1', name: 'Normal', type: CardType.Monster, description: 'A normal monster.' } as CardData;
    expect(buildCardEffectText(card, stubT)).toEqual([]);
  });

  it('returns one line for card with single effect', () => {
    const card = {
      id: '2', name: 'Effect Mon', type: CardType.Monster, description: 'test',
      effect: makeBlock('onSummon', [{ type: 'dealDamage', target: 'opponent', value: 300 }]),
    } as CardData;
    const lines = buildCardEffectText(card, stubT);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('300');
  });

  it('returns multiple lines for card with effects array', () => {
    const card = {
      id: '3', name: 'Multi Effect', type: CardType.Monster, description: 'test',
      effects: [
        makeBlock('passive', [{ type: 'passive_piercing' }]),
        makeBlock('onSummon', [{ type: 'draw', target: 'self', count: 1 }]),
      ],
    } as CardData;
    const lines = buildCardEffectText(card, stubT);
    expect(lines).toHaveLength(2);
  });
});

describe('action coverage', () => {
  const actionCases: [string, EffectDescriptor][] = [
    ['dealDamage', { type: 'dealDamage', target: 'opponent', value: 500 }],
    ['gainLP', { type: 'gainLP', target: 'self', value: 1000 }],
    ['draw', { type: 'draw', target: 'self', count: 2 }],
    ['buffField', { type: 'buffField', value: 200 }],
    ['tempBuffField', { type: 'tempBuffField', value: 300 }],
    ['debuffField', { type: 'debuffField', atkD: 200, defD: 100 }],
    ['tempDebuffField', { type: 'tempDebuffField', atkD: 300 }],
    ['bounceStrongestOpp', { type: 'bounceStrongestOpp' }],
    ['bounceAttacker', { type: 'bounceAttacker' }],
    ['bounceAllOppMonsters', { type: 'bounceAllOppMonsters' }],
    ['searchDeckToHand', { type: 'searchDeckToHand', filter: { race: Race.Dragon } }],
    ['tempAtkBonus', { type: 'tempAtkBonus', target: 'ownMonster', value: 500 }],
    ['permAtkBonus', { type: 'permAtkBonus', target: 'ownMonster', value: 300 }],
    ['tempDefBonus', { type: 'tempDefBonus', target: 'ownMonster', value: 400 }],
    ['permDefBonus', { type: 'permDefBonus', target: 'ownMonster', value: 200 }],
    ['reviveFromGrave', { type: 'reviveFromGrave' }],
    ['reviveFromEitherGrave', { type: 'reviveFromEitherGrave' }],
    ['cancelAttack', { type: 'cancelAttack' }],
    ['cancelEffect', { type: 'cancelEffect' }],
    ['destroyAttacker', { type: 'destroyAttacker' }],
    ['destroySummonedIf', { type: 'destroySummonedIf', minAtk: 1500 }],
    ['destroyAllOpp', { type: 'destroyAllOpp' }],
    ['destroyAll', { type: 'destroyAll' }],
    ['destroyWeakestOpp', { type: 'destroyWeakestOpp' }],
    ['destroyStrongestOpp', { type: 'destroyStrongestOpp' }],
    ['sendTopCardsToGrave', { type: 'sendTopCardsToGrave', count: 3 }],
    ['sendTopCardsToGraveOpp', { type: 'sendTopCardsToGraveOpp', count: 2 }],
    ['salvageFromGrave', { type: 'salvageFromGrave', filter: {} }],
    ['recycleFromGraveToDeck', { type: 'recycleFromGraveToDeck', filter: {} }],
    ['shuffleGraveIntoDeck', { type: 'shuffleGraveIntoDeck' }],
    ['shuffleDeck', { type: 'shuffleDeck' }],
    ['peekTopCard', { type: 'peekTopCard' }],
    ['specialSummonFromHand', { type: 'specialSummonFromHand' }],
    ['specialSummonFromDeck', { type: 'specialSummonFromDeck', filter: { maxLevel: 4 } }],
    ['discardFromHand', { type: 'discardFromHand', count: 1 }],
    ['discardOppHand', { type: 'discardOppHand', count: 1 }],
    ['discardEntireHand', { type: 'discardEntireHand', target: 'both' }],
    ['passive_piercing', { type: 'passive_piercing' }],
    ['passive_untargetable', { type: 'passive_untargetable' }],
    ['passive_directAttack', { type: 'passive_directAttack' }],
    ['passive_vsAttrBonus', { type: 'passive_vsAttrBonus', attr: Attribute.Water, atk: 500 }],
    ['passive_phoenixRevival', { type: 'passive_phoenixRevival' }],
    ['passive_indestructible', { type: 'passive_indestructible' }],
    ['passive_effectImmune', { type: 'passive_effectImmune' }],
    ['passive_cantBeAttacked', { type: 'passive_cantBeAttacked' }],
    ['passive_negateTraps', { type: 'passive_negateTraps' }],
    ['passive_negateSpells', { type: 'passive_negateSpells' }],
    ['passive_negateMonsterEffects', { type: 'passive_negateMonsterEffects' }],
    ['destroyOppSpellTrap', { type: 'destroyOppSpellTrap' }],
    ['destroyAllOppSpellTraps', { type: 'destroyAllOppSpellTraps' }],
    ['destroyAllSpellTraps', { type: 'destroyAllSpellTraps' }],
    ['destroyOppFieldSpell', { type: 'destroyOppFieldSpell' }],
    ['changePositionOpp', { type: 'changePositionOpp' }],
    ['setFaceDown', { type: 'setFaceDown' }],
    ['flipAllOppFaceDown', { type: 'flipAllOppFaceDown' }],
    ['destroyByFilter', { type: 'destroyByFilter', mode: 'strongest', side: 'opponent' }],
    ['halveAtk', { type: 'halveAtk', target: 'oppMonster' }],
    ['doubleAtk', { type: 'doubleAtk', target: 'ownMonster' }],
    ['swapAtkDef', { type: 'swapAtkDef', side: 'all' }],
    ['reflectBattleDamage', { type: 'reflectBattleDamage' }],
    ['stealMonster', { type: 'stealMonster' }],
    ['stealMonsterTemp', { type: 'stealMonsterTemp' }],
    ['skipOppDraw', { type: 'skipOppDraw' }],
    ['destroyAndDamageBoth', { type: 'destroyAndDamageBoth', side: 'opponent' }],
    ['preventBattleDamage', { type: 'preventBattleDamage' }],
    ['drawThenDiscard', { type: 'drawThenDiscard', drawCount: 3, discardCount: 1 }],
    ['bounceOppHandToDeck', { type: 'bounceOppHandToDeck', count: 2 }],
    ['tributeSelf', { type: 'tributeSelf' }],
    ['preventAttacks', { type: 'preventAttacks', turns: 1 }],
    ['createTokens', { type: 'createTokens', tokenId: 'token1', count: 2, position: 'atk' }],
    ['gameReset', { type: 'gameReset' }],
    ['excavateAndSummon', { type: 'excavateAndSummon', count: 5, maxLevel: 4 }],
  ];

  for (const [name, action] of actionCases) {
    it(`produces text for ${name}`, () => {
      const block = makeBlock('onSummon', [action]);
      const text = buildEffectBlockText(block, stubT);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('effectText.action_unknown');
    });
  }
});

describe('cost combinations', () => {
  it('LP cost', () => {
    const block = makeBlock('onSummon', [{ type: 'draw', target: 'self', count: 1 }], { lp: 1000 });
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('1000');
    expect(text).toContain('\u2192');
  });

  it('discard cost', () => {
    const block = makeBlock('onSummon', [{ type: 'gainLP', target: 'self', value: 500 }], { discard: 2 });
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('2');
  });

  it('tribute self cost', () => {
    const block = makeBlock('onSummon', [{ type: 'destroyAllOpp' }], { tributeSelf: true });
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('effectText.cost_tributeSelf');
  });

  it('half LP cost', () => {
    const block = makeBlock('onSummon', [{ type: 'destroyAll' }], { lpHalf: true });
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('effectText.cost_lpHalf');
  });

  it('combined costs', () => {
    const block = makeBlock('onSummon', [{ type: 'draw', target: 'self', count: 3 }], { lp: 500, discard: 1 });
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('500');
    expect(text).toContain('1');
  });
});

describe('filter text', () => {
  it('race filter', () => {
    const block = makeBlock('onSummon', [{ type: 'searchDeckToHand', filter: { race: Race.Dragon } }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('cards.race_Dragon');
  });

  it('attribute filter in passive_vsAttrBonus', () => {
    const block = makeBlock('passive', [{ type: 'passive_vsAttrBonus', attr: Attribute.Dark, atk: 500 }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('cards.attr_dark');
    expect(text).toContain('500');
  });
});

describe('ValueExpr text', () => {
  it('numeric value', () => {
    const block = makeBlock('onSummon', [{ type: 'dealDamage', target: 'opponent', value: 300 }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('300');
  });

  it('expression value', () => {
    const block = makeBlock('onDealBattleDamage', [{
      type: 'dealDamage', target: 'opponent',
      value: { from: 'attacker.effectiveATK' as const, multiply: 0.5, round: 'floor' as const },
    }]);
    const text = buildEffectBlockText(block, stubT);
    expect(text).toContain('50');
  });
});
