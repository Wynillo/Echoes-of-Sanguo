import type { CollectionEntry, OpponentRecord } from './types.js';
import type { CampaignProgress } from './campaign-types.js';

export const Progression = (() => {

  const KEYS = {
    initialized:    'tcg_initialized',
    starterChosen:  'tcg_starter_chosen',
    starterRace:    'tcg_starter_race',
    collection:     'tcg_collection',
    deck:           'tcg_deck',
    coins:          'eos_jade_coins',
    opponents:      'tcg_opponents',
    version:        'tcg_save_version',
    settings:       'tcg_settings',
    seenCards:        'tcg_seen_cards',
    campaignProgress: 'tcg_campaign_progress',
  };

  const SAVE_VERSION   = 2;   // increment when save format changes incompatibly
  const OPPONENT_COUNT = 10;

  function _load<T>(key: string, fallback: T, validator?: (v: unknown) => boolean): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      if (validator && !validator(parsed)) {
        console.warn(`[Progression] Invalid format for "${key}" – using fallback.`);
        return fallback;
      }
      return parsed;
    } catch (e) {
      return fallback;
    }
  }

  function _save(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Progression] Save failed for "${key}":`, e);
      window.dispatchEvent(new CustomEvent('eos:save-error', { detail: { key } }));
      return false;
    }
  }

  function _defaultOpponents(): Record<number, OpponentRecord> {
    const ops: Record<number, OpponentRecord> = {};
    for (let i = 1; i <= OPPONENT_COUNT; i++) {
      ops[i] = { unlocked: i === 1, wins: 0, losses: 0 };
    }
    return ops;
  }

  function init() {
    if (!localStorage.getItem(KEYS.initialized)) {
      _save(KEYS.coins, 0);
      _save(KEYS.collection, []);
      _save(KEYS.opponents, _defaultOpponents());
      const legacyDeck = localStorage.getItem('aetherialClash_deck');
      if (legacyDeck) {
        localStorage.setItem(KEYS.deck, legacyDeck);
      }
      localStorage.setItem(KEYS.initialized, '1');
      _save(KEYS.version, SAVE_VERSION);
    } else {
      if (!localStorage.getItem(KEYS.coins)) {
        const legacyCoins = localStorage.getItem('ac_aether_coins');
        _save(KEYS.coins, legacyCoins !== null ? JSON.parse(legacyCoins) : 0);
      }
      if (!localStorage.getItem(KEYS.collection)) _save(KEYS.collection, []);
      if (!localStorage.getItem(KEYS.opponents)) _save(KEYS.opponents, _defaultOpponents());
      if (!localStorage.getItem(KEYS.version)) _save(KEYS.version, 1);

      // v1 → v2: reset collection and deck if old-format IDs are detected.
      const savedVersion = _load(KEYS.version, 0, v => typeof v === 'number');
      if (savedVersion < 2) {
        const col = _load(KEYS.collection, [], v => Array.isArray(v)) as Array<{ id: string }>;
        const hasOldIds = col.some(e => /^[A-Z]/.test(e.id));
        if (hasOldIds) {
          console.info('[Progression] Migrating save data to v2: clearing collection and deck (card ID format changed).');
          try {
            localStorage.setItem('tcg_collection_v1_backup', JSON.stringify(col));
            const oldDeck = localStorage.getItem(KEYS.deck);
            if (oldDeck) localStorage.setItem('tcg_deck_v1_backup', oldDeck);
          } catch { /* backup is best-effort */ }
          _save(KEYS.collection, []);
          localStorage.removeItem(KEYS.deck);
          localStorage.setItem('tcg_migration_pending', '1');
        }
        _save(KEYS.version, SAVE_VERSION);
      }
    }
  }

  function hasMigrationPending(): boolean {
    return localStorage.getItem('tcg_migration_pending') === '1';
  }

  function clearMigrationPending(): void {
    localStorage.removeItem('tcg_migration_pending');
  }

  function hasV1Backup(): boolean {
    return localStorage.getItem('tcg_collection_v1_backup') !== null;
  }

  function restoreV1Backup(): boolean {
    try {
      const raw = localStorage.getItem('tcg_collection_v1_backup');
      if (!raw) return false;
      const col = JSON.parse(raw);
      if (!Array.isArray(col)) return false;
      _save(KEYS.collection, col);
      const deckRaw = localStorage.getItem('tcg_deck_v1_backup');
      if (deckRaw) localStorage.setItem(KEYS.deck, deckRaw);
      console.info('[Progression] Restored v1 backup successfully.');
      return true;
    } catch {
      console.warn('[Progression] Failed to restore v1 backup.');
      return false;
    }
  }

  function isFirstLaunch() {
    return !localStorage.getItem(KEYS.starterChosen);
  }

  function markStarterChosen(race: string) {
    localStorage.setItem(KEYS.starterChosen, '1');
    localStorage.setItem(KEYS.starterRace, race);
  }

  function getStarterRace() {
    return localStorage.getItem(KEYS.starterRace) || null;
  }

  function getCoins(): number {
    return _load(KEYS.coins, 0, v => typeof v === 'number' && v >= 0);
  }

  function addCoins(amount: number): number {
    const current = getCoins();
    _save(KEYS.coins, current + Math.max(0, amount));
    return getCoins();
  }

  function spendCoins(amount: number): boolean {
    const current = getCoins();
    if (current < amount) return false;
    _save(KEYS.coins, current - amount);
    return true;
  }

  function getCollection(): CollectionEntry[] {
    return _load(KEYS.collection, [], v => Array.isArray(v));
  }

  function addCardsToCollection(cards: (string | { id: string })[]): void {
    const col = getCollection();
    const map: Record<string, number> = {};
    col.forEach(entry => { map[entry.id] = entry.count; });

    cards.forEach(card => {
      const id = typeof card === 'string' ? card : card.id;
      map[id] = (map[id] || 0) + 1;
    });

    const newCol = Object.entries(map).map(([id, count]) => ({ id, count }));
    _save(KEYS.collection, newCol);
  }

  function ownsCard(cardId: string): boolean {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return !!entry && entry.count > 0;
  }

  function cardCount(cardId: string): number {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return entry ? entry.count : 0;
  }

  function getDeck(): string[] | null {
    const deck = _load(KEYS.deck, null, v => Array.isArray(v) && v.every(id => typeof id === 'string'));
    if (deck) return deck;
    try {
      const legacy = localStorage.getItem('aetherialClash_deck');
      if (legacy) return JSON.parse(legacy);
    } catch (e) { console.warn('[Progression] Legacy deck migration failed:', e); }
    return null;
  }

  function saveDeck(deckIds: string[]): boolean {
    const ok = _save(KEYS.deck, deckIds);
    if (ok) {
      try { localStorage.setItem('echoesOfSanguo_deck', JSON.stringify(deckIds)); } catch { /* ignore */ }
    }
    return ok;
  }

  function getOpponents(): Record<number, OpponentRecord> {
    return _load(KEYS.opponents, _defaultOpponents(),
      v => v !== null && typeof v === 'object' && !Array.isArray(v));
  }

  function recordDuelResult(opponentId: number | string, won: boolean): void {
    const id = parseInt(opponentId as string, 10);
    const ops = getOpponents();
    if (!ops[id]) return;

    if (won) {
      ops[id].wins++;
      if (id < OPPONENT_COUNT && ops[id + 1] && !ops[id + 1].unlocked) {
        ops[id + 1].unlocked = true;
      }
    } else {
      ops[id].losses++;
    }
    _save(KEYS.opponents, ops);
  }

  function isOpponentUnlocked(opponentId: number | string): boolean {
    const ops = getOpponents();
    const id = parseInt(opponentId as string, 10);
    return !!(ops[id] && ops[id].unlocked);
  }

  interface Settings { lang: string; volMaster: number; volMusic: number; volSfx: number; refillHand: boolean; }

  const SETTINGS_DEFAULTS: Settings = { lang: 'en', volMaster: 50, volMusic: 50, volSfx: 50, refillHand: true };

  function getSettings(): Settings {
    return { ...SETTINGS_DEFAULTS, ..._load(KEYS.settings, SETTINGS_DEFAULTS) };
  }

  function saveSettings(s: Settings): void {
    _save(KEYS.settings, s);
  }

  function getSeenCards(): Set<string> {
    const arr = _load(KEYS.seenCards, [], v => Array.isArray(v));
    return new Set(arr);
  }

  function markCardsAsSeen(ids: string[]): void {
    if (ids.length === 0) return;
    const seen = getSeenCards();
    ids.forEach(id => seen.add(id));
    _save(KEYS.seenCards, [...seen]);
  }

  function getCampaignProgress(): CampaignProgress {
    return _load(KEYS.campaignProgress, { completedNodes: [], currentChapter: 'ch1' },
      v => v !== null && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).completedNodes));
  }

  function saveCampaignProgress(progress: CampaignProgress): void {
    _save(KEYS.campaignProgress, progress);
  }

  function markNodeComplete(nodeId: string): CampaignProgress {
    if (!nodeId || typeof nodeId !== 'string') {
      console.warn('[Progression] markNodeComplete called with invalid nodeId:', nodeId);
      return getCampaignProgress();
    }
    const progress = getCampaignProgress();
    if (!progress.completedNodes.includes(nodeId)) {
      progress.completedNodes.push(nodeId);
      saveCampaignProgress(progress);
    }
    return progress;
  }

  function isNodeComplete(nodeId: string): boolean {
    const progress = getCampaignProgress();
    return progress.completedNodes.includes(nodeId);
  }

  const DUEL_CHECKPOINT_KEY = 'tcg_duel_checkpoint';

  function saveDuelCheckpoint(data: unknown): void {
    _save(DUEL_CHECKPOINT_KEY, data);
  }

  function loadDuelCheckpoint<T>(): T | null {
    return _load(DUEL_CHECKPOINT_KEY, null);
  }

  function clearDuelCheckpoint(): void {
    localStorage.removeItem(DUEL_CHECKPOINT_KEY);
  }

  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(DUEL_CHECKPOINT_KEY);
    console.warn('[Progression] All data reset.');
  }

  function backupToSession(): void {
    const backup: Record<string, string | null> = {};
    Object.values(KEYS).forEach(k => { backup[k] = localStorage.getItem(k); });
    sessionStorage.setItem('tcg_save_backup', JSON.stringify(backup));
  }

  function hasBackup(): boolean {
    return sessionStorage.getItem('tcg_save_backup') !== null;
  }

  function restoreFromBackup(): void {
    const raw = sessionStorage.getItem('tcg_save_backup');
    if (!raw) return;
    const backup = JSON.parse(raw) as Record<string, string | null>;
    Object.entries(backup).forEach(([k, v]) => {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    });
    sessionStorage.removeItem('tcg_save_backup');
  }

  function clearBackup(): void {
    sessionStorage.removeItem('tcg_save_backup');
  }

  return {
    init,
    isFirstLaunch,
    markStarterChosen,
    getStarterRace,
    getCoins,
    addCoins,
    spendCoins,
    getCollection,
    addCardsToCollection,
    ownsCard,
    cardCount,
    getDeck,
    saveDeck,
    getOpponents,
    recordDuelResult,
    isOpponentUnlocked,
    getSettings,
    saveSettings,
    getSeenCards,
    markCardsAsSeen,
    getCampaignProgress,
    saveCampaignProgress,
    markNodeComplete,
    isNodeComplete,
    hasMigrationPending,
    clearMigrationPending,
    hasV1Backup,
    restoreV1Backup,
    resetAll,
    backupToSession,
    hasBackup,
    restoreFromBackup,
    clearBackup,
    saveDuelCheckpoint,
    loadDuelCheckpoint,
    clearDuelCheckpoint,
  };

})();
