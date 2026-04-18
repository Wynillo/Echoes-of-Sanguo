import { loadAndApplyTcg, type BridgeLoadResult } from './tcg-bridge.js';
import { ENGINE_VERSION } from './version.js';
import { secureLogger } from './secure-logger.js';
import { computeArrayBufferHash } from './storage-security.js';

const DB_NAME = 'eos-tcg-cache';
const STORE_NAME = 'tcg-files';
const CACHE_KEY = 'base-tcg';

const REPO = 'Wynillo/Echoes-of-sanguo-MOD-base';
const COMMIT_URL = `https://api.github.com/repos/${REPO}/commits/main`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}`;

// Expected SHA-256 hashes for known-good TCG versions (updated with each release)
// Format: commit SHA -> expected hex-encoded hash of base.tcg file
// These hashes are pinned to prevent supply chain attacks if the repository is compromised
const EXPECTED_TCG_HASHES: Record<string, string> = {
  // Hashes will be populated as new versions are released and verified
  // Example: 'abc123def456...': '68656c6c6f20776f726c64'
};

// IndexedDB helpers

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedTcg(): Promise<{ sha: string; data: ArrayBuffer; hash?: string; engineVersion?: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setCachedTcg(sha: string, data: ArrayBuffer, hash?: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ sha, data, hash, engineVersion: ENGINE_VERSION }, CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Integrity validation helpers

/**
 * Validates the integrity of downloaded TCG data using SHA-256 hash.
 * @param data - The ArrayBuffer containing the TCG file
 * @param expectedHash - The expected SHA-256 hash (hex-encoded format)
 * @returns Promise resolving to true if hash matches, false otherwise
 */
async function validateIntegrity(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await computeArrayBufferHash(data);
    return actualHash === expectedHash;
  } catch (error) {
    secureLogger.error('TCG', 'Integrity validation failed:', error);
    return false;
  }
}

// GitHub API

async function getLatestCommitSha(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(COMMIT_URL, {
      headers: { Accept: 'application/vnd.github.sha' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const sha = (await res.text()).trim();
    return sha || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkForUpdate(): Promise<void> {
  const sha = await getLatestCommitSha();
  if (!sha) return;

  const cached = await getCachedTcg();
  if (cached?.sha === sha) return;

  secureLogger.log('TCG', 'New version detected, downloading...');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${RAW_BASE}/${sha}/dist/base.tcg`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      secureLogger.warn('TCG', 'Failed to download update:', res.status);
      return;
    }

    const contentType = res.headers.get('Content-Type');
    if (!contentType || (!contentType.includes('application/zip') && !contentType.includes('application/octet-stream'))) {
      secureLogger.error('TCG', 'Invalid content type:', contentType);
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const data = await res.arrayBuffer();
    const actualHash = await computeArrayBufferHash(data);

    const expectedHash = EXPECTED_TCG_HASHES[sha];
    if (expectedHash) {
      const isValid = await validateIntegrity(data, expectedHash);
      if (!isValid) {
        secureLogger.error('TCG', 'Integrity check failed for commit', sha.slice(0, 7));
        throw new Error('Content integrity validation failed');
      }
      secureLogger.log('TCG', 'Integrity check passed for commit', sha.slice(0, 7));
    } else {
      secureLogger.warn('TCG', 'No pinned hash for commit', sha.slice(0, 7));
    }

    await setCachedTcg(sha, data, actualHash);
    secureLogger.log('TCG', 'Cached new base.tcg (commit', sha.slice(0, 7));
  } catch (error) {
    secureLogger.error('TCG', 'Download failed:', error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
  const data = await res.arrayBuffer();
  await setCachedTcg(sha, data);
  secureLogger.log('TCG', 'Cached new base.tcg (commit', sha.slice(0, 7));
}

// Public API

export async function loadCachedOrBundled(
  bundledUrl: string,
  options?: { lang?: string; onProgress?: (percent: number) => void },
): Promise<BridgeLoadResult> {
  let result: BridgeLoadResult;

  try {
    const cached = await getCachedTcg();
    if (cached && cached.engineVersion === ENGINE_VERSION) {
      // Verify cached data integrity if hash is available
      if (cached.hash) {
        const currentHash = await computeArrayBufferHash(cached.data);
        if (currentHash !== cached.hash) {
          secureLogger.warn('TCG', 'Cached data integrity check failed, using bundled version');
          throw new Error('Cached TCG integrity check failed');
        }
        secureLogger.log('TCG', 'Loading cached base.tcg (commit', cached.sha.slice(0, 7));
      } else {
        secureLogger.log('TCG', 'Loading cached base.tcg (commit', cached.sha.slice(0, 7), '(no hash to verify)');
      }
      result = await loadAndApplyTcg(cached.data, options);
    } else {
      if (cached) {
        secureLogger.log('TCG', 'Engine version changed, ignoring stale cache');
      }
      result = await loadAndApplyTcg(bundledUrl, options);
    }
  } catch (e) {
    secureLogger.warn('TCG', 'Cached version failed, falling back to bundled:', e);
    result = await loadAndApplyTcg(bundledUrl, options);
  }

  cleanupSwTcgCache();
  checkForUpdate().catch((e) => secureLogger.warn('TCG', 'Background update check failed:', e));

  return result;
}

function cleanupSwTcgCache(): void {
  caches.delete('eos-tcg-data').catch(() => {});
}
