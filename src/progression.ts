import type { CollectionEntry, OpponentRecord } from './types.js';
import type { CampaignProgress } from './campaign-types.js';
import { getCurrency, addCurrency as _addCurrency, spendCurrency as _spendCurrency } from './currencies.js';
import { secureLogger } from './secure-logger.js';

export type SlotId = 1 | 2 | 3;

export interface SlotMeta {
  slot: SlotId;
  empty: boolean;
  starterRace: string | null;
  coins: number;
  currentChapter: string;
  lastSaved: string | null;  // ISO date string
}

export interface CraftedCardRecord {
  id: string;
  baseId: string;
  effectSourceId: string;
}

export const Progression = (() => {

  interface EffectItemEntry {
    id: string;
    count: number;
  }

  // ── Slot-aware key mapping ───────────────────────────────

  /** Logical key names for per-slot data */
  const SLOT_KEY_NAMES = {
    initialized:      'initialized',
    starterChosen:    'starter_chosen',
    starterRace:      'starter_race',
    collection:       'collection',
    deck:             'deck',
    coins:            'currency_coins',
    opponents:        'opponents',
    version:          'save_version',
    seenCards:        'seen_cards',
    campaignProgress: 'campaign_progress',
    effectItems:      'effect_items',
    craftedCards:     'crafted_cards',
    nextCraftedId:    'next_crafted_id',
  } as const;

  // Checkpoint save throttling (prevents spam/DoS)
  const CHECKPOINT_SAVE_COOLDOWN_MS = 5000;
  let _lastCheckpointSave = 0;

  /** Global keys (not per-slot) */
  const GLOBAL_KEYS = {
    settings:   'tcg_settings',
    slotMeta:   'tcg_slot_meta',
    activeSlot: 'tcg_active_slot',
  } as const;

  const DUEL_CHECKPOINT_SUFFIX = 'duel_checkpoint';

  const SAVE_VERSION   = 2;
  const OPPONENT_COUNT = 10;
  const SLOT_IDS: SlotId[] = [1, 2, 3];

  let activeSlot: SlotId | null = null;

  /** Build a localStorage key for a given slot and logical key name */
  function _slotKey(slot: SlotId, name: string): string {
    return `tcg_s${slot}_${name}`;
  }

  /** Get the localStorage key for the active slot. Throws if no slot is active. */
  function _key(name: string): string {
    if (activeSlot === null) throw new Error('[Progression] No active save slot. Call selectSlot() first.');
    return _slotKey(activeSlot, name);
  }

  /** Duel checkpoint key for a slot */
  function _checkpointKey(slot?: SlotId): string {
    const s = slot ?? activeSlot;
    if (s === null) throw new Error('[Progression] No active save slot.');
    return _slotKey(s, DUEL_CHECKPOINT_SUFFIX);
  }

  /**
   * Safely parse JSON string with prototype pollution protection.
   * Validates input before parsing and rejects dangerous patterns.
   *
   * SECURITY NOTE: CSRF protection is not applicable here.
   * localStorage data is scoped by origin (Same-Origin Policy) and
   * is never automatically transmitted with HTTP requests.
   * The actual threat model for localStorage is XSS, not CSRF.
   * Since this is a client-side only application with no backend
   * authentication, CSRF attacks cannot target this storage layer.
   */
  function safeJsonParse<T>(raw: string | null, fallback: T): T {
    if (raw === null || raw === '') return fallback;
    
    // Block prototype pollution attempts
    if (/\b(__proto__|constructor|prototype)\b/.test(raw)) {
      secureLogger.warn('SECURITY', 'Blocked prototype pollution attempt');
      return fallback;
    }
    
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  function _load<T>(key: string, fallback: T, validator?: (v: unknown) => boolean): T {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    
    const parsed = safeJsonParse(raw, fallback as T | null);
    if (parsed === null) return fallback;
    
    if (validator && !validator(parsed)) {
      secureLogger.warn('PROGRESSION', `Invalid format for "${key}" – using fallback`);
      return fallback;
    }
    return parsed;
  }

  function _save(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      secureLogger.error('PROGRESSION', `Save failed for "${key}":`, e);
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

  // ── Slot Management ──────────────────────────────────────

  /** Read the persisted active slot (or null if none) */
  function _readActiveSlot(): SlotId | null {
    const raw = localStorage.getItem(GLOBAL_KEYS.activeSlot);
    if (raw === null) return null;
    const num = parseInt(raw, 10);
    if (num >= 1 && num <= 3) return num as SlotId;
    return null;
  }

  /** Set the active slot for all subsequent Progression calls */
  function selectSlot(slot: SlotId): void {
    activeSlot = slot;
    localStorage.setItem(GLOBAL_KEYS.activeSlot, String(slot));
  }

  function getActiveSlot(): SlotId | null {
    return activeSlot;
  }

  /** Check if a slot has save data */
  function isSlotEmpty(slot: SlotId): boolean {
    return localStorage.getItem(_slotKey(slot, SLOT_KEY_NAMES.initialized)) === null;
  }

  /** Get display metadata for all 3 slots */
  function getSlotMeta(): SlotMeta[] {
    const stored = _load<Record<number, Omit<SlotMeta, 'slot' | 'empty'>>>(GLOBAL_KEYS.slotMeta, {});
    return SLOT_IDS.map(slot => {
      const empty = isSlotEmpty(slot);
      const meta = stored[slot];
      return {
        slot,
        empty,
        starterRace: empty ? null : (meta?.starterRace ?? localStorage.getItem(_slotKey(slot, SLOT_KEY_NAMES.starterRace)) ?? null),
        coins: empty ? 0 : (meta?.coins ?? getCurrency(slot as SlotId, 'coins')),
        currentChapter: empty ? 'ch1' : (meta?.currentChapter ?? 'ch1'),
        lastSaved: empty ? null : (meta?.lastSaved ?? null),
      };
    });
  }

  /** Update metadata for the active slot (call after significant saves) */
  function updateSlotMeta(): void {
    if (activeSlot === null) return;
    const stored = _load<Record<number, unknown>>(GLOBAL_KEYS.slotMeta, {});
    const progress = getCampaignProgress();
    stored[activeSlot] = {
      starterRace: localStorage.getItem(_key(SLOT_KEY_NAMES.starterRace)) ?? null,
      coins: getCoins(),
      currentChapter: progress.currentChapter,
      lastSaved: new Date().toISOString(),
    };
    _save(GLOBAL_KEYS.slotMeta, stored);
  }

  /** Delete all data for a specific slot */
  function deleteSlot(slot: SlotId): void {
    Object.values(SLOT_KEY_NAMES).forEach(name => {
      localStorage.removeItem(_slotKey(slot, name));
    });
    localStorage.removeItem(_slotKey(slot, DUEL_CHECKPOINT_SUFFIX));
    const stored = _load<Record<number, unknown>>(GLOBAL_KEYS.slotMeta, {});
    delete stored[slot];
    _save(GLOBAL_KEYS.slotMeta, stored);
    if (activeSlot === slot) {
      activeSlot = null;
      localStorage.removeItem(GLOBAL_KEYS.activeSlot);
    }
  }

  /** Check if any slot has data (for showing Load Game button) */
  function hasAnySave(): boolean {
    return SLOT_IDS.some(slot => !isSlotEmpty(slot));
  }

  // ── Migration ────────────────────────────────────────────

  /** Migrate old flat-key saves into slot 1 */
  function _migrateFromFlatKeys(): void {
    if (localStorage.getItem(GLOBAL_KEYS.activeSlot) !== null) return;

    const oldInitialized = localStorage.getItem('tcg_initialized');
    if (!oldInitialized) return;

    secureLogger.info('PROGRESSION', 'Migrating flat-key save data to slot 1');
    const slot: SlotId = 1;

    const migrations: [string, string][] = [
      ['tcg_initialized',        _slotKey(slot, SLOT_KEY_NAMES.initialized)],
      ['tcg_starter_chosen',     _slotKey(slot, SLOT_KEY_NAMES.starterChosen)],
      ['tcg_starter_race',       _slotKey(slot, SLOT_KEY_NAMES.starterRace)],
      ['tcg_collection',         _slotKey(slot, SLOT_KEY_NAMES.collection)],
      ['tcg_deck',               _slotKey(slot, SLOT_KEY_NAMES.deck)],
      ['eos_jade_coins',         _slotKey(slot, SLOT_KEY_NAMES.coins)],
      ['tcg_opponents',          _slotKey(slot, SLOT_KEY_NAMES.opponents)],
      ['tcg_save_version',       _slotKey(slot, SLOT_KEY_NAMES.version)],
      ['tcg_seen_cards',         _slotKey(slot, SLOT_KEY_NAMES.seenCards)],
      ['tcg_campaign_progress',  _slotKey(slot, SLOT_KEY_NAMES.campaignProgress)],
      ['tcg_duel_checkpoint',    _slotKey(slot, DUEL_CHECKPOINT_SUFFIX)],
    ];

    for (const [oldKey, newKey] of migrations) {
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }

    selectSlot(slot);

    const starterRace = localStorage.getItem(_slotKey(slot, SLOT_KEY_NAMES.starterRace)) ?? null;
    const coins = _load(_slotKey(slot, SLOT_KEY_NAMES.coins), 0);
    const progress = _load(_slotKey(slot, SLOT_KEY_NAMES.campaignProgress),
      { completedNodes: [], currentChapter: 'ch1' },
      v => v !== null && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).completedNodes));
    _save(GLOBAL_KEYS.slotMeta, {
      [slot]: {
        starterRace,
        coins,
        currentChapter: (progress as CampaignProgress).currentChapter,
        lastSaved: new Date().toISOString(),
      },
    });

    secureLogger.info('PROGRESSION', 'Migration to slot 1 complete');
  }

  // ── Initialization ───────────────────────────────────────

  function init() {
    _migrateFromFlatKeys();

    if (activeSlot === null) {
      activeSlot = _readActiveSlot();
    }

    if (activeSlot === null) return;

    const initKey = _key(SLOT_KEY_NAMES.initialized);
    const coinsKey = _key(SLOT_KEY_NAMES.coins);
    const collectionKey = _key(SLOT_KEY_NAMES.collection);
    const opponentsKey = _key(SLOT_KEY_NAMES.opponents);
    const versionKey = _key(SLOT_KEY_NAMES.version);

    if (!localStorage.getItem(initKey)) {
      _save(coinsKey, 0);
      _save(collectionKey, []);
      _save(opponentsKey, _defaultOpponents());
      localStorage.setItem(initKey, '1');
      _save(versionKey, SAVE_VERSION);
    } else {
      if (!localStorage.getItem(coinsKey)) _save(coinsKey, 0);
      if (!localStorage.getItem(collectionKey)) _save(collectionKey, []);
      if (!localStorage.getItem(opponentsKey)) _save(opponentsKey, _defaultOpponents());
      if (!localStorage.getItem(versionKey)) _save(versionKey, 1);

      const savedVersion = _load(versionKey, 0, v => typeof v === 'number');
      if (savedVersion < 2) {
        const col = _load(collectionKey, [], v => Array.isArray(v)) as Array<{ id: string }>;
        const hasOldIds = col.some(e => /^[A-Z]/.test(e.id));
      if (hasOldIds) {
        secureLogger.info('PROGRESSION', 'Migrating slot data to v2: clearing collection and deck');
          try {
            localStorage.setItem(`tcg_s${activeSlot}_collection_v1_backup`, JSON.stringify(col));
            const oldDeck = localStorage.getItem(_key(SLOT_KEY_NAMES.deck));
            if (oldDeck) localStorage.setItem(`tcg_s${activeSlot}_deck_v1_backup`, oldDeck);
          } catch { /* backup is best-effort */ }
          _save(collectionKey, []);
          localStorage.removeItem(_key(SLOT_KEY_NAMES.deck));
          localStorage.setItem('tcg_migration_pending', '1');
        }
        _save(versionKey, SAVE_VERSION);
      }
    }
  }

  function hasMigrationPending(): boolean {
    return localStorage.getItem('tcg_migration_pending') === '1';
  }

  function clearMigrationPending(): void {
    localStorage.removeItem('tcg_migration_pending');
  }

  function isFirstLaunch() {
    if (activeSlot === null) return true;
    return !localStorage.getItem(_key(SLOT_KEY_NAMES.starterChosen));
  }

  function markStarterChosen(race: string) {
    localStorage.setItem(_key(SLOT_KEY_NAMES.starterChosen), '1');
    localStorage.setItem(_key(SLOT_KEY_NAMES.starterRace), race);
    updateSlotMeta();
  }

  function getStarterRace() {
    if (activeSlot === null) return null;
    return localStorage.getItem(_key(SLOT_KEY_NAMES.starterRace)) || null;
  }

  // ── Coins ────────────────────────────────────────────────

function getCoins(): number {
  if (activeSlot === null) return 0;
  return getCurrency(activeSlot, 'coins');
}

function addCoins(amount: number): number {
  if (activeSlot === null) return 0;
  return _addCurrency(activeSlot, 'coins', amount);
}

function spendCoins(amount: number): boolean {
  if (activeSlot === null) return false;
  return _spendCurrency(activeSlot, 'coins', amount);
}

  // ── Collection ───────────────────────────────────────────

  function getCollection(): CollectionEntry[] {
    return _load(_key(SLOT_KEY_NAMES.collection), [], v => Array.isArray(v));
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
    _save(_key(SLOT_KEY_NAMES.collection), newCol);
  }

  function removeCardsFromCollection(ids: string[]): void {
    const col = getCollection();
    for (const id of ids) {
      const idx = col.findIndex(e => e.id === id);
      if (idx !== -1) {
        col[idx].count -= 1;
        if (col[idx].count <= 0) {
          col.splice(idx, 1);
        }
      }
    }
    _save(_key(SLOT_KEY_NAMES.collection), col);
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

  function getEffectItems(): EffectItemEntry[] {
    return _load(_key(SLOT_KEY_NAMES.effectItems), [], v => Array.isArray(v));
  }

  function addEffectItem(id: string, count: number = 1): void {
    const items = getEffectItems();
    const existing = items.find(e => e.id === id);
    if (existing) {
      existing.count += count;
    } else {
      items.push({ id, count });
    }
    _save(_key(SLOT_KEY_NAMES.effectItems), items);
  }

  function removeEffectItem(id: string, count: number = 1): boolean {
    const items = getEffectItems();
    const idx = items.findIndex(e => e.id === id);
    if (idx === -1) return false;
    
    items[idx].count -= count;
    if (items[idx].count <= 0) {
      items.splice(idx, 1);
    }
    _save(_key(SLOT_KEY_NAMES.effectItems), items);
    return true;
  }

  function getEffectItemCount(id: string): number {
    const items = getEffectItems();
    const entry = items.find(e => e.id === id);
    return entry ? entry.count : 0;
  }

  function getCraftedCards(): CraftedCardRecord[] {
    return _load(_key(SLOT_KEY_NAMES.craftedCards), [], v => Array.isArray(v));
  }

  function getNextCraftedId(): number {
    return _load(_key(SLOT_KEY_NAMES.nextCraftedId), 0, v => typeof v === 'number');
  }

  function incrementCraftedId(): void {
    const next = getNextCraftedId() + 1;
    _save(_key(SLOT_KEY_NAMES.nextCraftedId), next);
  }

  function addCraftedCard(baseId: string, effectSourceId: string): string {
    const CRAFTED_ID_OFFSET = 100_000_000;
    const nextId = getNextCraftedId();
    incrementCraftedId();
    
    const generatedId = String(CRAFTED_ID_OFFSET + nextId);
    
    const records = getCraftedCards();
    records.push({
      id: generatedId,
      baseId,
      effectSourceId,
    });
    _save(_key(SLOT_KEY_NAMES.craftedCards), records);
    
    return generatedId;
  }

  function findCraftedRecord(id: string): CraftedCardRecord | undefined {
    const records = getCraftedCards();
    return records.find(r => r.id === id);
  }

  function getDeck(): string[] | null {
    return _load(_key(SLOT_KEY_NAMES.deck), null, v => Array.isArray(v) && v.every(id => typeof id === 'string'));
  }

  function saveDeck(deckIds: string[]): boolean {
    return _save(_key(SLOT_KEY_NAMES.deck), deckIds);
  }

  function getOpponents(): Record<number, OpponentRecord> {
    return _load(_key(SLOT_KEY_NAMES.opponents), _defaultOpponents(),
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
    _save(_key(SLOT_KEY_NAMES.opponents), ops);
  }

  function isOpponentUnlocked(opponentId: number | string): boolean {
    const ops = getOpponents();
    const id = parseInt(opponentId as string, 10);
    return !!(ops[id] && ops[id].unlocked);
  }

  interface Settings { lang: string; volMaster: number; volMusic: number; volSfx: number; controllerEnabled: boolean; vibrationEnabled: boolean; }

  const SETTINGS_DEFAULTS: Settings = { lang: 'en', volMaster: 50, volMusic: 50, volSfx: 50, controllerEnabled: true, vibrationEnabled: true };

  function getSettings(): Settings {
    return { ...SETTINGS_DEFAULTS, ..._load(GLOBAL_KEYS.settings, SETTINGS_DEFAULTS) };
  }

  function saveSettings(s: Settings): void {
    _save(GLOBAL_KEYS.settings, s);
  }

  function getSeenCards(): Set<string> {
    const arr = _load(_key(SLOT_KEY_NAMES.seenCards), [], v => Array.isArray(v));
    return new Set(arr);
  }

  function markCardsAsSeen(ids: string[]): void {
    if (ids.length === 0) return;
    const seen = getSeenCards();
    ids.forEach(id => seen.add(id));
    _save(_key(SLOT_KEY_NAMES.seenCards), [...seen]);
  }

  function getCampaignProgress(): CampaignProgress {
    return _load(_key(SLOT_KEY_NAMES.campaignProgress), { completedNodes: [], currentChapter: 'ch1' },
      v => v !== null && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).completedNodes));
  }

  function saveCampaignProgress(progress: CampaignProgress): void {
    _save(_key(SLOT_KEY_NAMES.campaignProgress), progress);
  }

  function markNodeComplete(nodeId: string): CampaignProgress {
    if (!nodeId || typeof nodeId !== 'string') {
      secureLogger.warn('PROGRESSION', 'markNodeComplete called with invalid nodeId:', nodeId);
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

  function saveDuelCheckpoint(data: unknown): void {
    const now = Date.now();
    if (now - _lastCheckpointSave < CHECKPOINT_SAVE_COOLDOWN_MS) {
      console.warn('[Progression] Checkpoint save throttled');
      return;
    }
    _save(_checkpointKey(), data);
    _lastCheckpointSave = now;
  }

  function loadDuelCheckpoint<T>(): T | null {
    return _load(_checkpointKey(), null);
  }

  function clearDuelCheckpoint(): void {
    localStorage.removeItem(_checkpointKey());
  }

  // ── v1 Migration Recovery ────────────────────────────────

  function hasV1Backup(): boolean {
    if (activeSlot === null) return false;
    return localStorage.getItem(`tcg_s${activeSlot}_collection_v1_backup`) !== null;
  }

  function restoreV1Backup(): boolean {
    if (activeSlot === null) return false;
    try {
      const raw = localStorage.getItem(`tcg_s${activeSlot}_collection_v1_backup`);
      if (!raw) return false;
      const col = JSON.parse(raw);
      if (!Array.isArray(col)) return false;
      _save(_key(SLOT_KEY_NAMES.collection), col);
      const deckRaw = localStorage.getItem(`tcg_s${activeSlot}_deck_v1_backup`);
      if (deckRaw) localStorage.setItem(_key(SLOT_KEY_NAMES.deck), deckRaw);
      secureLogger.info('PROGRESSION', 'Restored v1 backup successfully');
      return true;
    } catch {
      secureLogger.warn('PROGRESSION', 'Failed to restore v1 backup');
      return false;
    }
  }

  // ── Debug / Reset ────────────────────────────────────────

  function resetAll() {
    if (activeSlot === null) return;
    Object.values(SLOT_KEY_NAMES).forEach(name => {
      localStorage.removeItem(_key(name));
    });
    localStorage.removeItem(_checkpointKey());
    secureLogger.warn('PROGRESSION', `Slot ${activeSlot} data reset`);
  }

  // ── Soft-Reset / Backup ──────────────────────────────────

  function backupToSession(): void {
    if (activeSlot === null) return;
    const backup: Record<string, string | null> = {};
    Object.values(SLOT_KEY_NAMES).forEach(name => {
      const k = _key(name);
      backup[k] = localStorage.getItem(k);
    });
    const ckKey = _checkpointKey();
    backup[ckKey] = localStorage.getItem(ckKey);
    backup['__slot'] = String(activeSlot);
    sessionStorage.setItem('tcg_save_backup', JSON.stringify(backup));
  }

  function hasBackup(): boolean {
    return sessionStorage.getItem('tcg_save_backup') !== null;
  }

  function restoreFromBackup(): void {
    const raw = sessionStorage.getItem('tcg_save_backup');
    if (!raw) return;
    const backup = JSON.parse(raw) as Record<string, string | null>;
    const backupSlot = backup['__slot'] ? parseInt(backup['__slot'], 10) as SlotId : activeSlot;
    Object.entries(backup).forEach(([k, v]) => {
      if (k === '__slot') return;
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    });
    if (backupSlot) selectSlot(backupSlot);
    sessionStorage.removeItem('tcg_save_backup');
  }

  function clearBackup(): void {
    sessionStorage.removeItem('tcg_save_backup');
  }

  // ── Public API ───────────────────────────────────────────

  return {
    // Slot management
    selectSlot,
    getActiveSlot,
    isSlotEmpty,
    getSlotMeta,
    updateSlotMeta,
    deleteSlot,
    hasAnySave,
    // Init
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
    removeCardsFromCollection,
    ownsCard,
    cardCount,
    // Effect Items
    getEffectItems,
    addEffectItem,
    removeEffectItem,
    getEffectItemCount,
    // Crafted Cards
    getCraftedCards,
    getNextCraftedId,
    incrementCraftedId,
    addCraftedCard,
    findCraftedRecord,
    // Deck
    getDeck,
    saveDeck,
    // Opponents
    getOpponents,
    recordDuelResult,
    isOpponentUnlocked,
    // Settings (global)
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
    // Migration
    hasMigrationPending,
    clearMigrationPending,
    // v1 Migration Recovery
    hasV1Backup,
    restoreV1Backup,
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
