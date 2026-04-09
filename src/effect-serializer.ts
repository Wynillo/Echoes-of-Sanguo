import { type CardEffectBlock, type CardData, type CardFilter, type EffectCost, type EffectDescriptor, type EffectTrigger, type TrapTrigger, type ValueExpr, type StatTarget } from './types.js';
import { isValidTrigger, intToCardType } from './enums.js';

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

function serializeCardFilter(f: CardFilter): string {
  const parts: string[] = [];
  if (f.race     !== undefined) parts.push(`r=${f.race}`);
  if (f.attr     !== undefined) parts.push(`a=${f.attr}`);
  if (f.cardType !== undefined) parts.push(`ct=${f.cardType}`);
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
    const [key, val] = pair.split(/[=:]/);
    switch (key.trim()) {
      case 'r':        filter.race = parseInt(val); break;
      case 'a':        filter.attr = parseInt(val); break;
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
    case 'cancelEffect':            return 'cancelEffect()';
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
    case 'passive_vsAttrBonus':     return `passive_vsAttrBonus(${a.attr},${a.atk})`;
    case 'passive_phoenixRevival':  return 'passive_phoenixRevival()';
    case 'passive_indestructible':  return 'passive_indestructible()';
    case 'passive_effectImmune':    return 'passive_effectImmune()';
    case 'passive_cantBeAttacked':  return 'passive_cantBeAttacked()';
    // Spell/Trap destruction
    case 'destroyOppSpellTrap':     return 'destroyOppSpellTrap()';
    case 'destroyAllOppSpellTraps': return 'destroyAllOppSpellTraps()';
    case 'destroyAllSpellTraps':    return 'destroyAllSpellTraps()';
    case 'destroyOppFieldSpell':    return 'destroyOppFieldSpell()';
    // Position manipulation
    case 'changePositionOpp':       return 'changePositionOpp()';
    case 'setFaceDown':             return 'setFaceDown()';
    case 'flipAllOppFaceDown':      return 'flipAllOppFaceDown()';
    // Filter-based destruction
    case 'destroyByFilter':         return `destroyByFilter(${a.mode}${a.side ? `,${a.side}` : ''}${a.filter ? `,${serializeCardFilter(a.filter)}` : ''})`;
    // Stat manipulation
    case 'halveAtk':                return `halveAtk(${a.target})`;
    case 'doubleAtk':               return `doubleAtk(${a.target})`;
    case 'swapAtkDef':              return `swapAtkDef(${a.side})`;
    // Special summon from deck
    case 'specialSummonFromDeck': {
      let s = `specialSummonFromDeck(${serializeCardFilter(a.filter)}`;
      if (a.faceDown) s += ',faceDown';
      if (a.position && a.position !== 'atk') s += `,${a.position}`;
      return s + ')';
    }
    // Phase 2: Reflect & Steal
    case 'reflectBattleDamage':     return 'reflectBattleDamage()';
    case 'stealMonster':            return 'stealMonster()';
    case 'skipOppDraw':             return 'skipOppDraw()';
    case 'discardEntireHand':       return `discardEntireHand(${a.target})`;
    case 'destroyAndDamageBoth':    return `destroyAndDamageBoth(${a.side})`;
    case 'preventBattleDamage':     return 'preventBattleDamage()';
    case 'passive_negateTraps':     return 'passive_negateTraps()';
    case 'passive_negateSpells':    return 'passive_negateSpells()';
    case 'passive_negateMonsterEffects': return 'passive_negateMonsterEffects()';
    case 'stealMonsterTemp':        return 'stealMonsterTemp()';
    case 'reviveFromEitherGrave':   return 'reviveFromEitherGrave()';
    case 'drawThenDiscard':         return `drawThenDiscard(${a.drawCount},${a.discardCount})`;
    case 'bounceOppHandToDeck':     return `bounceOppHandToDeck(${a.count})`;
    case 'tributeSelf':             return 'tributeSelf()';
    case 'preventAttacks':          return `preventAttacks(${a.turns})`;
    case 'createTokens':            return `createTokens(${a.tokenId},${a.count},${a.position})`;
    case 'gameReset':               return 'gameReset()';
    case 'excavateAndSummon':       return `excavateAndSummon(${a.count},${a.maxLevel})`;
    // Mill & banish
    case 'millOpp':                 return `millOpp(${(a as any).count})`;
    case 'banishOppGy':             return 'banishOppGy()';
    case 'negateAttack':            return 'negateAttack()';
    case 'reflectDamage':           return `reflectDamage(${(a as any).multiplier})`;
    case 'negate':                  return 'negate';
    default:
      throw new Error(`Unknown effect action type: ${(a as any).type}`);
  }
}

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
  const m = actionStr.match(/^(\w+)\((.*)\)$/);
  if (!m) {
    // Handle known bare action names without parentheses (e.g., "negate")
    const bare = actionStr.trim();
    if (bare === 'negate') {
      return { type: bare } as any;
    }
    throw new Error(`Invalid action syntax: ${actionStr}`);
  }
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
      return { type: 'searchDeckToHand', filter: args.length > 0 && args[0] !== '' && isFilterArg(args[0]) ? deserializeCardFilter(args[0]) : {} };

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
    case 'cancelEffect':            return { type: 'cancelEffect' };
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
    case 'salvageFromGrave':        return { type: 'salvageFromGrave', filter: args.length > 0 && args[0] !== '' && isFilterArg(args[0]) ? deserializeCardFilter(args[0]) : {} };
    case 'recycleFromGraveToDeck':  return { type: 'recycleFromGraveToDeck', filter: args.length > 0 && args[0] !== '' && isFilterArg(args[0]) ? deserializeCardFilter(args[0]) : {} };
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
      return { type: 'passive_vsAttrBonus', attr: parseInt(args[0]), atk: parseInt(args[1]) };
    case 'passive_phoenixRevival':  return { type: 'passive_phoenixRevival' };
    case 'passive_indestructible':  return { type: 'passive_indestructible' };
    case 'passive_effectImmune':    return { type: 'passive_effectImmune' };
    case 'passive_cantBeAttacked':  return { type: 'passive_cantBeAttacked' };

    // Spell/Trap destruction
    case 'destroyOppSpellTrap': {
      const desc: any = { type: 'destroyOppSpellTrap' };
      if (args.length > 0 && args[0] !== '') desc.count = parseInt(args[0]);
      return desc;
    }
    case 'destroyAllOppSpellTraps': return { type: 'destroyAllOppSpellTraps' };
    case 'destroyAllSpellTraps':    return { type: 'destroyAllSpellTraps' };
    case 'destroyOppFieldSpell':    return { type: 'destroyOppFieldSpell' };

    // Position manipulation
    case 'changePositionOpp':       return { type: 'changePositionOpp' };
    case 'setFaceDown':             return { type: 'setFaceDown' };
    case 'flipAllOppFaceDown':      return { type: 'flipAllOppFaceDown' };

    // Filter-based destruction
    case 'destroyByFilter': {
      const desc: any = { type: 'destroyByFilter', mode: args[0] };
      let argIdx = 1;
      if (args.length > argIdx && !isFilterArg(args[argIdx])) { desc.side = args[argIdx]; argIdx++; }
      if (args.length > argIdx && isFilterArg(args[argIdx])) desc.filter = deserializeCardFilter(args[argIdx]);
      return desc;
    }

    // Stat manipulation
    case 'halveAtk':                return { type: 'halveAtk', target: asStatTarget(args[0]) };
    case 'doubleAtk':               return { type: 'doubleAtk', target: asStatTarget(args[0]) };
    case 'swapAtkDef':              return { type: 'swapAtkDef', side: args[0] as 'self' | 'opponent' | 'all' };

    // Special summon from deck
    case 'specialSummonFromDeck': {
      const desc: any = { type: 'specialSummonFromDeck', filter: deserializeCardFilter(args[0]) };
      for (let i = 1; i < args.length; i++) {
        if (args[i] === 'faceDown') desc.faceDown = true;
        else if (args[i] === 'def' || args[i] === 'atk') desc.position = args[i];
      }
      return desc;
    }

    // Phase 2: Reflect & Steal
    case 'reflectBattleDamage':     return { type: 'reflectBattleDamage' };
    case 'stealMonster':            return { type: 'stealMonster' };
    case 'skipOppDraw':             return { type: 'skipOppDraw' };
    case 'discardEntireHand':       return { type: 'discardEntireHand', target: args[0] as 'self' | 'opponent' | 'both' };
    case 'destroyAndDamageBoth':    return { type: 'destroyAndDamageBoth', side: args[0] as 'opponent' | 'self' };
    case 'preventBattleDamage':     return { type: 'preventBattleDamage' };
    case 'passive_negateTraps':     return { type: 'passive_negateTraps' };
    case 'passive_negateSpells':    return { type: 'passive_negateSpells' };
    case 'passive_negateMonsterEffects': return { type: 'passive_negateMonsterEffects' };
    case 'stealMonsterTemp':        return { type: 'stealMonsterTemp' };
    case 'reviveFromEitherGrave':   return { type: 'reviveFromEitherGrave' };
    case 'drawThenDiscard':         return { type: 'drawThenDiscard', drawCount: parseInt(args[0]), discardCount: parseInt(args[1]) };
    case 'bounceOppHandToDeck':     return { type: 'bounceOppHandToDeck', count: parseInt(args[0]) };
    case 'tributeSelf':             return { type: 'tributeSelf' };
    case 'preventAttacks':          return { type: 'preventAttacks', turns: parseInt(args[0]) };
    case 'createTokens':            return { type: 'createTokens', tokenId: args[0], count: parseInt(args[1]), position: args[2] as 'atk' | 'def' };
    case 'gameReset':               return { type: 'gameReset' };
    case 'excavateAndSummon':       return { type: 'excavateAndSummon', count: parseInt(args[0]), maxLevel: parseInt(args[1]) };

    // Mill & banish
    case 'millOpp':                 return { type: 'millOpp', count: parseInt(args[0]) } as any;
    case 'banishOppGy':             return { type: 'banishOppGy' } as any;
    // Combat negation
    case 'negateAttack':            return { type: 'negateAttack' } as any;
    // Reflect damage with multiplier
    case 'reflectDamage':           return { type: 'reflectDamage', multiplier: args[0] } as any;
    // Negate (standalone keyword for trap-like effects)
    case 'negate':                  return { type: 'negate' } as any;

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

