import { extractPassiveFlags } from './effect-registry.js';
import type { CardData, Owner, Position } from './types.js';

export class FieldCard {
  card: CardData;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  hasFlipSummoned: boolean;
  summonedThisTurn: boolean;
  tempATKBonus: number;
  tempDEFBonus: number;
  permATKBonus: number;
  permDEFBonus: number;
  fieldSpellATKBonus: number;
  fieldSpellDEFBonus: number;
  phoenixRevivalUsed: boolean;
  piercing: boolean;
  cannotBeTargeted: boolean;
  canDirectAttack: boolean;
  hasPhoenixRevival: boolean;
  indestructible: boolean;
  isEffectImmune: boolean;
  cannotBeAttacked: boolean;
  equippedCards: Array<{ zone: number; card: CardData }>;
  originalOwner?: Owner;

  constructor(card: CardData, position: Position = 'atk', faceDown: boolean = false) {
    this.card       = { // deep-copy effect to prevent shared mutations across FieldCard instances
      ...card,
      effect: card.effect ? { ...card.effect, actions: card.effect.actions.map((a: import('./types.js').EffectDescriptor) => ({ ...a })) } : undefined,
      effects: card.effects ? card.effects.map(b => ({ ...b, actions: b.actions.map((a: import('./types.js').EffectDescriptor) => ({ ...a })) })) : undefined,
    };
    this.position   = position; // 'atk' | 'def'
    this.faceDown   = faceDown;
    this.hasAttacked= false;
    this.hasFlipSummoned = false;
    this.summonedThisTurn = false; // FM-style: no summoning sickness
    this.tempATKBonus = 0;
    this.tempDEFBonus = 0;
    this.permATKBonus = 0;
    this.permDEFBonus = 0;
    this.fieldSpellATKBonus = 0;
    this.fieldSpellDEFBonus = 0;
    this.phoenixRevivalUsed = false;
    this.equippedCards = [];
    // passive flags from effect blocks
    this.piercing = false;
    this.cannotBeTargeted = false;
    this.canDirectAttack  = false;
    this.hasPhoenixRevival  = false;
    this.indestructible  = false;
    this.isEffectImmune    = false;
    this.cannotBeAttacked  = false;

    const passiveBlocks = this._getPassiveBlocks();
    for (const block of passiveBlocks) {
      const flags = extractPassiveFlags(block);
      if (flags.piercing)           this.piercing = true;
      if (flags.cannotBeTargeted)   this.cannotBeTargeted = true;
      if (flags.canDirectAttack)    this.canDirectAttack = true;
      if (flags.hasPhoenixRevival)  this.hasPhoenixRevival = true;
      if (flags.indestructible)     this.indestructible = true;
      if (flags.isEffectImmune)     this.isEffectImmune = true;
      if (flags.cannotBeAttacked)   this.cannotBeAttacked = true;
    }
  }

  _getPassiveBlocks(): import('./types.js').CardEffectBlock[] {
    const blocks: import('./types.js').CardEffectBlock[] = [];
    if (this.card.effects) {
      for (const b of this.card.effects) {
        if (b.trigger === 'passive') blocks.push(b);
      }
    } else if (this.card.effect && this.card.effect.trigger === 'passive') {
      blocks.push(this.card.effect);
    }
    return blocks;
  }
  effectiveATK(): number {
    return Math.max(0, (this.card.atk ?? 0) + this.tempATKBonus + this.permATKBonus + this.fieldSpellATKBonus);
  }
  effectiveDEF(): number {
    return Math.max(0, (this.card.def ?? 0) + this.tempDEFBonus + this.permDEFBonus + this.fieldSpellDEFBonus);
  }
  /** Returns the effective combat value based on current position. */
  combatValue(): number {
    return this.position === 'atk' ? this.effectiveATK() : this.effectiveDEF();
  }
}

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
