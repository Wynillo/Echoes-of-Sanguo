// ============================================================
// ECHOES OF SANGUO — Effect Registry & Interpreter
// Data-driven effect execution: EffectDescriptor → EffectSignal
// ============================================================

import {
  Attribute, CardType,
  type CardData, type CardFilter,
  type EffectDescriptor, type EffectContext, type EffectSignal, type CardEffectBlock,
  type ValueExpr, type StatTarget, type Owner, type FieldCard,
} from './types.js';

// ── CardFilter Utilities ─────────────────────────────────────

/** Check if a card matches a CardFilter */
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

/** Filter FieldCards on a field by CardFilter */
function filterFieldMonsters(monsters: Array<FieldCard | null>, filter?: CardFilter): FieldCard[] {
  let result = monsters.filter((fm): fm is FieldCard => fm !== null);
  if (filter) result = result.filter(fm => matchesFilter(fm.card, filter));
  if (filter?.random !== undefined && filter.random > 0) {
    const shuffled = [...result].sort(() => Math.random() - 0.5);
    result = shuffled.slice(0, Math.min(filter.random, result.length));
  }
  return result;
}


/** Get opponent Owner */
function oppOf(owner: Owner): Owner {
  return owner === 'player' ? 'opponent' : 'player';
}

// ── Value Resolution ────────────────────────────────────────

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

/** Resolve a StatTarget to the actual FieldCard from context */
function resolveStatTarget(target: StatTarget, ctx: EffectContext): FieldCard | null {
  if (target === 'attacker')    return ctx.attacker ?? null;
  if (target === 'defender')    return ctx.defender ?? null;
  if (target === 'summonedFC')  return ctx.summonedFC ?? null;
  if (target === 'ownMonster')  return ctx.targetFC ?? null;
  if (target === 'oppMonster')  return ctx.targetFC ?? null;
  return null;
}

/** Fisher-Yates shuffle in place */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── VFX Helper ──────────────────────────────────────────────

/** Fire a buff VFX on the zone where a FieldCard sits */
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

// ── Effect Implementations ──────────────────────────────────

// Public API type — call sites receive EffectDescriptor (no `any`)
export type EffectImpl = (desc: EffectDescriptor, ctx: EffectContext) => EffectSignal;
// Internal type — allows handlers to declare specific desc subtypes while still
// being assignable to the Record annotation (ctx stays typed).
type InternalImpl = (desc: any, ctx: EffectContext) => EffectSignal;

const IMPL: Record<string, InternalImpl> = {

  // ─── Damage & Healing ─────────────────────────────────────

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

  // ─── Card Draw ────────────────────────────────────────────

  draw(desc: { target: 'self' | 'opponent'; count: number }, ctx) {
    const target = resolveTarget(desc.target, ctx.owner);
    ctx.engine.drawCard(target, desc.count);
    return {};
  },

  // ─── Field-wide Buffs/Debuffs (unified with CardFilter) ──

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

  // ─── Bounce ───────────────────────────────────────────────

  bounceStrongestOpp(_desc: unknown, ctx) {
    const opp = oppOf(ctx.owner);
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    let strongest: number | null = null;
    monsters.forEach((fm, i) => {
      if (!fm || fm.cannotBeTargeted) return;
      if (strongest === null || fm.effectiveATK() > monsters[strongest]!.effectiveATK()) strongest = i;
    });
    if (strongest !== null && monsters[strongest]) {
      const fc = monsters[strongest]!;
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

  // ─── Search ───────────────────────────────────────────────

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

  // ─── Targeted Stat Modification ───────────────────────────

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

  // ─── Graveyard ────────────────────────────────────────────

  reviveFromGrave(_desc: unknown, ctx) {
    if (ctx.targetCard) ctx.engine.specialSummonFromGrave(ctx.owner, ctx.targetCard);
    return {};
  },

  // ─── Trap Signals ─────────────────────────────────────────

  cancelAttack() {
    return { cancelAttack: true };
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

  // ─── Destruction Effects ──────────────────────────────────

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
    let weakestIdx: number | null = null;
    monsters.forEach((fm, i) => {
      if (!fm) return;
      if (weakestIdx === null || fm.effectiveATK() < monsters[weakestIdx]!.effectiveATK()) weakestIdx = i;
    });
    if (weakestIdx !== null && monsters[weakestIdx]) {
      const fc = monsters[weakestIdx]!;
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
    let strongestIdx: number | null = null;
    monsters.forEach((fm, i) => {
      if (!fm) return;
      if (strongestIdx === null || fm.effectiveATK() > monsters[strongestIdx]!.effectiveATK()) strongestIdx = i;
    });
    if (strongestIdx !== null && monsters[strongestIdx]) {
      const fc = monsters[strongestIdx]!;
      st[opp].graveyard.push(fc.card);
      monsters[strongestIdx] = null;
      ctx.engine._removeEquipmentForMonster(opp, strongestIdx);
      ctx.engine.addLog(`${fc.card.name} (strongest) destroyed!`);
    }
    return {};
  },

  // ─── Graveyard & Deck Manipulation ────────────────────────

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

  // ─── Special Summon ───────────────────────────────────────

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

  // ─── Hand Manipulation ────────────────────────────────────

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

  // ─── Passive Flags (no-op at runtime; read at FieldCard construction) ──

  passive_piercing()       { return {}; },
  passive_untargetable()   { return {}; },
  passive_directAttack()   { return {}; },
  passive_vsAttrBonus()    { return {}; },
  passive_phoenixRevival() { return {}; },
  passive_indestructible() { return {}; },
  passive_effectImmune()   { return {}; },
  passive_cantBeAttacked() { return {}; },
};

// ── Public Registry ─────────────────────────────────────────

export const EFFECT_REGISTRY = new Map<string, EffectImpl>(
  Object.entries(IMPL) as [string, EffectImpl][],
);

/** Register a custom effect type (for mods) */
export function registerEffect(type: string, impl: EffectImpl): void {
  EFFECT_REGISTRY.set(type, impl);
}

// ── Interpreter ─────────────────────────────────────────────

/** Execute a CardEffectBlock and return the combined signal */
export function executeEffectBlock(block: CardEffectBlock, ctx: EffectContext): EffectSignal {
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

/** Check if a CardEffectBlock contains passive flags and extract them */
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
