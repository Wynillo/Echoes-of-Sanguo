/**
 * Storage security utilities for client-side data integrity verification.
 *
 * SECURITY MODEL:
 * - This module provides integrity verification using SHA-256 hashes and HMAC-SHA256 signatures
 * - It does NOT provide encryption - client-side encryption without secure key storage is security theater
 * - Threat model: XSS attacks, accidental corruption, casual tampering
 * - NOT protected against: determined attackers with browser access, malicious browser extensions
 *
 * HMAC provides stronger protection than plain hashes:
 * - Plain hash: attacker can modify data and recompute hash
 * - HMAC: attacker needs the secret key to generate valid signature
 * - Key is derived client-side and not persisted (memory only)
 *
 * See: OWASP Client-Side Storage Security Cheat Sheet
 *      https://cheatsheetseries.owasp.org/cheatsheets/Client-Side_Storage_Security_Cheat_Sheet.html
 */

// ── Hash Suffixes ─────────────────────────────────────────

const HASH_SUFFIX = '.sha256';
const HMAC_SUFFIX = '.hmac';
const TS_SUFFIX = '.ts';

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

// ── HMAC Functions (SHA-256 with key) ─────────────────────

/**
 * Derive a client-side key from a seed string.
 * Uses PBKDF2 with fixed salt for deterministic key derivation.
 * The derived key is NOT stored - it's recomputed when needed.
 *
 * @param seed - Seed string (e.g., slot ID + game salt)
 * @returns Hex-encoded 256-bit key
 */
export async function deriveKey(seed: string): Promise<string> {
  const encoder = new TextEncoder();
  const seedBuffer = encoder.encode(seed);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    seedBuffer,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const salt = encoder.encode('eos-storage-security-salt-v1');

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 1000,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );

  return Array.from(new Uint8Array(derivedBits))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute HMAC-SHA256 signature of data using provided key.
 * Returns hex-encoded signature string.
 *
 * @param key - Hex-encoded 256-bit key
 * @param data - Data to sign
 * @returns Hex-encoded HMAC signature
 */
