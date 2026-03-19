// ============================================================
// AETHERIAL CLASH - Progression System
// Verwaltet: Münzen, Sammlung, Deck, Gegner-Unlock
// ============================================================

const Progression = (() => {

  const KEYS = {
    initialized:    'ac_initialized',
    starterChosen:  'ac_starter_chosen',
    starterRace:    'ac_starter_race',
    collection:     'ac_collection',
    deck:           'ac_deck',
    coins:          'ac_aether_coins',
    opponents:      'ac_opponents',
  };

  const OPPONENT_COUNT = 10;

  // ── Hilfsfunktionen ──────────────────────────────────────

  function _load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function _save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function _defaultOpponents() {
    const ops = {};
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
    } else {
      // Fehlende Felder ergänzen (nach Updates)
      if (!localStorage.getItem(KEYS.coins)) _save(KEYS.coins, 0);
      if (!localStorage.getItem(KEYS.collection)) _save(KEYS.collection, []);
      if (!localStorage.getItem(KEYS.opponents)) _save(KEYS.opponents, _defaultOpponents());
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

  function getCoins() {
    return _load(KEYS.coins, 0);
  }

  function addCoins(amount) {
    const current = getCoins();
    _save(KEYS.coins, current + Math.max(0, amount));
    return getCoins();
  }

  /** Gibt false zurück wenn nicht genug Münzen vorhanden */
  function spendCoins(amount) {
    const current = getCoins();
    if (current < amount) return false;
    _save(KEYS.coins, current - amount);
    return true;
  }

  // ── Sammlung ─────────────────────────────────────────────

  function getCollection() {
    return _load(KEYS.collection, []);
  }

  /** cards: Array von Card-Objekten oder ID-Strings */
  function addCardsToCollection(cards) {
    const col = getCollection();
    const map = {};
    col.forEach(entry => { map[entry.id] = entry.count; });

    cards.forEach(card => {
      const id = typeof card === 'string' ? card : card.id;
      map[id] = (map[id] || 0) + 1;
    });

    const newCol = Object.entries(map).map(([id, count]) => ({ id, count }));
    _save(KEYS.collection, newCol);
  }

  /** Gibt true zurück wenn der Spieler mindestens 1 Exemplar der Karte besitzt */
  function ownsCard(cardId) {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return !!entry && entry.count > 0;
  }

  /** Gibt die Anzahl der besessenen Exemplare zurück */
  function cardCount(cardId) {
    const col = getCollection();
    const entry = col.find(e => e.id === cardId);
    return entry ? entry.count : 0;
  }

  // ── Deck ─────────────────────────────────────────────────

  function getDeck() {
    // Versuche neuen Key, dann alten Legacy-Key
    const deck = _load(KEYS.deck, null);
    if (deck) return deck;
    try {
      const legacy = localStorage.getItem('aetherialClash_deck');
      if (legacy) return JSON.parse(legacy);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveDeck(deckIds) {
    _save(KEYS.deck, deckIds);
    // Legacy-Key synchron halten für Abwärtskompatibilität
    localStorage.setItem('aetherialClash_deck', JSON.stringify(deckIds));
  }

  // ── Gegner ───────────────────────────────────────────────

  function getOpponents() {
    return _load(KEYS.opponents, _defaultOpponents());
  }

  function recordDuelResult(opponentId, won) {
    const id = parseInt(opponentId, 10);
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

  function isOpponentUnlocked(opponentId) {
    const ops = getOpponents();
    const id = parseInt(opponentId, 10);
    return !!(ops[id] && ops[id].unlocked);
  }

  // ── Debug / Reset ────────────────────────────────────────

  /** Setzt alle Progression-Daten zurück (nur für Debug) */
  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    console.warn('[Progression] Alle Daten zurückgesetzt.');
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
    // Debug
    resetAll,
  };

})();
