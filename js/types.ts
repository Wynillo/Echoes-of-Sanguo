export type Owner        = 'player' | 'opponent';
export type Phase        = 'draw' | 'main' | 'battle' | 'end';
export type Position     = 'atk' | 'def';
export type TrapTrigger  = 'onAttack' | 'onOwnMonsterAttacked' | 'onOpponentSummon' | 'manual' | 'onOpponentSpell' | 'onAnySummon';
export type EffectTrigger= 'onSummon' | 'onDestroyByBattle' | 'onDestroyByOpponent' | 'passive' | 'onFlip' | 'onDealBattleDamage' | 'onSentToGrave';
export type SpellType    = 'normal' | 'targeted' | 'fromGrave' | 'field';

// Monster covers both normal and effect cards; distinction via effect field.
export enum CardType {
  Monster   = 1,
  Fusion    = 2,
  Spell     = 3,
  Trap      = 4,
  Equipment = 5,
}

export enum Attribute {
  Light = 1,
  Dark  = 2,
  Fire  = 3,
  Water = 4,
  Earth = 5,
  Wind  = 6,
}

export enum Race {
  Dragon      = 1,
  Spellcaster = 2,
  Warrior     = 3,
  Beast       = 4,
  Plant       = 5,
  Rock        = 6,
  Phoenix     = 7,
  Undead      = 8,
  Aqua        = 9,
  Insect      = 10,
  Machine     = 11,
  Pyro        = 12,
}

export enum Rarity {
  Common    = 1,
  Uncommon  = 2,
  Rare      = 4,
  SuperRare = 6,
  UltraRare = 8,
}

/** @deprecated Use Rarity enum instead */
export type RarityLevel = Rarity;

export function isEffectMonster(card: CardData): boolean {
  return card.type === CardType.Monster && !!card.effect;
}

export function isMonsterType(type: CardType): boolean {
  return type === CardType.Monster || type === CardType.Fusion;
}

export function isEquipmentType(type: CardType): boolean {
  return type === CardType.Equipment;
}

export interface VsAttrBonus {
  attr: Attribute;
  atk:  number;
}

export type ValueExpr =
  | number
  | { from: 'attacker.effectiveATK'; multiply: number; round: 'floor' | 'ceil' }
  | { from: 'summoned.atk';          multiply: number; round: 'floor' | 'ceil' };

export type StatTarget = 'ownMonster' | 'oppMonster' | 'attacker' | 'defender' | 'summonedFC';

export interface CardFilter {
  race?:      Race;
  attr?:      Attribute;
  cardType?:  CardType;
  cardId?:    string;
  maxAtk?:    number;
  minAtk?:    number;
  maxDef?:    number;
  maxLevel?:  number;
  minLevel?:  number;
  random?:    number;
}

/**
 * Open map of effect action types → payloads.
 * Modders can extend this via declaration merging to add custom effect types.
 */
export interface EffectDescriptorMap {
  dealDamage:            { target: 'opponent' | 'self'; value: ValueExpr };
  gainLP:               { target: 'opponent' | 'self'; value: number | ValueExpr };
  draw:                 { target: 'self' | 'opponent'; count: number };
  buffField:            { value: number; filter?: CardFilter };
  tempBuffField:        { value: number; filter?: CardFilter };
  debuffField:          { atkD: number; defD: number };
  tempDebuffField:      { atkD: number; defD?: number };
  bounceStrongestOpp:   {};
  bounceAttacker:       {};
  bounceAllOppMonsters: {};
  searchDeckToHand:     { filter: CardFilter };
  tempAtkBonus:         { target: StatTarget; value: number };
  permAtkBonus:         { target: StatTarget; value: number; filter?: CardFilter };
  tempDefBonus:         { target: StatTarget; value: number };
  permDefBonus:         { target: StatTarget; value: number };
  reviveFromGrave:      {};
  cancelAttack:         {};
  cancelEffect:         {};
  destroyAttacker:      {};
  destroySummonedIf:    { minAtk: number };
  destroyAllOpp:        {};
  destroyAll:           {};
  destroyWeakestOpp:    {};
  destroyStrongestOpp:  {};
  sendTopCardsToGrave:    { count: number };
  sendTopCardsToGraveOpp: { count: number };
  salvageFromGrave:       { filter: CardFilter };
  recycleFromGraveToDeck: { filter: CardFilter };
  shuffleGraveIntoDeck:   {};
  shuffleDeck:            {};
  peekTopCard:            {};
  specialSummonFromHand:  { filter?: CardFilter };
  discardFromHand:      { count: number };
  discardOppHand:       { count: number };
  passive_piercing:          {};
  passive_untargetable:      {};
  passive_directAttack:      {};
  passive_vsAttrBonus:  { attr: Attribute; atk: number };
  passive_phoenixRevival:    {};
  passive_indestructible:    {};
  passive_effectImmune:      {};
  passive_cantBeAttacked:    {};
  destroyOppSpellTrap:       {};
  destroyAllOppSpellTraps:   {};
  destroyAllSpellTraps:      {};
  destroyOppFieldSpell:      {};
  changePositionOpp:         {};
  setFaceDown:               {};
  flipAllOppFaceDown:        {};
  destroyByFilter:           { filter?: CardFilter; mode: 'weakest' | 'strongest' | 'highestDef' | 'first'; side?: 'opponent' | 'self' };
  halveAtk:                  { target: StatTarget };
  doubleAtk:                 { target: StatTarget };
  swapAtkDef:                { side: 'self' | 'opponent' | 'all' };
  specialSummonFromDeck:     { filter: CardFilter; faceDown?: boolean; position?: Position };
  reflectBattleDamage:       {};
  stealMonster:              {};
  skipOppDraw:               {};
  discardEntireHand:         { target: 'self' | 'opponent' | 'both' };
  destroyAndDamageBoth:      { side: 'opponent' | 'self' };
  preventBattleDamage:       {};
}