export async function computeHMAC(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();

  const keyBytes = new Uint8Array(key.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const dataBuffer = encoder.encode(data);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);

  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC signature matches expected.
 * Returns true if signature is valid, false otherwise.
 */
export async function verifyHMAC(key: string, data: string, signature: string): Promise<boolean> {
  const actualSignature = await computeHMAC(key, data);
  if (actualSignature.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < actualSignature.length; i++) {
    result |= actualSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

// ── Hash-Based Integrity Storage (SHA-256, no key) ────────

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

      if (hash_raw === null || raw === null) {
        if (raw === null) return fallback;
        return safeParse(raw, fallback, validator);
      }

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

// ── HMAC-Based Encoded Storage (with secret key) ──────────

/**
 * HMAC-encoded storage wrapper with cryptographic signatures.
 * Stores data with timestamp and HMAC-SHA256 signature for tamper detection.
 *
 * SECURITY MODEL:
 * - Data format: { data: T, ts: number } (signature stored separately)
 * - Signature: HMAC-SHA256(key, JSON(data) + ts)
 * - Key is derived from seed and not persisted
 * - Protects against casual tampering and accidental corruption
 * - Does NOT protect against determined attackers with full browser access
 */
export interface HMACEncodedStorage {
  /**
   * Save data with HMAC signature.
   * @param key Storage key
   * @param data Data to store (will be wrapped with timestamp and signed)
   * @returns true if save succeeded, false on error
   */
  save(key: string, data: unknown): Promise<boolean>;

  /**
   * Load data with HMAC verification.
   * @param key Storage key
   * @param fallback Value to return if key missing or integrity check fails
   * @returns Loaded data or fallback
   */
  load<T>(key: string, fallback: T): Promise<T>;

  /**
   * Load data with HMAC verification and custom validator.
   * @param key Storage key
   * @param fallback Value to return if validation fails
   * @param validator Function to validate parsed data structure
   * @returns Loaded data or fallback
   */
  load<T>(key: string, fallback: T, validator?: (v: unknown) => boolean): Promise<T>;

  /**
   * Remove data, timestamp, and signature.
   */
  remove(key: string): void;

  /**
   * Check if key exists and has valid HMAC signature.
   */
  hasValid(key: string): Promise<boolean>;
}

/**
 * Wrapped data structure stored with HMAC signature.
 */
export interface HMACWrappedData<T> {
  /** The actual data payload */
  data: T;
  /** Timestamp when data was signed (ms since epoch) */
  ts: number;
}

/**
 * Create an HMAC-encoded storage instance for localStorage.
 *
 * @param keySeed Seed for key derivation (e.g., slot ID + game salt)
 * @param storage Storage backend (default: localStorage)
 * @param options Configuration options
 * @param options.strict If true, load() returns fallback on HMAC mismatch. If false, logs warning and returns data anyway.
 * @returns HMACEncodedStorage instance
 */
export function createHMACEncodedStorage(
  keySeed: string,
  storage: Storage = localStorage,
  options: { strict?: boolean } = {}
): HMACEncodedStorage {
  const { strict = false } = options;
  let derivedKey: string | null = null;

  return {
    async save(key: string, data: unknown): Promise<boolean> {
      try {
        if (derivedKey === null) {
          derivedKey = await deriveKey(keySeed);
        }

        const wrapped: HMACWrappedData<unknown> = {
          data,
          ts: Date.now(),
        };

        const jsonString = JSON.stringify(wrapped);
        const signature = await computeHMAC(derivedKey, jsonString);

        storage.setItem(key, jsonString);
        storage.setItem(key + HMAC_SUFFIX, signature);
        storage.setItem(key + TS_SUFFIX, String(wrapped.ts));

        return true;
      } catch (e) {
        console.error(`[StorageSecurity] HMAC save failed for "${key}":`, e);
        return false;
      }
    },

    async load<T>(key: string, fallback: T, validator?: (v: unknown) => boolean): Promise<T> {
      const raw = storage.getItem(key);
      const sig_raw = storage.getItem(key + HMAC_SUFFIX);
      const ts_raw = storage.getItem(key + TS_SUFFIX);

      if (sig_raw === null || raw === null) {
        if (raw === null) return fallback;
        return safeParse(raw, fallback, validator);
      }

      if (derivedKey === null) {
        derivedKey = await deriveKey(keySeed);
      }

      const valid = await verifyHMAC(derivedKey, raw, sig_raw);
      if (!valid) {
        window.dispatchEvent(new CustomEvent('eos:integrity-failure', {
          detail: { key, expectedSig: sig_raw, ts: ts_raw },
        }));

        if (strict) {
          console.warn(`[StorageSecurity] HMAC verification failed for "${key}" - using fallback`);
          return fallback;
        } else {
          console.warn(`[StorageSecurity] HMAC verification failed for "${key}" - data may be tampered`);
          return safeParse(raw, fallback, validator);
        }
      }

      const parsed = safeParse(raw, null as HMACWrappedData<T> | null);
      if (parsed === null) return fallback;

      if (validator && !validator(parsed.data)) {
        return fallback;
      }

      return parsed.data;
    },

    remove(key: string): void {
      storage.removeItem(key);
      storage.removeItem(key + HMAC_SUFFIX);
      storage.removeItem(key + TS_SUFFIX);
    },

    async hasValid(key: string): Promise<boolean> {
      const raw = storage.getItem(key);
      const sig_raw = storage.getItem(key + HMAC_SUFFIX);
      if (raw === null || sig_raw === null) return false;

      if (derivedKey === null) {
        derivedKey = await deriveKey(keySeed);
      }

      return verifyHMAC(derivedKey, raw, sig_raw);
    },
  };
}

// ── Safe JSON Parse (prototype pollution protection) ──────

/**
 * Safe JSON parse with prototype pollution protection.
 * Duplicated from progression.ts to avoid circular dependency.
 */
function safeParse<T>(raw: string, fallback: T, validator?: (v: unknown) => boolean): T {
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

// ── ArrayBuffer Hash (for IndexedDB) ──────────────────────

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
