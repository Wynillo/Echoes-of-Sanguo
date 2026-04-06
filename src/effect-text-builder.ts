import type { CardData, CardEffectBlock, CardFilter, EffectCost, EffectDescriptor, EffectTrigger, TrapTrigger, ValueExpr, StatTarget } from './types.js';
import { getRaceById, getAttrById } from './type-metadata.js';

export type TFunction = (key: string, opts?: Record<string, unknown>) => string;

export interface EffectTextSegment {
  text: string;
  tooltip?: string;
  type: 'trigger' | 'cost' | 'action' | 'separator';
}

function attrName(attr: number, t: TFunction): string {
  const meta = getAttrById(attr);
  if (!meta) return String(attr);
  const translated = t(`cards.attr_${meta.key.toLowerCase()}`);
  return translated !== `cards.attr_${meta.key.toLowerCase()}` ? translated : meta.value;
}

function raceName(race: number, t: TFunction): string {
  const meta = getRaceById(race);
  if (!meta) return String(race);
  const translated = t(`cards.race_${meta.key}`);
  return translated !== `cards.race_${meta.key}` ? translated : meta.value;
}

function valueExprText(v: ValueExpr, t: TFunction): string {
  if (typeof v === 'number') return String(v);
  const percent = Math.round(v.multiply * 100);
  if (v.from === 'attacker.effectiveATK') {
    return t('effectText.value_attackerAtk', { percent });
  }
  return t('effectText.value_summonedAtk', { percent });
}

function statTargetText(target: StatTarget, t: TFunction): string {
  return t(`effectText.target_${target}`);
}

function filterText(filter: CardFilter | undefined, t: TFunction): string {
  if (!filter) return '';
  const parts: string[] = [];
  if (filter.race !== undefined) parts.push(raceName(filter.race, t));
  if (filter.attr !== undefined) parts.push(attrName(filter.attr, t));
  if (parts.length === 0 && !filter.maxAtk && !filter.minAtk && !filter.maxDef && !filter.maxLevel && !filter.minLevel) return '';
  let base = parts.length > 0
    ? t('effectText.filter_typed', { type: parts.join('/') })
    : t('effectText.filter_monsters');
  const constraints: string[] = [];
  if (filter.minAtk !== undefined) constraints.push(t('effectText.filter_minAtk', { value: filter.minAtk }));
  if (filter.maxAtk !== undefined) constraints.push(t('effectText.filter_maxAtk', { value: filter.maxAtk }));
  if (filter.maxDef !== undefined) constraints.push(t('effectText.filter_maxDef', { value: filter.maxDef }));
  if (filter.minLevel !== undefined) constraints.push(t('effectText.filter_minLevel', { value: filter.minLevel }));
  if (filter.maxLevel !== undefined) constraints.push(t('effectText.filter_maxLevel', { value: filter.maxLevel }));
  if (constraints.length > 0) base += ' ' + constraints.join(', ');
  return base;
}

function triggerText(trigger: EffectTrigger | TrapTrigger, t: TFunction): string {
  return t(`effectText.trigger_${trigger}`);
}

function triggerTooltip(trigger: EffectTrigger | TrapTrigger, t: TFunction): string {
  return t(`effectText.trigger_${trigger}_tip`);
}

function costText(cost: EffectCost, t: TFunction): string {
  const parts: string[] = [];
  if (cost.lp !== undefined) parts.push(t('effectText.cost_lp', { value: cost.lp }));
  if (cost.lpHalf) parts.push(t('effectText.cost_lpHalf'));
  if (cost.discard !== undefined) parts.push(t('effectText.cost_discard', { count: cost.discard }));
  if (cost.tributeSelf) parts.push(t('effectText.cost_tributeSelf'));
  return parts.join(', ');
}