export type EffectDescriptor = {
  [K in keyof EffectDescriptorMap]: { type: K } & EffectDescriptorMap[K]
}[keyof EffectDescriptorMap];

export interface EffectContext {
  engine:       GameEngine;
  owner:        Owner;
  targetFC?:    FieldCard;   // targeted FieldCard (targeted spells/traps)
  targetCard?:  CardData;    // targeted CardData (fromGrave spells)
  attacker?:    FieldCard;   // attacking FieldCard (onAttack traps)
  defender?:    FieldCard;
  summonedFC?:  FieldCard;   // FieldCard just summoned (onOpponentSummon traps)
}

export interface EffectSignal {
  cancelAttack?:     boolean;
  destroySummoned?:  boolean;
  destroyAttacker?:  boolean;
  cancelEffect?:     boolean;
  reflectDamage?:    boolean;
}

export interface EffectCost {
  lp?:      number;
  discard?: number;
}

export interface CardEffectBlock {
  trigger:    EffectTrigger | TrapTrigger;
  actions:    EffectDescriptor[];
  cost?:      EffectCost;
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
  spellType?:   SpellType;
  trapTrigger?: TrapTrigger;
  target?:      string;
  atkBonus?:    number;
  defBonus?:    number;
  equipRequirement?: EquipRequirement;
}

export interface EquipRequirement {
  race?: Race;
  attr?: Attribute;
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
  operand1:   number;    // Race (1-12) or Attribute (1-6) enum value
  operand2:   number;    // Race (1-12) or Attribute (1-6) enum value
  priority:   number;    // Higher = checked first
  resultPool: string[];  // Card IDs (string, post-loader conversion)
}

export type AISummonPriority   = 'highestATK' | 'highestDEF' | 'effectFirst' | 'lowestLevel';
export type AIPositionStrategy = 'smart' | 'aggressive' | 'defensive';
export type AIBattleStrategy   = 'smart' | 'aggressive' | 'conservative';

export interface AISpellRule {
  when: 'always' | 'oppLP>N' | 'selfLP<N';
  threshold?: number;
}

export type AIGoalId =
  | 'fusion_otk'   // hunt fusion OTK windows, save hand for materials
  | 'stall_drain'  // preserve LP, skip battle unless lethal
  | 'swarm_aggro'  // flood board, attack always
  | 'control';     // remove threats first, advance slowly

export interface AIGoal {
  id:             AIGoalId;
  alignmentBonus: number;  // added to actions matching this goal
  switchTurn?:    number;  // if set, deactivate goal at this turn number
}

export interface BoardSnapshot {
  aiLP:            number;
  plrLP:           number;
  aiMonsterPower:  number;  // sum of effectiveATK of AI field monsters
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
  lookaheadDepth?:          number;  // 0 = disabled, 1 = one-step lookahead
  gamma?:                   number;  // discount factor 0.0–1.0
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
  deckIds:     string[];
  behaviorId?: string;
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

export interface UICallbacks {
  render:               (state: GameState) => void;
  log:                  (msg: string) => void;
  prompt?:              (opts: PromptOptions) => Promise<boolean>;
  showResult?:          (result: 'victory' | 'defeat') => void;
  showActivation?:      (card: CardData, text: string) => Promise<void> | void;
  playAttackAnimation?: (atkOwner: Owner, atkZone: number, defOwner: Owner, defZone: number | null) => Promise<void>;
  playFusionAnimation?: (owner: Owner, handIdx1: number, handIdx2: number, resultZone: number) => Promise<void>;
  playFusionChainAnimation?: (owner: Owner, handIndices: number[], resultZone: number) => Promise<void>;
  playVFX?:             (type: 'buff' | 'heal' | 'damage', owner: Owner, zone?: number) => Promise<void>;
  playSfx?:             (sfxId: string) => void;
  showDamageNumber?:    (amount: number, owner: Owner) => void;
  onDraw?:              (owner: Owner, count: number) => void;
  onDuelEnd?:           (result: 'victory' | 'defeat', oppId: number | null, stats: DuelStats) => void;
  showCoinToss?:        (playerGoesFirst: boolean) => Promise<void>;
}

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
  hasFlipped:       boolean;
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
  vsAttrBonus:      VsAttrBonus | null;
  phoenixRevival:   boolean;
  indestructible:   boolean;
  effectImmune:     boolean;
  cantBeAttacked:   boolean;
  equippedCards:    Array<{ zone: number; card: CardData }>;
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
  specialSummon(owner: Owner, card: CardData, zone?: number): Promise<boolean>;
  specialSummonFromGrave(owner: Owner, card: CardData): Promise<boolean>;
  performFusionChain(owner: Owner, handIndices: number[]): Promise<boolean>;
  equipCard(owner: Owner, handIndex: number, targetOwner: Owner, targetMonsterZone: number): Promise<boolean>;
  activateFieldSpell(owner: Owner, handIndex: number): Promise<boolean>;
  _removeEquipmentForMonster(monsterOwner: Owner, monsterZone: number): void;
  endTurn(): void;
  advancePhase(): void;
}
