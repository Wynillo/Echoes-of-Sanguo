/**
 * Type Definition Conventions
 * ===========================
 *
 * This file uses both `type` aliases and `interface` declarations following
 * these conventions:
 *
 * **Use `type` for:**
 * - Union types (e.g., `Owner`, `Phase`, `Position`)
 * - Type aliases for primitives that come from external sources
 *   (e.g., `Attribute`, `Race`, `Rarity` from TCG format)
 * - Mapped types and type transformations (e.g., `EffectDescriptor`)
 * - Re-exports of types from external libraries
 *
 * **Use `interface` for:**
 * - Object shapes representing data structures (e.g., `CardData`, `GameState`)
 * - When declaration merging or `extends` is needed
 * - Context and configuration objects (e.g., `EffectContext`, `OpponentConfig`)
 *
 * **Special case: Attribute, Race, Rarity**
 * These are defined as `type` aliases to `number` (not enums) because:
 * 1. They originate from the TCG format library as numeric IDs
 * 2. Type metadata (display names, colors, icons) is provided separately
 *    via `type-metadata.ts` using the `TYPE_META` registry
 * 3. This maintains compatibility with the external TCG format
 *
 * See: TypeScript Handbook - Interfaces vs Type Aliases
 * https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
 */

// Import effect types from TCG format library (single source of truth)
import type {
  TcgTrapTrigger,
  TcgEffectTrigger,
  TcgEffectDescriptorMap,
  TcgEffectDescriptor,
  TcgValueExpr,
  TcgStatTarget,
  TcgCardEffectFilter,
  TcgEquipRequirement,
  TcgEffectCost,
  TcgCardEffectBlock,
} from '@wynillo/tcg-format';

export type Owner        = 'player' | 'opponent';
export type Phase        = 'draw' | 'main' | 'battle';
export type Position     = 'atk' | 'def';
export type TrapTrigger  = TcgTrapTrigger;
export type EffectTrigger= TcgEffectTrigger;

// Monster covers both normal and effect cards; distinction via effect field.
export enum CardType {
  Monster   = 1,
  Fusion    = 2,
  Spell     = 3,
  Trap      = 4,
  Equipment = 5,
}

/**
 * Primitive type aliases for TCG numeric IDs.
 * These are not enums because they come from the external TCG format
 * as plain numbers. Type metadata is provided via type-metadata.ts.
 */
export type Attribute = number;
export type Race = number;

/**
 * Rarity enum for card rarity levels.
 * Values skip numbers to allow bit-flag operations and future expansion.
 */
export enum Rarity {
  COMMON = 1,
  UNCOMMON = 2,
  RARE = 4,
  SUPER_RARE = 6,
  ULTRA_RARE = 8,
}

// Type aliases for backward compatibility with existing code
export type EffectDescriptorMap = TcgEffectDescriptorMap;
export type EffectDescriptor = TcgEffectDescriptor;
export type ValueExpr = TcgValueExpr;
export type StatTarget = TcgStatTarget;
export type CardFilter = TcgCardEffectFilter;
export type EquipRequirement = TcgEquipRequirement;
export type EffectCost = TcgEffectCost;
export type CardEffectBlock = TcgCardEffectBlock;

// Also re-export for other modules
export type {
  TcgEffectDescriptorMap,
  TcgEffectDescriptor,
  TcgValueExpr,
  TcgStatTarget,
  TcgCardEffectFilter,
  TcgEquipRequirement,
  TcgEffectCost,
  TcgCardEffectBlock,
};

export function isMonsterType(type: CardType): boolean {
  return type === CardType.Monster || type === CardType.Fusion;
}

export interface EffectContext {
  engine:       GameEngine;
  owner:        Owner;
  target?:      FieldCard;   // targeted FieldCard (targeted spells/traps)
  targetCard?:  CardData;    // targeted CardData (fromGrave spells)
  attacker?:    FieldCard;   // attacking FieldCard (onAttack traps)
  defender?:    FieldCard;
  summoned?:    FieldCard;   // FieldCard just summoned (onOpponentSummon traps)
  abortSignal?: AbortSignal; // for timeout/step-limit cancellation
}

export interface PureEffectCtx {
  state:        GameState;
  owner:        Owner;
  target?:      FieldCard;
  targetCard?:  CardData;
  attacker?:    FieldCard;
  defender?:    FieldCard;
  summoned?:    FieldCard;
  log(msg: string): void;
  damage(owner: Owner, amount: number): void;
  heal(owner: Owner, amount: number): void;
  draw(owner: Owner, count?: number): void;
  removeEquipment(owner: Owner, zone: number): void;
  removeFieldSpell(owner: Owner): void;
  vfx?(type: 'buff' | 'heal' | 'damage', owner?: Owner, zone?: number): void;
}

