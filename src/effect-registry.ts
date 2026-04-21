import {
  Attribute, CardType,
  type CardData, type CardFilter,
  type EffectDescriptor, type EffectContext, type EffectSignal, type CardEffectBlock,
  type ValueExpr, type StatTarget, type Owner, type FieldCard,
  type PureEffectCtx, type ChainEffectCtx,
} from './types.js';
import { EchoesOfSanguo } from './debug-logger.js';
import { shuffleArray, shuffleInPlace } from './utils/array.js';
import { findEmptyMonsterZone } from './utils/field-zones.js';

/**
 * Maximum number of effect steps allowed per effect block execution.
 * Prevents DoS attacks via infinite recursive effect chains.
 * Configurable via options parameter to executeEffectBlock().
 */
export const MAX_EFFECT_STEPS = 100;

/**
 * Custom error for effect execution failures.
 * Provides clear indication of why execution was terminated.
 */
export class EffectExecutionError extends Error {
  constructor(
    message: string,
    public readonly reason: 'timeout' | 'step_limit' | 'error',
    public readonly stepsExecuted?: number,
  ) {
    super(message);
    this.name = 'EffectExecutionError';
  }
}

export function matchesFilter(card: CardData, filter: CardFilter): boolean {
  if (filter.race     !== undefined && card.race      !== filter.race)       return false;
  if (filter.attr     !== undefined && card.attribute  !== filter.attr)       return false;
  if (filter.cardType !== undefined && card.type       !== filter.cardType)   return false;
  if (filter.cardId   !== undefined && card.id         !== filter.cardId)     return false;
  if (filter.maxAtk   !== undefined && (card.atk ?? 0) > filter.maxAtk)      return false;
  if (filter.minAtk   !== undefined && (card.atk ?? 0) < filter.minAtk)      return false;
  if (filter.maxDef   !== undefined && (card.def ?? 0) > filter.maxDef)      return false;
  if (filter.maxLevel !== undefined && (card.level ?? 0) > filter.maxLevel)  return false;
  if (filter.minLevel !== undefined && (card.level ?? 0) < filter.minLevel)  return false;
  return true;
}

function filterFieldMonsters(monsters: Array<FieldCard | null>, filter?: CardFilter): FieldCard[] {
  let result = monsters.filter((fm): fm is FieldCard => fm !== null);
  if (filter) result = result.filter(fm => matchesFilter(fm.card, filter));
  if (filter?.random !== undefined && filter.random > 0) {
    const shuffled = shuffleArray(result);
    result = shuffled.slice(0, Math.min(filter.random, result.length));
  }
  return result;
}


function oppOf(owner: Owner): Owner {
  return owner === 'player' ? 'opponent' : 'player';
}

function resolveValue(expr: ValueExpr, ctx: PureEffectCtx): number {
  if (typeof expr === 'number') return expr;
  if (expr.from === 'attacker.effectiveATK' && ctx.attacker) {
    const raw = ctx.attacker.effectiveATK() * expr.multiply;
    return expr.round === 'floor' ? Math.floor(raw) : Math.ceil(raw);
  }
  if (expr.from === 'summoned.atk' && ctx.summoned) {
    const raw = (ctx.summoned.card.atk ?? 0) * expr.multiply;
    return expr.round === 'floor' ? Math.floor(raw) : Math.ceil(raw);
  }
  return 0;
}

function resolveTarget(target: 'opponent' | 'self', owner: Owner): Owner {
  if (target === 'self') return owner;
  return oppOf(owner);
}

function resolveStatTarget(target: StatTarget, ctx: PureEffectCtx): FieldCard | null {
  if (target === 'attacker')    return ctx.attacker ?? null;
  if (target === 'defender')    return ctx.defender ?? null;
  if (target === 'summonedFC')  return ctx.summoned ?? null;
  if (target === 'ownMonster')  return ctx.target ?? null;
  if (target === 'oppMonster')  return ctx.target ?? null;
  return null;
}

function _triggerBuffVFX(fc: FieldCard, ctx: PureEffectCtx): void {
  if (!ctx.vfx) return;
  for (const side of ['player', 'opponent'] as Owner[]) {
    const zone = ctx.state[side].field.monsters.indexOf(fc);
    if (zone !== -1) {
      ctx.vfx('buff', side, zone);
      return;
    }
  }
}

function findMonsterByATK(
  monsters: Array<FieldCard | null>,
  mode: 'strongest' | 'weakest',
  opts?: { excludeUntargetable?: boolean },
): number | null {
  const cmp = mode === 'strongest'
    ? (a: number, b: number) => a > b
    : (a: number, b: number) => a < b;
  let idx: number | null = null;
  monsters.forEach((fm, i) => {
    if (!fm) return;
    if (opts?.excludeUntargetable && fm.cannotBeTargeted) return;
    if (idx === null || cmp(fm.effectiveATK(), monsters[idx]!.effectiveATK())) idx = i;
  });
  return idx;
}

export type EffectImpl = (desc: EffectDescriptor, ctx: EffectContext) => EffectSignal;
// Internal type — all handlers receive ChainEffectCtx from the dispatcher at runtime.
// A-handlers declare ctx: PureEffectCtx (supertype → valid via contravariance).
// B/A+B handlers declare ctx: ChainEffectCtx (same type → valid directly).
type InternalImpl = (desc: any, ctx: ChainEffectCtx) => EffectSignal | Promise<EffectSignal>;

