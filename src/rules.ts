// ============================================================
// ECHOES OF SANGUO — Game Rule Constants
// Central runtime store with defaults; can be overridden by
// rules.json inside a .tcg archive.
// ============================================================

export const GAME_RULES = {
  startingLP: 8000,
  maxLP: 99999,
  handLimitDraw: 10,
  handLimitEnd: 8,
  fieldZones: 5,
  maxDeckSize: 40,
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
