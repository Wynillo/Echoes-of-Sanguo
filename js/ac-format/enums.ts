// ============================================================
// ECHOES OF SANGUO — Enum Converters (enum ↔ int)
// Bidirectional mapping between internal enums and AC int enums
// Since the internal enums now use the same numeric values as the
// AC format constants, these conversions are identity mappings.
// ============================================================

import { CardType, Attribute, Race, Rarity } from '../types.js';
import type { EffectTrigger, TrapTrigger, SpellType } from '../types.js';
import {
  AC_TYPE_MONSTER, AC_TYPE_FUSION, AC_TYPE_SPELL, AC_TYPE_TRAP,
  AC_ATTR_LIGHT, AC_ATTR_DARK, AC_ATTR_FIRE, AC_ATTR_WATER, AC_ATTR_EARTH, AC_ATTR_WIND,
  AC_RACE_DRAGON, AC_RACE_SPELLCASTER, AC_RACE_WARRIOR, AC_RACE_FIRE, AC_RACE_PLANT,
  AC_RACE_STONE, AC_RACE_FLYER, AC_RACE_ELF, AC_RACE_DEMON, AC_RACE_WATER,
  AC_RARITY_COMMON, AC_RARITY_UNCOMMON, AC_RARITY_RARE, AC_RARITY_SUPER_RARE, AC_RARITY_ULTRA_RARE,
} from './types.js';

// ── CardType ─────────────────────────────────────────────────
// CardType.Monster (1) == AC_TYPE_MONSTER (1), etc.

const TYPE_TO_INT: Record<CardType, number> = {
  [CardType.Monster]: AC_TYPE_MONSTER,
  [CardType.Fusion]:  AC_TYPE_FUSION,
  [CardType.Spell]:   AC_TYPE_SPELL,
  [CardType.Trap]:    AC_TYPE_TRAP,
};

const INT_TO_TYPE: Record<number, CardType> = {
  [AC_TYPE_MONSTER]: CardType.Monster,
  [AC_TYPE_FUSION]:  CardType.Fusion,
  [AC_TYPE_SPELL]:   CardType.Spell,
  [AC_TYPE_TRAP]:    CardType.Trap,
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
  [Attribute.Light]: AC_ATTR_LIGHT,
  [Attribute.Dark]:  AC_ATTR_DARK,
  [Attribute.Fire]:  AC_ATTR_FIRE,
  [Attribute.Water]: AC_ATTR_WATER,
  [Attribute.Earth]: AC_ATTR_EARTH,
  [Attribute.Wind]:  AC_ATTR_WIND,
};

const INT_TO_ATTR: Record<number, Attribute> = {
  [AC_ATTR_LIGHT]: Attribute.Light,
  [AC_ATTR_DARK]:  Attribute.Dark,
  [AC_ATTR_FIRE]:  Attribute.Fire,
  [AC_ATTR_WATER]: Attribute.Water,
  [AC_ATTR_EARTH]: Attribute.Earth,
  [AC_ATTR_WIND]:  Attribute.Wind,
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
  [Race.Dragon]:      AC_RACE_DRAGON,
  [Race.Spellcaster]: AC_RACE_SPELLCASTER,
  [Race.Warrior]:     AC_RACE_WARRIOR,
  [Race.Fire]:        AC_RACE_FIRE,
  [Race.Plant]:       AC_RACE_PLANT,
  [Race.Stone]:       AC_RACE_STONE,
  [Race.Flyer]:       AC_RACE_FLYER,
  [Race.Elf]:         AC_RACE_ELF,
  [Race.Demon]:       AC_RACE_DEMON,
  [Race.Water]:       AC_RACE_WATER,
};

const INT_TO_RACE: Record<number, Race> = {
  [AC_RACE_DRAGON]:      Race.Dragon,
  [AC_RACE_SPELLCASTER]: Race.Spellcaster,
  [AC_RACE_WARRIOR]:     Race.Warrior,
  [AC_RACE_FIRE]:        Race.Fire,
  [AC_RACE_PLANT]:       Race.Plant,
  [AC_RACE_STONE]:       Race.Stone,
  [AC_RACE_FLYER]:       Race.Flyer,
  [AC_RACE_ELF]:         Race.Elf,
  [AC_RACE_DEMON]:       Race.Demon,
  [AC_RACE_WATER]:       Race.Water,
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
  [Rarity.Common]:    AC_RARITY_COMMON,
  [Rarity.Uncommon]:  AC_RARITY_UNCOMMON,
  [Rarity.Rare]:      AC_RARITY_RARE,
  [Rarity.SuperRare]: AC_RARITY_SUPER_RARE,
  [Rarity.UltraRare]: AC_RARITY_ULTRA_RARE,
};

const INT_TO_RARITY: Record<number, Rarity> = {
  [AC_RARITY_COMMON]:     Rarity.Common,
  [AC_RARITY_UNCOMMON]:   Rarity.Uncommon,
  [AC_RARITY_RARE]:       Rarity.Rare,
  [AC_RARITY_SUPER_RARE]: Rarity.SuperRare,
  [AC_RARITY_ULTRA_RARE]: Rarity.UltraRare,
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
  'onSummon', 'onDestroyByBattle', 'onDestroyByOpponent', 'passive',
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