const IMPL: Record<string, InternalImpl> = {

  dealDamage(desc: { target: 'opponent' | 'self'; value: ValueExpr }, ctx: PureEffectCtx) {
    const amount = resolveValue(desc.value, ctx);
    const target = resolveTarget(desc.target, ctx.owner);
    ctx.vfx?.('damage', target);
    ctx.damage(target, amount);
    return {};
  },

  gainLP(desc: { target: 'opponent' | 'self'; value: number | ValueExpr }, ctx: PureEffectCtx) {
    const amount = resolveValue(desc.value as ValueExpr, ctx);
    const target = resolveTarget(desc.target, ctx.owner);
    ctx.heal(target, amount);
    return {};
  },

  draw(desc: { target: 'self' | 'opponent'; count: number }, ctx: PureEffectCtx) {
    ctx.draw(resolveTarget(desc.target, ctx.owner), desc.count);
    return {};
  },

  buffField(desc: { value: number; filter?: CardFilter }, ctx: PureEffectCtx) {
    const monsters = filterFieldMonsters(ctx.state[ctx.owner].field.monsters, desc.filter);
    for (const fm of monsters) {
      fm.permATKBonus = (fm.permATKBonus || 0) + desc.value;
      fm.permDEFBonus = (fm.permDEFBonus || 0) + desc.value;
      const zone = ctx.state[ctx.owner].field.monsters.indexOf(fm);
      if (zone !== -1) ctx.vfx?.('buff', ctx.owner, zone);
    }
    return {};
  },

  tempBuffField(desc: { value: number; filter?: CardFilter }, ctx: PureEffectCtx) {
    const monsters = filterFieldMonsters(ctx.state[ctx.owner].field.monsters, desc.filter);
    for (const fm of monsters) {
      fm.tempATKBonus = (fm.tempATKBonus || 0) + desc.value;
      fm.tempDEFBonus = (fm.tempDEFBonus || 0) + desc.value;
      const zone = ctx.state[ctx.owner].field.monsters.indexOf(fm);
      if (zone !== -1) ctx.vfx?.('buff', ctx.owner, zone);
    }
    return {};
  },

  debuffField(desc: { atkD: number; defD: number }, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    ctx.state[opp].field.monsters.forEach(fm => {
      if (!fm) return;
      if (desc.atkD) fm.permATKBonus = (fm.permATKBonus || 0) - desc.atkD;
      if (desc.defD) fm.permDEFBonus = (fm.permDEFBonus || 0) - desc.defD;
    });
    return {};
  },

  tempDebuffField(desc: { atkD: number; defD?: number }, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const defD = desc.defD ?? desc.atkD;
    ctx.state[opp].field.monsters.forEach(fm => {
      if (!fm) return;
      if (desc.atkD) fm.tempATKBonus = (fm.tempATKBonus || 0) - desc.atkD;
      if (defD) fm.tempDEFBonus = (fm.tempDEFBonus || 0) - defD;
    });
    return {};
  },

  bounceStrongestOpp(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const monsters = ctx.state[opp].field.monsters;
    const strongest = findMonsterByATK(monsters, 'strongest', { excludeUntargetable: true });
    if (strongest !== null && monsters[strongest]) {
      const fc = monsters[strongest];
      ctx.state[opp].hand.push(fc.card);
      monsters[strongest] = null;
      ctx.removeEquipment(opp, strongest);
      ctx.log(`${fc.card.name} was bounced back to hand!`);
    }
    return {};
  },

  bounceAttacker(_desc: unknown, ctx: PureEffectCtx) {
    if (!ctx.attacker) return {};
    const opp = oppOf(ctx.owner);
    ctx.state[opp].hand.push(ctx.attacker.card);
    const monsters = ctx.state[opp].field.monsters;
    const i = monsters.indexOf(ctx.attacker);
    if (i !== -1) { monsters[i] = null; ctx.removeEquipment(opp, i); }
    return {};
  },

  bounceAllOppMonsters(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const monsters = ctx.state[opp].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      if (monsters[i]) {
        ctx.state[opp].hand.push(monsters[i]!.card);
        monsters[i] = null;
        ctx.removeEquipment(opp, i);
      }
    }
    return {};
  },

  async searchDeckToHand(desc: { filter: CardFilter }, ctx: ChainEffectCtx) {
    const deck = ctx.state[ctx.owner].deck;
    const matches = deck.filter(c => matchesFilter(c, desc.filter));
    if (matches.length === 0) return {};

    const chosen = ctx.owner === 'opponent'
      ? matches[0]
      : await ctx.selectFromDeck(matches);
    if (!chosen) return {};

    const idx = deck.indexOf(chosen);
    if (idx !== -1) {
      deck.splice(idx, 1);
      ctx.state[ctx.owner].hand.push(chosen);
      ctx.log(`${ctx.owner === 'player' ? 'You' : 'Opponent'}: ${chosen.name} added to hand by effect.`);
    }
    return {};
  },

  tempAtkBonus(desc: { target: StatTarget; value: number }, ctx: PureEffectCtx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      fc.tempATKBonus = (fc.tempATKBonus || 0) + desc.value;
      fc.tempDEFBonus = (fc.tempDEFBonus || 0) + desc.value;
      _triggerBuffVFX(fc, ctx);
    }
    return {};
  },

  permAtkBonus(desc: { target: StatTarget; value: number; filter?: CardFilter }, ctx: PureEffectCtx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (!fc) return {};
    if (desc.filter && !matchesFilter(fc.card, desc.filter)) return {};
    fc.permATKBonus = (fc.permATKBonus || 0) + desc.value;
    fc.permDEFBonus = (fc.permDEFBonus || 0) + desc.value;
    _triggerBuffVFX(fc, ctx);
    return {};
  },

  tempDefBonus(desc: { target: StatTarget; value: number }, ctx: PureEffectCtx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      fc.tempDEFBonus = (fc.tempDEFBonus || 0) + desc.value;
      _triggerBuffVFX(fc, ctx);
    }
    return {};
  },

  permDefBonus(desc: { target: StatTarget; value: number }, ctx: PureEffectCtx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      fc.permDEFBonus = (fc.permDEFBonus || 0) + desc.value;
      _triggerBuffVFX(fc, ctx);
    }
    return {};
  },

  async reviveFromGrave(_desc: unknown, ctx: ChainEffectCtx) {
    if (ctx.targetCard) await ctx.summonFromGrave(ctx.owner, ctx.targetCard);
    return {};
  },

  cancelAttack(_desc: unknown, _ctx: PureEffectCtx) {
    return { cancelAttack: true };
  },

  cancelEffect(_desc: unknown, _ctx: PureEffectCtx) {
    return { cancelEffect: true };
  },

  reflectBattleDamage(_desc: unknown, _ctx: PureEffectCtx) {
    return { cancelAttack: true, reflectDamage: true };
  },

  stealMonster(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const oppMonsters = ctx.state[opp].field.monsters;
    const idx = findMonsterByATK(oppMonsters, 'strongest', { excludeUntargetable: true });
    if (idx === null || !oppMonsters[idx]) return {};
    const ownMonsters = ctx.state[ctx.owner].field.monsters;
    const freeZone = findEmptyMonsterZone(ownMonsters);
    if (freeZone === -1) return {};
    const fc = oppMonsters[idx]!;
    oppMonsters[idx] = null;
    ctx.removeEquipment(opp, idx);
    fc.originalOwner = opp;
    ownMonsters[freeZone] = fc;
    fc.hasAttacked = false;
    ctx.log(`${fc.card.name} control changed!`);
    return {};
  },

  skipOppDraw(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    ctx.state.skipNextDraw = opp;
    ctx.log(`${opp === 'player' ? 'You' : 'Opponent'} will skip the next Draw Phase!`);
    return {};
  },

  destroyAndDamageBoth(desc: { side: 'opponent' | 'self' }, ctx: PureEffectCtx) {
    const targetOwner = desc.side === 'opponent' ? oppOf(ctx.owner) : ctx.owner;
    const monsters = ctx.state[targetOwner].field.monsters;
    const idx = findMonsterByATK(monsters, 'strongest', {});
    if (idx === null || !monsters[idx]) return {};
    const fc = monsters[idx]!;
    const atk = fc.effectiveATK();
    ctx.log(`${fc.card.name} is destroyed! Both players take ${atk} damage!`);
    ctx.state[targetOwner].graveyard.push(fc.card);
    ctx.state[targetOwner].field.monsters[idx] = null;
    ctx.removeEquipment(targetOwner, idx);
    ctx.damage('player', atk);
    ctx.damage('opponent', atk);
    return {};
  },

  preventBattleDamage(_desc: unknown, ctx: PureEffectCtx) {
    ctx.state[ctx.owner].battleProtection = true;
    ctx.log('Battle damage and destruction prevented this turn!');
    return { cancelAttack: true };
  },

  passive_negateTraps(_desc: unknown, ctx: PureEffectCtx) {
    if (!ctx.state[ctx.owner].fieldFlags) ctx.state[ctx.owner].fieldFlags = {};
    ctx.state[ctx.owner].fieldFlags!.negateTraps = true;
    ctx.log('All Trap effects are negated!');
    return {};
  },

  passive_negateSpells(_desc: unknown, ctx: PureEffectCtx) {
    if (!ctx.state[ctx.owner].fieldFlags) ctx.state[ctx.owner].fieldFlags = {};
    ctx.state[ctx.owner].fieldFlags!.negateSpells = true;
    ctx.log('All Spell effects are negated!');
    return {};
  },

  passive_negateMonsterEffects(_desc: unknown, ctx: PureEffectCtx) {
    if (!ctx.state[ctx.owner].fieldFlags) ctx.state[ctx.owner].fieldFlags = {};
    ctx.state[ctx.owner].fieldFlags!.negateMonsterEffects = true;
    ctx.log('All monster effects are negated!');
    return {};
  },

  stealMonsterTemp(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const oppMonsters = ctx.state[opp].field.monsters;
    const idx = findMonsterByATK(oppMonsters, 'strongest', { excludeUntargetable: true });
    if (idx === null || !oppMonsters[idx]) return {};
    const ownMonsters = ctx.state[ctx.owner].field.monsters;
    const freeZone = findEmptyMonsterZone(ownMonsters);
    if (freeZone === -1) return {};
    const fc = oppMonsters[idx]!;
    oppMonsters[idx] = null;
    ctx.removeEquipment(opp, idx);
    fc.originalOwner = opp;
    fc.hasAttacked = false;
    ownMonsters[freeZone] = fc;
    ctx.log(`${fc.card.name} is temporarily under your control!`);
    return {};
  },

  async reviveFromEitherGrave(_desc: unknown, ctx: ChainEffectCtx) {
    const ownGY = ctx.state[ctx.owner].graveyard;
    const oppGY = ctx.state[oppOf(ctx.owner)].graveyard;
    let bestCard: CardData | null = null;
    let bestAtk = -1;
    let fromOwner: Owner = ctx.owner;
    for (const [side, gy] of [[ctx.owner, ownGY], [oppOf(ctx.owner), oppGY]] as [Owner, CardData[]][]) {
      for (const card of gy) {
        if ((card.type === CardType.Monster || card.type === CardType.Fusion) && (card.atk ?? 0) > bestAtk) {
          bestAtk = card.atk ?? 0; bestCard = card; fromOwner = side;
        }
      }
    }
    if (bestCard) await ctx.summonFromGrave(ctx.owner, bestCard, fromOwner);
    return {};
  },

  drawThenDiscard(desc: { drawCount: number; discardCount: number }, ctx: PureEffectCtx) {
    ctx.draw(ctx.owner, desc.drawCount);
    const hand = ctx.state[ctx.owner].hand;
    const toDiscard = Math.min(desc.discardCount, hand.length);
    for (let i = 0; i < toDiscard; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      ctx.state[ctx.owner].graveyard.push(c);
    }
    ctx.log(`Drew ${desc.drawCount}, discarded ${toDiscard}.`);
    return {};
  },

  bounceOppHandToDeck(desc: { count: number }, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const hand = ctx.state[opp].hand;
    const toReturn = Math.min(desc.count, hand.length);
    for (let i = 0; i < toReturn; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      ctx.state[opp].deck.push(c);
    }
    if (toReturn > 0) ctx.log(`${toReturn} card(s) shuffled back into opponent's deck.`);
    return {};
  },

  tributeSelf(_desc: unknown, _ctx: PureEffectCtx) {
    return {};
  },

  preventAttacks(desc: { turns: number }, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    if (!ctx.state[opp].turnCounters) ctx.state[opp].turnCounters = [];
    ctx.state[opp].turnCounters!.push({ turnsRemaining: desc.turns, effect: 'preventAttacks' });
    ctx.log(`Opponent cannot attack for ${desc.turns} turns!`);
    return {};
  },

  async createTokens(desc: { tokenId: string; count: number; position: string }, ctx: ChainEffectCtx) {
    const pos = (desc.position ?? 'def') as 'atk' | 'def';
    for (let i = 0; i < desc.count; i++) {
      const tokenCard: CardData = {
        id: `${desc.tokenId}_${Date.now()}_${i}`,
        name: 'Sheep Token',
        type: CardType.Monster,
        atk: 0,
        def: 0,
        description: 'A token monster.',
      };
      await ctx.summon(ctx.owner, tokenCard, undefined, pos);
    }
    ctx.log(`${desc.count} token(s) summoned!`);
    return {};
  },

  gameReset(_desc: unknown, ctx: PureEffectCtx) {
    for (const side of ['player', 'opponent'] as Owner[]) {
      const ps = ctx.state[side];
      const allCards: CardData[] = [...ps.hand, ...ps.graveyard];
      for (const fc of ps.field.monsters) {
        if (fc) allCards.push(fc.card);
      }
      for (const fst of ps.field.spellTraps) {
        if (fst) allCards.push(fst.card);
      }
      if (ps.field.fieldSpell) allCards.push(ps.field.fieldSpell.card);
      ps.hand.length = 0;
      ps.graveyard.length = 0;
      ps.field.monsters.fill(null);
      ps.field.spellTraps.fill(null);
      ps.field.fieldSpell = null;
      ps.deck.push(...allCards);
      for (let i = ps.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ps.deck[i], ps.deck[j]] = [ps.deck[j], ps.deck[i]];
      }
      ctx.draw(side, 5);
    }
    ctx.log('All cards shuffled back! Both players draw 5.');
    return {};
  },

  async excavateAndSummon(desc: { count: number; maxLevel: number }, ctx: ChainEffectCtx) {
    for (const side of ['player', 'opponent'] as Owner[]) {
      const ps = ctx.state[side];
      const excavated: CardData[] = [];
      for (let i = 0; i < desc.count && ps.deck.length > 0; i++) {
        excavated.push(ctx.removeFromDeck(side, 0));
      }
      for (const card of excavated) {
        if ((card.type === CardType.Monster || card.type === CardType.Fusion) && (card.level ?? 99) <= desc.maxLevel) {
          await ctx.summon(side, card, undefined, 'def', true);
        } else {
          ps.hand.push(card);
        }
      }
    }
    ctx.log(`Top ${desc.count} cards excavated! Monsters summoned, rest added to hand.`);
    return {};
  },

  discardEntireHand(desc: { target: 'self' | 'opponent' | 'both' }, ctx: PureEffectCtx) {
    const discard = (owner: Owner) => {
      const ps = ctx.state[owner];
      while (ps.hand.length > 0) {
        ps.graveyard.push(ps.hand.pop()!);
      }
      ctx.log(`${owner === 'player' ? 'You' : 'Opponent'} discarded entire hand.`);
    };
    if (desc.target === 'self' || desc.target === 'both') discard(ctx.owner);
    if (desc.target === 'opponent' || desc.target === 'both') discard(oppOf(ctx.owner));
    return {};
  },

  destroyAttacker(_desc: unknown, _ctx: PureEffectCtx) {
    return { cancelAttack: true, destroyAttacker: true };
  },

  destroySummonedIf(desc: { minAtk: number }, ctx: PureEffectCtx) {
    if (ctx.summoned && ctx.summoned.card.atk !== undefined && ctx.summoned.card.atk >= desc.minAtk) {
      ctx.log(`Trap! ${ctx.summoned.card.name} is destroyed!`);
      return { destroySummoned: true };
    }
    return {};
  },

  destroyAllOpp(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const monsters = ctx.state[opp].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      if (monsters[i]) {
        ctx.state[opp].graveyard.push(monsters[i]!.card);
        monsters[i] = null;
        ctx.removeEquipment(opp, i);
      }
    }
    ctx.log('All opponent monsters destroyed!');
    return {};
  },

  destroyAll(_desc: unknown, ctx: PureEffectCtx) {
    for (const side of ['player', 'opponent'] as Owner[]) {
      const monsters = ctx.state[side].field.monsters;
      for (let i = 0; i < monsters.length; i++) {
        if (monsters[i]) {
          ctx.state[side].graveyard.push(monsters[i]!.card);
          monsters[i] = null;
          ctx.removeEquipment(side, i);
        }
      }
    }
    ctx.log('All monsters on both sides destroyed!');
    return {};
  },

  destroyWeakestOpp(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const monsters = ctx.state[opp].field.monsters;
    const weakestIdx = findMonsterByATK(monsters, 'weakest');
    if (weakestIdx !== null && monsters[weakestIdx]) {
      const fc = monsters[weakestIdx];
      ctx.state[opp].graveyard.push(fc.card);
      monsters[weakestIdx] = null;
      ctx.removeEquipment(opp, weakestIdx);
      ctx.log(`${fc.card.name} (weakest) destroyed!`);
    }
    return {};
  },

  destroyStrongestOpp(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const monsters = ctx.state[opp].field.monsters;
    const strongestIdx = findMonsterByATK(monsters, 'strongest');
    if (strongestIdx !== null && monsters[strongestIdx]) {
      const fc = monsters[strongestIdx];
      ctx.state[opp].graveyard.push(fc.card);
      monsters[strongestIdx] = null;
      ctx.removeEquipment(opp, strongestIdx);
      ctx.log(`${fc.card.name} (strongest) destroyed!`);
    }
    return {};
  },

  sendTopCardsToGrave(desc: { count: number }, ctx: PureEffectCtx) {
    const deck = ctx.state[ctx.owner].deck;
    const count = Math.min(desc.count, deck.length);
    const cards = deck.splice(0, count);
    ctx.state[ctx.owner].graveyard.push(...cards);
    ctx.log(`${count} card(s) sent from deck to graveyard.`);
    return {};
  },

  sendTopCardsToGraveOpp(desc: { count: number }, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const deck = ctx.state[opp].deck;
    const count = Math.min(desc.count, deck.length);
    const cards = deck.splice(0, count);
    ctx.state[opp].graveyard.push(...cards);
    ctx.log(`${count} card(s) from opponent's deck sent to graveyard.`);
    return {};
  },

  salvageFromGrave(desc: { filter: CardFilter }, ctx: PureEffectCtx) {
    const grave = ctx.state[ctx.owner].graveyard;
    const idx = grave.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const [c] = grave.splice(idx, 1);
      ctx.state[ctx.owner].hand.push(c);
      ctx.log(`${c.name} salvaged from graveyard to hand.`);
    }
    return {};
  },

  recycleFromGraveToDeck(desc: { filter: CardFilter }, ctx: PureEffectCtx) {
    const grave = ctx.state[ctx.owner].graveyard;
    const idx = grave.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const [c] = grave.splice(idx, 1);
      ctx.state[ctx.owner].deck.push(c);
      ctx.log(`${c.name} recycled from graveyard to deck.`);
    }
    return {};
  },

  shuffleGraveIntoDeck(_desc: unknown, ctx: PureEffectCtx) {
    const ps = ctx.state[ctx.owner];
    ps.deck.push(...ps.graveyard);
    ps.graveyard.length = 0;
    shuffleInPlace(ps.deck);
    ctx.log('Graveyard shuffled back into deck.');
    return {};
  },

  shuffleDeck(_desc: unknown, ctx: PureEffectCtx) {
    shuffleInPlace(ctx.state[ctx.owner].deck);
    ctx.log('Deck shuffled.');
    return {};
  },

  peekTopCard(_desc: unknown, ctx: PureEffectCtx) {
    const deck = ctx.state[ctx.owner].deck;
    ctx.log(deck.length > 0 ? `Top card: ${deck[0].name}` : 'Deck is empty!');
    return {};
  },

  async specialSummonFromHand(desc: { filter?: CardFilter }, ctx: ChainEffectCtx) {
    const hand = ctx.state[ctx.owner].hand;
    const idx = desc.filter
      ? hand.findIndex(c => matchesFilter(c, desc.filter!))
      : hand.findIndex(c => c.type === CardType.Monster || c.type === CardType.Fusion);
    if (idx !== -1) {
      const card = ctx.removeFromHand(ctx.owner, idx);
      await ctx.summon(ctx.owner, card);
    }
    return {};
  },

  discardFromHand(desc: { count: number }, ctx: PureEffectCtx) {
    const hand = ctx.state[ctx.owner].hand;
    const count = Math.min(desc.count, hand.length);
    for (let i = 0; i < count && hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      ctx.state[ctx.owner].graveyard.push(c);
    }
    if (count > 0) ctx.log(`${count} card(s) discarded from hand.`);
    return {};
  },

  discardOppHand(desc: { count: number }, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const hand = ctx.state[opp].hand;
    const count = Math.min(desc.count, hand.length);
    for (let i = 0; i < count && hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      ctx.state[opp].graveyard.push(c);
    }
    if (count > 0) ctx.log(`${count} card(s) discarded from opponent's hand.`);
    return {};
  },

  destroyOppSpellTrap(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const zones = ctx.state[opp].field.spellTraps;
    for (let i = 0; i < zones.length; i++) {
      if (zones[i]) {
        ctx.log(`${zones[i]!.card.name} was destroyed!`);
        ctx.state[opp].graveyard.push(zones[i]!.card);
        zones[i] = null;
        ctx.removeEquipment(opp, i);
        break;
      }
    }
    return {};
  },

  destroyAllOppSpellTraps(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const zones = ctx.state[opp].field.spellTraps;
    for (let i = 0; i < zones.length; i++) {
      if (zones[i]) {
        ctx.log(`${zones[i]!.card.name} was destroyed!`);
        ctx.state[opp].graveyard.push(zones[i]!.card);
        zones[i] = null;
        ctx.removeEquipment(opp, i);
      }
    }
    return {};
  },

  destroyAllSpellTraps(_desc: unknown, ctx: PureEffectCtx) {
    for (const side of ['player', 'opponent'] as Owner[]) {
      const zones = ctx.state[side].field.spellTraps;
      for (let i = 0; i < zones.length; i++) {
        if (zones[i]) {
          ctx.log(`${zones[i]!.card.name} was destroyed!`);
          ctx.state[side].graveyard.push(zones[i]!.card);
          zones[i] = null;
          ctx.removeEquipment(side, i);
        }
      }
    }
    return {};
  },

  destroyOppFieldSpell(_desc: unknown, ctx: PureEffectCtx) {
    ctx.removeFieldSpell(oppOf(ctx.owner));
    return {};
  },

  changePositionOpp(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    const monsters = ctx.state[opp].field.monsters;
    const idx = findMonsterByATK(monsters, 'strongest');
    if (idx !== null && monsters[idx]) {
      const fc = monsters[idx]!;
      fc.position = fc.position === 'atk' ? 'def' : 'atk';
      ctx.log(`${fc.card.name} position changed to ${fc.position.toUpperCase()}!`);
    }
    return {};
  },

  setFaceDown(_desc: unknown, ctx: PureEffectCtx) {
    if (!ctx.target) return {};
    ctx.target.faceDown = true;
    ctx.target.position = 'def';
    ctx.target.hasFlipSummoned = false;
    ctx.log(`${ctx.target.card.name} was set face-down!`);
    return {};
  },

  flipAllOppFaceDown(_desc: unknown, ctx: PureEffectCtx) {
    const opp = oppOf(ctx.owner);
    for (const fc of ctx.state[opp].field.monsters) {
      if (fc && !fc.faceDown) {
        fc.faceDown = true;
        fc.position = 'def';
        fc.hasFlipSummoned = false;
      }
    }
    ctx.log('All opponent monsters set face-down!');
    return {};
  },

  destroyByFilter(desc: { filter?: CardFilter; mode: 'weakest' | 'strongest' | 'highestDef' | 'first'; side?: 'opponent' | 'self' }, ctx: PureEffectCtx) {
    const side = desc.side === 'self' ? ctx.owner : oppOf(ctx.owner);
    const monsters = ctx.state[side].field.monsters;
    let idx: number | null = null;

    if (desc.mode === 'weakest') {
      idx = findMonsterByATK(monsters, 'weakest');
    } else if (desc.mode === 'strongest') {
      idx = findMonsterByATK(monsters, 'strongest');
    } else if (desc.mode === 'highestDef') {
      let best: number | null = null;
      monsters.forEach((fm, i) => {
        if (!fm) return;
        if (desc.filter && !matchesFilter(fm.card, desc.filter)) return;
        if (best === null || fm.effectiveDEF() > monsters[best]!.effectiveDEF()) best = i;
      });
      idx = best;
    } else {
      for (let i = 0; i < monsters.length; i++) {
        if (monsters[i] && (!desc.filter || matchesFilter(monsters[i]!.card, desc.filter))) {
          idx = i; break;
        }
      }
    }

    if (idx !== null && monsters[idx]) {
      const fc = monsters[idx]!;
      ctx.state[side].graveyard.push(fc.card);
      monsters[idx] = null;
      ctx.removeEquipment(side, idx);
      ctx.log(`${fc.card.name} was destroyed!`);
    }
    return {};
  },

  halveAtk(desc: { target: StatTarget }, ctx: PureEffectCtx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      const half = Math.floor(fc.effectiveATK() / 2);
      const reduction = fc.effectiveATK() - half;
      fc.tempATKBonus = (fc.tempATKBonus || 0) - reduction;
      ctx.log(`${fc.card.name}'s ATK halved!`);
    }
    return {};
  },

  doubleAtk(desc: { target: StatTarget }, ctx: PureEffectCtx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      const current = fc.effectiveATK();
      fc.tempATKBonus = (fc.tempATKBonus || 0) + current;
      _triggerBuffVFX(fc, ctx);
      ctx.log(`${fc.card.name}'s ATK doubled!`);
    }
    return {};
  },

  swapAtkDef(desc: { side: 'self' | 'opponent' | 'all' }, ctx: PureEffectCtx) {
    const sides: Owner[] = desc.side === 'all'
      ? ['player', 'opponent']
      : [desc.side === 'self' ? ctx.owner : oppOf(ctx.owner)];
    for (const side of sides) {
      for (const fc of ctx.state[side].field.monsters) {
        if (!fc) continue;
        const atk = fc.card.atk ?? 0;
        const def = fc.card.def ?? 0;
        const atkBonus = fc.permATKBonus + fc.tempATKBonus + fc.fieldSpellATKBonus;
        const defBonus = fc.permDEFBonus + fc.tempDEFBonus + fc.fieldSpellDEFBonus;
        const effAtk = Math.max(0, atk + atkBonus);
        const effDef = Math.max(0, def + defBonus);
        fc.tempATKBonus += (effDef - effAtk);
        fc.tempDEFBonus += (effAtk - effDef);
      }
    }
    ctx.log('ATK and DEF values swapped!');
    return {};
  },

  async specialSummonFromDeck(desc: { filter: CardFilter; faceDown?: boolean; position?: string }, ctx: ChainEffectCtx) {
    const deck = ctx.state[ctx.owner].deck;
    const idx = deck.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const card = ctx.removeFromDeck(ctx.owner, idx);
      const pos = (desc.position ?? 'atk') as 'atk' | 'def';
      await ctx.summon(ctx.owner, card, undefined, pos, !!desc.faceDown);
      ctx.log(`${card.name} special summoned from deck${desc.faceDown ? ' face-down' : ''}!`);
    }
    return {};
  },

  passive_piercing(_desc: unknown, _ctx: PureEffectCtx)       { return {}; },
  passive_untargetable(_desc: unknown, _ctx: PureEffectCtx)   { return {}; },
  passive_directAttack(_desc: unknown, _ctx: PureEffectCtx)   { return {}; },
  passive_vsAttrBonus(_desc: unknown, _ctx: PureEffectCtx)    { return {}; },
  passive_phoenixRevival(_desc: unknown, _ctx: PureEffectCtx) { return {}; },
  passive_indestructible(_desc: unknown, _ctx: PureEffectCtx) { return {}; },
  passive_effectImmune(_desc: unknown, _ctx: PureEffectCtx)   { return {}; },
  passive_cantBeAttacked(_desc: unknown, _ctx: PureEffectCtx) { return {}; },
};

