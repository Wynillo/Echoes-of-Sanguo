// ============================================================
// ECHOES OF SANGUO — Field Card Classes
// ============================================================

import { extractPassiveFlags } from './effect-registry.js';
import type { CardData, Owner, Position, VsAttrBonus } from './types.js';

// ── FieldCard ────────────────────────────────────────────────
export class FieldCard {
  card: CardData;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  hasFlipped: boolean;
  summonedThisTurn: boolean;
  tempATKBonus: number;
  tempDEFBonus: number;
  permATKBonus: number;
  permDEFBonus: number;
  phoenixRevivalUsed: boolean;
  piercing: boolean;
  cannotBeTargeted: boolean;
  canDirectAttack: boolean;
  vsAttrBonus: VsAttrBonus | null;
  phoenixRevival: boolean;
  indestructible: boolean;
  effectImmune: boolean;
  cantBeAttacked: boolean;
  equippedCards: Array<{ zone: number; card: CardData }>;

  constructor(card: CardData, position: Position = 'atk', faceDown: boolean = false) {
    this.card       = { // deep-copy effect to prevent shared mutations across FieldCard instances
      ...card,
      effect: card.effect ? { ...card.effect, actions: card.effect.actions.map(a => ({ ...a })) } : undefined,
    };
    this.position   = position; // 'atk' | 'def'
    this.faceDown   = faceDown;
    this.hasAttacked= false;
    this.hasFlipped = false;
    this.summonedThisTurn = false; // FM-style: no summoning sickness
    this.tempATKBonus = 0;
    this.tempDEFBonus = 0;
    this.permATKBonus = 0;
    this.permDEFBonus = 0;
    this.phoenixRevivalUsed = false;
    this.equippedCards = [];
    // passive flags from effect
    if(card.effect && card.effect.trigger==='passive'){
      const flags = extractPassiveFlags(card.effect);
      this.piercing        = flags.piercing;
      this.cannotBeTargeted= flags.cannotBeTargeted;
      this.canDirectAttack = flags.canDirectAttack;
      this.vsAttrBonus     = flags.vsAttrBonus;
      this.phoenixRevival  = flags.phoenixRevival;
      this.indestructible  = flags.indestructible;
      this.effectImmune    = flags.effectImmune;
      this.cantBeAttacked  = flags.cantBeAttacked;
    } else {
      this.piercing = false;
      this.cannotBeTargeted = false;
      this.canDirectAttack  = false;
      this.vsAttrBonus     = null;
      this.phoenixRevival  = false;
      this.indestructible  = false;
      this.effectImmune    = false;
      this.cantBeAttacked  = false;
    }
  }
  effectiveATK(): number {
    return Math.max(0, (this.card.atk ?? 0) + this.tempATKBonus + this.permATKBonus);
  }
  effectiveDEF(): number {
    return Math.max(0, (this.card.def ?? 0) + this.tempDEFBonus + this.permDEFBonus);
  }
}

// ── FieldSpellTrap ─────────────────────────────────────────
export class FieldSpellTrap {
  card: CardData;
  faceDown: boolean;
  used: boolean;
  equippedMonsterZone?: number;
  equippedOwner?: Owner;

  constructor(card: CardData, faceDown=true){
    this.card    = card;
    this.faceDown= faceDown;
    this.used    = false;
  }
}
