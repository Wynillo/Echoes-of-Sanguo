// ============================================================
// AETHERIAL CLASH — Central Type Definitions
// Import with:  import type { Owner, GameState, ... } from './types.js';
// ============================================================

// ── Primitive Unions ────────────────────────────────────────

export type Owner        = 'player' | 'opponent';
export type Phase        = 'draw' | 'main' | 'battle' | 'end';
export type Position     = 'atk' | 'def';
export type CardType     = 'normal' | 'effect' | 'fusion' | 'spell' | 'trap';
export type Attribute    = 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark';
export type Race         = 'feuer' | 'drache' | 'flug' | 'stein' | 'pflanze' | 'krieger' | 'magier' | 'elfe' | 'daemon' | 'wasser';
export type RarityLevel  = 'common' | 'uncommon' | 'rare' | 'super_rare' | 'ultra_rare';
export type TrapTrigger  = 'onAttack' | 'onOwnMonsterAttacked' | 'onOpponentSummon' | 'manual';
export type EffectTrigger= 'onSummon' | 'onDestroyByBattle' | 'onDestroyByOpponent' | 'passive';
export type SpellType    = 'normal' | 'targeted' | 'fromGrave';

// ── Effect ──────────────────────────────────────────────────

export interface VsAttrBonus {
  attr: Attribute;
  atk:  number;
}

// ── Data-Driven Effect System ───────────────────────────────

/** Dynamic value expression — allows effects to reference runtime values */
export type ValueExpr =
  | number
  | { from: 'attacker.effectiveATK'; multiply: number; round: 'floor' | 'ceil' }
  | { from: 'summoned.atk';          multiply: number; round: 'floor' | 'ceil' };

/** Contextual target for stat modifications */
export type StatTarget = 'ownMonster' | 'oppMonster' | 'attacker' | 'defender' | 'summonedFC';

/** Discriminated union of all effect actions */
export type EffectDescriptor =
  // Damage & healing
  | { type: 'dealDamage';          target: 'opponent' | 'self'; value: ValueExpr }
  | { type: 'gainLP';             target: 'opponent' | 'self'; value: number | ValueExpr }
  // Card draw
  | { type: 'draw';               target: 'self' | 'opponent'; count: number }
  // Field buffs/debuffs (onSummon monster effects)
  | { type: 'buffAtkRace';        race: Race;      value: number }
  | { type: 'buffAtkAttr';        attr: Attribute;  value: number }
  | { type: 'debuffAllOpp';       atkD: number; defD: number }
  // Temporary field-wide buffs/debuffs (spell effects)
  | { type: 'tempBuffAtkRace';    race: Race;      value: number }
  | { type: 'tempDebuffAllOpp';   atkD: number; defD?: number }
  // Bounce
  | { type: 'bounceStrongestOpp' }
  | { type: 'bounceAttacker' }
  | { type: 'bounceAllOppMonsters' }
  // Search
  | { type: 'searchDeckToHand';   attr: Attribute }
  // Targeted stat modification (spells + traps)
  | { type: 'tempAtkBonus';       target: StatTarget; value: number }
  | { type: 'permAtkBonus';       target: StatTarget; value: number; attrFilter?: Attribute }
  | { type: 'tempDefBonus';       target: StatTarget; value: number }
  | { type: 'permDefBonus';       target: StatTarget; value: number }
  // Graveyard
  | { type: 'reviveFromGrave' }
  // Trap signals
  | { type: 'cancelAttack' }
  | { type: 'destroyAttacker' }
  | { type: 'destroySummonedIf';  minAtk: number }
  // Passive flags
  | { type: 'passive_piercing' }
  | { type: 'passive_untargetable' }
  | { type: 'passive_directAttack' }
  | { type: 'passive_vsAttrBonus'; attr: Attribute; atk: number }
  | { type: 'passive_phoenixRevival' };

/** Context passed to effect implementations at runtime */
export interface EffectContext {
  engine:       GameEngine;
  owner:        Owner;
  /** The targeted FieldCard (for targeted spells/traps) */
  targetFC?:    FieldCard;
  /** The targeted CardData (for fromGrave spells) */
  targetCard?:  CardData;
  /** The attacking FieldCard (for onAttack traps) */
  attacker?:    FieldCard;
  /** The defending FieldCard */
  defender?:    FieldCard;
  /** The FieldCard that was just summoned (for onOpponentSummon traps) */
  summonedFC?:  FieldCard;
}