export const EFFECT_REGISTRY = new Map<string, EffectImpl>(
  Object.entries(IMPL) as unknown as [string, EffectImpl][],
);

export function registerEffect(type: string, impl: EffectImpl): void {
  EFFECT_REGISTRY.set(type, impl);
}

export function makePureCtx(ctx: EffectContext): PureEffectCtx {
  const engine = ctx.engine;
  const state   = engine.getState();
  return {
    state,
    owner:      ctx.owner,
    target:     ctx.target,
    targetCard: ctx.targetCard,
    attacker:   ctx.attacker,
    defender:   ctx.defender,
    summoned:   ctx.summoned,
    log:               (msg) => engine.addLog(msg),
    damage:            (owner, amount) => engine.dealDamage(owner, amount),
    heal:              (owner, amount) => engine.gainLP(owner, amount),
    draw:              (owner, count)  => engine.drawCard(owner, count),
    removeEquipment:   (owner, zone)   => engine.removeEquipmentForMonster(owner, zone),
    removeFieldSpell:  (owner)         => engine.removeFieldSpell(owner),
    vfx:               engine.ui?.playVFX ? (type, owner, zone) => engine.ui.playVFX!(type, owner!, zone) : undefined,
  };
}

export function makeChainCtx(ctx: EffectContext): ChainEffectCtx {
  const engine = ctx.engine;
  return {
    ...makePureCtx(ctx),
    summon:         (owner, card, zone, position, faceDown) => engine.specialSummon(owner, card, zone, position, faceDown),
    summonFromGrave:(owner, card, fromOwner)                => engine.specialSummonFromGrave(owner, card, fromOwner),
    removeFromHand: (owner, index)                          => engine.removeFromHand(owner, index),
    removeFromDeck: (owner, index)                          => engine.removeFromDeck(owner, index),
    selectFromDeck: (cards)                                 => engine.ui?.selectFromDeck ? engine.ui.selectFromDeck(cards) : Promise.resolve(cards[0] ?? null),
  };
}

