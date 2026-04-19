import { loadAndApplyTcg, type BridgeLoadResult } from './tcg-bridge.js';
import { ENGINE_VERSION } from './version.js';
import { secureLogger } from './secure-logger.js';
import { API_CONFIG, DB_CONFIG } from './config.js';

const { GITHUB_API_BASE, GITHUB_RAW_BASE, REPO_OWNER, REPO_NAME, CHECK_UPDATE_TIMEOUT_MS } = API_CONFIG;
const { TCG_CACHE_NAME, TCG_STORE_NAME, TCG_CACHE_KEY, INDEXEDDB_QUOTA_THRESHOLD } = DB_CONFIG;

const REPO = `${REPO_OWNER}/${REPO_NAME}`;
const COMMIT_URL = `${GITHUB_API_BASE}/repos/${REPO}/commits/main`;
const RAW_BASE = `${GITHUB_RAW_BASE}/${REPO}`;

// IndexedDB helpers

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(TCG_CACHE_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TCG_STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedTcg(): Promise<{ sha: string; data: ArrayBuffer; engineVersion?: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TCG_STORE_NAME, 'readonly');
    const req = tx.objectStore(TCG_STORE_NAME).get(TCG_CACHE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setCachedTcg(sha: string, data: ArrayBuffer): Promise<void> {
  // Check IndexedDB quota before writing
  try {
    if ('storage' in navigator && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 50 * 1024 * 1024; // Fallback: 50MB
      
      if (usage + data.byteLength > quota * INDEXEDDB_QUOTA_THRESHOLD) {
        secureLogger.warn('TCG', 'Approaching IndexedDB quota, clearing old cache');
        await cleanupSwTcgCache();
        
        // Re-check after cleanup
        const newEstimate = await navigator.storage.estimate();
        const newUsage = newEstimate.usage || 0;
        if (newUsage + data.byteLength > (newEstimate.quota || 50 * 1024 * 1024) * INDEXEDDB_QUOTA_THRESHOLD) {
          secureLogger.warn('TCG', 'IndexedDB quota still exceeded after cleanup, skipping cache');
          return;
        }
      }
    }
  } catch (e) {
    secureLogger.warn('TCG', 'Quota check failed, proceeding with cache:', e);
  }
  
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TCG_STORE_NAME, 'readwrite');
    tx.objectStore(TCG_STORE_NAME).put({ sha, data, engineVersion: ENGINE_VERSION }, TCG_CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// GitHub API

async function getLatestCommitSha(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_UPDATE_TIMEOUT_MS);
  try {
    const res = await fetch(COMMIT_URL, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin',
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

  secureLogger.log('TCG', 'New version detected, downloading…');
  const res = await fetch(`${RAW_BASE}/${sha}/dist/base.tcg`, {
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'strict-origin-when-cross-origin',
  });
  if (!res.ok) {
    secureLogger.warn('TCG', 'Failed to download update:', res.status);
    return;
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
      secureLogger.log('TCG', 'Loading cached base.tcg (commit', cached.sha.slice(0, 7));
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
