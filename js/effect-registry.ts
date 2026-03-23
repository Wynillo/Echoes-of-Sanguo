// ============================================================
// ECHOES OF SANGUO — Effect Registry & Interpreter
// Data-driven effect execution: EffectDescriptor → EffectSignal
// ============================================================

import {
  Attribute, Race,
  type EffectDescriptor, type EffectContext, type EffectSignal, type CardEffectBlock,
  type ValueExpr, type StatTarget, type Owner, type FieldCard,
} from './types.js';

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
  return owner === 'player' ? 'opponent' : 'player';
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

// ── Effect Implementations ──────────────────────────────────

type EffectImpl = (desc: any, ctx: EffectContext) => EffectSignal;

const IMPL: Record<string, EffectImpl> = {

  dealDamage(desc: { target: 'opponent' | 'self'; value: ValueExpr }, ctx) {
    const amount = resolveValue(desc.value, ctx);
    const target = resolveTarget(desc.target, ctx.owner);
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

  buffAtkRace(desc: { race: Race; value: number }, ctx) {
    const st = ctx.engine.getState();
    st[ctx.owner].field.monsters.forEach(fm => {
      if (fm && fm.card.race === desc.race) fm.permATKBonus = (fm.permATKBonus || 0) + desc.value;
    });
    return {};
  },

  buffAtkAttr(desc: { attr: Attribute; value: number }, ctx) {
    const st = ctx.engine.getState();
    st[ctx.owner].field.monsters.forEach(fm => {
      if (fm && fm.card.attribute === desc.attr) fm.permATKBonus = (fm.permATKBonus || 0) + desc.value;
    });
    return {};
  },

  tempBuffAtkRace(desc: { race: Race; value: number }, ctx) {
    const st = ctx.engine.getState();
    st[ctx.owner].field.monsters.forEach(fm => {
      if (fm && fm.card.race === desc.race) fm.tempATKBonus = (fm.tempATKBonus || 0) + desc.value;
    });
    return {};
  },

  tempDebuffAllOpp(desc: { atkD: number; defD?: number }, ctx) {
    const opp: Owner = ctx.owner === 'player' ? 'opponent' : 'player';
    const st = ctx.engine.getState();
    st[opp].field.monsters.forEach(fm => {
      if (!fm) return;
      if (desc.atkD) fm.tempATKBonus = (fm.tempATKBonus || 0) - desc.atkD;
      if (desc.defD) fm.tempDEFBonus = (fm.tempDEFBonus || 0) - desc.defD;
    });
    return {};
  },

  debuffAllOpp(desc: { atkD: number; defD: number }, ctx) {
    const opp: Owner = ctx.owner === 'player' ? 'opponent' : 'player';
    const st = ctx.engine.getState();
    st[opp].field.monsters.forEach(fm => {
      if (!fm) return;
      if (desc.atkD) fm.permATKBonus = (fm.permATKBonus || 0) - desc.atkD;
      if (desc.defD) fm.permDEFBonus = (fm.permDEFBonus || 0) - desc.defD;
    });
    return {};
  },

  bounceStrongestOpp(_desc: unknown, ctx) {
    const opp: Owner = ctx.owner === 'player' ? 'opponent' : 'player';
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    let strongest: number | null = null;
    monsters.forEach((fm, i) => {
      if (!fm) return;
      if (strongest === null || fm.effectiveATK() > monsters[strongest]!.effectiveATK()) strongest = i;
    });
    if (strongest !== null && monsters[strongest]) {
      const fc = monsters[strongest]!;
      st[opp].hand.push(fc.card);
      monsters[strongest] = null;
      ctx.engine.addLog(`${fc.card.name} wurde auf die Hand zurückgespielt!`);
    }
    return {};
  },

  bounceAttacker(_desc: unknown, ctx) {
    if (!ctx.attacker) return {};
    const opp: Owner = ctx.owner === 'player' ? 'opponent' : 'player';
    const st = ctx.engine.getState();
    st[opp].hand.push(ctx.attacker.card);
    const monsters = st[opp].field.monsters;
    const i = monsters.indexOf(ctx.attacker);
    if (i !== -1) monsters[i] = null;
    return {};
  },

  bounceAllOppMonsters(_desc: unknown, ctx) {
    const opp: Owner = ctx.owner === 'player' ? 'opponent' : 'player';
    const st = ctx.engine.getState();
    const monsters = st[opp].field.monsters;
    for (let i = 0; i < monsters.length; i++) {
      if (monsters[i]) {
        st[opp].hand.push(monsters[i]!.card);
        monsters[i] = null;
      }
    }
    return {};
  },

  searchDeckToHand(desc: { attr: Attribute }, ctx) {
    const st = ctx.engine.getState();
    const deck = st[ctx.owner].deck;
    const idx = deck.findIndex(c => c.attribute === desc.attr);
    if (idx !== -1) {
      const [c] = deck.splice(idx, 1);
      st[ctx.owner].hand.push(c);
      ctx.engine.addLog(`${ctx.owner === 'player' ? 'Du' : 'Gegner'}: ${c.name} durch Effekt auf die Hand genommen.`);
    }
    return {};
  },

  tempAtkBonus(desc: { target: StatTarget; value: number }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) fc.tempATKBonus = (fc.tempATKBonus || 0) + desc.value;
    return {};
  },

  permAtkBonus(desc: { target: StatTarget; value: number; attrFilter?: Attribute }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (!fc) return {};
    if (desc.attrFilter && fc.card?.attribute !== desc.attrFilter) return {};
    fc.permATKBonus = (fc.permATKBonus || 0) + desc.value;
    return {};
  },

  tempDefBonus(desc: { target: StatTarget; value: number }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) fc.tempDEFBonus = (fc.tempDEFBonus || 0) + desc.value;
    return {};
  },

  permDefBonus(desc: { target: StatTarget; value: number }, ctx) {
    const fc = resolveStatTarget(desc.target, ctx);
    if (fc) fc.permDEFBonus = (fc.permDEFBonus || 0) + desc.value;
    return {};
  },

  reviveFromGrave(_desc: unknown, ctx) {
    if (ctx.targetCard) ctx.engine.specialSummonFromGrave(ctx.owner, ctx.targetCard);
    return {};
  },

  cancelAttack() {
    return { cancelAttack: true };
  },

  destroyAttacker() {
    return { cancelAttack: true, destroyAttacker: true };
  },

  destroySummonedIf(desc: { minAtk: number }, ctx) {
    if (ctx.summonedFC && ctx.summonedFC.card.atk !== undefined && ctx.summonedFC.card.atk >= desc.minAtk) {
      ctx.engine.addLog(`Falle! ${ctx.summonedFC.card.name} wird zerstört!`);
      return { destroySummoned: true };
    }
    return {};
  },

  // Passive flags — no-op at runtime (read at FieldCard construction)
  passive_piercing()      { return {}; },
  passive_untargetable()  { return {}; },
  passive_directAttack()  { return {}; },
  passive_vsAttrBonus()   { return {}; },
  passive_phoenixRevival(){ return {}; },
};

// ── Public Registry ─────────────────────────────────────────

export const EFFECT_REGISTRY = new Map<string, EffectImpl>(Object.entries(IMPL));

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
} {
  const flags = {
    piercing: false,
    cannotBeTargeted: false,
    canDirectAttack: false,
    vsAttrBonus: null as { attr: Attribute; atk: number } | null,
    phoenixRevival: false,
  };
  for (const action of block.actions) {
    switch (action.type) {
      case 'passive_piercing':      flags.piercing = true; break;
      case 'passive_untargetable':  flags.cannotBeTargeted = true; break;
      case 'passive_directAttack':  flags.canDirectAttack = true; break;
      case 'passive_vsAttrBonus':   flags.vsAttrBonus = { attr: action.attr, atk: action.atk }; break;
      case 'passive_phoenixRevival':flags.phoenixRevival = true; break;
    }
  }
  return flags;
}