export function canPayCost(block: CardEffectBlock, ctx: EffectContext): boolean {
  if (!block.cost) return true;
  const st = ctx.engine.getState()[ctx.owner];
  if (block.cost.lp && st.lp < block.cost.lp) return false;
  if (block.cost.discard && st.hand.length < block.cost.discard) return false;
  return true;
}

async function payCost(block: CardEffectBlock, ctx: EffectContext): Promise<void> {
  if (!block.cost) return;
  const st = ctx.engine.getState()[ctx.owner];
  if (block.cost.lpHalf) {
    const halfLP = Math.floor(st.lp / 2);
    ctx.engine.dealDamage(ctx.owner, halfLP);
    ctx.engine.addLog(`Paid ${halfLP} LP (half) as cost.`);
  } else if (block.cost.lp) {
    ctx.engine.dealDamage(ctx.owner, block.cost.lp);
    ctx.engine.addLog(`Paid ${block.cost.lp} LP as cost.`);
  }
  if (block.cost.discard) {
    for (let i = 0; i < block.cost.discard && st.hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * st.hand.length);
      const [c] = st.hand.splice(idx, 1);
      st.graveyard.push(c);
    }
    ctx.engine.addLog(`Discarded ${block.cost.discard} card(s) as cost.`);
  }
  if (block.cost.tributeSelf) {
    const monsters = ctx.engine.getState()[ctx.owner].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      const fc = monsters[i];
      if (fc && fc.card.effect?.actions.some((a: import('./types.js').EffectDescriptor) => a.type === block.actions[0]?.type)) {
        await ctx.engine.chainTribute(ctx.owner, fc.card);
        break;
      }
    }
  }
}

