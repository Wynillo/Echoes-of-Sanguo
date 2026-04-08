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
  TCG_SPELL_NORMAL, TCG_SPELL_TARGETED, TCG_SPELL_FROM_GRAVE, TCG_SPELL_FIELD, TCG_SPELL_TYPES,
  TCG_TRAP_ON_ATTACK, TCG_TRAP_ON_OWN_MONSTER_ATTACKED, TCG_TRAP_ON_OPPONENT_SUMMON, TCG_TRAP_MANUAL,
  TCG_TRAP_ON_OPPONENT_SPELL, TCG_TRAP_ON_ANY_SUMMON, TCG_TRAP_ON_OPPONENT_TRAP,
  TCG_TRAP_ON_OPP_CARD_EFFECT, TCG_TRAP_ON_OPPONENT_DRAW,
  TCG_TRAP_TRIGGERS, TCG_TRAP_TRIGGER_NAME_TO_ID,
  DEFAULT_GAME_RULES,
} from './types.js';

// ── Loader ───────────────────────────────────────────────────
export { loadTcgFile, TcgNetworkError, TcgFormatError } from './tcg-loader.js';

// ── Packer (Node.js only — uses node:fs) ─────────────────────
export { packTcgArchive, packTcgArchiveToBuffer } from './tcg-packer.js';