function serializeCost(cost: EffectCost): string {
  const parts: string[] = [];
  if (cost.lp !== undefined) parts.push(`lp=${cost.lp}`);
  if (cost.discard !== undefined) parts.push(`discard=${cost.discard}`);
  if (cost.tributeSelf) parts.push('tributeSelf');
  if (cost.lpHalf) parts.push('lpHalf');
  return `[cost:${parts.join(',')}]`;
}

function deserializeCost(costStr: string): EffectCost {
  const inner = costStr.slice(6, -1); // strip "[cost:" and "]"
  const cost: EffectCost = {};
  for (const pair of inner.split(',')) {
    const [key, val] = pair.split('=');
    switch (key.trim()) {
      case 'lp':          cost.lp = parseInt(val); break;
      case 'discard':     cost.discard = parseInt(val); break;
      case 'tributeSelf': cost.tributeSelf = true; break;
      case 'lpHalf':      cost.lpHalf = true; break;
    }
  }
  return cost;
}

export function serializeEffect(block: CardEffectBlock): string {
  const actions = block.actions.map(serializeAction).join(';');
  const costPart = block.cost ? serializeCost(block.cost) : '';
  return `${block.trigger}${costPart}:${actions}`;
}

export function deserializeEffect(str: string): CardEffectBlock {
  // Handle [cost:...]trigger:actions format (cost before trigger)
  const costPrefixMatch = str.match(/^(\[cost:[^\]]+\])/);
  let costFromPrefix: EffectCost | undefined;
  if (costPrefixMatch) {
    costFromPrefix = deserializeCost(costPrefixMatch[1]);
    str = str.substring(costPrefixMatch[1].length);
  }

  // Find the trigger:actions separator colon, skipping any colons inside [cost:...] brackets
  let colonIdx = -1;
  let bracketDepth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '[') bracketDepth++;
    else if (str[i] === ']') bracketDepth--;
    else if (str[i] === ':' && bracketDepth === 0) { colonIdx = i; break; }
  }
  if (colonIdx === -1) throw new Error(`Invalid effect string (no trigger separator): ${str}`);

  let triggerStr = str.substring(0, colonIdx);
  let cost: EffectCost | undefined = costFromPrefix;

  const costMatch = triggerStr.match(/^(.+?)(\[cost:[^\]]+\])$/);
  if (costMatch) {
    triggerStr = costMatch[1];
    cost = deserializeCost(costMatch[2]);
  }

  if (!isValidTrigger(triggerStr)) throw new Error(`Invalid trigger: ${triggerStr}`);

  let actionsStr = str.substring(colonIdx + 1);

  // Extract trailing [cost:...] from actions section
  const trailingCostMatch = actionsStr.match(/;?\[cost:([^\]]+)\]$/);
  if (trailingCostMatch) {
    if (!cost) cost = deserializeCost(`[cost:${trailingCostMatch[1]}]`);
    actionsStr = actionsStr.substring(0, actionsStr.length - trailingCostMatch[0].length);
  }

  const actionParts = splitActions(actionsStr);
  const actions = actionParts.map(deserializeAction);

  const block: CardEffectBlock = { trigger: triggerStr as EffectTrigger | TrapTrigger, actions };
  if (cost) block.cost = cost;
  return block;
}