export interface EffectExecutionOptions {
  /** Shared step counter object (for recursive calls across effect chains) */
  stepCounter?: { value: number };
  /** Maximum allowed steps (defaults to MAX_EFFECT_STEPS) */
  maxSteps?: number;
  /** AbortSignal for timeout cancellation */
  abortSignal?: AbortSignal;
}

/**
 * Executes a card effect block with step limit and timeout protection.
 * Each action in the block counts as one step to prevent DoS attacks.
 */
export async function executeEffectBlock(
  block: CardEffectBlock,
  ctx: EffectContext,
  options?: EffectExecutionOptions,
): Promise<EffectSignal> {
  const stepCounter = options?.stepCounter ?? { value: 0 };
  const maxSteps = options?.maxSteps ?? MAX_EFFECT_STEPS;

  // Check abort signal
  if (options?.abortSignal?.aborted) {
    const errorMsg = `Effect execution aborted: ${options.abortSignal.reason || 'timeout'}`;
    EchoesOfSanguo.log('SECURITY', errorMsg, '#f44');
    throw new EffectExecutionError(errorMsg, 'timeout', stepCounter.value);
  }

  if (!canPayCost(block, ctx)) {
    ctx.engine.addLog('Cannot pay effect cost!');
    return {};
  }
  await payCost(block, ctx);

  const pctx = makeChainCtx(ctx);
  const signal: EffectSignal = {};
  
  for (const action of block.actions) {
    // Increment step counter for each action
    stepCounter.value++;
    
    // Check step limit before each action
    if (stepCounter.value > maxSteps) {
      const errorMsg = `Effect execution exceeded maximum steps (${stepCounter.value} > ${maxSteps})`;
      EchoesOfSanguo.log('SECURITY', errorMsg, '#f44');
      throw new EffectExecutionError(errorMsg, 'step_limit', stepCounter.value);
    }

    // Check abort signal before each action
    if (options?.abortSignal?.aborted) {
      const errorMsg = `Effect execution aborted: ${options.abortSignal.reason || 'timeout'}`;
      EchoesOfSanguo.log('SECURITY', errorMsg, '#f44');
      throw new EffectExecutionError(errorMsg, 'timeout', stepCounter.value);
    }

    const impl = EFFECT_REGISTRY.get(action.type) as InternalImpl | undefined;
    if (impl) {
      Object.assign(signal, await impl(action, pctx));
    } else {
      ctx.engine.addLog(`[EffectRegistry] No handler for effect type: "${action.type}" — skipping.`);
    }
  }
  return signal;
}

