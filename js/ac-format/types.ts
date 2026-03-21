// ============================================================
// AETHERIAL CLASH — .ac File Format Types
// Int-based enums for the portable card exchange format
// ============================================================

// ── Card Type ────────────────────────────────────────────────
// 1=Monster (normal+effect), 2=Fusion, 3=Spell, 4=Trap
export const AC_TYPE_MONSTER = 1;
export const AC_TYPE_FUSION  = 2;
export const AC_TYPE_SPELL   = 3;
export const AC_TYPE_TRAP    = 4;
export const AC_TYPES = [AC_TYPE_MONSTER, AC_TYPE_FUSION, AC_TYPE_SPELL, AC_TYPE_TRAP] as const;

// ── Attribute ────────────────────────────────────────────────
export const AC_ATTR_LIGHT = 1;
export const AC_ATTR_DARK  = 2;
export const AC_ATTR_FIRE  = 3;
export const AC_ATTR_WATER = 4;
export const AC_ATTR_EARTH = 5;
export const AC_ATTR_WIND  = 6;
export const AC_ATTRIBUTES = [AC_ATTR_LIGHT, AC_ATTR_DARK, AC_ATTR_FIRE, AC_ATTR_WATER, AC_ATTR_EARTH, AC_ATTR_WIND] as const;

// ── Race ─────────────────────────────────────────────────────
export const AC_RACE_DRAGON      = 1;
export const AC_RACE_SPELLCASTER = 2;
export const AC_RACE_WARRIOR     = 3;
export const AC_RACE_FIRE        = 4;
export const AC_RACE_PLANT       = 5;
export const AC_RACE_STONE       = 6;
export const AC_RACE_FLYER       = 7;
export const AC_RACE_ELF         = 8;
export const AC_RACE_DEMON       = 9;
export const AC_RACE_WATER       = 10;
export const AC_RACES = [AC_RACE_DRAGON, AC_RACE_SPELLCASTER, AC_RACE_WARRIOR, AC_RACE_FIRE, AC_RACE_PLANT, AC_RACE_STONE, AC_RACE_FLYER, AC_RACE_ELF, AC_RACE_DEMON, AC_RACE_WATER] as const;

// ── Rarity (1-8 range) ──────────────────────────────────────
export const AC_RARITY_COMMON     = 1;
export const AC_RARITY_UNCOMMON   = 2;
export const AC_RARITY_RARE       = 4;
export const AC_RARITY_SUPER_RARE = 6;
export const AC_RARITY_ULTRA_RARE = 8;
export const AC_RARITIES = [AC_RARITY_COMMON, AC_RARITY_UNCOMMON, AC_RARITY_RARE, AC_RARITY_SUPER_RARE, AC_RARITY_ULTRA_RARE] as const;

// ── Card Schema ──────────────────────────────────────────────

export interface AcCard {
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

export interface AcCardDefinition {
  id:          number;
  name:        string;
  description: string;
}

// ── AC Archive metadata ──────────────────────────────────────

export interface AcMeta {
  fusionRecipes?: Array<{ materials: [number, number]; result: number }>;
  opponentConfigs?: Array<{
    id:        number;
    name:      string;
    title:     string;
    race:      number;
    flavor:    string;
    coinsWin:  number;
    coinsLoss: number;
    deckIds:   number[];
  }>;
  starterDecks?: Record<string, number[]>;
}

// ── Validation result ────────────────────────────────────────

export interface ValidationResult {
  valid:    boolean;
  errors:   string[];
  warnings: string[];
}

// ── Load result ──────────────────────────────────────────────

export interface AcLoadResult {
  cards:       AcCard[];
  definitions: Map<string, AcCardDefinition[]>;  // lang -> definitions
  images:      Map<number, string>;               // card id -> blob URL
  meta?:       AcMeta;
  warnings:    string[];
}
