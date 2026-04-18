/**
 * Storage security utilities for client-side data integrity verification.
 *
 * SECURITY MODEL:
 * - This module provides integrity verification using SHA-256 hashes
 * - It does NOT provide encryption - client-side encryption without secure key storage is security theater
 * - Threat model: XSS attacks, accidental corruption, casual tampering
 * - NOT protected against: determined attackers with browser access, malicious browser extensions
 *
 * See: OWASP Client-Side Storage Security Cheat Sheet
 *      https://cheatsheetseries.owasp.org/cheatsheets/Client-Side_Storage_Security_Cheat_Sheet.html
 */

/**
 * Compute SHA-256 hash of a string using Web Crypto API.
 * Returns hex-encoded hash string.
 */
export async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify that data matches expected hash.
 * Returns true if hash matches, false otherwise.
 */
export async function verifyHash(data: string, expectedHash: string): Promise<boolean> {
  const actualHash = await computeHash(data);
  return actualHash === expectedHash;
}

/**
 * Integrity-verified storage wrapper for localStorage.
 * Stores data with SHA-256 hash for tamper detection.
 */
export interface IntegrityStorage {
  /**
   * Save data with integrity hash.
   * @param key Storage key
   * @param data Data to store (will be JSON stringified)
   * @returns true if save succeeded, false on error
   */
  save(key: string, data: unknown): Promise<boolean>;

  /**
   * Load data with integrity verification.
   * @param key Storage key
   * @param fallback Value to return if key missing or integrity check fails
   * @returns Loaded data or fallback
   */
  load<T>(key: string, fallback: T): Promise<T>;

  /**
   * Load data with integrity verification and custom validator.
   * @param key Storage key
   * @param fallback Value to return if validation fails
   * @param validator Function to validate parsed data structure
   * @returns Loaded data or fallback
   */
  load<T>(key: string, fallback: T, validator?: (v: unknown) => boolean): Promise<T>;

  /**
   * Remove data and its hash.
   */
  remove(key: string): void;

  /**
   * Check if key exists and has valid integrity.
   */
  hasValid(key: string): Promise<boolean>;
}

/**
 * Hash suffix appended to storage keys.
 */
const HASH_SUFFIX = '.sha256';

/**
 * Create an integrity-verified storage instance for localStorage.
 *
 * @param storage Storage backend (default: localStorage)
 * @param options Configuration options
 * @param options.strict If true, load() returns fallback on hash mismatch. If false, logs warning and returns data anyway.
 */
export function createIntegrityStorage(
  storage: Storage = localStorage,
  options: { strict?: boolean } = {}
): IntegrityStorage {
  const { strict = false } = options;

  return {
    async save(key: string, data: unknown): Promise<boolean> {
      try {
        const jsonString = JSON.stringify(data);
        const hash = await computeHash(jsonString);
        storage.setItem(key, jsonString);
        storage.setItem(key + HASH_SUFFIX, hash);
        return true;
      } catch (e) {
        console.error(`[StorageSecurity] Save failed for "${key}":`, e);
        return false;
      }
    },

    async load<T>(key: string, fallback: T, validator?: (v: unknown) => boolean): Promise<T> {
      const raw = storage.getItem(key);
      const hash_raw = storage.getItem(key + HASH_SUFFIX);

      // No hash = legacy data, return as-is
      if (hash_raw === null || raw === null) {
        if (raw === null) return fallback;
        return safeParse(raw, fallback, validator);
      }

      // Verify hash
      const valid = await verifyHash(raw, hash_raw);
      if (!valid) {
        if (strict) {
          console.warn(`[StorageSecurity] Integrity check failed for "${key}" - using fallback`);
          return fallback;
        } else {
          console.warn(`[StorageSecurity] Integrity check failed for "${key}" - data may be corrupted`);
          return safeParse(raw, fallback, validator);
        }
      }

      return safeParse(raw, fallback, validator);
    },

    remove(key: string): void {
      storage.removeItem(key);
      storage.removeItem(key + HASH_SUFFIX);
    },

    async hasValid(key: string): Promise<boolean> {
      const raw = storage.getItem(key);
      const hash_raw = storage.getItem(key + HASH_SUFFIX);
      if (raw === null || hash_raw === null) return false;
      return verifyHash(raw, hash_raw);
    },
  };
}

/**
 * Safe JSON parse with prototype pollution protection.
 * Duplicated from progression.ts to avoid circular dependency.
 */
function safeParse<T>(raw: string, fallback: T, validator?: (v: unknown) => boolean): T {
  // Block prototype pollution attempts
  if (/\b(__proto__|constructor|prototype)\b/.test(raw)) {
    console.warn('[StorageSecurity] Blocked prototype pollution attempt.');
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (validator && !validator(parsed)) {
      console.warn('[StorageSecurity] Validation failed - using fallback.');
      return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * Compute hash for IndexedDB storage.
 * Similar to computeHash but optimized for ArrayBuffer data.
 */
export async function computeArrayBufferHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
