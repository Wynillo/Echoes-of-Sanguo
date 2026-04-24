import type { PlayerState, GameState, Owner } from '../types';
import type { FieldCard, FieldSpellTrap } from '../field';

/**
 * Finds the first empty monster zone.
 * @param monsters - Array of monster zones (nullable)
 * @returns Zone index (0-4) or -1 if no empty zone
 */
export function findEmptyMonsterZone(monsters: Array<FieldCard | null>): number {
  return monsters.findIndex(z => z === null);
}

/**
 * Finds the first empty spell/trap zone.
 * @param spellTraps - Array of spell/trap zones (nullable)
 * @returns Zone index (0-4) or -1 if no empty zone
 */
export function findEmptySpellTrapZone(spellTraps: Array<FieldSpellTrap | null>): number {
  return spellTraps.findIndex(z => z === null);
}

/**
 * Checks if there's at least one empty monster zone.
 * @param monsters - Array of monster zones (nullable)
 * @returns true if any zone is empty
 */
export function hasEmptyMonsterZone(monsters: Array<FieldCard | null>): boolean {
  return monsters.some(z => z === null);
}

/**
 * Checks if there's at least one empty spell/trap zone.
 * @param spellTraps - Array of spell/trap zones (nullable)
 * @returns true if any zone is empty
 */
export function hasEmptySpellTrapZone(spellTraps: Array<FieldSpellTrap | null>): boolean {
  return spellTraps.some(z => z === null);
}

/**
 * Finds the first empty monster zone or logs an error if none available.
 * @param playerState - Player state containing field
 * @param logError - Function to log error message
 * @returns Zone index (0-4) or null if no empty zone
 */
export function getFirstEmptyMonsterZoneOrError(
  playerState: PlayerState,
  logError: (msg: string) => void
): number | null {
  const zone = findEmptyMonsterZone(playerState.field.monsters);
  if (zone === -1) {
    logError('No free monster zone!');
    return null;
  }
  return zone;
}

/**
 * Finds the first empty spell/trap zone or logs an error if none available.
 * @param playerState - Player state containing field
 * @param logError - Function to log error message
 * @returns Zone index (0-4) or null if no empty zone
 */
export function getFirstEmptySpellTrapZoneOrError(
  playerState: PlayerState,
  logError: (msg: string) => void
): number | null {
  const zone = findEmptySpellTrapZone(playerState.field.spellTraps);
  if (zone === -1) {
    logError('No free spell/trap zone!');
    return null;
  }
  return zone;
}

/**
 * Safely accesses a monster at the given zone.
 * @param state - Game state
 * @param owner - Zone owner
 * @param zone - Zone index
 * @returns FieldCard at zone or null if empty/invalid
 */
export function getMonsterAtZone(
  state: GameState,
  owner: Owner,
  zone: number
): FieldCard | null {
  const playerState = owner === 'player' ? state.player : state.opponent;
  if (zone < 0 || zone >= playerState.field.monsters.length) {
    return null;
  }
  return playerState.field.monsters[zone];
}

/**
 * Safely accesses a spell/trap at the given zone.
 * @param state - Game state
 * @param owner - Zone owner
 * @param zone - Zone index
 * @returns FieldSpellTrap at zone or null if empty/invalid
 */
export function getSpellTrapAtZone(
  state: GameState,
  owner: Owner,
  zone: number
): FieldSpellTrap | null {
  const playerState = owner === 'player' ? state.player : state.opponent;
  if (zone < 0 || zone >= playerState.field.spellTraps.length) {
    return null;
  }
  return playerState.field.spellTraps[zone];
}

/**
 * Checks if a zone index is valid (0-4).
 * @param zone - Zone index to validate
 * @returns true if zone is within valid range
 */
export function isValidMonsterZone(zone: number): zone is 0 | 1 | 2 | 3 | 4 {
  return zone >= 0 && zone <= 4;
}

/**
 * Checks if a spell/trap zone index is valid (0-4).
 * @param zone - Zone index to validate
 * @returns true if zone is within valid range
 */
export function isValidSpellTrapZone(zone: number): zone is 0 | 1 | 2 | 3 | 4 {
  return zone >= 0 && zone <= 4;
}

/**
 * Gets all occupied monster zones for a player.
 * @param playerState - Player state containing field
 * @returns Array of zone indices that are occupied
 */
export function getOccupiedMonsterZones(playerState: PlayerState): number[] {
  return playerState.field.monsters
    .map((zone, idx) => (zone !== null ? idx : -1))
    .filter(idx => idx !== -1);
}

/**
 * Gets all occupied spell/trap zones for a player.
 * @param playerState - Player state containing field
 * @returns Array of zone indices that are occupied
 */
export function getOccupiedSpellTrapZones(playerState: PlayerState): number[] {
  return playerState.field.spellTraps
    .map((zone, idx) => (zone !== null ? idx : -1))
    .filter(idx => idx !== -1);
}

/**
 * Counts empty monster zones.
 * @param playerState - Player state containing field
 * @returns Number of empty monster zones
 */
export function countEmptyMonsterZones(playerState: PlayerState): number {
  return playerState.field.monsters.filter(z => z === null).length;
}

/**
 * Counts empty spell/trap zones.
 * @param playerState - Player state containing field
 * @returns Number of empty spell/trap zones
 */
export function countEmptySpellTrapZones(playerState: PlayerState): number {
  return playerState.field.spellTraps.filter(z => z === null).length;
}
