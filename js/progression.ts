// ============================================================
// AETHERIAL CLASH - Progression System
// Verwaltet: Münzen, Sammlung, Deck, Gegner-Unlock
// ============================================================

import type { CollectionEntry, OpponentRecord } from './types.js';

export const Progression = (() => {

  const KEYS = {
    initialized:    'ac_initialized',
    starterChosen:  'ac_starter_chosen',
    starterRace:    'ac_starter_race',
    collection:     'ac_collection',
    deck:           'ac_deck',
    coins:          'ac_aether_coins',
    opponents:      'ac_opponents',
    version:        'ac_save_version',
    settings:       'ac_settings',
    seenCards:      'ac_seen_cards',
  };

  const SAVE_VERSION   = 1;   // increment when save format changes incompatibly
  const OPPONENT_COUNT = 10;

  // ── Hilfsfunktionen ──────────────────────────────────────

  /**
   * @param {string}    key       localStorage key
   * @param {*}         fallback  value returned when key is absent, unparseable, or invalid
   * @param {Function}  [validator]  optional fn(parsed) → boolean; returns fallback when false
   */
  function _load(key, fallback, validator?) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      if (validator && !validator(parsed)) {
        console.warn(`[Progression] Ungültiges Format für "${key}" – Fallback wird genutzt.`);
        return fallback;
      }
      return parsed;
    } catch (e) {
      return fallback;
    }
  }

  function _save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // QuotaExceededError (storage full) or SecurityError (private browsing blocked)
      console.error(`[Progression] Speichern fehlgeschlagen für "${key}":`, e);
    }
  }

  function _defaultOpponents(): Record<number, OpponentRecord> {
    const ops: Record<number, OpponentRecord> = {};
    for (let i = 1; i <= OPPONENT_COUNT; i++) {
      ops[i] = { unlocked: i === 1, wins: 0, losses: 0 };
    }
    return ops;
  }

  // ── Initialisierung ──────────────────────────────────────

  function init() {
    if (!localStorage.getItem(KEYS.initialized)) {
      // Erstmaliger Start – Standardwerte setzen
      _save(KEYS.coins, 0);
      _save(KEYS.collection, []);
      _save(KEYS.opponents, _defaultOpponents());
      // Deck: alten Key migrieren falls vorhanden
      const legacyDeck = localStorage.getItem('aetherialClash_deck');
      if (legacyDeck) {
        localStorage.setItem(KEYS.deck, legacyDeck);
      }
      localStorage.setItem(KEYS.initialized, '1');
      _save(KEYS.version, SAVE_VERSION);
    } else {
      // Fehlende Felder ergänzen (nach Updates)
      if (!localStorage.getItem(KEYS.coins)) _save(KEYS.coins, 0);
      if (!localStorage.getItem(KEYS.collection)) _save(KEYS.collection, []);
      if (!localStorage.getItem(KEYS.opponents)) _save(KEYS.opponents, _defaultOpponents());
      // Versionsstempel setzen falls fehlend (bestehende Saves von vor v1)
      if (!localStorage.getItem(KEYS.version)) _save(KEYS.version, SAVE_VERSION);
    }
  }

  function isFirstLaunch() {
    return !localStorage.getItem(KEYS.starterChosen);
  }

  function markStarterChosen(race) {
    localStorage.setItem(KEYS.starterChosen, '1');
    localStorage.setItem(KEYS.starterRace, race);
  }

  function getStarterRace() {
    return localStorage.getItem(KEYS.starterRace) || null;
  }

  // ── Münzen ───────────────────────────────────────────────

  function getCoins(): number {
    return _load(KEYS.coins, 0, v => typeof v === 'number' && v >= 0);
  }

  function addCoins(amount: number): number {
    const current = getCoins();
    _save(KEYS.coins, current + Math.max(0, amount));
    return getCoins();
  }

  /** Gibt false zurück wenn nicht genug Münzen vorhanden */
  function spendCoins(amount: number): boolean {
    const current = getCoins();
    if (current < amount) return false;
    _save(KEYS.coins, current - amount);
    return true;
  }

  // ── Sammlung ─────────────────────────────────────────────

  function getCollection(): CollectionEntry[] {
    return _load(KEYS.collection, [], v => Array.isArray(v));
  }

  /** cards: Array von Card-Objekten oder ID-Strings */
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

  /** Gibt true zurück wenn der Spieler mindestens 1 Exemplar der Karte besitzt */
  function ownsCard(cardId: string): boolean {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return !!entry && entry.count > 0;
  }

  /** Gibt die Anzahl der besessenen Exemplare zurück */
  function cardCount(cardId: string): number {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return entry ? entry.count : 0;
  }

  // ── Deck ─────────────────────────────────────────────────

  function getDeck(): string[] | null {
    // Versuche neuen Key, dann alten Legacy-Key
    const deck = _load(KEYS.deck, null, v => Array.isArray(v) && v.every(id => typeof id === 'string'));
    if (deck) return deck;
    try {
      const legacy = localStorage.getItem('aetherialClash_deck');
      if (legacy) return JSON.parse(legacy);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveDeck(deckIds: string[]): void {
    _save(KEYS.deck, deckIds);
    // Legacy-Key synchron halten für Abwärtskompatibilität
    localStorage.setItem('aetherialClash_deck', JSON.stringify(deckIds));
  }

  // ── Gegner ───────────────────────────────────────────────

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
      // Nächsten Gegner freischalten
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

  // ── Einstellungen ────────────────────────────────────────

  interface Settings { lang: string; volMaster: number; volMusic: number; volSfx: number; }

  function getSettings(): Settings {
    return _load(KEYS.settings, { lang: 'en', volMaster: 50, volMusic: 50, volSfx: 50 });
  }

  function saveSettings(s: Settings): void {
    _save(KEYS.settings, s);
  }

  // ── Gesehene Karten ──────────────────────────────────────

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

  // ── Debug / Reset ────────────────────────────────────────

  /** Setzt alle Progression-Daten zurück (nur für Debug) */
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    console.warn('[Progression] Alle Daten zurückgesetzt.');
  }

  // ── Soft-Reset / Backup ──────────────────────────────────

  /** Sichert den aktuellen Stand in sessionStorage (für "Neues Spiel"-Flow) */
  function backupToSession(): void {
    const backup: Record<string, string | null> = {};
    Object.values(KEYS).forEach(k => { backup[k] = localStorage.getItem(k); });
    sessionStorage.setItem('ac_save_backup', JSON.stringify(backup));
  }

  /** Gibt true zurück wenn ein Backup im sessionStorage vorhanden ist */
  function hasBackup(): boolean {
    return sessionStorage.getItem('ac_save_backup') !== null;
  }

  /** Stellt den gesicherten Stand wieder her und löscht das Backup */
  function restoreFromBackup(): void {
    const raw = sessionStorage.getItem('ac_save_backup');
    if (!raw) return;
    const backup = JSON.parse(raw) as Record<string, string | null>;
    Object.entries(backup).forEach(([k, v]) => {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    });
    sessionStorage.removeItem('ac_save_backup');
  }

  /** Löscht das Backup ohne Wiederherstellung (neues Spiel bestätigt) */
  function clearBackup(): void {
    sessionStorage.removeItem('ac_save_backup');
  }

  // ── Public API ───────────────────────────────────────────

  return {
    init,
    isFirstLaunch,
    markStarterChosen,
    getStarterRace,
    // Münzen
    getCoins,
    addCoins,
    spendCoins,
    // Sammlung
    getCollection,
    addCardsToCollection,
    ownsCard,
    cardCount,
    // Deck
    getDeck,
    saveDeck,
    // Gegner
    getOpponents,
    recordDuelResult,
    isOpponentUnlocked,
    // Einstellungen
    getSettings,
    saveSettings,
    // Gesehene Karten
    getSeenCards,
    markCardsAsSeen,
    // Debug
    resetAll,
    // Soft-Reset
    backupToSession,
    hasBackup,
    restoreFromBackup,
    clearBackup,
  };

})();
