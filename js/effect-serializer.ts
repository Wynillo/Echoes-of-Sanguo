// ============================================================
// ECHOES OF SANGUO — Effect Serializer/Deserializer (TCG Format)
// Converts CardEffectBlock ↔ compact string notation
//
// Format: "trigger:action1(args);action2(args)"
// Examples:
//   "onSummon:dealDamage(opponent,300)"
//   "passive:passive_piercing()"
//   "onSummon:buffField(200,{r=3})"
//   "onAttack:dealDamage(opponent,attacker.effectiveATK*0.5f);cancelAttack()"
// ============================================================

import { type CardEffectBlock, type CardFilter, type EffectDescriptor, type EffectTrigger, type TrapTrigger, type ValueExpr, type StatTarget } from './types.js';
import { isValidTrigger, intToAttribute, intToRace, attributeToInt, raceToInt, cardTypeToInt, intToCardType } from './enums.js';

// ── ValueExpr Serialization ──────────────────────────────────

function serializeValueExpr(v: ValueExpr): string {
  if (typeof v === 'number') return String(v);
  const roundSuffix = v.round === 'floor' ? 'f' : 'c';
  return `${v.from}*${v.multiply}${roundSuffix}`;
}

function deserializeValueExpr(s: string): ValueExpr {
  const n = Number(s);
  if (!isNaN(n)) return n;

  const m = s.match(/^([\w.]+)\*([0-9.]+)([fc])$/);
  if (!m) throw new Error(`Invalid ValueExpr: ${s}`);

  const from = m[1];
  if (from !== 'attacker.effectiveATK' && from !== 'summoned.atk') {
    throw new Error(`Unknown ValueExpr source: ${from}`);
  }
  return {
    from,
    multiply: parseFloat(m[2]),
    round: m[3] === 'f' ? 'floor' : 'ceil',
  };
}

// ── CardFilter Serialization ─────────────────────────────────
// Format: {r=3,a=1,maxAtk=1500,ct=1,id=card123,rnd=2}

function serializeCardFilter(f: CardFilter): string {
  const parts: string[] = [];
  if (f.race     !== undefined) parts.push(`r=${raceToInt(f.race)}`);
  if (f.attr     !== undefined) parts.push(`a=${attributeToInt(f.attr)}`);
  if (f.cardType !== undefined) parts.push(`ct=${cardTypeToInt(f.cardType)}`);
  if (f.cardId   !== undefined) parts.push(`id=${f.cardId}`);
  if (f.maxAtk   !== undefined) parts.push(`maxAtk=${f.maxAtk}`);
  if (f.minAtk   !== undefined) parts.push(`minAtk=${f.minAtk}`);
  if (f.maxDef   !== undefined) parts.push(`maxDef=${f.maxDef}`);
  if (f.maxLevel !== undefined) parts.push(`maxLevel=${f.maxLevel}`);
  if (f.minLevel !== undefined) parts.push(`minLevel=${f.minLevel}`);
  if (f.random   !== undefined) parts.push(`rnd=${f.random}`);
  return `{${parts.join(',')}}`;
}

function deserializeCardFilter(s: string): CardFilter {
  // Strip braces
  const inner = s.slice(1, -1);
  if (inner.trim() === '') return {};
  const filter: CardFilter = {};
  for (const pair of inner.split(',')) {
    const [key, val] = pair.split('=');
    switch (key.trim()) {
      case 'r':        filter.race = intToRace(parseInt(val)); break;
      case 'a':        filter.attr = intToAttribute(parseInt(val)); break;
      case 'ct':       filter.cardType = intToCardType(parseInt(val), false); break;
      case 'id':       filter.cardId = val.trim(); break;
      case 'maxAtk':   filter.maxAtk = parseInt(val); break;
      case 'minAtk':   filter.minAtk = parseInt(val); break;
      case 'maxDef':   filter.maxDef = parseInt(val); break;
      case 'maxLevel': filter.maxLevel = parseInt(val); break;
      case 'minLevel': filter.minLevel = parseInt(val); break;
      case 'rnd':      filter.random = parseInt(val); break;
      default: throw new Error(`Unknown CardFilter key: ${key}`);
    }
  }
  return filter;
}

