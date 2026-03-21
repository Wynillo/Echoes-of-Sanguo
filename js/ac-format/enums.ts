// ============================================================
// AETHERIAL CLASH — Enum Converters (string ↔ int)
// Bidirectional mapping between internal string enums and AC int enums
// ============================================================

import type { CardType, Attribute, Race, RarityLevel, EffectTrigger, TrapTrigger, SpellType } from '../types.js';
import {
  AC_TYPE_MONSTER, AC_TYPE_FUSION, AC_TYPE_SPELL, AC_TYPE_TRAP,
  AC_ATTR_LIGHT, AC_ATTR_DARK, AC_ATTR_FIRE, AC_ATTR_WATER, AC_ATTR_EARTH, AC_ATTR_WIND,
  AC_RACE_DRAGON, AC_RACE_SPELLCASTER, AC_RACE_WARRIOR, AC_RACE_FIRE, AC_RACE_PLANT,
  AC_RACE_STONE, AC_RACE_FLYER, AC_RACE_ELF, AC_RACE_DEMON, AC_RACE_WATER,
  AC_RARITY_COMMON, AC_RARITY_UNCOMMON, AC_RARITY_RARE, AC_RARITY_SUPER_RARE, AC_RARITY_ULTRA_RARE,
} from './types.js';

// ── CardType ─────────────────────────────────────────────────
// 'normal' and 'effect' both map to Monster (1). Distinction via effect field.

const TYPE_TO_INT: Record<CardType, number> = {
  normal: AC_TYPE_MONSTER,
  effect: AC_TYPE_MONSTER,
  fusion: AC_TYPE_FUSION,
  spell:  AC_TYPE_SPELL,
  trap:   AC_TYPE_TRAP,
};

const INT_TO_TYPE: Record<number, CardType> = {
  [AC_TYPE_MONSTER]: 'normal',   // caller decides 'effect' based on effect field
  [AC_TYPE_FUSION]:  'fusion',
  [AC_TYPE_SPELL]:   'spell',
  [AC_TYPE_TRAP]:    'trap',
};

export function cardTypeToInt(ct: CardType): number {
  const n = TYPE_TO_INT[ct];
  if (n === undefined) throw new Error(`Unknown CardType: ${ct}`);
  return n;
}

export function intToCardType(n: number, hasEffect: boolean): CardType {
  if (n === AC_TYPE_MONSTER) return hasEffect ? 'effect' : 'normal';
  const ct = INT_TO_TYPE[n];
  if (!ct) throw new Error(`Unknown type int: ${n}`);
  return ct;
}

// ── Attribute ────────────────────────────────────────────────

const ATTR_TO_INT: Record<Attribute, number> = {
  light: AC_ATTR_LIGHT,
  dark:  AC_ATTR_DARK,
  fire:  AC_ATTR_FIRE,
  water: AC_ATTR_WATER,
  earth: AC_ATTR_EARTH,
  wind:  AC_ATTR_WIND,
};

const INT_TO_ATTR: Record<number, Attribute> = {
  [AC_ATTR_LIGHT]: 'light',
  [AC_ATTR_DARK]:  'dark',
  [AC_ATTR_FIRE]:  'fire',
  [AC_ATTR_WATER]: 'water',
  [AC_ATTR_EARTH]: 'earth',
  [AC_ATTR_WIND]:  'wind',
};

export function attributeToInt(a: Attribute): number {
  const n = ATTR_TO_INT[a];
  if (n === undefined) throw new Error(`Unknown Attribute: ${a}`);
  return n;
}

export function intToAttribute(n: number): Attribute {
  const a = INT_TO_ATTR[n];
  if (!a) throw new Error(`Unknown attribute int: ${n}`);
  return a;
}

// ── Race ─────────────────────────────────────────────────────
// Internal uses German names, AC format uses int codes

const RACE_TO_INT: Record<Race, number> = {
  drache:  AC_RACE_DRAGON,
  magier:  AC_RACE_SPELLCASTER,
  krieger: AC_RACE_WARRIOR,
  feuer:   AC_RACE_FIRE,
  pflanze: AC_RACE_PLANT,
  stein:   AC_RACE_STONE,
  flug:    AC_RACE_FLYER,
  elfe:    AC_RACE_ELF,
  daemon:  AC_RACE_DEMON,
  wasser:  AC_RACE_WATER,
};

const INT_TO_RACE: Record<number, Race> = {
  [AC_RACE_DRAGON]:      'drache',
  [AC_RACE_SPELLCASTER]: 'magier',
  [AC_RACE_WARRIOR]:     'krieger',
  [AC_RACE_FIRE]:        'feuer',
  [AC_RACE_PLANT]:       'pflanze',
  [AC_RACE_STONE]:       'stein',
  [AC_RACE_FLYER]:       'flug',
  [AC_RACE_ELF]:         'elfe',
  [AC_RACE_DEMON]:       'daemon',
  [AC_RACE_WATER]:       'wasser',
};

export function raceToInt(r: Race): number {
  const n = RACE_TO_INT[r];
  if (n === undefined) throw new Error(`Unknown Race: ${r}`);
  return n;
}

export function intToRace(n: number): Race {
  const r = INT_TO_RACE[n];
  if (!r) throw new Error(`Unknown race int: ${n}`);
  return r;
}

// ── Rarity ───────────────────────────────────────────────────

const RARITY_TO_INT: Record<RarityLevel, number> = {
  common:     AC_RARITY_COMMON,
  uncommon:   AC_RARITY_UNCOMMON,
  rare:       AC_RARITY_RARE,
  super_rare: AC_RARITY_SUPER_RARE,
  ultra_rare: AC_RARITY_ULTRA_RARE,
};

const INT_TO_RARITY: Record<number, RarityLevel> = {
  [AC_RARITY_COMMON]:     'common',
  [AC_RARITY_UNCOMMON]:   'uncommon',
  [AC_RARITY_RARE]:       'rare',
  [AC_RARITY_SUPER_RARE]: 'super_rare',
  [AC_RARITY_ULTRA_RARE]: 'ultra_rare',
};

export function rarityToInt(r: RarityLevel): number {
  const n = RARITY_TO_INT[r];
  if (n === undefined) throw new Error(`Unknown RarityLevel: ${r}`);
  return n;
}

export function intToRarity(n: number): RarityLevel {
  const r = INT_TO_RARITY[n];
  if (!r) throw new Error(`Unknown rarity int: ${n}`);
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
