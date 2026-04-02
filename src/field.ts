import { extractPassiveFlags } from './effect-registry.js';
import type { CardData, Owner, Position, VsAttrBonus } from './types.js';

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
  vsAttrBonus: VsAttrBonus | null;
  phoenixRevival: boolean;
  indestructible: boolean;
  effectImmune: boolean;
  cantBeAttacked: boolean;
  equippedCards: Array<{ zone: number; card: CardData }>;
  originalOwner?: Owner;

  constructor(card: CardData, position: Position = 'atk', faceDown: boolean = false) {
    this.card       = { // deep-copy effect to prevent shared mutations across FieldCard instances
      ...card,
      effect: card.effect ? { ...card.effect, actions: card.effect.actions.map(a => ({ ...a })) } : undefined,
      effects: card.effects ? card.effects.map(b => ({ ...b, actions: b.actions.map(a => ({ ...a })) })) : undefined,
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
    this.vsAttrBonus     = null;
    this.phoenixRevival  = false;
    this.indestructible  = false;
    this.effectImmune    = false;
    this.cantBeAttacked  = false;

    const passiveBlocks = this._getPassiveBlocks();
    for (const block of passiveBlocks) {
      const flags = extractPassiveFlags(block);
      if (flags.piercing)        this.piercing = true;
      if (flags.cannotBeTargeted) this.cannotBeTargeted = true;
      if (flags.canDirectAttack) this.canDirectAttack = true;
      if (flags.vsAttrBonus)     this.vsAttrBonus = flags.vsAttrBonus;
      if (flags.phoenixRevival)  this.phoenixRevival = true;
      if (flags.indestructible)  this.indestructible = true;
      if (flags.effectImmune)    this.effectImmune = true;
      if (flags.cantBeAttacked)  this.cantBeAttacked = true;
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
