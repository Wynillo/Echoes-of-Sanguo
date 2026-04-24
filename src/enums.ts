import { CardType } from './types';
import type { EffectTrigger, TrapTrigger} from './types';
import {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_EQUIPMENT,
  TCG_TRAP_TRIGGER_NAME_TO_ID,
  TCG_TRAP_TRIGGER_ID_TO_NAME,
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

const TRIGGER_STRINGS: ReadonlySet<string> = new Set([
  'onSummon', 'onDestroyByBattle', 'onDestroyByOpponent', 'passive', 'onFlipSummon', 'onFlip',
  'onDealBattleDamage', 'onSentToGrave',
  'onAttack', 'onOwnMonsterAttacked', 'onOpponentSummon', 'manual', 'onOpponentSpell', 'onAnySummon',
  'onOppCardEffect', 'onOpponentDraw',
]);

export function isValidTrigger(s: string): s is (EffectTrigger | TrapTrigger) {
  return TRIGGER_STRINGS.has(s);
}

// Use imported mappings directly from TCG format library
const TRAP_TRIGGER_TO_INT = TCG_TRAP_TRIGGER_NAME_TO_ID;
const INT_TO_TRAP_TRIGGER = TCG_TRAP_TRIGGER_ID_TO_NAME;

export function trapTriggerToInt(t: TrapTrigger): number {
  const n = TCG_TRAP_TRIGGER_NAME_TO_ID[t];
  if (n === undefined) throw new Error(`Unknown TrapTrigger: ${t}`);
  return n;
}

export function intToTrapTrigger(n: number): TrapTrigger {
  const t = TCG_TRAP_TRIGGER_ID_TO_NAME[n];
  if (t === undefined) throw new Error(`Unknown trapTrigger int: ${n}`);
  return t;
}

export function isTrapTrigger(s: string): s is TrapTrigger {
  return s in TRAP_TRIGGER_TO_INT;
}
