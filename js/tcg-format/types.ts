// ============================================================
// ECHOES OF SANGUO — .tcg File Format Types
// Int-based enums for the portable card exchange format
// ============================================================

// ── Card Type ────────────────────────────────────────────────
// 1=Monster (normal+effect), 2=Fusion, 3=Spell, 4=Trap
export const TCG_TYPE_MONSTER = 1;
export const TCG_TYPE_FUSION  = 2;
export const TCG_TYPE_SPELL   = 3;
export const TCG_TYPE_TRAP    = 4;
export const TCG_TYPES = [TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP] as const;

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
export const TCG_RACE_FIRE        = 4;
export const TCG_RACE_PLANT       = 5;
export const TCG_RACE_STONE       = 6;
export const TCG_RACE_FLYER       = 7;
export const TCG_RACE_ELF         = 8;
export const TCG_RACE_DEMON       = 9;
export const TCG_RACE_WATER       = 10;
export const TCG_RACES = [TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_FIRE, TCG_RACE_PLANT, TCG_RACE_STONE, TCG_RACE_FLYER, TCG_RACE_ELF, TCG_RACE_DEMON, TCG_RACE_WATER] as const;

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
  race?:      number;       // 1-10, absent for Spells/Traps
  effect?:    string;       // serialized effect string
  spellType?:   number;    // 1=normal, 2=targeted, 3=fromGrave
  trapTrigger?: number;    // 1=onAttack, 2=onOwnMonsterAttacked, 3=onOpponentSummon, 4=manual
  target?:      string;    // targeting hint: 'ownMonster', 'oppMonster', etc.
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
  race:      number;    // TCG int (1-10), converted to Race enum by loader
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

// ── types.json schema (enum visual metadata) ─────────────────

export interface TcgTypesJson {
  races?:      Array<{ id: number; key: string; color: string; icon: string; symbol: string; abbr: string }>;
  attributes?: Array<{ id: number; key: string; color: string; symbol: string; name: string }>;
  rarities?:   Array<{ id: number; key: string; color: string; name: string }>;
  cardTypes?:  Array<{ id: number; key: string; label: string; css: string }>;
}

// ── TCG Archive metadata ──────────────────────────────────────


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
