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

export interface CardEffect {
  trigger?:           EffectTrigger;
  apply?:             (engine: GameEngine, owner: Owner, targetInfo?: unknown) => unknown;
  // Passive flags — read into FieldCard at construction time
  piercing?:          boolean;
  cannotBeTargeted?:  boolean;
  canDirectAttack?:   boolean;
  vsAttrBonus?:       VsAttrBonus;
  phoenixRevival?:    boolean;
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
  effect?:      CardEffect;
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
  phoenixRevived:   boolean;
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
  state:   GameState | null;
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
