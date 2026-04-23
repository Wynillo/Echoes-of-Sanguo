/**
 * UI timing constants for animations and timeouts.
 * Centralized to ensure consistent timing and enable global tuning.
 */
export const ANIMATION_TIMING = {
  /** Pack opening effects */
  PACK_SPARKLE_REMOVE_MS: 1200,
  PACK_BEAM_REMOVE_MS: 1500,
  PACK_BURST_REMOVE_MS: 1000,
  /** Toast notifications */
  TOAST_DISMISS_MS: 2000,
  CONTROLLER_TOAST_MS: 3000,
  /** Damage numbers */
  DAMAGE_NUMBER_MS: 1500,
  /** Coin flip animation */
  COIN_FLIP_MS: 1500,
  /** Save confirmation */
  SAVE_CONFIRMATION_MS: 2000,
  /** Duel result screen animations */
  DUEL_RESULT_ANIM_MS: 3600,
  /** Error banner display */
  ERROR_BANNER_MS: 4000,
  /** Fusion animation effects */
  FUSION_BURST_MS: 1200,
  FUSION_SPARK_MS: 1000,
} as const;
