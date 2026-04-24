export const FIELD_RULES = {
  MONSTER_ZONES_PER_PLAYER: 5,
  SPELL_TRAP_ZONES_PER_PLAYER: 5,
  HAND_CARDS_INITIAL: 5,
  DECK_MIN_MAIN: 40,
  DECK_MAX_MAIN: 60,
  DECK_MAX_EXTRA: 15,
} as const;

export const GAME_RULES = {
  /** Standard TCG format starting LP (8000 = traditional, 4000 = speed duel) */
  STARTING_LP: 8000,
  maxLP: 99999,
  handLimitDraw: 10,
  handLimitEnd: 8,
  fieldZones: FIELD_RULES.MONSTER_ZONES_PER_PLAYER as number,
  maxDeckSize: FIELD_RULES.DECK_MIN_MAIN as number,
  maxCardCopies: 3,
  drawPerTurn: 1,
  handRefillSize: 5,
  refillHandEnabled: true,
  craftingEnabled: false,
  craftingCurrency: undefined as string | undefined,
  craftingCost: 0,
  oneMoveEnabled: false,
};

export type GameRules = typeof GAME_RULES;

export function applyRules(partial: Partial<GameRules>): void {
  Object.assign(GAME_RULES, partial);
}