export interface ChainEffectCtx extends PureEffectCtx {
  summon(
    owner: Owner,
    card: CardData,
    zone?: number,
    position?: Position,
    faceDown?: boolean,
  ): Promise<boolean>;
  summonFromGrave(owner: Owner, card: CardData, fromOwner?: Owner): Promise<boolean>;
  removeFromHand(owner: Owner, index: number): CardData;
  removeFromDeck(owner: Owner, index: number): CardData;
  selectFromDeck(cards: CardData[]): Promise<CardData | null>;
}

export interface EffectSignal {
  cancelAttack?:     boolean;
  destroySummoned?:  boolean;
  destroyAttacker?:  boolean;
  cancelEffect?:     boolean;
  reflectDamage?:    boolean;
}



export interface TurnCounter {
  turnsRemaining: number;
  effect: string;
}



export interface CardData {
  id:           string;
  name:         string;
  type:         CardType;
  attribute?:   Attribute;
  race?:        Race;
  rarity?:      Rarity;
  level?:       number;
  atk?:         number;
  def?:         number;
  description:  string;
  effect?:      CardEffectBlock;
  effects?:     CardEffectBlock[];
  spirit?:      boolean;
  trapTrigger?: TrapTrigger;
  target?:      string;
  atkBonus?:    number;
  defBonus?:    number;
  equipRequirement?: EquipRequirement;
}



export function meetsEquipRequirement(equipment: CardData, target: CardData): boolean {
  const req = equipment.equipRequirement;
  if (!req) return true;
  if (req.race !== undefined && target.race !== req.race) return false;
  if (req.attr !== undefined && target.attribute !== req.attr) return false;
  return true;
}

export interface FusionRecipe {
  materials: [string, string];
  result:    string;
}

export type FusionComboType = 'race+race' | 'race+attr' | 'attr+attr';

export interface FusionFormula {
  id:         string;
  comboType:  FusionComboType;
  operand1:   number;    // Race or Attribute enum value
  operand2:   number;    // Race or Attribute enum value
  priority:   number;    // Higher = checked first
  resultPool: string[];  // Card IDs (string, post-loader conversion)
}

export type AISummonPriority   = 'highestAtk' | 'highestDef' | 'effectFirst' | 'lowestLevel';
export type AIPositionStrategy = 'smart' | 'aggressive' | 'defensive';
export type AIBattleStrategy   = 'smart' | 'aggressive' | 'conservative';

export interface AISpellRule {
  when: 'always' | 'opponentLp>$N' | 'playerLp<$N';
  threshold?: number;
}

export type AIGoalId =
  | 'fusion_otk'   // hunt fusion OTK windows, save hand for materials
  | 'stall_drain'  // preserve LP, skip battle unless lethal
  | 'swarm_aggro'  // flood board, attack always
  | 'control';     // remove threats first, advance slowly

export interface AIGoal {
  id:             AIGoalId;
  alignmentBonus: number;
  switchTurn?:    number;
}

export interface BoardSnapshot {
  opponentLp:      number;
  playerLp:        number;
  aiMonsterPower:  number;
  plrMonsterPower: number;
  aiHandSize:      number;
  plrHandSize:     number;
}

export interface AIBehavior {
  fusionFirst?:             boolean;
  fusionMinATK?:            number;
  summonPriority?:          AISummonPriority;
  positionStrategy?:        AIPositionStrategy;
  battleStrategy?:          AIBattleStrategy;
  spellRules?:              Record<string, AISpellRule>;
  defaultSpellActivation?:  'always' | 'never' | 'smart';
  goal?:                    AIGoal;
  lookaheadDepth?:          number;
  gamma?:                   number;
  peekDeckCards?:           number;
  knowsPlayerHand?:         boolean;
  peekPlayerDeck?:          number;
  holdFusionPiece?:         boolean;
}

export interface OpponentConfig {
  id:          number;
  name:        string;
  title:       string;
  race:        Race;
  flavor:      string;
  coinsWin:    number;
  coinsLoss:   number;
  currencyId?: string;
  deckIds:     string[];
  behaviorId?: string;
  rewardConfig?: import('./reward-config.js').DuelRewardConfig;
}

