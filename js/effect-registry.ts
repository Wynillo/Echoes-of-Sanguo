import {
  Attribute, CardType,
  type CardData, type CardFilter,
  type EffectDescriptor, type EffectContext, type EffectSignal, type CardEffectBlock,
  type ValueExpr, type StatTarget, type Owner, type FieldCard,
} from './types.js';

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
    const shuffled = [...result].sort(() => Math.random() - 0.5);
    result = shuffled.slice(0, Math.min(filter.random, result.length));
  }
  return result;
}


function oppOf(owner: Owner): Owner {
  return owner === 'player' ? 'opponent' : 'player';
}

function resolveValue(expr: ValueExpr, ctx: EffectContext): number {
  if (typeof expr === 'number') return expr;
  if (expr.from === 'attacker.effectiveATK' && ctx.attacker) {
    const raw = ctx.attacker.effectiveATK() * expr.multiply;
    return expr.round === 'floor' ? Math.floor(raw) : Math.ceil(raw);
  }
  if (expr.from === 'summoned.atk' && ctx.summonedFC) {
    const raw = (ctx.summonedFC.card.atk ?? 0) * expr.multiply;
    return expr.round === 'floor' ? Math.floor(raw) : Math.ceil(raw);
  }
  return 0;
}

function resolveTarget(target: 'opponent' | 'self', owner: Owner): Owner {
  if (target === 'self') return owner;
  return oppOf(owner);
}

