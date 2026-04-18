import { loadAndApplyTcg, type BridgeLoadResult } from './tcg-bridge.js';
import { ENGINE_VERSION } from './version.js';
import { secureLogger } from './secure-logger.js';

const DB_NAME = 'eos-tcg-cache';
const STORE_NAME = 'tcg-files';
const CACHE_KEY = 'base-tcg';

const REPO = 'Wynillo/Echoes-of-sanguo-MOD-base';
const COMMIT_URL = `https://api.github.com/repos/${REPO}/commits/main`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}`;

// IndexedDB helpers

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedTcg(): Promise<{ sha: string; data: ArrayBuffer; engineVersion?: string } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(CACHE_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function setCachedTcg(sha: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ sha, data, engineVersion: ENGINE_VERSION }, CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// GitHub API

async function getLatestCommitSha(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const headers: HeadersInit = { Accept: 'application/vnd.github.sha' };
    
    // VITE_ prefix required for client-side exposure in Vite
    const token = import.meta.env.VITE_GITHUB_TOKEN;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const res = await fetch(COMMIT_URL, {
      headers,
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
  const res = await fetch(`${RAW_BASE}/${sha}/dist/base.tcg`);
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
