/**
 * Cryptographically secure random number utilities using crypto.getRandomValues().
 * 
 * Math.random() is NOT cryptographically secure and can be predicted if enough
 * samples are observed. For game-critical randomness (pack openings, badge drops,
 * card shuffling, target selection), we MUST use crypto.getRandomValues().
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
 * @see https://cwe.mitre.org/data/definitions/330.html
 */

/**
 * Returns a cryptographically secure random floating-point number in [0, 1).
 * Uses Uint32Array for full 32-bit randomness, normalized to [0, 1).
 */
export function secureRandom(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Divide by (2^32) to get [0, 1)
  return array[0] / (0xFFFFFFFF + 1);
}

/**
 * Returns a cryptographically secure random integer in [0, max).
 * Uses rejection sampling to ensure uniform distribution.
 * 
 * @param max - Upper bound (exclusive). Must be positive.
 * @returns Random integer in range [0, max)
 */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error('max must be positive');
  if (max === 1) return 0;
  
  const array = new Uint32Array(1);
  // Reject values that would bias the distribution
  const limit = Math.floor(0xFFFFFFFF / max) * max;
  
  do {
    crypto.getRandomValues(array);
  } while (array[0] >= limit);
  
  return array[0] % max;
}

/**
 * Securely shuffles an array in-place using Fisher-Yates algorithm.
 * 
 * @param arr - Array to shuffle (modified in place)
 * @returns The same array reference, shuffled
 */
export function shuffleSecure<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Securely shuffles an array, returning a new shuffled array.
 * 
 * @param arr - Array to shuffle (not modified)
 * @returns New shuffled array
 */
export function shuffleArraySecure<T>(arr: readonly T[]): T[] {
  return shuffleSecure([...arr]);
}

/**
 * Picks a random element from an array securely.
 * 
 * @param arr - Array to pick from
 * @returns Random element, or undefined if array is empty
 */
export function pickRandomSecure<T>(arr: readonly T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[secureRandomInt(arr.length)];
}

/**
 * Generates a cryptographically secure unique ID.
 * Uses 16 random bytes (128 bits) converted to hex.
 * 
 * @param prefix - Optional prefix (e.g., "token", "sheep")
 * @returns Unique ID string in format: "{prefix}_{timestamp}_{random_hex}"
 */
export function generateSecureId(prefix?: string): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const randomHex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}_${timestamp}_${randomHex}` : `${timestamp}_${randomHex}`;
}

/**
 * Selects a random index from an array securely.
 * 
 * @param arr - Array or array-like object
 * @returns Random index in range [0, arr.length)
 */
export function randomIndexSecure<T>(arr: readonly T[]): number {
  return secureRandomInt(arr.length);
}
