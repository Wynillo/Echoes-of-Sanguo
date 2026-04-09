import { CardType, Race } from './types.js';
import type { EffectTrigger, TrapTrigger} from './types.js';
import {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_EQUIPMENT
  ,
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

export function raceToInt(r: Race): number {
  return r;
}

export function intToRace(n: number): Race {
  return n;
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

const TRAP_TRIGGER_TO_INT: Record<string, number> = {
  onAttack: 1, onOwnMonsterAttacked: 2, onOpponentSummon: 3, manual: 4, onOpponentSpell: 5, onAnySummon: 6, onOpponentTrap: 7, onOppCardEffect: 8, onOpponentDraw: 9,
};
const INT_TO_TRAP_TRIGGER: Record<number, TrapTrigger> = {
  1: 'onAttack', 2: 'onOwnMonsterAttacked', 3: 'onOpponentSummon', 4: 'manual', 5: 'onOpponentSpell', 6: 'onAnySummon', 7: 'onOpponentTrap', 8: 'onOppCardEffect', 9: 'onOpponentDraw',
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

export function isTrapTrigger(s: string): s is TrapTrigger {
  return s in TRAP_TRIGGER_TO_INT;
}