export interface PlayerState {
  lp:               number;
  deck:             CardData[];
  hand:             CardData[];
  field: {
    monsters:   Array<FieldCard | null>;
    spellTraps: Array<FieldSpellTrap | null>;
    fieldSpell: FieldSpellTrap | null;
  };
  graveyard:        CardData[];
  normalSummonUsed: boolean;
  battleProtection?: boolean;
  turnCounters?: TurnCounter[];
  fieldFlags?: {
    negateTraps?: boolean;
    negateSpells?: boolean;
    negateMonsterEffects?: boolean;
  };
}

export interface GameState {
  phase:        Phase;
  turn:         number;
  activePlayer: Owner;
  player:       PlayerState;
  opponent:     PlayerState;
  log:          string[];
  firstTurnNoAttack?: boolean;
  skipNextDraw?: Owner;
  oneMoveActionUsed?: boolean;
}

export interface DuelStats {
  turns:            number;
  monstersPlayed:   number;
  fusionsPerformed: number;
  spellsActivated:  number;
  trapsActivated:   number;
  cardsDrawn:       number;
  lpRemaining:      number;
  opponentLpRemaining: number;
  deckRemaining:    number;
  graveyardSize:    number;
  opponentMonstersPlayed:   number;
  opponentFusionsPerformed: number;
  opponentSpellsActivated:  number;
  opponentTrapsActivated:   number;
  opponentDeckRemaining:    number;
  opponentGraveyardSize:    number;
  endReason: 'lp_zero' | 'deck_out' | 'surrender';
}

export interface BattleContext {
  triggerType: string;
  attackerName?: string;
  attackerAtk?: number;
  attackerCardId?: string;
  defenderName?: string;
  defenderDef?: number;
  defenderAtk?: number;
  defenderPos?: string;
  defenderCardId?: string;
}

export interface PromptOptions {
  title:   string;
  cardId:  string;
  message: string;
  yes:     string;
  no:      string;
  battleContext?: BattleContext;
}

/**
 * Interface Segregation Principle applied to UI callbacks.
 * Split into focused interfaces by concern:
 * - UIRender: Core rendering and logging
 * - UIAnimations: Visual animations (attacks, fusions, VFX)
 * - UIAudio: Sound effects
 * - UIPrompts: User interaction prompts
 * - UILifecycle: Game lifecycle events
 */

/** Core rendering and logging - required for any UI implementation */
export interface UIRender {
  render(state: GameState): void;
  log(msg: string): void;
}

/** Visual animations - optional for non-graphical interfaces */
export interface UIAnimations {
  playAttackAnimation(atkOwner: Owner, atkZone: number, defOwner: Owner, defZone: number | null): Promise<void>;
  playFusionAnimation(owner: Owner, handIdx1: number, handIdx2: number, resultZone: number): Promise<void>;
  playFusionChainAnimation(owner: Owner, handIndices: number[], resultZone: number): Promise<void>;
  playVFX(type: 'buff' | 'heal' | 'damage', owner: Owner, zone?: number): Promise<void>;
}

/** Audio/sound effects - optional for silent/muted interfaces */
export interface UIAudio {
  playSfx(sfxId: string): void;
}

/** User prompts and selections - optional for automated/non-interactive interfaces */
export interface UIPrompts {
  prompt(opts: PromptOptions): Promise<boolean>;
  selectFromDeck(cards: CardData[]): Promise<CardData>;
  showCoinToss(playerGoesFirst: boolean): Promise<void>;
}

/** Game lifecycle events - optional for headless/embedded engines */
export interface UILifecycle {
  showResult(result: 'victory' | 'defeat'): void;
  showActivation(card: CardData, text: string): Promise<void> | void;
  onDraw(owner: Owner, count: number): void;
  onDuelEnd(result: 'victory' | 'defeat', oppId: number | null, stats: DuelStats): void;
}

/** Damage number overlay - separate for fine-grained control */
export interface UIDamageFX {
  showDamageNumber(amount: number, owner: Owner): void;
}

/**
 * Legacy UICallbacks interface - kept for backwards compatibility.
 * New implementations should use the segregated interfaces directly.
 * 
 * @deprecated Use UIRender & Partial<UIAnimations> & Partial<UIAudio> & Partial<UIPrompts> & Partial<UILifecycle> & Partial<UIDamageFX>
 */
export interface UICallbacks extends UIRender, Partial<UIAnimations>, Partial<UIAudio>, Partial<UIPrompts>, Partial<UILifecycle>, Partial<UIDamageFX> {}

export interface CollectionEntry {
  id:    string;
  count: number;
}

