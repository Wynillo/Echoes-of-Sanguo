// ============================================================
// ECHOES OF SANGUO - Progression System
// Manages: coins, collection, deck, opponent unlocks
// ============================================================

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

  // ── Helpers ──────────────────────────────────────────────

  /**
   * @param {string}    key       localStorage key
   * @param {*}         fallback  value returned when key is absent, unparseable, or invalid
   * @param {Function}  [validator]  optional fn(parsed) → boolean; returns fallback when false
   */
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
      // QuotaExceededError (storage full) or SecurityError (private browsing blocked)
      console.error(`[Progression] Save failed for "${key}":`, e);
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

  // ── Initialization ───────────────────────────────────────

  function init() {
    if (!localStorage.getItem(KEYS.initialized)) {
      // First launch – set defaults
      _save(KEYS.coins, 0);
      _save(KEYS.collection, []);
      _save(KEYS.opponents, _defaultOpponents());
      // Deck: migrate old key if present
      const legacyDeck = localStorage.getItem('aetherialClash_deck');
      if (legacyDeck) {
        localStorage.setItem(KEYS.deck, legacyDeck);
      }
      localStorage.setItem(KEYS.initialized, '1');
      _save(KEYS.version, SAVE_VERSION);
    } else {
      // Fill in missing fields (after updates)
      // Legacy migration: move old aether coins to new jade key
      if (!localStorage.getItem(KEYS.coins)) {
        const legacyCoins = localStorage.getItem('ac_aether_coins');
        _save(KEYS.coins, legacyCoins !== null ? JSON.parse(legacyCoins) : 0);
      }
      if (!localStorage.getItem(KEYS.collection)) _save(KEYS.collection, []);
      if (!localStorage.getItem(KEYS.opponents)) _save(KEYS.opponents, _defaultOpponents());
      // Set version stamp if missing (saves from before v1)
      if (!localStorage.getItem(KEYS.version)) _save(KEYS.version, 1);

      // v1 → v2: card IDs changed from string format ("M001") to numeric strings ("1").
      // Old IDs are unresolvable without the removed id_migration.json, so reset
      // collection and deck if old-format IDs are detected.
      const savedVersion = _load(KEYS.version, 0, v => typeof v === 'number');
      if (savedVersion < 2) {
        const col = _load(KEYS.collection, [], v => Array.isArray(v)) as Array<{ id: string }>;
        const hasOldIds = col.some(e => /^[A-Z]/.test(e.id));
        if (hasOldIds) {
          console.info('[Progression] Migrating save data to v2: clearing collection and deck (card ID format changed).');
          // Back up old data before wiping so it can be inspected if migration fails
          try {
            localStorage.setItem('tcg_collection_v1_backup', JSON.stringify(col));
            const oldDeck = localStorage.getItem(KEYS.deck);
            if (oldDeck) localStorage.setItem('tcg_deck_v1_backup', oldDeck);
          } catch { /* backup is best-effort */ }
          _save(KEYS.collection, []);
          localStorage.removeItem(KEYS.deck);
        }
        _save(KEYS.version, SAVE_VERSION);
      }
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

  // ── Coins ────────────────────────────────────────────────

  function getCoins(): number {
    return _load(KEYS.coins, 0, v => typeof v === 'number' && v >= 0);
  }

  function addCoins(amount: number): number {
    const current = getCoins();
    _save(KEYS.coins, current + Math.max(0, amount));
    return getCoins();
  }

  /** Returns false if not enough coins */
  function spendCoins(amount: number): boolean {
    const current = getCoins();
    if (current < amount) return false;
    _save(KEYS.coins, current - amount);
    return true;
  }

  // ── Collection ───────────────────────────────────────────

  function getCollection(): CollectionEntry[] {
    return _load(KEYS.collection, [], v => Array.isArray(v));
  }

  /** cards: array of Card objects or ID strings */
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

  /** Returns true if the player owns at least 1 copy of the card */
  function ownsCard(cardId: string): boolean {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return !!entry && entry.count > 0;
  }

  /** Returns the number of owned copies */
  function cardCount(cardId: string): number {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return entry ? entry.count : 0;
  }

  // ── Deck ─────────────────────────────────────────────────

  function getDeck(): string[] | null {
    // Try new key, then old legacy key
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
      // Keep legacy key in sync for backward compatibility
      try { localStorage.setItem('echoesOfSanguo_deck', JSON.stringify(deckIds)); } catch { /* ignore */ }
    }
    return ok;
  }

  // ── Opponents ────────────────────────────────────────────

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
      // Unlock next opponent
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

  // ── Settings ─────────────────────────────────────────────

  interface Settings { lang: string; volMaster: number; volMusic: number; volSfx: number; refillHand: boolean; }

  const SETTINGS_DEFAULTS: Settings = { lang: 'en', volMaster: 50, volMusic: 50, volSfx: 50, refillHand: true };

  function getSettings(): Settings {
    return { ...SETTINGS_DEFAULTS, ..._load(KEYS.settings, SETTINGS_DEFAULTS) };
  }

  function saveSettings(s: Settings): void {
    _save(KEYS.settings, s);
  }

  // ── Seen Cards ───────────────────────────────────────────

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

  // ── Campaign Progress ───────────────────────────────────

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

  // ── Duel Checkpoint (anti-save-scum) ─────────────────────

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

  // ── Debug / Reset ────────────────────────────────────────

  /** Resets all progression data (debug only) */
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    console.warn('[Progression] All data reset.');
  }

  // ── Soft-Reset / Backup ──────────────────────────────────

  /** Backs up current state to sessionStorage (for "New Game" flow) */
  function backupToSession(): void {
    const backup: Record<string, string | null> = {};
    Object.values(KEYS).forEach(k => { backup[k] = localStorage.getItem(k); });
    sessionStorage.setItem('tcg_save_backup', JSON.stringify(backup));
  }

  /** Returns true if a backup exists in sessionStorage */
  function hasBackup(): boolean {
    return sessionStorage.getItem('tcg_save_backup') !== null;
  }

  /** Restores the backed-up state and clears the backup */
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

  /** Clears the backup without restoring (new game confirmed) */
  function clearBackup(): void {
    sessionStorage.removeItem('tcg_save_backup');
  }

  // ── Public API ───────────────────────────────────────────

  return {
    init,
    isFirstLaunch,
    markStarterChosen,
    getStarterRace,
    // Coins
    getCoins,
    addCoins,
    spendCoins,
    // Collection
    getCollection,
    addCardsToCollection,
    ownsCard,
    cardCount,
    // Deck
    getDeck,
    saveDeck,
    // Opponents
    getOpponents,
    recordDuelResult,
    isOpponentUnlocked,
    // Settings
    getSettings,
    saveSettings,
    // Seen cards
    getSeenCards,
    markCardsAsSeen,
    // Campaign
    getCampaignProgress,
    saveCampaignProgress,
    markNodeComplete,
    isNodeComplete,
    // Debug
    resetAll,
    // Soft-Reset
    backupToSession,
    hasBackup,
    restoreFromBackup,
    clearBackup,
    // Duel Checkpoint
    saveDuelCheckpoint,
    loadDuelCheckpoint,
    clearDuelCheckpoint,
  };

})();