/** Signal returned by effect execution — controls engine flow */
export interface EffectSignal {
  cancelAttack?:     boolean;
  destroySummoned?:  boolean;
  destroyAttacker?:  boolean;
}

/** Data-driven effect block — replaces CardEffect */
export interface CardEffectBlock {
  trigger:    EffectTrigger | TrapTrigger;
  actions:    EffectDescriptor[];
}

// ── Card ────────────────────────────────────────────────────

export interface CardData {
  id:           string;
  name:         string;
  type:         CardType;
  attribute?:   Attribute;
  race?:        Race;
  rarity?:      RarityLevel;
  level?:       number;
  atk?:         number;
  def?:         number;
  description:  string;
  effect?:      CardEffectBlock;
  // Spell / Trap extras
  spellType?:   SpellType;
  trapTrigger?: TrapTrigger;
  target?:      string;
}

// ── Deck recipe ─────────────────────────────────────────────

export interface FusionRecipe {
  materials: [string, string];
  result:    string;
}

// ── Opponent ─────────────────────────────────────────────────

export interface OpponentConfig {
  id:        number;
  name:      string;
  title:     string;
  race:      Race;
  flavor:    string;
  coinsWin:  number;
  coinsLoss: number;
  deckIds:   string[];
}

// ── Game state ───────────────────────────────────────────────

export interface PlayerState {
  lp:               number;
  deck:             CardData[];
  hand:             CardData[];
  field: {
    monsters:   Array<FieldCard | null>;
    spellTraps: Array<FieldSpellTrap | null>;
  };
  graveyard:        CardData[];
  normalSummonUsed: boolean;
}

export interface GameState {
  phase:        Phase;
  turn:         number;
  activePlayer: Owner;
  player:       PlayerState;
  opponent:     PlayerState;
  log:          string[];
}

// ── UI callbacks ─────────────────────────────────────────────

export interface PromptOptions {
  title:   string;
  cardId:  string;
  message: string;
  yes:     string;
  no:      string;
}

export interface UICallbacks {
  render:               (state: GameState) => void;
  log:                  (msg: string) => void;
  prompt?:              (opts: PromptOptions) => Promise<boolean>;
  showResult?:          (result: 'victory' | 'defeat') => void;
  showActivation?:      (card: CardData, text: string) => Promise<void> | void;
  playAttackAnimation?: (atkOwner: Owner, atkZone: number, defOwner: Owner, defZone: number | null) => Promise<void>;
  onDraw?:              (owner: Owner, count: number) => void;
  onDuelEnd?:           (result: 'victory' | 'defeat', oppId: number | null) => void;
}

// ── Progression ──────────────────────────────────────────────

export interface CollectionEntry {
  id:    string;
  count: number;
}

export interface OpponentRecord {
  unlocked: boolean;
  wins:     number;
  losses:   number;
}

// ── Forward declarations — implemented in engine.ts ──────────
// (Used in type signatures above before the class files are loaded)

export declare class FieldCard {
  constructor(card: CardData, position?: Position, faceDown?: boolean);
  card:             CardData;
  position:         Position;
  faceDown:         boolean;
  hasAttacked:      boolean;
  summonedThisTurn: boolean;
  tempATKBonus:     number;
  permATKBonus:     number;
  permDEFBonus:     number;
  phoenixRevivalUsed: boolean;
  piercing:         boolean;
  cannotBeTargeted: boolean;
  canDirectAttack:  boolean;
  vsAttrBonus:      VsAttrBonus | null;
  phoenixRevival:   boolean;
  effectiveATK():   number;
  effectiveDEF():   number;
}

export declare class FieldSpellTrap {
  constructor(card: CardData, faceDown?: boolean);
  card:     CardData;
  faceDown: boolean;
  used:     boolean;
}

export declare class GameEngine {
  constructor(uiCallbacks: UICallbacks);
  state:   GameState;
  initGame(playerDeckIds: string[], opponentConfig: OpponentConfig | null): void;
  getState(): GameState;
  addLog(msg: string): void;
  dealDamage(target: Owner, amount: number): void;
  gainLP(target: Owner, amount: number): void;
  drawCard(owner: Owner, count?: number): void;
  specialSummonFromGrave(owner: Owner, card: CardData): boolean;
  endTurn(): void;
  advancePhase(): void;
}