function isCardFilterEmpty(f: CardFilter): boolean {
  return Object.keys(f).length === 0;
}

// ── Action Serialization ─────────────────────────────────────

const STAT_TARGETS = new Set<string>(['ownMonster', 'oppMonster', 'attacker', 'defender', 'summonedFC']);

function asStatTarget(s: string): StatTarget {
  if (!STAT_TARGETS.has(s)) throw new Error(`Invalid StatTarget: ${s}`);
  return s as StatTarget;
}

function serializeAction(a: EffectDescriptor): string {
  switch (a.type) {
    // Damage & healing
    case 'dealDamage':              return `dealDamage(${a.target},${serializeValueExpr(a.value)})`;
    case 'gainLP':                  return `gainLP(${a.target},${serializeValueExpr(a.value)})`;
    // Card draw
    case 'draw':                    return `draw(${a.target},${a.count})`;
    // Field buffs/debuffs (unified)
    case 'buffField':               return `buffField(${a.value}${a.filter && !isCardFilterEmpty(a.filter) ? `,${serializeCardFilter(a.filter)}` : ''})`;
    case 'tempBuffField':           return `tempBuffField(${a.value}${a.filter && !isCardFilterEmpty(a.filter) ? `,${serializeCardFilter(a.filter)}` : ''})`;
    case 'debuffField':             return `debuffField(${a.atkD},${a.defD})`;
    case 'tempDebuffField':         return `tempDebuffField(${a.atkD}${a.defD !== undefined ? `,${a.defD}` : ''})`;
    // Bounce
    case 'bounceStrongestOpp':      return 'bounceStrongestOpp()';
    case 'bounceAttacker':          return 'bounceAttacker()';
    case 'bounceAllOppMonsters':    return 'bounceAllOppMonsters()';
    // Search
    case 'searchDeckToHand':        return `searchDeckToHand(${serializeCardFilter(a.filter)})`;
    // Targeted stat modification
    case 'tempAtkBonus':            return `tempAtkBonus(${a.target},${a.value})`;
    case 'permAtkBonus':            return `permAtkBonus(${a.target},${a.value}${a.filter && !isCardFilterEmpty(a.filter) ? `,${serializeCardFilter(a.filter)}` : ''})`;
    case 'tempDefBonus':            return `tempDefBonus(${a.target},${a.value})`;
    case 'permDefBonus':            return `permDefBonus(${a.target},${a.value})`;
    // Graveyard
    case 'reviveFromGrave':         return 'reviveFromGrave()';
    // Trap signals
    case 'cancelAttack':            return 'cancelAttack()';
    case 'destroyAttacker':         return 'destroyAttacker()';
    case 'destroySummonedIf':       return `destroySummonedIf(${a.minAtk})`;
    // Destruction
    case 'destroyAllOpp':           return 'destroyAllOpp()';
    case 'destroyAll':              return 'destroyAll()';
    case 'destroyWeakestOpp':       return 'destroyWeakestOpp()';
    case 'destroyStrongestOpp':     return 'destroyStrongestOpp()';
    // Graveyard & Deck manipulation
    case 'sendTopCardsToGrave':     return `sendTopCardsToGrave(${a.count})`;
    case 'sendTopCardsToGraveOpp':  return `sendTopCardsToGraveOpp(${a.count})`;
    case 'salvageFromGrave':        return `salvageFromGrave(${serializeCardFilter(a.filter)})`;
    case 'recycleFromGraveToDeck':  return `recycleFromGraveToDeck(${serializeCardFilter(a.filter)})`;
    case 'shuffleGraveIntoDeck':    return 'shuffleGraveIntoDeck()';
    case 'shuffleDeck':             return 'shuffleDeck()';
    case 'peekTopCard':             return 'peekTopCard()';
    // Special Summon
    case 'specialSummonFromHand':   return `specialSummonFromHand(${a.filter ? serializeCardFilter(a.filter) : ''})`;
    // Hand manipulation
    case 'discardFromHand':         return `discardFromHand(${a.count})`;
    case 'discardOppHand':          return `discardOppHand(${a.count})`;
    // Passive flags
    case 'passive_piercing':        return 'passive_piercing()';
    case 'passive_untargetable':    return 'passive_untargetable()';
    case 'passive_directAttack':    return 'passive_directAttack()';
    case 'passive_vsAttrBonus':     return `passive_vsAttrBonus(${attributeToInt(a.attr)},${a.atk})`;
    case 'passive_phoenixRevival':  return 'passive_phoenixRevival()';
    case 'passive_indestructible':  return 'passive_indestructible()';
    case 'passive_effectImmune':    return 'passive_effectImmune()';
    case 'passive_cantBeAttacked':  return 'passive_cantBeAttacked()';
    default:
      throw new Error(`Unknown effect action type: ${(a as any).type}`);
  }
}

