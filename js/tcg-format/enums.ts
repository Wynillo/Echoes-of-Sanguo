// ============================================================
// ECHOES OF SANGUO — Enum Converters (enum ↔ int)
// Bidirectional mapping between internal enums and TCG int enums
// Since the internal enums now use the same numeric values as the
// TCG format constants, these conversions are identity mappings.
// ============================================================

import { CardType, Attribute, Race, Rarity } from '../types.js';
import type { EffectTrigger, TrapTrigger, SpellType } from '../types.js';
import {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP,
  TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND,
  TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_BEAST, TCG_RACE_PLANT,
  TCG_RACE_ROCK, TCG_RACE_PHOENIX, TCG_RACE_UNDEAD, TCG_RACE_AQUA, TCG_RACE_INSECT,
  TCG_RACE_MACHINE, TCG_RACE_PYRO,
  TCG_RARITY_COMMON, TCG_RARITY_UNCOMMON, TCG_RARITY_RARE, TCG_RARITY_SUPER_RARE, TCG_RARITY_ULTRA_RARE,
} from './types.js';

// ── CardType ─────────────────────────────────────────────────
// CardType.Monster (1) == TCG_TYPE_MONSTER (1), etc.

const TYPE_TO_INT: Record<CardType, number> = {
  [CardType.Monster]: TCG_TYPE_MONSTER,
  [CardType.Fusion]:  TCG_TYPE_FUSION,
  [CardType.Spell]:   TCG_TYPE_SPELL,
  [CardType.Trap]:    TCG_TYPE_TRAP,
};

const INT_TO_TYPE: Record<number, CardType> = {
  [TCG_TYPE_MONSTER]: CardType.Monster,
  [TCG_TYPE_FUSION]:  CardType.Fusion,
  [TCG_TYPE_SPELL]:   CardType.Spell,
  [TCG_TYPE_TRAP]:    CardType.Trap,
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

// ── Attribute ────────────────────────────────────────────────

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

// ── Race ─────────────────────────────────────────────────────

const RACE_TO_INT: Record<Race, number> = {
  [Race.Dragon]:      TCG_RACE_DRAGON,
  [Race.Spellcaster]: TCG_RACE_SPELLCASTER,
  [Race.Warrior]:     TCG_RACE_WARRIOR,
  [Race.Beast]:       TCG_RACE_BEAST,
  [Race.Plant]:       TCG_RACE_PLANT,
  [Race.Rock]:        TCG_RACE_ROCK,
  [Race.Phoenix]:     TCG_RACE_PHOENIX,
  [Race.Undead]:      TCG_RACE_UNDEAD,
  [Race.Aqua]:        TCG_RACE_AQUA,
  [Race.Insect]:      TCG_RACE_INSECT,
  [Race.Machine]:     TCG_RACE_MACHINE,
  [Race.Pyro]:        TCG_RACE_PYRO,
};

const INT_TO_RACE: Record<number, Race> = {
  [TCG_RACE_DRAGON]:      Race.Dragon,
  [TCG_RACE_SPELLCASTER]: Race.Spellcaster,
  [TCG_RACE_WARRIOR]:     Race.Warrior,
  [TCG_RACE_BEAST]:       Race.Beast,
  [TCG_RACE_PLANT]:       Race.Plant,
  [TCG_RACE_ROCK]:        Race.Rock,
  [TCG_RACE_PHOENIX]:     Race.Phoenix,
  [TCG_RACE_UNDEAD]:      Race.Undead,
  [TCG_RACE_AQUA]:        Race.Aqua,
  [TCG_RACE_INSECT]:      Race.Insect,
  [TCG_RACE_MACHINE]:     Race.Machine,
  [TCG_RACE_PYRO]:        Race.Pyro,
};

export function raceToInt(r: Race): number {
  const n = RACE_TO_INT[r];
  if (n === undefined) throw new Error(`Unknown Race: ${r}`);
  return n;
}

export function intToRace(n: number): Race {
  const r = INT_TO_RACE[n];
  if (r === undefined) throw new Error(`Unknown race int: ${n}`);
  return r;
}

// ── Rarity ───────────────────────────────────────────────────

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

// ── Trigger ──────────────────────────────────────────────────
// Effect triggers and trap triggers share the same string space in serialization

const TRIGGER_STRINGS: ReadonlySet<string> = new Set([
  'onSummon', 'onDestroyByBattle', 'onDestroyByOpponent', 'passive', 'onFlip',
  'onAttack', 'onOwnMonsterAttacked', 'onOpponentSummon', 'manual',
]);

export function isValidTrigger(s: string): s is (EffectTrigger | TrapTrigger) {
  return TRIGGER_STRINGS.has(s);
}

// ── SpellType ────────────────────────────────────────────────

const SPELL_TYPE_STRINGS: ReadonlySet<string> = new Set(['normal', 'targeted', 'fromGrave']);

export function isValidSpellType(s: string): s is SpellType {
  return SPELL_TYPE_STRINGS.has(s);
}

const SPELL_TYPE_TO_INT: Record<string, number> = { normal: 1, targeted: 2, fromGrave: 3 };
const INT_TO_SPELL_TYPE: Record<number, SpellType> = { 1: 'normal', 2: 'targeted', 3: 'fromGrave' };

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

// ── TrapTrigger ─────────────────────────────────────────────

const TRAP_TRIGGER_TO_INT: Record<string, number> = {
  onAttack: 1, onOwnMonsterAttacked: 2, onOpponentSummon: 3, manual: 4,
};
const INT_TO_TRAP_TRIGGER: Record<number, TrapTrigger> = {
  1: 'onAttack', 2: 'onOwnMonsterAttacked', 3: 'onOpponentSummon', 4: 'manual',
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
