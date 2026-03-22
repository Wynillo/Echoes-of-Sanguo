// ============================================================
// ECHOES OF SANGUO — Effect Serializer/Deserializer
// Converts CardEffectBlock ↔ compact string notation
//
// Format: "trigger:action1(args);action2(args)"
// Examples:
//   "onSummon:dealDamage(opponent,300)"
//   "passive:passive_piercing()"
//   "onAttack:dealDamage(opponent,attacker.effectiveATK*0.5f);cancelAttack()"
// ============================================================

import { type CardEffectBlock, type EffectDescriptor, type EffectTrigger, type TrapTrigger, type ValueExpr, Attribute, Race, type StatTarget } from '../types.js';
import { isValidTrigger, intToAttribute, intToRace, attributeToInt, raceToInt } from './enums.js';

// ── ValueExpr Serialization ──────────────────────────────────

function serializeValueExpr(v: ValueExpr): string {
  if (typeof v === 'number') return String(v);
  const roundSuffix = v.round === 'floor' ? 'f' : 'c';
  return `${v.from}*${v.multiply}${roundSuffix}`;
}

function deserializeValueExpr(s: string): ValueExpr {
  // Try plain number first
  const n = Number(s);
  if (!isNaN(n)) return n;

  // Pattern: source*multiplier[f|c]
  const m = s.match(/^([\w.]+)\*([0-9.]+)([fc])$/);
  if (!m) throw new Error(`Invalid ValueExpr: ${s}`);

  const from = m[1] as ValueExpr & { from: string } extends never ? never : string;
  if (from !== 'attacker.effectiveATK' && from !== 'summoned.atk') {
    throw new Error(`Unknown ValueExpr source: ${from}`);
  }
  return {
    from,
    multiply: parseFloat(m[2]),
    round: m[3] === 'f' ? 'floor' : 'ceil',
  };
}

// ── Action Serialization ─────────────────────────────────────

function serializeAction(a: EffectDescriptor): string {
  switch (a.type) {
    // Damage & healing
    case 'dealDamage':           return `dealDamage(${a.target},${serializeValueExpr(a.value)})`;
    case 'gainLP':               return `gainLP(${a.target},${serializeValueExpr(a.value)})`;
    // Card draw
    case 'draw':                 return `draw(${a.target},${a.count})`;
    // Field buffs/debuffs
    case 'buffAtkRace':          return `buffAtkRace(${raceToInt(a.race)},${a.value})`;
    case 'buffAtkAttr':          return `buffAtkAttr(${attributeToInt(a.attr)},${a.value})`;
    case 'debuffAllOpp':         return `debuffAllOpp(${a.atkD},${a.defD})`;
    // Temporary field-wide
    case 'tempBuffAtkRace':      return `tempBuffAtkRace(${raceToInt(a.race)},${a.value})`;
    case 'tempDebuffAllOpp':     return `tempDebuffAllOpp(${a.atkD}${a.defD !== undefined ? `,${a.defD}` : ''})`;
    // Bounce
    case 'bounceStrongestOpp':   return 'bounceStrongestOpp()';
    case 'bounceAttacker':       return 'bounceAttacker()';
    case 'bounceAllOppMonsters': return 'bounceAllOppMonsters()';
    // Search
    case 'searchDeckToHand':     return `searchDeckToHand(${attributeToInt(a.attr)})`;
    // Targeted stat modification
    case 'tempAtkBonus':         return `tempAtkBonus(${a.target},${a.value})`;
    case 'permAtkBonus':         return `permAtkBonus(${a.target},${a.value}${a.attrFilter ? `,${attributeToInt(a.attrFilter)}` : ''})`;
    case 'tempDefBonus':         return `tempDefBonus(${a.target},${a.value})`;
    case 'permDefBonus':         return `permDefBonus(${a.target},${a.value})`;
    // Graveyard
    case 'reviveFromGrave':      return 'reviveFromGrave()';
    // Trap signals
    case 'cancelAttack':         return 'cancelAttack()';
    case 'destroyAttacker':      return 'destroyAttacker()';
    case 'destroySummonedIf':    return `destroySummonedIf(${a.minAtk})`;
    // Passive flags
    case 'passive_piercing':        return 'passive_piercing()';
    case 'passive_untargetable':    return 'passive_untargetable()';
    case 'passive_directAttack':    return 'passive_directAttack()';
    case 'passive_vsAttrBonus':     return `passive_vsAttrBonus(${attributeToInt(a.attr)},${a.atk})`;
    case 'passive_phoenixRevival':  return 'passive_phoenixRevival()';
    default:
      throw new Error(`Unknown effect action type: ${(a as any).type}`);
  }
}