// ── Action Deserialization ───────────────────────────────────

/** Parse comma-separated args, respecting {} blocks */
function parseArgs(argsStr: string): string[] {
  if (argsStr.trim() === '') return [];
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < argsStr.length; i++) {
    if (argsStr[i] === '{') depth++;
    else if (argsStr[i] === '}') depth--;
    else if (argsStr[i] === ',' && depth === 0) {
      args.push(argsStr.substring(start, i).trim());
      start = i + 1;
    }
  }
  if (start < argsStr.length) args.push(argsStr.substring(start).trim());
  return args;
}

function isFilterArg(s: string): boolean {
  return s.startsWith('{') && s.endsWith('}');
}

function deserializeAction(actionStr: string): EffectDescriptor {
  const m = actionStr.match(/^(\w+)\(([^)]*(?:\{[^}]*\}[^)]*)*)\)$/);
  if (!m) throw new Error(`Invalid action syntax: ${actionStr}`);
  const type = m[1];
  const args = parseArgs(m[2]);

  switch (type) {
    case 'dealDamage':
      return { type: 'dealDamage', target: args[0] as 'opponent' | 'self', value: deserializeValueExpr(args[1]) };
    case 'gainLP':
      return { type: 'gainLP', target: args[0] as 'opponent' | 'self', value: deserializeValueExpr(args[1]) };
    case 'draw':
      return { type: 'draw', target: args[0] as 'self' | 'opponent', count: parseInt(args[1]) };

    // Unified field buffs/debuffs
    case 'buffField': {
      const desc: EffectDescriptor = { type: 'buffField', value: parseInt(args[0]) };
      if (args.length > 1 && isFilterArg(args[1])) (desc as any).filter = deserializeCardFilter(args[1]);
      return desc;
    }
    case 'tempBuffField': {
      const desc: EffectDescriptor = { type: 'tempBuffField', value: parseInt(args[0]) };
      if (args.length > 1 && isFilterArg(args[1])) (desc as any).filter = deserializeCardFilter(args[1]);
      return desc;
    }
    case 'debuffField':
      return { type: 'debuffField', atkD: parseInt(args[0]), defD: parseInt(args[1]) };
    case 'tempDebuffField': {
      const desc: any = { type: 'tempDebuffField', atkD: parseInt(args[0]) };
      if (args.length > 1) desc.defD = parseInt(args[1]);
      return desc;
    }

    // Bounce
    case 'bounceStrongestOpp':      return { type: 'bounceStrongestOpp' };
    case 'bounceAttacker':          return { type: 'bounceAttacker' };
    case 'bounceAllOppMonsters':    return { type: 'bounceAllOppMonsters' };

    // Search
    case 'searchDeckToHand':
      return { type: 'searchDeckToHand', filter: deserializeCardFilter(args[0]) };

    // Targeted stat modification
    case 'tempAtkBonus':
      return { type: 'tempAtkBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
    case 'permAtkBonus': {
      const desc: any = { type: 'permAtkBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
      if (args.length > 2 && isFilterArg(args[2])) desc.filter = deserializeCardFilter(args[2]);
      return desc;
    }
    case 'tempDefBonus':
      return { type: 'tempDefBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
    case 'permDefBonus':
      return { type: 'permDefBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };

    // Graveyard
    case 'reviveFromGrave':         return { type: 'reviveFromGrave' };

    // Trap signals
    case 'cancelAttack':            return { type: 'cancelAttack' };
    case 'destroyAttacker':         return { type: 'destroyAttacker' };
    case 'destroySummonedIf':       return { type: 'destroySummonedIf', minAtk: parseInt(args[0]) };

    // Destruction
    case 'destroyAllOpp':           return { type: 'destroyAllOpp' };
    case 'destroyAll':              return { type: 'destroyAll' };
    case 'destroyWeakestOpp':       return { type: 'destroyWeakestOpp' };
    case 'destroyStrongestOpp':     return { type: 'destroyStrongestOpp' };

    // Graveyard & Deck manipulation
    case 'sendTopCardsToGrave':     return { type: 'sendTopCardsToGrave', count: parseInt(args[0]) };
    case 'sendTopCardsToGraveOpp':  return { type: 'sendTopCardsToGraveOpp', count: parseInt(args[0]) };
    case 'salvageFromGrave':        return { type: 'salvageFromGrave', filter: deserializeCardFilter(args[0]) };
    case 'recycleFromGraveToDeck':  return { type: 'recycleFromGraveToDeck', filter: deserializeCardFilter(args[0]) };
    case 'shuffleGraveIntoDeck':    return { type: 'shuffleGraveIntoDeck' };
    case 'shuffleDeck':             return { type: 'shuffleDeck' };
    case 'peekTopCard':             return { type: 'peekTopCard' };

    // Special Summon
    case 'specialSummonFromHand': {
      const desc: any = { type: 'specialSummonFromHand' };
      if (args.length > 0 && args[0] !== '' && isFilterArg(args[0])) desc.filter = deserializeCardFilter(args[0]);
      return desc;
    }

    // Hand manipulation
    case 'discardFromHand':         return { type: 'discardFromHand', count: parseInt(args[0]) };
    case 'discardOppHand':          return { type: 'discardOppHand', count: parseInt(args[0]) };

    // Passive flags
    case 'passive_piercing':        return { type: 'passive_piercing' };
    case 'passive_untargetable':    return { type: 'passive_untargetable' };
    case 'passive_directAttack':    return { type: 'passive_directAttack' };
    case 'passive_vsAttrBonus':
      return { type: 'passive_vsAttrBonus', attr: intToAttribute(parseInt(args[0])), atk: parseInt(args[1]) };
    case 'passive_phoenixRevival':  return { type: 'passive_phoenixRevival' };
    case 'passive_indestructible':  return { type: 'passive_indestructible' };
    case 'passive_effectImmune':    return { type: 'passive_effectImmune' };
    case 'passive_cantBeAttacked':  return { type: 'passive_cantBeAttacked' };

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// ── Public API ───────────────────────────────────────────────

export function serializeEffect(block: CardEffectBlock): string {
  const actions = block.actions.map(serializeAction).join(';');
  return `${block.trigger}:${actions}`;
}

export function deserializeEffect(str: string): CardEffectBlock {
  const colonIdx = str.indexOf(':');
  if (colonIdx === -1) throw new Error(`Invalid effect string (no trigger separator): ${str}`);

  const triggerStr = str.substring(0, colonIdx);
  if (!isValidTrigger(triggerStr)) throw new Error(`Invalid trigger: ${triggerStr}`);

  const actionsStr = str.substring(colonIdx + 1);
  const actionParts = splitActions(actionsStr);
  const actions = actionParts.map(deserializeAction);

  return { trigger: triggerStr as EffectTrigger | TrapTrigger, actions };
}

/** Split action string on ';' while respecting parentheses and braces */
function splitActions(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(' || s[i] === '{') depth++;
    else if (s[i] === ')' || s[i] === '}') depth--;
    else if (s[i] === ';' && depth === 0) {
      parts.push(s.substring(start, i));
      start = i + 1;
    }
  }
  if (start < s.length) parts.push(s.substring(start));
  return parts.filter(p => p.length > 0);
}

/** Validate effect string syntax without full deserialization */
export function isValidEffectString(str: string): boolean {
  try {
    deserializeEffect(str);
    return true;
  } catch {
    return false;
  }
}