export function extractPassiveFlags(block: CardEffectBlock): {
  piercing: boolean;
  cannotBeTargeted: boolean;
  canDirectAttack: boolean;
  vsAttrBonus: { attr: Attribute; atk: number } | null;
  phoenixRevival: boolean;
  indestructible: boolean;
  effectImmune: boolean;
  cantBeAttacked: boolean;
} {
  const flags = {
    piercing: false,
    cannotBeTargeted: false,
    canDirectAttack: false,
    vsAttrBonus: null as { attr: Attribute; atk: number } | null,
    phoenixRevival: false,
    indestructible: false,
    effectImmune: false,
    cantBeAttacked: false,
  };
  for (const action of block.actions) {
    switch (action.type) {
      case 'passive_piercing':       flags.piercing = true; break;
      case 'passive_untargetable':   flags.cannotBeTargeted = true; break;
      case 'passive_directAttack':   flags.canDirectAttack = true; break;
      case 'passive_vsAttrBonus':    flags.vsAttrBonus = { attr: action.attr, atk: action.atk }; break;
      case 'passive_phoenixRevival': flags.phoenixRevival = true; break;
      case 'passive_indestructible': flags.indestructible = true; break;
      case 'passive_effectImmune':   flags.effectImmune = true; break;
      case 'passive_cantBeAttacked': flags.cantBeAttacked = true; break;
    }
  }
  return flags;
}