function resolveStatTarget(target: StatTarget, ctx: EffectContext): FieldCard | null {
  if (target === 'attacker')    return ctx.attacker ?? null;
  if (target === 'defender')    return ctx.defender ?? null;
  if (target === 'summonedFC')  return ctx.summonedFC ?? null;
  if (target === 'ownMonster')  return ctx.targetFC ?? null;
  if (target === 'oppMonster')  return ctx.targetFC ?? null;
  return null;
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function _triggerBuffVFX(fc: FieldCard, ctx: EffectContext): void {
  const ui = ctx.engine.ui;
  if (!ui?.playVFX) return;
  const st = ctx.engine.getState();
  for (const side of ['player', 'opponent'] as Owner[]) {
    const zone = st[side].field.monsters.indexOf(fc);
    if (zone !== -1) {
      ui.playVFX('buff', side, zone);
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
// Internal type — allows handlers to declare specific desc subtypes while still
// being assignable to the Record annotation (ctx stays typed).
type InternalImpl = (desc: any, ctx: EffectContext) => EffectSignal;

const IMPL: Record<string, InternalImpl> = {

  dealDamage(desc: { target: 'opponent' | 'self'; value: ValueExpr }, ctx) {
    const amount = resolveValue(desc.value, ctx);
    const target = resolveTarget(desc.target, ctx.owner);
    ctx.engine.ui?.playVFX?.('damage', target);
    ctx.engine.dealDamage(target, amount);
    return {};
  },

  gainLP(desc: { target: 'opponent' | 'self'; value: number | ValueExpr }, ctx) {
    const amount = resolveValue(desc.value as ValueExpr, ctx);
    const target = resolveTarget(desc.target, ctx.owner);
    ctx.engine.gainLP(target, amount);
    return {};
  },

  draw(desc: { target: 'self' | 'opponent'; count: number }, ctx) {
    const target = resolveTarget(desc.target, ctx.owner);
    ctx.engine.drawCard(target, desc.count);
    return {};
  },

  buffField(desc: { value: number; filter?: CardFilter }, ctx) {
    const st = ctx.engine.getState();
    const monsters = filterFieldMonsters(st[ctx.owner].field.monsters, desc.filter);
    for (const fm of monsters) {
      fm.permATKBonus = (fm.permATKBonus || 0) + desc.value;
      fm.permDEFBonus = (fm.permDEFBonus || 0) + desc.value;
      const zone = st[ctx.owner].field.monsters.indexOf(fm);
      if (zone !== -1) ctx.engine.ui?.playVFX?.('buff', ctx.owner, zone);
    }
    return {};
  },

  tempBuffField(desc: { value: number; filter?: CardFilter }, ctx) {
    const st = ctx.engine.getState();
    const monsters = filterFieldMonsters(st[ctx.owner].field.monsters, desc.filter);
    for (const fm of monsters) {
      fm.tempATKBonus = (fm.tempATKBonus || 0) + desc.value;
      fm.tempDEFBonus = (fm.tempDEFBonus || 0) + desc.value;
      const zone = st[ctx.owner].field.monsters.indexOf(fm);
      if (zone !== -1) ctx.engine.ui?.playVFX?.('buff', ctx.owner, zone);
    }
    return {};
  },

  debuffField(desc: { atkD: number; defD: number }, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    st[opp].field.monsters.forEach(fm => {
      if (!fm) return;
      if (desc.atkD) fm.permATKBonus = (fm.permATKBonus || 0) - desc.atkD;
      if (desc.defD) fm.permDEFBonus = (fm.permDEFBonus || 0) - desc.defD;
    });
    return {};
  },

  tempDebuffField(desc: { atkD: number; defD?: number }, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const defD = desc.defD ?? desc.atkD;
    st[opp].field.monsters.forEach(fm => {
      if (!fm) return;
      if (desc.atkD) fm.tempATKBonus = (fm.tempATKBonus || 0) - desc.atkD;
      if (defD) fm.tempDEFBonus = (fm.tempDEFBonus || 0) - defD;
    });
    return {};
  },

  bounceStrongestOpp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    const strongest = findMonsterByATK(monsters, 'strongest', { excludeUntargetable: true });
    if (strongest !== null && monsters[strongest]) {
      const fc = monsters[strongest];
      st[opp].hand.push(fc.card);
      monsters[strongest] = null;
      ctx.engine._removeEquipmentForMonster(opp, strongest);
      ctx.engine.addLog(`${fc.card.name} was bounced back to hand!`);
    }
    return {};
  },

  bounceAttacker(_desc: unknown, ctx) {
    if (!ctx.attacker) return {};
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    st[opp].hand.push(ctx.attacker.card);
    const monsters = st[opp].field.monsters;
    const i = monsters.indexOf(ctx.attacker);
    if (i !== -1) { monsters[i] = null; ctx.engine._removeEquipmentForMonster(opp, i); }
    return {};
  },

  bounceAllOppMonsters(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      if (monsters[i]) {
        st[opp].hand.push(monsters[i]!.card);
        monsters[i] = null;
        ctx.engine._removeEquipmentForMonster(opp, i);
      }
    }
    return {};
  },

  searchDeckToHand(desc: { filter: CardFilter }, ctx) {
    const st = ctx.engine.getState();
    const deck = st[ctx.owner].deck;
    const idx = deck.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const [c] = deck.splice(idx, 1);
      st[ctx.owner].hand.push(c);
      ctx.engine.addLog(`${ctx.owner === 'player' ? 'You' : 'Opponent'}: ${c.name} added to hand by effect.`);
    }
    return {};
  },

  tempAtkBonus(desc: { target: StatTarget; value: number }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      fc.tempATKBonus = (fc.tempATKBonus || 0) + desc.value;
      fc.tempDEFBonus = (fc.tempDEFBonus || 0) + desc.value;
      _triggerBuffVFX(fc, ctx);
    }
    return {};
  },

  permAtkBonus(desc: { target: StatTarget; value: number; filter?: CardFilter }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (!fc) return {};
    if (desc.filter && !matchesFilter(fc.card, desc.filter)) return {};
    fc.permATKBonus = (fc.permATKBonus || 0) + desc.value;
    fc.permDEFBonus = (fc.permDEFBonus || 0) + desc.value;
    _triggerBuffVFX(fc, ctx);
    return {};
  },

  tempDefBonus(desc: { target: StatTarget; value: number }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      fc.tempDEFBonus = (fc.tempDEFBonus || 0) + desc.value;
      _triggerBuffVFX(fc, ctx);
    }
    return {};
  },

  permDefBonus(desc: { target: StatTarget; value: number }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      fc.permDEFBonus = (fc.permDEFBonus || 0) + desc.value;
      _triggerBuffVFX(fc, ctx);
    }
    return {};
  },

  reviveFromGrave(_desc: unknown, ctx) {
    if (ctx.targetCard) ctx.engine.specialSummonFromGrave(ctx.owner, ctx.targetCard);
    return {};
  },

  cancelAttack() {
    return { cancelAttack: true };
  },

  cancelEffect() {
    return { cancelEffect: true };
  },

  reflectBattleDamage() {
    return { cancelAttack: true, reflectDamage: true };
  },

  stealMonster(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const oppMonsters = st[opp].field.monsters;
    const idx = findMonsterByATK(oppMonsters, 'strongest', { excludeUntargetable: true });
    if (idx === null || !oppMonsters[idx]) return {};
    const ownMonsters = st[ctx.owner].field.monsters;
    const freeZone = ownMonsters.findIndex(z => z === null);
    if (freeZone === -1) return {};
    const fc = oppMonsters[idx]!;
    oppMonsters[idx] = null;
    ctx.engine._removeEquipmentForMonster(opp, idx);
    ownMonsters[freeZone] = fc;
    fc.hasAttacked = false;
    ctx.engine.addLog(`${fc.card.name} control changed!`);
    return {};
  },

  skipOppDraw(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    ctx.engine.getState().skipNextDraw = opp;
    ctx.engine.addLog(`${opp === 'player' ? 'You' : 'Opponent'} will skip the next Draw Phase!`);
    return {};
  },

  destroyAndDamageBoth(desc: { side: 'opponent' | 'self' }, ctx) {
    const targetOwner = desc.side === 'opponent' ? oppOf(ctx.owner) : ctx.owner;
    const st = ctx.engine.getState();
    const monsters = st[targetOwner].field.monsters;
    const idx = findMonsterByATK(monsters, 'strongest', {});
    if (idx === null || !monsters[idx]) return {};
    const fc = monsters[idx]!;
    const atk = fc.effectiveATK();
    ctx.engine.addLog(`${fc.card.name} is destroyed! Both players take ${atk} damage!`);
    st[targetOwner].graveyard.push(fc.card);
    st[targetOwner].field.monsters[idx] = null;
    ctx.engine._removeEquipmentForMonster(targetOwner, idx);
    ctx.engine.dealDamage('player', atk);
    ctx.engine.dealDamage('opponent', atk);
    return {};
  },

  preventBattleDamage(_desc: unknown, ctx) {
    ctx.engine.getState()[ctx.owner].battleProtection = true;
    ctx.engine.addLog('Battle damage and destruction prevented this turn!');
    return { cancelAttack: true };
  },

  passive_negateTraps(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    if (!st[ctx.owner].fieldFlags) st[ctx.owner].fieldFlags = {};
    st[ctx.owner].fieldFlags!.negateTraps = true;
    ctx.engine.addLog('All Trap effects are negated!');
    return {};
  },

  passive_negateSpells(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    if (!st[ctx.owner].fieldFlags) st[ctx.owner].fieldFlags = {};
    st[ctx.owner].fieldFlags!.negateSpells = true;
    ctx.engine.addLog('All Spell effects are negated!');
    return {};
  },

  passive_negateMonsterEffects(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    if (!st[ctx.owner].fieldFlags) st[ctx.owner].fieldFlags = {};
    st[ctx.owner].fieldFlags!.negateMonsterEffects = true;
    ctx.engine.addLog('All monster effects are negated!');
    return {};
  },

  stealMonsterTemp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const oppMonsters = st[opp].field.monsters;
    const idx = findMonsterByATK(oppMonsters, 'strongest', { excludeUntargetable: true });
    if (idx === null || !oppMonsters[idx]) return {};
    const ownMonsters = st[ctx.owner].field.monsters;
    const freeZone = ownMonsters.findIndex(z => z === null);
    if (freeZone === -1) return {};
    const fc = oppMonsters[idx]!;
    oppMonsters[idx] = null;
    ctx.engine._removeEquipmentForMonster(opp, idx);
    fc.originalOwner = opp;
    fc.hasAttacked = false;
    ownMonsters[freeZone] = fc;
    ctx.engine.addLog(`${fc.card.name} is temporarily under your control!`);
    return {};
  },

  reviveFromEitherGrave(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    const ownGY = st[ctx.owner].graveyard;
    const oppGY = st[oppOf(ctx.owner)].graveyard;
    let bestIdx = -1;
    let bestAtk = -1;
    let fromOwner: Owner = ctx.owner;
    for (let i = 0; i < ownGY.length; i++) {
      if (ownGY[i].type === CardType.Monster || ownGY[i].type === CardType.Fusion) {
        if ((ownGY[i].atk ?? 0) > bestAtk) { bestAtk = ownGY[i].atk ?? 0; bestIdx = i; fromOwner = ctx.owner; }
      }
    }
    for (let i = 0; i < oppGY.length; i++) {
      if (oppGY[i].type === CardType.Monster || oppGY[i].type === CardType.Fusion) {
        if ((oppGY[i].atk ?? 0) > bestAtk) { bestAtk = oppGY[i].atk ?? 0; bestIdx = i; fromOwner = oppOf(ctx.owner); }
      }
    }
    if (bestIdx >= 0) {
      const gy = st[fromOwner].graveyard;
      const [card] = gy.splice(bestIdx, 1);
      ctx.engine.specialSummon(ctx.owner, card);
    }
    return {};
  },

  drawThenDiscard(desc: { drawCount: number; discardCount: number }, ctx) {
    ctx.engine.drawCard(ctx.owner, desc.drawCount);
    const st = ctx.engine.getState();
    const hand = st[ctx.owner].hand;
    const toDiscard = Math.min(desc.discardCount, hand.length);
    for (let i = 0; i < toDiscard; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      st[ctx.owner].graveyard.push(c);
    }
    ctx.engine.addLog(`Drew ${desc.drawCount}, discarded ${toDiscard}.`);
    return {};
  },

  bounceOppHandToDeck(desc: { count: number }, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const hand = st[opp].hand;
    const toReturn = Math.min(desc.count, hand.length);
    for (let i = 0; i < toReturn; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      st[opp].deck.push(c);
    }
    if (toReturn > 0) ctx.engine.addLog(`${toReturn} card(s) shuffled back into opponent's deck.`);
    return {};
  },

  tributeSelf(_desc: unknown, _ctx) {
    return {};
  },

  preventAttacks(desc: { turns: number }, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    if (!st[opp].turnCounters) st[opp].turnCounters = [];
    st[opp].turnCounters!.push({ turnsRemaining: desc.turns, effect: 'preventAttacks' });
    ctx.engine.addLog(`Opponent cannot attack for ${desc.turns} turns!`);
    return {};
  },

  discardEntireHand(desc: { target: 'self' | 'opponent' | 'both' }, ctx) {
    const state = ctx.engine.getState();
    const discard = (owner: Owner) => {
      const st = state[owner];
      while (st.hand.length > 0) {
        st.graveyard.push(st.hand.pop()!);
      }
      ctx.engine.addLog(`${owner === 'player' ? 'You' : 'Opponent'} discarded entire hand.`);
    };
    if (desc.target === 'self' || desc.target === 'both') discard(ctx.owner);
    if (desc.target === 'opponent' || desc.target === 'both') discard(oppOf(ctx.owner));
    return {};
  },

  destroyAttacker() {
    return { cancelAttack: true, destroyAttacker: true };
  },

  destroySummonedIf(desc: { minAtk: number }, ctx) {
    if (ctx.summonedFC && ctx.summonedFC.card.atk !== undefined && ctx.summonedFC.card.atk >= desc.minAtk) {
      ctx.engine.addLog(`Trap! ${ctx.summonedFC.card.name} is destroyed!`);
      return { destroySummoned: true };
    }
    return {};
  },

  destroyAllOpp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      if (monsters[i]) {
        st[opp].graveyard.push(monsters[i]!.card);
        monsters[i] = null;
        ctx.engine._removeEquipmentForMonster(opp, i);
      }
    }
    ctx.engine.addLog('All opponent monsters destroyed!');
    return {};
  },

  destroyAll(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    for (const side of ['player', 'opponent'] as Owner[]) {
      const monsters = st[side].field.monsters;
      for (let i = 0; i < monsters.length; i++) {
        if (monsters[i]) {
          st[side].graveyard.push(monsters[i]!.card);
          monsters[i] = null;
          ctx.engine._removeEquipmentForMonster(side, i);
        }
      }
    }
    ctx.engine.addLog('All monsters on both sides destroyed!');
    return {};
  },

  destroyWeakestOpp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    const weakestIdx = findMonsterByATK(monsters, 'weakest');
    if (weakestIdx !== null && monsters[weakestIdx]) {
      const fc = monsters[weakestIdx];
      st[opp].graveyard.push(fc.card);
      monsters[weakestIdx] = null;
      ctx.engine._removeEquipmentForMonster(opp, weakestIdx);
      ctx.engine.addLog(`${fc.card.name} (weakest) destroyed!`);
    }
    return {};
  },

  destroyStrongestOpp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    const strongestIdx = findMonsterByATK(monsters, 'strongest');
    if (strongestIdx !== null && monsters[strongestIdx]) {
      const fc = monsters[strongestIdx];
      st[opp].graveyard.push(fc.card);
      monsters[strongestIdx] = null;
      ctx.engine._removeEquipmentForMonster(opp, strongestIdx);
      ctx.engine.addLog(`${fc.card.name} (strongest) destroyed!`);
    }
    return {};
  },

  sendTopCardsToGrave(desc: { count: number }, ctx) {
    const st = ctx.engine.getState();
    const deck = st[ctx.owner].deck;
    const count = Math.min(desc.count, deck.length);
    const cards = deck.splice(0, count);
    st[ctx.owner].graveyard.push(...cards);
    ctx.engine.addLog(`${count} card(s) sent from deck to graveyard.`);
    return {};
  },

  sendTopCardsToGraveOpp(desc: { count: number }, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const deck = st[opp].deck;
    const count = Math.min(desc.count, deck.length);
    const cards = deck.splice(0, count);
    st[opp].graveyard.push(...cards);
    ctx.engine.addLog(`${count} card(s) from opponent's deck sent to graveyard.`);
    return {};
  },

  salvageFromGrave(desc: { filter: CardFilter }, ctx) {
    const st = ctx.engine.getState();
    const grave = st[ctx.owner].graveyard;
    const idx = grave.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const [c] = grave.splice(idx, 1);
      st[ctx.owner].hand.push(c);
      ctx.engine.addLog(`${c.name} salvaged from graveyard to hand.`);
    }
    return {};
  },

  recycleFromGraveToDeck(desc: { filter: CardFilter }, ctx) {
    const st = ctx.engine.getState();
    const grave = st[ctx.owner].graveyard;
    const idx = grave.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const [c] = grave.splice(idx, 1);
      st[ctx.owner].deck.push(c);
      ctx.engine.addLog(`${c.name} recycled from graveyard to deck.`);
    }
    return {};
  },

  shuffleGraveIntoDeck(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    const ps = st[ctx.owner];
    ps.deck.push(...ps.graveyard);
    ps.graveyard.length = 0;
    shuffleArray(ps.deck);
    ctx.engine.addLog('Graveyard shuffled back into deck.');
    return {};
  },

  shuffleDeck(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    shuffleArray(st[ctx.owner].deck);
    ctx.engine.addLog('Deck shuffled.');
    return {};
  },

  peekTopCard(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    const deck = st[ctx.owner].deck;
    if (deck.length > 0) {
      ctx.engine.addLog(`Top card: ${deck[0].name}`);
    } else {
      ctx.engine.addLog('Deck is empty!');
    }
    return {};
  },

  specialSummonFromHand(desc: { filter?: CardFilter }, ctx) {
    const st = ctx.engine.getState();
    const hand = st[ctx.owner].hand;
    const idx = desc.filter
      ? hand.findIndex(c => matchesFilter(c, desc.filter!))
      : hand.findIndex(c => c.type === CardType.Monster || c.type === CardType.Fusion);
    if (idx !== -1) {
      const [card] = hand.splice(idx, 1);
      ctx.engine.specialSummon(ctx.owner, card);
    }
    return {};
  },

  discardFromHand(desc: { count: number }, ctx) {
    const st = ctx.engine.getState();
    const hand = st[ctx.owner].hand;
    const count = Math.min(desc.count, hand.length);
    for (let i = 0; i < count && hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      st[ctx.owner].graveyard.push(c);
    }
    if (count > 0) ctx.engine.addLog(`${count} card(s) discarded from hand.`);
    return {};
  },

  discardOppHand(desc: { count: number }, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const hand = st[opp].hand;
    const count = Math.min(desc.count, hand.length);
    for (let i = 0; i < count && hand.length > 0; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      const [c] = hand.splice(idx, 1);
      st[opp].graveyard.push(c);
    }
    if (count > 0) ctx.engine.addLog(`${count} card(s) discarded from opponent's hand.`);
    return {};
  },

  destroyOppSpellTrap(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const zones = st[opp].field.spellTraps;
    for (let i = 0; i < zones.length; i++) {
      if (zones[i]) {
        ctx.engine.addLog(`${zones[i]!.card.name} was destroyed!`);
        st[opp].graveyard.push(zones[i]!.card);
        zones[i] = null;
        ctx.engine._removeEquipmentForMonster(opp, i);
        break;
      }
    }
    return {};
  },

  destroyAllOppSpellTraps(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const zones = st[opp].field.spellTraps;
    for (let i = 0; i < zones.length; i++) {
      if (zones[i]) {
        ctx.engine.addLog(`${zones[i]!.card.name} was destroyed!`);
        st[opp].graveyard.push(zones[i]!.card);
        zones[i] = null;
      }
    }
    return {};
  },

  destroyAllSpellTraps(_desc: unknown, ctx) {
    const st = ctx.engine.getState();
    for (const side of ['player', 'opponent'] as Owner[]) {
      const zones = st[side].field.spellTraps;
      for (let i = 0; i < zones.length; i++) {
        if (zones[i]) {
          ctx.engine.addLog(`${zones[i]!.card.name} was destroyed!`);
          st[side].graveyard.push(zones[i]!.card);
          zones[i] = null;
        }
      }
    }
    return {};
  },

  destroyOppFieldSpell(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    ctx.engine._removeFieldSpell(opp);
    return {};
  },

  changePositionOpp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    const idx = findMonsterByATK(monsters, 'strongest');
    if (idx !== null && monsters[idx]) {
      const fc = monsters[idx]!;
      fc.position = fc.position === 'atk' ? 'def' : 'atk';
      ctx.engine.addLog(`${fc.card.name} position changed to ${fc.position.toUpperCase()}!`);
    }
    return {};
  },

  setFaceDown(_desc: unknown, ctx) {
    if (!ctx.targetFC) return {};
    ctx.targetFC.faceDown = true;
    ctx.targetFC.position = 'def';
    ctx.targetFC.hasFlipped = false;
    ctx.engine.addLog(`${ctx.targetFC.card.name} was set face-down!`);
    return {};
  },

  flipAllOppFaceDown(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    for (const fc of st[opp].field.monsters) {
      if (fc && !fc.faceDown) {
        fc.faceDown = true;
        fc.position = 'def';
        fc.hasFlipped = false;
      }
    }
    ctx.engine.addLog('All opponent monsters set face-down!');
    return {};
  },

  destroyByFilter(desc: { filter?: CardFilter; mode: 'weakest' | 'strongest' | 'highestDef' | 'first'; side?: 'opponent' | 'self' }, ctx) {
    const side = desc.side === 'self' ? ctx.owner : oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[side].field.monsters;
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
      st[side].graveyard.push(fc.card);
      monsters[idx] = null;
      ctx.engine._removeEquipmentForMonster(side, idx);
      ctx.engine.addLog(`${fc.card.name} was destroyed!`);
    }
    return {};
  },

  halveAtk(desc: { target: StatTarget }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      const half = Math.floor(fc.effectiveATK() / 2);
      const reduction = fc.effectiveATK() - half;
      fc.tempATKBonus = (fc.tempATKBonus || 0) - reduction;
      ctx.engine.addLog(`${fc.card.name}'s ATK halved!`);
    }
    return {};
  },

  doubleAtk(desc: { target: StatTarget }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) {
      const current = fc.effectiveATK();
      fc.tempATKBonus = (fc.tempATKBonus || 0) + current;
      _triggerBuffVFX(fc, ctx);
      ctx.engine.addLog(`${fc.card.name}'s ATK doubled!`);
    }
    return {};
  },

  swapAtkDef(desc: { side: 'self' | 'opponent' | 'all' }, ctx) {
    const st = ctx.engine.getState();
    const sides: Owner[] = desc.side === 'all'
      ? ['player', 'opponent']
      : [desc.side === 'self' ? ctx.owner : oppOf(ctx.owner)];
    for (const side of sides) {
      for (const fc of st[side].field.monsters) {
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
    ctx.engine.addLog('ATK and DEF values swapped!');
    return {};
  },

  specialSummonFromDeck(desc: { filter: CardFilter; faceDown?: boolean; position?: string }, ctx) {
    const st = ctx.engine.getState();
    const deck = st[ctx.owner].deck;
    const idx = deck.findIndex(c => matchesFilter(c, desc.filter));
    if (idx !== -1) {
      const [card] = deck.splice(idx, 1);
      const pos = (desc.position ?? 'atk') as 'atk' | 'def';
      ctx.engine.specialSummon(ctx.owner, card, undefined, pos, !!desc.faceDown);
      ctx.engine.addLog(`${card.name} special summoned from deck${desc.faceDown ? ' face-down' : ''}!`);
    }
    return {};
  },

  passive_piercing()       { return {}; },
  passive_untargetable()   { return {}; },
  passive_directAttack()   { return {}; },
  passive_vsAttrBonus()    { return {}; },
  passive_phoenixRevival() { return {}; },
  passive_indestructible() { return {}; },
  passive_effectImmune()   { return {}; },
  passive_cantBeAttacked() { return {}; },
};

export const EFFECT_REGISTRY = new Map<string, EffectImpl>(
  Object.entries(IMPL) as [string, EffectImpl][],
);

export function registerEffect(type: string, impl: EffectImpl): void {
  EFFECT_REGISTRY.set(type, impl);
}

export function canPayCost(block: CardEffectBlock, ctx: EffectContext): boolean {
  if (!block.cost) return true;
  const st = ctx.engine.getState()[ctx.owner];
  if (block.cost.lp && st.lp <= block.cost.lp) return false;
  if (block.cost.discard && st.hand.length < block.cost.discard) return false;
  return true;
}

function payCost(block: CardEffectBlock, ctx: EffectContext): void {
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
    const state = ctx.engine.getState();
    const monsters = state[ctx.owner].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      const fc = monsters[i];
      if (fc && fc.card.effect?.actions.some(a => a.type === block.actions[0]?.type)) {
        state[ctx.owner].graveyard.push(fc.card);
        monsters[i] = null;
        ctx.engine._removeEquipmentForMonster(ctx.owner, i);
        ctx.engine.addLog(`${fc.card.name} was tributed as cost.`);
        break;
      }
    }
  }
}

export function executeEffectBlock(block: CardEffectBlock, ctx: EffectContext): EffectSignal {
  if (!canPayCost(block, ctx)) {
    ctx.engine.addLog('Cannot pay effect cost!');
    return {};
  }
  payCost(block, ctx);

  const signal: EffectSignal = {};
  for (const action of block.actions) {
    const impl = EFFECT_REGISTRY.get(action.type);
    if (impl) {
      Object.assign(signal, impl(action, ctx));
    } else {
      console.warn(`[EffectRegistry] No handler for effect type: "${action.type}" — skipping.`);
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