// ── Action Deserialization ───────────────────────────────────

function parseArgs(argsStr: string): string[] {
  if (argsStr.trim() === '') return [];
  return argsStr.split(',').map(s => s.trim());
}

const STAT_TARGETS = new Set<string>(['ownMonster', 'oppMonster', 'attacker', 'defender', 'summonedFC']);

function asStatTarget(s: string): StatTarget {
  if (!STAT_TARGETS.has(s)) throw new Error(`Invalid StatTarget: ${s}`);
  return s as StatTarget;
}

function deserializeAction(actionStr: string): EffectDescriptor {
  const m = actionStr.match(/^(\w+)\(([^)]*)\)$/);
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
    case 'buffAtkRace':
      return { type: 'buffAtkRace', race: intToRace(parseInt(args[0])), value: parseInt(args[1]) };
    case 'buffAtkAttr':
      return { type: 'buffAtkAttr', attr: intToAttribute(parseInt(args[0])), value: parseInt(args[1]) };
    case 'debuffAllOpp':
      return { type: 'debuffAllOpp', atkD: parseInt(args[0]), defD: parseInt(args[1]) };
    case 'tempBuffAtkRace':
      return { type: 'tempBuffAtkRace', race: intToRace(parseInt(args[0])), value: parseInt(args[1]) };
    case 'tempDebuffAllOpp': {
      const result: EffectDescriptor = { type: 'tempDebuffAllOpp', atkD: parseInt(args[0]) };
      if (args.length > 1) (result as any).defD = parseInt(args[1]);
      return result;
    }
    case 'bounceStrongestOpp':   return { type: 'bounceStrongestOpp' };
    case 'bounceAttacker':       return { type: 'bounceAttacker' };
    case 'bounceAllOppMonsters': return { type: 'bounceAllOppMonsters' };
    case 'searchDeckToHand':
      return { type: 'searchDeckToHand', attr: intToAttribute(parseInt(args[0])) };
    case 'tempAtkBonus':
      return { type: 'tempAtkBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
    case 'permAtkBonus': {
      const desc: any = { type: 'permAtkBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
      if (args.length > 2) desc.attrFilter = intToAttribute(parseInt(args[2]));
      return desc;
    }
    case 'tempDefBonus':
      return { type: 'tempDefBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
    case 'permDefBonus':
      return { type: 'permDefBonus', target: asStatTarget(args[0]), value: parseInt(args[1]) };
    case 'reviveFromGrave':      return { type: 'reviveFromGrave' };
    case 'cancelAttack':         return { type: 'cancelAttack' };
    case 'destroyAttacker':      return { type: 'destroyAttacker' };
    case 'destroySummonedIf':
      return { type: 'destroySummonedIf', minAtk: parseInt(args[0]) };
    case 'passive_piercing':        return { type: 'passive_piercing' };
    case 'passive_untargetable':    return { type: 'passive_untargetable' };
    case 'passive_directAttack':    return { type: 'passive_directAttack' };
    case 'passive_vsAttrBonus':
      return { type: 'passive_vsAttrBonus', attr: intToAttribute(parseInt(args[0])), atk: parseInt(args[1]) };
    case 'passive_phoenixRevival':  return { type: 'passive_phoenixRevival' };
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
  // Split on ';' but respect parentheses
  const actionParts = splitActions(actionsStr);
  const actions = actionParts.map(deserializeAction);

  return { trigger: triggerStr as EffectTrigger | TrapTrigger, actions };
}

/** Split action string on ';' while respecting parentheses */
function splitActions(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
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
