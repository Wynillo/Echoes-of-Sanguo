// ============================================================
// ECHOES OF SANGUO — .tcg File Format Types
// Int-based enums for the portable card exchange format
// ============================================================

// ── Card Type ────────────────────────────────────────────────
// 1=Monster (normal+effect), 2=Fusion, 3=Spell, 4=Trap, 5=Equipment
export const TCG_TYPE_MONSTER   = 1;
export const TCG_TYPE_FUSION    = 2;
export const TCG_TYPE_SPELL     = 3;
export const TCG_TYPE_TRAP      = 4;
export const TCG_TYPE_EQUIPMENT = 5;
export const TCG_TYPES = [TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_EQUIPMENT] as const;

// ── Attribute ────────────────────────────────────────────────
export const TCG_ATTR_LIGHT = 1;
export const TCG_ATTR_DARK  = 2;
export const TCG_ATTR_FIRE  = 3;
export const TCG_ATTR_WATER = 4;
export const TCG_ATTR_EARTH = 5;
export const TCG_ATTR_WIND  = 6;
export const TCG_ATTRIBUTES = [TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND] as const;

// ── Race ─────────────────────────────────────────────────────
export const TCG_RACE_DRAGON      = 1;
export const TCG_RACE_SPELLCASTER = 2;
export const TCG_RACE_WARRIOR     = 3;
export const TCG_RACE_BEAST       = 4;
export const TCG_RACE_PLANT       = 5;
export const TCG_RACE_ROCK        = 6;
export const TCG_RACE_PHOENIX     = 7;
export const TCG_RACE_UNDEAD      = 8;
export const TCG_RACE_AQUA        = 9;
export const TCG_RACE_INSECT      = 10;
export const TCG_RACE_MACHINE     = 11;
export const TCG_RACE_PYRO        = 12;
export const TCG_RACES = [TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_BEAST, TCG_RACE_PLANT, TCG_RACE_ROCK, TCG_RACE_PHOENIX, TCG_RACE_UNDEAD, TCG_RACE_AQUA, TCG_RACE_INSECT, TCG_RACE_MACHINE, TCG_RACE_PYRO] as const;

// ── Rarity (1-8 range) ──────────────────────────────────────
export const TCG_RARITY_COMMON     = 1;
export const TCG_RARITY_UNCOMMON   = 2;
export const TCG_RARITY_RARE       = 4;
export const TCG_RARITY_SUPER_RARE = 6;
export const TCG_RARITY_ULTRA_RARE = 8;
export const TCG_RARITIES = [TCG_RARITY_COMMON, TCG_RARITY_UNCOMMON, TCG_RARITY_RARE, TCG_RARITY_SUPER_RARE, TCG_RARITY_ULTRA_RARE] as const;

// ── Card Schema ──────────────────────────────────────────────

export interface TcgCard {
  id:         number;
  level:      number;       // 1-12
  atk?:       number;       // optional, absent for Spells/Traps
  def?:       number;       // optional, absent for Spells/Traps
  rarity:     number;       // 1-8
  type:       number;       // 1-4
  attribute?: number;       // 1-6, absent for Spells/Traps
  race?:      number;       // 1-12, absent for Spells/Traps
  effect?:    string;       // serialized effect string
  spellType?:   number;    // 1=normal, 2=targeted, 3=fromGrave
  trapTrigger?: number;    // 1=onAttack, 2=onOwnMonsterAttacked, 3=onOpponentSummon, 4=manual
  target?:      string;    // targeting hint: 'ownMonster', 'oppMonster', etc.
  atkBonus?:    number;    // Equipment: ATK bonus applied to equipped monster
  defBonus?:    number;    // Equipment: DEF bonus applied to equipped monster
}

// ── Card Definition (localized) ──────────────────────────────

export interface TcgCardDefinition {
  id:          number;
  name:        string;
  description: string;
}

// ── Opponent Deck (opponents/opponent_deck_N.json inside base.tcg) ──

export interface TcgOpponentDeck {
  id:        number;
  name:      string;
  title:     string;
  race:      number;    // TCG int (1-12), converted to Race enum by loader
  flavor:    string;
  coinsWin:  number;
  coinsLoss: number;
  deckIds:   number[];  // numeric card IDs, converted to string IDs by loader
  behavior?: string;    // AI behavior profile name (e.g. 'aggressive', 'defensive')
}

// ── Opponent Description (localized) ────────────────────────────

export interface TcgOpponentDescription {
  id:     number;
  name:   string;
  title:  string;
  flavor: string;
}

// ── Manifest (format versioning & feature flags) ────────────────

export interface TcgManifest {
  formatVersion: number;
  name?: string;
  author?: string;
  features?: string[];
  minEngineVersion?: string;
}

// ── Races JSON ───────────────────────────────────────────────

