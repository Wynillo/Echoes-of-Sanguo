export const API_CONFIG = {
  GITHUB_API_BASE: 'https://api.github.com',
  GITHUB_RAW_BASE: 'https://raw.githubusercontent.com',
  REPO_OWNER: import.meta.env.VITE_GITHUB_REPO_OWNER || 'Wynillo',
  REPO_NAME: import.meta.env.VITE_GITHUB_REPO_NAME || 'Echoes-of-sanguo-MOD-base',
  CHECK_UPDATE_TIMEOUT_MS: 5000,
} as const;

export const DB_CONFIG = {
  TCG_CACHE_NAME: 'eos-tcg-cache',
  TCG_STORE_NAME: 'tcg-files',
  TCG_CACHE_KEY: 'base-tcg',
  INDEXEDDB_QUOTA_THRESHOLD: 0.8,
} as const;

export const EXPECTED_TCG_HASHES: Record<string, string> = {
  // SHA-256 hash of base.tcg for main branch
  // Update this hash when base.tcg content changes
  'main': 'ae7a771dda41eae4842eb69f0330a74c7d843384ebb01062ad86e70e22520619',
} as const;