function actionText(a: EffectDescriptor, t: TFunction): string {
  switch (a.type) {
    case 'dealDamage':
      return t(`effectText.action_dealDamage_${a.target}`, { value: valueExprText(a.value, t) });
    case 'gainLP':
      return t(`effectText.action_gainLP_${a.target}`, { value: valueExprText(a.value, t) });
    case 'draw':
      return t(`effectText.action_draw_${a.target}`, { count: a.count });
    case 'buffField': {
      const f = filterText(a.filter, t);
      return f
        ? t('effectText.action_buffField_filtered', { value: a.value, filter: f })
        : t('effectText.action_buffField', { value: a.value });
    }
    case 'tempBuffField': {
      const f = filterText(a.filter, t);
      return f
        ? t('effectText.action_tempBuffField_filtered', { value: a.value, filter: f })
        : t('effectText.action_tempBuffField', { value: a.value });
    }
    case 'debuffField':
      return t('effectText.action_debuffField', { atk: a.atkD, def: a.defD });
    case 'tempDebuffField':
      return a.defD !== undefined
        ? t('effectText.action_tempDebuffField_both', { atk: a.atkD, def: a.defD })
        : t('effectText.action_tempDebuffField', { atk: a.atkD });
    case 'bounceStrongestOpp':
      return t('effectText.action_bounceStrongestOpp');
    case 'bounceAttacker':
      return t('effectText.action_bounceAttacker');
    case 'bounceAllOppMonsters':
      return t('effectText.action_bounceAllOppMonsters');
    case 'searchDeckToHand': {
      const f = filterText(a.filter, t);
      return f ? t('effectText.action_searchDeckToHand_filtered', { filter: f }) : t('effectText.action_searchDeckToHand');
    }
    case 'tempAtkBonus':
      return t('effectText.action_tempAtkBonus', { target: statTargetText(a.target, t), value: a.value });
    case 'permAtkBonus': {
      const f = filterText(a.filter, t);
      return f
        ? t('effectText.action_permAtkBonus_filtered', { target: statTargetText(a.target, t), value: a.value, filter: f })
        : t('effectText.action_permAtkBonus', { target: statTargetText(a.target, t), value: a.value });
    }
    case 'tempDefBonus':
      return t('effectText.action_tempDefBonus', { target: statTargetText(a.target, t), value: a.value });
    case 'permDefBonus':
      return t('effectText.action_permDefBonus', { target: statTargetText(a.target, t), value: a.value });
    case 'reviveFromGrave':
      return t('effectText.action_reviveFromGrave');
    case 'reviveFromEitherGrave':
      return t('effectText.action_reviveFromEitherGrave');
    case 'cancelAttack':
      return t('effectText.action_cancelAttack');
    case 'cancelEffect':
      return t('effectText.action_cancelEffect');
    case 'destroyAttacker':
      return t('effectText.action_destroyAttacker');
    case 'destroySummonedIf':
      return t('effectText.action_destroySummonedIf', { minAtk: a.minAtk });
    case 'destroyAllOpp':
      return t('effectText.action_destroyAllOpp');
    case 'destroyAll':
      return t('effectText.action_destroyAll');
    case 'destroyWeakestOpp':
      return t('effectText.action_destroyWeakestOpp');
    case 'destroyStrongestOpp':
      return t('effectText.action_destroyStrongestOpp');
    case 'sendTopCardsToGrave':
      return t('effectText.action_sendTopCardsToGrave', { count: a.count });
    case 'sendTopCardsToGraveOpp':
      return t('effectText.action_sendTopCardsToGraveOpp', { count: a.count });
    case 'salvageFromGrave': {
      const f = filterText(a.filter, t);
      return f ? t('effectText.action_salvageFromGrave_filtered', { filter: f }) : t('effectText.action_salvageFromGrave');
    }
    case 'recycleFromGraveToDeck': {
      const f = filterText(a.filter, t);
      return f ? t('effectText.action_recycleFromGraveToDeck_filtered', { filter: f }) : t('effectText.action_recycleFromGraveToDeck');
    }
    case 'shuffleGraveIntoDeck':
      return t('effectText.action_shuffleGraveIntoDeck');
    case 'shuffleDeck':
      return t('effectText.action_shuffleDeck');
    case 'peekTopCard':
      return t('effectText.action_peekTopCard');
    case 'specialSummonFromHand': {
      const f = filterText(a.filter, t);
      return f ? t('effectText.action_specialSummonFromHand_filtered', { filter: f }) : t('effectText.action_specialSummonFromHand');
    }
    case 'specialSummonFromDeck': {
      const f = filterText(a.filter, t);
      const extra = a.faceDown ? ` (${t('effectText.modifier_faceDown')})` : '';
      return (f ? t('effectText.action_specialSummonFromDeck_filtered', { filter: f }) : t('effectText.action_specialSummonFromDeck')) + extra;
    }
    case 'discardFromHand':
      return t('effectText.action_discardFromHand', { count: a.count });
    case 'discardOppHand':
      return t('effectText.action_discardOppHand', { count: a.count });
    case 'discardEntireHand':
      return t(`effectText.action_discardEntireHand_${a.target}`);
    case 'passive_piercing':
      return t('effectText.action_passive_piercing');
    case 'passive_untargetable':
      return t('effectText.action_passive_untargetable');
    case 'passive_directAttack':
      return t('effectText.action_passive_directAttack');
    case 'passive_vsAttrBonus':
      return t('effectText.action_passive_vsAttrBonus', { atk: a.atk, attr: attrName(a.attr, t) });
    case 'passive_phoenixRevival':
      return t('effectText.action_passive_phoenixRevival');
    case 'passive_indestructible':
      return t('effectText.action_passive_indestructible');
    case 'passive_effectImmune':
      return t('effectText.action_passive_effectImmune');
    case 'passive_cantBeAttacked':
      return t('effectText.action_passive_cantBeAttacked');
    case 'passive_negateTraps':
      return t('effectText.action_passive_negateTraps');
    case 'passive_negateSpells':
      return t('effectText.action_passive_negateSpells');
    case 'passive_negateMonsterEffects':
      return t('effectText.action_passive_negateMonsterEffects');
    case 'destroyOppSpellTrap':
      return t('effectText.action_destroyOppSpellTrap');
    case 'destroyAllOppSpellTraps':
      return t('effectText.action_destroyAllOppSpellTraps');
    case 'destroyAllSpellTraps':
      return t('effectText.action_destroyAllSpellTraps');
    case 'destroyOppFieldSpell':
      return t('effectText.action_destroyOppFieldSpell');
    case 'changePositionOpp':
      return t('effectText.action_changePositionOpp');
    case 'setFaceDown':
      return t('effectText.action_setFaceDown');
    case 'flipAllOppFaceDown':
      return t('effectText.action_flipAllOppFaceDown');
    case 'destroyByFilter': {
      const f = filterText(a.filter, t);
      const side = a.side ?? 'opponent';
      return t(`effectText.action_destroyByFilter_${a.mode}`, { side: t(`effectText.side_${side}`), filter: f || '' });
    }
    case 'halveAtk':
      return t('effectText.action_halveAtk', { target: statTargetText(a.target, t) });
    case 'doubleAtk':
      return t('effectText.action_doubleAtk', { target: statTargetText(a.target, t) });
    case 'swapAtkDef':
      return t(`effectText.action_swapAtkDef_${a.side}`);
    case 'reflectBattleDamage':
      return t('effectText.action_reflectBattleDamage');
    case 'stealMonster':
      return t('effectText.action_stealMonster');
    case 'stealMonsterTemp':
      return t('effectText.action_stealMonsterTemp');
    case 'skipOppDraw':
      return t('effectText.action_skipOppDraw');
    case 'destroyAndDamageBoth':
      return t('effectText.action_destroyAndDamageBoth');
    case 'preventBattleDamage':
      return t('effectText.action_preventBattleDamage');
    case 'drawThenDiscard':
      return t('effectText.action_drawThenDiscard', { draw: a.drawCount, discard: a.discardCount });
    case 'bounceOppHandToDeck':
      return t('effectText.action_bounceOppHandToDeck', { count: a.count });
    case 'tributeSelf':
      return t('effectText.action_tributeSelf');
    case 'preventAttacks':
      return t('effectText.action_preventAttacks', { turns: a.turns });
    case 'createTokens':
      return t('effectText.action_createTokens', { count: a.count });
    case 'gameReset':
      return t('effectText.action_gameReset');
    case 'excavateAndSummon':
      return t('effectText.action_excavateAndSummon', { count: a.count, maxLevel: a.maxLevel });
    default:
      return t('effectText.action_unknown', { type: (a as any).type });
  }
}