export interface OpponentRecord {
  unlocked: boolean;
  wins:     number;
  losses:   number;
}

// Forward declarations — implemented in field.ts / engine.ts.
// Used in type signatures above before the class files are loaded.
export declare class FieldCard {
  constructor(card: CardData, position?: Position, faceDown?: boolean);
  card:             CardData;
  position:         Position;
  faceDown:         boolean;
  hasAttacked:      boolean;
  hasFlipSummoned:  boolean;
  summonedThisTurn: boolean;
  tempATKBonus:     number;
  tempDEFBonus:     number;
  permATKBonus:     number;
  permDEFBonus:     number;
  fieldSpellATKBonus: number;
  fieldSpellDEFBonus: number;
  phoenixRevivalUsed: boolean;
  piercing:         boolean;
  cannotBeTargeted: boolean;
  canDirectAttack:  boolean;
  hasPhoenixRevival: boolean;
  indestructible:   boolean;
  isEffectImmune:     boolean;
  cannotBeAttacked:   boolean;
  equippedCards:    Array<{ zone: number; card: CardData }>;
  originalOwner?:   Owner;
  effectiveATK():   number;
  effectiveDEF():   number;
  combatValue():    number;
}

export declare class FieldSpellTrap {
  constructor(card: CardData, faceDown?: boolean);
  card:     CardData;
  faceDown: boolean;
  used:     boolean;
  equippedMonsterZone?: number;
  equippedOwner?:       Owner;
}

export declare class GameEngine {
  constructor(uiCallbacks: UICallbacks);
  ui:      UICallbacks;
  state:   GameState;
  _currentOpponentId: number | null;
  _aiBehavior: Required<AIBehavior> & { _id?: string };
  initGame(playerDeckIds: string[], opponentConfig: OpponentConfig | null): Promise<void>;
  restoreGame(checkpoint: unknown): void;
  getState(): GameState;
  addLog(msg: string): void;
  dealDamage(target: Owner, amount: number): void;
  gainLP(target: Owner, amount: number): void;
  drawCard(owner: Owner, count?: number): void;
  refillHand(owner: Owner): void;
  specialSummon(owner: Owner, card: CardData, zone?: number, position?: Position, faceDown?: boolean): Promise<boolean>;
  specialSummonFromGrave(owner: Owner, card: CardData, fromOwner?: Owner): Promise<boolean>;
  performFusionChain(owner: Owner, handIndices: number[]): Promise<boolean>;
  equipCard(owner: Owner, handIndex: number, targetOwner: Owner, targetMonsterZone: number): Promise<boolean>;
  activateFieldSpell(owner: Owner, handIndex: number): Promise<boolean>;
  _removeEquipmentForMonster(monsterOwner: Owner, monsterZone: number): void;
  _removeFieldSpell(owner: Owner): void;
  removeEquipmentForMonster(owner: Owner, zone: number): void;
  removeFieldSpell(owner: Owner): void;
  removeFromHand(owner: Owner, index: number): CardData;
  removeFromDeck(owner: Owner, index: number): CardData;
  chainTribute(owner: Owner, card: CardData): Promise<void>;
  endTurn(): void;
  advancePhase(): void;
}

// Default implementations for testing and headless scenarios

/** Minimal silent UI implementation - useful for testing and headless engines */
export const SilentUI: UIRender = {
  render: () => {},
  log: () => {},
};

/** Null animations - no-op implementation for testing */
export const NullAnimations: UIAnimations = {
  playAttackAnimation: () => Promise.resolve(),
  playFusionAnimation: () => Promise.resolve(),
  playFusionChainAnimation: () => Promise.resolve(),
  playVFX: () => Promise.resolve(),
};

/** Silent audio - no-op implementation for muted testing */
export const SilentAudio: UIAudio = {
  playSfx: () => {},
};

/** Null prompts - should not be used without overrides, causes infinite waits */
export const NullPrompts: UIPrompts = {
  prompt: () => Promise.resolve(false),
  selectFromDeck: (cards: CardData[]) => Promise.resolve(cards[0]),
  showCoinToss: () => Promise.resolve(),
};

/** Minimal lifecycle - no-op for embedded/headless scenarios */
export const NullLifecycle: UILifecycle = {
  showResult: () => {},
  showActivation: () => {},
  onDraw: () => {},
  onDuelEnd: () => {},
};

/** Null damage FX - no-op for testing */
export const NullDamageFX: UIDamageFX = {
  showDamageNumber: () => {},
};
