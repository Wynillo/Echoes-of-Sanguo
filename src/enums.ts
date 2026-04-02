import { CardType, Attribute, Race, Rarity } from './types.js';
import type { EffectTrigger, TrapTrigger, SpellType } from './types.js';
import {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_EQUIPMENT,
  TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND,
  TCG_RARITY_COMMON, TCG_RARITY_UNCOMMON, TCG_RARITY_RARE, TCG_RARITY_SUPER_RARE, TCG_RARITY_ULTRA_RARE,
} from '@wynillo/tcg-format';

const TYPE_TO_INT: Record<CardType, number> = {
  [CardType.Monster]:   TCG_TYPE_MONSTER,
  [CardType.Fusion]:    TCG_TYPE_FUSION,
  [CardType.Spell]:     TCG_TYPE_SPELL,
  [CardType.Trap]:      TCG_TYPE_TRAP,
  [CardType.Equipment]: TCG_TYPE_EQUIPMENT,
};

const INT_TO_TYPE: Record<number, CardType> = {
  [TCG_TYPE_MONSTER]:   CardType.Monster,
  [TCG_TYPE_FUSION]:    CardType.Fusion,
  [TCG_TYPE_SPELL]:     CardType.Spell,
  [TCG_TYPE_TRAP]:      CardType.Trap,
  [TCG_TYPE_EQUIPMENT]: CardType.Equipment,
};

export function cardTypeToInt(ct: CardType): number {
  const n = TYPE_TO_INT[ct];
  if (n === undefined) throw new Error(`Unknown CardType: ${ct}`);
  return n;
}

export function intToCardType(n: number, hasEffect: boolean): CardType {
  // Monster covers both normal and effect; caller uses hasEffect for distinction
  const ct = INT_TO_TYPE[n];
  if (ct === undefined) throw new Error(`Unknown type int: ${n}`);
  return ct;
}

const ATTR_TO_INT: Record<Attribute, number> = {
  [Attribute.Light]: TCG_ATTR_LIGHT,
  [Attribute.Dark]:  TCG_ATTR_DARK,
  [Attribute.Fire]:  TCG_ATTR_FIRE,
  [Attribute.Water]: TCG_ATTR_WATER,
  [Attribute.Earth]: TCG_ATTR_EARTH,
  [Attribute.Wind]:  TCG_ATTR_WIND,
};

const INT_TO_ATTR: Record<number, Attribute> = {
  [TCG_ATTR_LIGHT]: Attribute.Light,
  [TCG_ATTR_DARK]:  Attribute.Dark,
  [TCG_ATTR_FIRE]:  Attribute.Fire,
  [TCG_ATTR_WATER]: Attribute.Water,
  [TCG_ATTR_EARTH]: Attribute.Earth,
  [TCG_ATTR_WIND]:  Attribute.Wind,
};

export function attributeToInt(a: Attribute): number {
  const n = ATTR_TO_INT[a];
  if (n === undefined) throw new Error(`Unknown Attribute: ${a}`);
  return n;
}

export function intToAttribute(n: number): Attribute {
  const a = INT_TO_ATTR[n];
  if (a === undefined) throw new Error(`Unknown attribute int: ${n}`);
  return a;
}

export function raceToInt(r: Race): number {
  return r;
}

export function intToRace(n: number): Race {
  return n;
}

const RARITY_TO_INT: Record<Rarity, number> = {
  [Rarity.Common]:    TCG_RARITY_COMMON,
  [Rarity.Uncommon]:  TCG_RARITY_UNCOMMON,
  [Rarity.Rare]:      TCG_RARITY_RARE,
  [Rarity.SuperRare]: TCG_RARITY_SUPER_RARE,
  [Rarity.UltraRare]: TCG_RARITY_ULTRA_RARE,
};

const INT_TO_RARITY: Record<number, Rarity> = {
  [TCG_RARITY_COMMON]:     Rarity.Common,
  [TCG_RARITY_UNCOMMON]:   Rarity.Uncommon,
  [TCG_RARITY_RARE]:       Rarity.Rare,
  [TCG_RARITY_SUPER_RARE]: Rarity.SuperRare,
  [TCG_RARITY_ULTRA_RARE]: Rarity.UltraRare,
};

export function rarityToInt(r: Rarity): number {
  const n = RARITY_TO_INT[r];
  if (n === undefined) throw new Error(`Unknown Rarity: ${r}`);
  return n;
}

export function intToRarity(n: number): Rarity {
  const r = INT_TO_RARITY[n];
  if (r === undefined) throw new Error(`Unknown rarity int: ${n}`);
  return r;
}

const TRIGGER_STRINGS: ReadonlySet<string> = new Set([
  'onSummon', 'onDestroyByBattle', 'onDestroyByOpponent', 'passive', 'onFlip',
  'onDealBattleDamage', 'onSentToGrave',
  'onAttack', 'onOwnMonsterAttacked', 'onOpponentSummon', 'manual', 'onOpponentSpell', 'onAnySummon',
]);

export function isValidTrigger(s: string): s is (EffectTrigger | TrapTrigger) {
  return TRIGGER_STRINGS.has(s);
}

const SPELL_TYPE_STRINGS: ReadonlySet<string> = new Set(['normal', 'targeted', 'fromGrave', 'field']);

export function isValidSpellType(s: string): s is SpellType {
  return SPELL_TYPE_STRINGS.has(s);
}

const SPELL_TYPE_TO_INT: Record<string, number> = { normal: 1, targeted: 2, fromGrave: 3, field: 4 };
const INT_TO_SPELL_TYPE: Record<number, SpellType> = { 1: 'normal', 2: 'targeted', 3: 'fromGrave', 4: 'field' };

export function spellTypeToInt(s: SpellType): number {
  const n = SPELL_TYPE_TO_INT[s];
  if (n === undefined) throw new Error(`Unknown SpellType: ${s}`);
  return n;
}

export function intToSpellType(n: number): SpellType {
  const s = INT_TO_SPELL_TYPE[n];
  if (s === undefined) throw new Error(`Unknown spellType int: ${n}`);
  return s;
}

const TRAP_TRIGGER_TO_INT: Record<string, number> = {
  onAttack: 1, onOwnMonsterAttacked: 2, onOpponentSummon: 3, manual: 4, onOpponentSpell: 5, onAnySummon: 6, onOpponentTrap: 7,
};
const INT_TO_TRAP_TRIGGER: Record<number, TrapTrigger> = {
  1: 'onAttack', 2: 'onOwnMonsterAttacked', 3: 'onOpponentSummon', 4: 'manual', 5: 'onOpponentSpell', 6: 'onAnySummon', 7: 'onOpponentTrap',
};

export function trapTriggerToInt(t: TrapTrigger): number {
  const n = TRAP_TRIGGER_TO_INT[t];
  if (n === undefined) throw new Error(`Unknown TrapTrigger: ${t}`);
  return n;
}

export function intToTrapTrigger(n: number): TrapTrigger {
  const t = INT_TO_TRAP_TRIGGER[n];
  if (t === undefined) throw new Error(`Unknown trapTrigger int: ${n}`);
  return t;
}