function actionTooltip(a: EffectDescriptor, t: TFunction): string | undefined {
  const key = `effectText.action_${a.type}_tip`;
  const result = t(key);
  return result !== key ? result : undefined;
}

export function buildEffectBlockSegments(block: CardEffectBlock, t: TFunction): EffectTextSegment[] {
  const segments: EffectTextSegment[] = [];

  segments.push({
    text: triggerText(block.trigger, t),
    tooltip: triggerTooltip(block.trigger, t),
    type: 'trigger',
  });

  segments.push({ text: ': ', type: 'separator' });

  if (block.cost) {
    segments.push({
      text: costText(block.cost, t),
      tooltip: t('effectText.cost_tip'),
      type: 'cost',
    });
    segments.push({ text: ' \u2192 ', type: 'separator' });
  }

  block.actions.forEach((action, i) => {
    if (i > 0) {
      segments.push({ text: ', ', type: 'separator' });
    }
    segments.push({
      text: actionText(action, t),
      tooltip: actionTooltip(action, t),
      type: 'action',
    });
  });

  return segments;
}

export function buildEffectBlockText(block: CardEffectBlock, t: TFunction): string {
  return buildEffectBlockSegments(block, t).map(s => s.text).join('');
}

function getEffectBlocks(card: CardData): CardEffectBlock[] {
  if (card.effects && card.effects.length > 0) return card.effects;
  if (card.effect) return [card.effect];
  return [];
}

export function buildCardEffectSegments(card: CardData, t: TFunction): EffectTextSegment[][] {
  return getEffectBlocks(card).map(block => buildEffectBlockSegments(block, t));
}

export function buildCardEffectText(card: CardData, t: TFunction): string[] {
  return getEffectBlocks(card).map(block => buildEffectBlockText(block, t));
}
