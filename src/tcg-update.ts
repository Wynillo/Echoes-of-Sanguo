import { loadAndApplyTcg, type BridgeLoadResult } from './tcg-bridge.js';
import { ENGINE_VERSION } from './version.js';

const DB_NAME = 'eos-tcg-cache';
const STORE_NAME = 'tcg-files';
const CACHE_KEY = 'base-tcg';

const REPO = 'Wynillo/Echoes-of-sanguo-MOD-base';
const COMMIT_URL = `https://api.github.com/repos/${REPO}/commits/main`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}`;

// Security constants
const FETCH_TIMEOUT_MS = 30000; // 30 seconds for TCG downloads
const METADATA_TIMEOUT_MS = 5000; // 5 seconds for GitHub API calls
const MAX_TCG_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Expected SHA-256 hash for base.tcg (integrity verification)
// This should be updated whenever base.tcg is rebuilt and committed
const EXPECTED_BASE_TCG_HASH = 'sha256:PENDING_UPDATE'; // Set this to the actual hash after build

// IndexedDB helpers

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

interface CachedTcgEntry {
  sha: string;
  data: ArrayBuffer;
  engineVersion?: string;
  cachedAt?: number;
}

async function getCachedTcg(): Promise<CachedTcgEntry | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
    req.onsuccess = () => {
      const cached: CachedTcgEntry | null = req.result ?? null;
      // Check cache TTL
      if (cached && cached.cachedAt !== undefined) {
        const age = Date.now() - cached.cachedAt;
        if (age > CACHE_TTL_MS) {
          console.log('[tcg-update] Cache expired (%dh old), refreshing', Math.round(age / 1000 / 60 / 60));
          resolve(null);
          return;
        }
      }
      resolve(cached);
    };
    req.onerror = () => reject(req.error);
    // Close transaction after use to prevent connection exhaustion
    tx.oncomplete = () => db.close();
  });
}

async function setCachedTcg(sha: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  const cacheEntry: CachedTcgEntry = { sha, data, engineVersion: ENGINE_VERSION, cachedAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(cacheEntry, CACHE_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// Fetch helpers with security

async function fetchWithTimeout(url: string, timeoutMs: number = FETCH_TIMEOUT_MS, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

function validateContentLength(res: Response): void {
  const contentLength = res.headers.get('Content-Length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_TCG_SIZE_BYTES) {
      throw new Error(`TCG file too large: ${size} bytes (max: ${MAX_TCG_SIZE_BYTES} bytes)`);
    }
  }
}

async function verifyIntegrity(buffer: ArrayBuffer, expectedHash: string): Promise<boolean> {
  if (expectedHash === 'sha256:PENDING_UPDATE' || !expectedHash) {
    console.warn('[tcg-update] Integrity check skipped - expected hash not set');
    return true;
  }
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const normalizedExpected = expectedHash.replace('sha256:', '').toLowerCase();
  
  return hashHex === normalizedExpected;
}

async function getLatestCommitSha(): Promise<string | null> {
  return fetchWithTimeout(COMMIT_URL, METADATA_TIMEOUT_MS, {
    headers: { Accept: 'application/vnd.github.sha' },
  })
    .then(res => {
      if (!res.ok) return null;
      return res.text().then(sha => (sha.trim() || null));
    })
    .catch(() => null);
}

async function checkForUpdate(): Promise<void> {
  const sha = await getLatestCommitSha();
  if (!sha) return;

  const cached = await getCachedTcg();
  if (cached?.sha === sha) return;

  console.log('[tcg-update] New version detected, downloading...');
  
  const res = await fetchWithTimeout(`${RAW_BASE}/${sha}/dist/base.tcg`);
  if (!res.ok) {
    console.warn('[tcg-update] Failed to download update:', res.status);
    return;
  }
  
  validateContentLength(res);
  
  const data = await res.arrayBuffer();
  
  if (!await verifyIntegrity(data, EXPECTED_BASE_TCG_HASH)) {
    console.error('[tcg-update] Integrity check failed - TCG file may be tampered');
    return;
  }
  
  await setCachedTcg(sha, data);
  console.log('[tcg-update] Cached new base.tcg (commit %s)', sha.slice(0, 7));
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
      console.log('[tcg-update] Loading cached base.tcg (commit %s)', cached.sha.slice(0, 7));
      result = await loadAndApplyTcg(cached.data, options);
    } else {
      if (cached) {
        console.log('[tcg-update] Engine version changed, ignoring stale cache');
      }
      result = await loadAndApplyTcg(bundledUrl, options);
    }
  } catch (e) {
    console.warn('[tcg-update] Cached version failed, falling back to bundled:', e);
    result = await loadAndApplyTcg(bundledUrl, options);
  }

  cleanupSwTcgCache();
  checkForUpdate().catch((e) => console.warn('[tcg-update] Background update check failed:', e));

  return result;
}

function cleanupSwTcgCache(): void {
  caches.delete('eos-tcg-data').catch(() => {});
}
