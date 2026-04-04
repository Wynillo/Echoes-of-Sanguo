// ============================================================
// ECHOES OF SANGUO — @wynillo/tcg-format Public API
// ============================================================

// ── Types ────────────────────────────────────────────────────
export type {
  TcgCard,
  TcgParsedCard,
  TcgCardDefinition,
  TcgManifest,
  TcgMeta,
  TcgModJson,
  TcgOpponentDeck,
  TcgOpponentDescription,
  TcgFusionFormula,
  TcgLoadResult,
  TcgShopJson,
  TcgCampaignJson,
  TcgPackDef,
  TcgPackSlot,
  TcgCardPool,
  TcgCardPoolFilter,
  ValidationResult,
  TcgRaceEntry,
  TcgAttributeEntry,
  TcgCardTypeEntry,
  TcgRarityEntry,
  TcgRacesJson,
  TcgAttributesJson,
  TcgCardTypesJson,
  TcgRaritiesJson,
  TcgLocaleOverrides,
  TcgGameRules,
  CampaignData,
  CampaignChapter,
  CampaignNode,
  DuelNode,
  StoryNode,
  RewardNode,
  ShopNode,
  BranchNode,
  DialogueScene,
  DialogueLine,
  ForegroundSprite,
  UnlockCondition,
  CampaignRewards,
} from './types.js';

// ── Constants ────────────────────────────────────────────────
export {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP, TCG_TYPE_EQUIPMENT, TCG_TYPES,
  TCG_ATTR_LIGHT, TCG_ATTR_DARK, TCG_ATTR_FIRE, TCG_ATTR_WATER, TCG_ATTR_EARTH, TCG_ATTR_WIND, TCG_ATTRIBUTES,
  TCG_RACE_DRAGON, TCG_RACE_SPELLCASTER, TCG_RACE_WARRIOR, TCG_RACE_BEAST, TCG_RACE_PLANT, TCG_RACE_ROCK,
  TCG_RACE_PHOENIX, TCG_RACE_UNDEAD, TCG_RACE_AQUA, TCG_RACE_INSECT, TCG_RACE_MACHINE, TCG_RACE_PYRO, TCG_RACES,
  TCG_RARITY_COMMON, TCG_RARITY_UNCOMMON, TCG_RARITY_RARE, TCG_RARITY_SUPER_RARE, TCG_RARITY_ULTRA_RARE, TCG_RARITIES,
  TCG_SPELL_NORMAL, TCG_SPELL_TARGETED, TCG_SPELL_FROM_GRAVE, TCG_SPELL_FIELD, TCG_SPELL_TYPES,
  TCG_TRAP_ON_ATTACK, TCG_TRAP_ON_OWN_MONSTER_ATTACKED, TCG_TRAP_ON_OPPONENT_SUMMON, TCG_TRAP_MANUAL,
  TCG_TRAP_ON_OPPONENT_SPELL, TCG_TRAP_ON_ANY_SUMMON, TCG_TRAP_ON_OPPONENT_TRAP, TCG_TRAP_TRIGGERS,
  DEFAULT_GAME_RULES,
} from './types.js';

// ── Loader ───────────────────────────────────────────────────
export { loadTcgFile, TcgNetworkError, TcgFormatError } from './tcg-loader.js';

// ── Packer (Node.js only — uses node:fs) ─────────────────────
export { packTcgArchive, packTcgArchiveToBuffer } from './tcg-packer.js';