/** Split a block on ;trigger: boundaries into separate trigger:actions strings */
function expandEmbeddedTriggers(block: string): string[] {
  // Split action parts on ';' boundaries where the next part starts with a valid trigger + ':'
  const parts = splitActions(block.substring(block.indexOf(':') + 1));
  if (parts.length <= 1) return [block];

  const triggerPart = block.substring(0, block.indexOf(':'));
  const result: string[] = [];
  let currentActions: string[] = [];

  let currentTrigger = triggerPart;
  for (const part of parts) {
    // Check if this part starts with a trigger prefix like "passive:" or "onSummon:"
    const triggerMatch = part.match(/^(\w+):/);
    if (triggerMatch && isValidTrigger(triggerMatch[1])) {
      if (currentActions.length > 0) {
        result.push(`${currentTrigger}:${currentActions.join(';')}`);
      }
      currentTrigger = triggerMatch[1];
      currentActions = [part.substring(triggerMatch[0].length)];
    } else {
      currentActions.push(part);
    }
  }
  if (currentActions.length > 0) {
    result.push(`${currentTrigger}:${currentActions.join(';')}`);
  }
  return result;
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

/** Deserialize a pipe-delimited multi-block effect string (e.g. "passive:...|onDealBattleDamage:...") */
export function deserializeEffects(str: string): CardEffectBlock[] {
  const rawBlocks = str.split('|').map(s => s.trim());
  const blocks: CardEffectBlock[] = [];
  let lastTrigger = '';

  for (const block of rawBlocks) {
    // Check if this block has a trigger separator (colon at depth 0)
    let hasColon = false;
    let depth = 0;
    for (let i = 0; i < block.length; i++) {
      if (block[i] === '[' || block[i] === '(') depth++;
      else if (block[i] === ']' || block[i] === ')') depth--;
      else if (block[i] === ':' && depth === 0) { hasColon = true; break; }
    }

    const effectStr = hasColon ? block : `${lastTrigger}:${block}`;
    // The block may contain ;trigger: patterns — expand into multiple blocks
    const subBlocks = expandEmbeddedTriggers(effectStr);
    for (const sub of subBlocks) {
      const parsed = deserializeEffect(sub);
      blocks.push(parsed);
      lastTrigger = parsed.trigger;
    }
  }

  return blocks;
}

/** Serialize multiple effect blocks into pipe-delimited format */
export function serializeEffects(blocks: CardEffectBlock[]): string {
  return blocks.map(serializeEffect).join('|');
}

/** Check if an effect string contains multiple blocks (pipe-delimited or embedded triggers) */
export function isMultiBlockEffect(str: string): boolean {
  if (str.includes('|')) return true;
  // Check for ;trigger: pattern (embedded trigger boundaries)
  const expanded = expandEmbeddedTriggers(str);
  return expanded.length > 1;
}

/**
 * Parse an effect string and populate card.effect and card.effects.
 * Single-block strings set card.effect only (backward compat).
 * Multi-block strings set card.effects (array) and card.effect to the first block.
 */
export function parseEffectString(str: string, card: Partial<Pick<CardData, 'effect' | 'effects'>>): void {
  // Always go through deserializeEffects to handle all multi-block patterns
  const blocks = deserializeEffects(str);
  if (blocks.length > 1) {
    card.effects = blocks;
    card.effect = blocks[0];
  } else {
    card.effect = blocks[0];
  }
}

/** Validate effect string syntax without full deserialization */
export function isValidEffectString(str: string): boolean {
  try {
    deserializeEffects(str);
    return true;
  } catch {
    return false;
  }
}