export interface TcgRaceEntry {
  id:     number;
  key:    string;
  value:  string;
  color:  string;
  icon?:  string;
}
export type TcgRacesJson = TcgRaceEntry[];

// ── Attributes JSON ──────────────────────────────────────────

export interface TcgAttributeEntry {
  id:      number;
  key:     string;
  value:   string;
  color:   string;
  symbol?: string;
}
export type TcgAttributesJson = TcgAttributeEntry[];

// ── Card Types JSON ──────────────────────────────────────────

export interface TcgCardTypeEntry {
  id:    number;
  key:   string;
  value: string;
  color: string;
}
export type TcgCardTypesJson = TcgCardTypeEntry[];

// ── Rarities JSON ────────────────────────────────────────────

export interface TcgRarityEntry {
  id:    number;
  key:   string;
  value: string;
  color: string;
}
export type TcgRaritiesJson = TcgRarityEntry[];

// ── Locale overrides ─────────────────────────────────────────
// key → translated value
export type TcgLocaleOverrides = Record<string, string>;

// ── TCG Archive metadata ──────────────────────────────────────


// ── Fusion Formulas (type-based, Forbidden Memories style) ──

export interface TcgFusionFormula {
  id:         string;
  comboType:  string;    // 'race+race' | 'race+attr' | 'attr+attr'
  operand1:   number;
  operand2:   number;
  priority:   number;
  resultPool: number[];  // numeric card IDs (converted to string by loader)
}

export interface TcgMeta {
  fusionRecipes?: Array<{ materials: [number, number]; result: number }>;
  opponentConfigs?: TcgOpponentDeck[];
  starterDecks?: Record<string, number[]>;
}

// ── Validation result ────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Shop JSON schema ─────────────────────────────────────────

export interface TcgPackSlot {
  count: number;
  rarity?: number;
  pool?: string;
  distribution?: Record<string, number>;
}

export interface TcgPackDef {
  id: string;
  name: string;
  desc: string;
  price: number;
  icon: string;
  color: string;
  slots: TcgPackSlot[];
  filter?: string;
}

export interface TcgShopJson {
  packs: TcgPackDef[];
  currency?: { nameKey: string; icon: string };
}

// ── Campaign JSON (alias) ────────────────────────────────

export type { CampaignData as TcgCampaignJson } from '../campaign-types.js';

// ── Load result ──────────────────────────────────────────────

export interface TcgLoadResult {
  cards:       TcgCard[];
  definitions: Map<string, TcgCardDefinition[]>;  // lang -> definitions
  images:      Map<number, string>;               // card id -> blob URL
  meta?:       TcgMeta;
  manifest?:   TcgManifest;
  warnings:    string[];
}

// ── Campaign System ───────────────────────────────────────────

export type NodeStatus = 'locked' | 'available' | 'complete';
export type CampaignProgress = Record<string, NodeStatus>;

export interface CampaignData { chapters: CampaignChapter[]; }
export interface CampaignChapter { id: string; titleKey: string; nodes: CampaignNode[]; }

export type CampaignNode = DuelNode | StoryNode | RewardNode | ShopNode | BranchNode;

interface NodeBase {
  id: string;
  type: string;
  position: { x: number; y: number };
  mapIcon: string | null;
  unlockCondition: UnlockCondition | null;
  rewards: CampaignRewards | null;
}
export interface DuelNode   extends NodeBase { type: 'duel';   opponentId: number; isBoss: boolean; completeOnLoss?: boolean; preDialogue: DialogueScene | null; postDialogue: DialogueScene | null; }
export interface StoryNode  extends NodeBase { type: 'story';  scene: DialogueScene; }
export interface RewardNode extends NodeBase { type: 'reward'; }
export interface ShopNode   extends NodeBase { type: 'shop';   shopId: string; }
export interface BranchNode extends NodeBase { type: 'branch'; promptKey: string; options: { labelKey: string; unlocks: string[] }[]; }

export type UnlockCondition =
  | { type: 'nodeComplete'; nodeId: string }
  | { type: 'allComplete';  nodeIds: string[] }
  | { type: 'anyComplete';  nodeIds: string[] }
  | { type: 'cardOwned';    cardId: number }
  | { type: 'winsCount';    count: number };

export interface CampaignRewards { coins: number | null; cards: string[] | null; unlocks: string[] | null; }

export interface DialogueScene { background: string; dialogue: DialogueLine[]; }
export interface DialogueLine {
  textKey: string;
  speaker: string;
  portrait: string | null;
  side: 'left' | 'right';
  foregrounds: ForegroundSprite[] | null;
}
export interface ForegroundSprite {
  sprite: string;
  position: 'far-left' | 'left' | 'center' | 'right' | 'far-right';
  flipX: boolean;
  active: boolean;
}
