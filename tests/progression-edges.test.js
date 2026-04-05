// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Progression } from '../src/progression.ts';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  Progression.selectSlot(1);
  Progression.init();
});

// ── resetAll ─────────────────────────────────────────────────

describe('resetAll', () => {
  it('clears all progression keys from localStorage', () => {
    Progression.addCoins(500);
    Progression.addCardsToCollection(['1']);
    Progression.saveDeck(['1']);
    Progression.markStarterChosen('Dragon');
    Progression.saveSettings({ lang: 'de', volMaster: 80, volMusic: 60, volSfx: 40 });
    Progression.markCardsAsSeen(['1', '2']);

    Progression.resetAll();

    // After reset, re-init should behave like first launch
    Progression.init();
    expect(Progression.getCoins()).toBe(0);
    expect(Progression.getCollection()).toEqual([]);
    expect(Progression.isFirstLaunch()).toBe(true);
    expect(Progression.getStarterRace()).toBeNull();
    expect(Progression.getSeenCards().size).toBe(0);
  });

  it('does not affect non-progression localStorage keys', () => {
    localStorage.setItem('some_other_key', 'preserve_me');
    Progression.resetAll();
    expect(localStorage.getItem('some_other_key')).toBe('preserve_me');
  });
});

// ── Backup / Restore ─────────────────────────────────────────

describe('backupToSession / restoreFromBackup / clearBackup', () => {
  it('hasBackup returns false when no backup exists', () => {
    expect(Progression.hasBackup()).toBe(false);
  });

  it('backupToSession creates a backup and hasBackup returns true', () => {
    Progression.addCoins(300);
    Progression.backupToSession();
    expect(Progression.hasBackup()).toBe(true);
  });

  it('restoreFromBackup restores previous state', () => {
    Progression.addCoins(300);
    Progression.addCardsToCollection(['1', '2']);
    Progression.saveDeck(['1']);
    Progression.markStarterChosen('Warrior');

    Progression.backupToSession();

    // Modify state after backup
    Progression.resetAll();
    Progression.init();
    Progression.addCoins(9999);

    // Restore
    Progression.restoreFromBackup();
    expect(Progression.getCoins()).toBe(300);
    expect(Progression.cardCount('1')).toBe(1);
    expect(Progression.cardCount('2')).toBe(1);
    expect(Progression.getDeck()).toEqual(['1']);
    expect(Progression.getStarterRace()).toBe('Warrior');
  });

  it('restoreFromBackup removes the backup afterwards', () => {
    Progression.backupToSession();
    expect(Progression.hasBackup()).toBe(true);
    Progression.restoreFromBackup();
    expect(Progression.hasBackup()).toBe(false);
  });

  it('restoreFromBackup is a no-op when no backup exists', () => {
    Progression.addCoins(100);
    Progression.restoreFromBackup(); // should not throw
    expect(Progression.getCoins()).toBe(100);
  });

  it('clearBackup removes backup without restoring', () => {
    Progression.addCoins(500);
    Progression.backupToSession();

    // Change state
    Progression.addCoins(200);

    Progression.clearBackup();
    expect(Progression.hasBackup()).toBe(false);
    // State should remain as modified, not restored
    expect(Progression.getCoins()).toBe(700);
  });

  it('backup preserves null keys (removed items restore as removed)', () => {
    // Don't choose a starter — starterChosen and starterRace are absent
    Progression.backupToSession();

    // Now set a starter
    Progression.markStarterChosen('Dragon');
    expect(Progression.getStarterRace()).toBe('Dragon');

    // Restore should remove the starter keys
    Progression.restoreFromBackup();
    expect(Progression.isFirstLaunch()).toBe(true);
    expect(Progression.getStarterRace()).toBeNull();
  });
});

// ── Starter deck selection ───────────────────────────────────

describe('starter deck selection', () => {
  it('isFirstLaunch returns true before choosing starter', () => {
    expect(Progression.isFirstLaunch()).toBe(true);
  });

  it('isFirstLaunch returns false after markStarterChosen', () => {
    Progression.markStarterChosen('Dragon');
    expect(Progression.isFirstLaunch()).toBe(false);
  });

  it('getStarterRace returns the chosen race', () => {
    Progression.markStarterChosen('Spellcaster');
    expect(Progression.getStarterRace()).toBe('Spellcaster');
  });

  it('getStarterRace returns null before choosing', () => {
    expect(Progression.getStarterRace()).toBeNull();
  });

  it('markStarterChosen can be called multiple times (overwrite)', () => {
    Progression.markStarterChosen('Dragon');
    Progression.markStarterChosen('Warrior');
    expect(Progression.getStarterRace()).toBe('Warrior');
    expect(Progression.isFirstLaunch()).toBe(false);
  });

  it('starter deck cards must be added to collection (prevents bricking)', () => {
    const starterCards = ['1', '2', '3', '1', '1'];
    Progression.markStarterChosen('Dragon');
    Progression.addCardsToCollection(starterCards);
    Progression.saveDeck(starterCards);
    expect(Progression.cardCount('1')).toBe(3);
    expect(Progression.cardCount('2')).toBe(1);
    expect(Progression.cardCount('3')).toBe(1);
    expect(Progression.ownsCard('1')).toBe(true);
    expect(Progression.ownsCard('2')).toBe(true);
    expect(Progression.ownsCard('3')).toBe(true);
    expect(Progression.getDeck()).toEqual(starterCards);
  });

  it('player can rebuild deck after removing all cards (collection preserved)', () => {
    const starterCards = ['1', '2', '3'];
    Progression.markStarterChosen('Dragon');
    Progression.addCardsToCollection(starterCards);
    Progression.saveDeck(starterCards);
    Progression.saveDeck([]);
    expect(Progression.ownsCard('1')).toBe(true);
    expect(Progression.ownsCard('2')).toBe(true);
    expect(Progression.ownsCard('3')).toBe(true);
    Progression.saveDeck(['1', '2', '3']);
    expect(Progression.getDeck()).toEqual(['1', '2', '3']);
  });
});

// ── Coins edge cases ─────────────────────────────────────────

describe('coins edge cases', () => {
  it('spendCoins with exact balance succeeds and leaves 0', () => {
    Progression.addCoins(100);
    expect(Progression.spendCoins(100)).toBe(true);
    expect(Progression.getCoins()).toBe(0);
  });

  it('spendCoins with more than available fails and preserves balance', () => {
    Progression.addCoins(50);
    expect(Progression.spendCoins(51)).toBe(false);
    expect(Progression.getCoins()).toBe(50);
  });

  it('addCoins with zero amount does not change balance', () => {
    Progression.addCoins(100);
    Progression.addCoins(0);
    expect(Progression.getCoins()).toBe(100);
  });

  it('addCoins with negative amount is treated as 0 (Math.max)', () => {
    Progression.addCoins(100);
    Progression.addCoins(-999);
    expect(Progression.getCoins()).toBe(100);
  });

  it('getCoins falls back to 0 when localStorage has invalid data', () => {
    localStorage.setItem('tcg_s1_jade_coins', '"not_a_number"');
    expect(Progression.getCoins()).toBe(0);
  });

  it('getCoins falls back to 0 when localStorage has negative number', () => {
    localStorage.setItem('tcg_s1_jade_coins', '-50');
    expect(Progression.getCoins()).toBe(0);
  });

  it('getCoins falls back to 0 for unparseable JSON', () => {
    localStorage.setItem('tcg_s1_jade_coins', '{broken');
    expect(Progression.getCoins()).toBe(0);
  });
});

// ── Collection edge cases ────────────────────────────────────

describe('collection edge cases', () => {
  it('addCardsToCollection with empty array is a no-op', () => {
    Progression.addCardsToCollection([]);
    expect(Progression.getCollection()).toEqual([]);
  });

  it('addCardsToCollection accepts card objects with id property', () => {
    Progression.addCardsToCollection([{ id: '101' }, { id: '102' }]);
    expect(Progression.ownsCard('101')).toBe(true);
    expect(Progression.ownsCard('102')).toBe(true);
  });

  it('addCardsToCollection merges with existing collection', () => {
    Progression.addCardsToCollection(['1', '1']);
    Progression.addCardsToCollection(['1', '2']);
    expect(Progression.cardCount('1')).toBe(3);
    expect(Progression.cardCount('2')).toBe(1);
  });

  it('cardCount returns 0 for cards never added', () => {
    expect(Progression.cardCount('NONEXISTENT')).toBe(0);
  });

  it('ownsCard returns false for cards never added', () => {
    expect(Progression.ownsCard('NONEXISTENT')).toBe(false);
  });

  it('getCollection falls back to empty array for corrupted data', () => {
    localStorage.setItem('tcg_s1_collection', '"not_an_array"');
    expect(Progression.getCollection()).toEqual([]);
  });

  it('getCollection falls back to empty array for unparseable JSON', () => {
    localStorage.setItem('tcg_s1_collection', '{{{bad');
    expect(Progression.getCollection()).toEqual([]);
  });
});

// ── Deck edge cases ──────────────────────────────────────────

describe('deck edge cases', () => {
  it('saveDeck persists deck to slot key', () => {
    Progression.saveDeck(['1', '2']);
    const stored = JSON.parse(localStorage.getItem('tcg_s1_deck'));
    expect(stored).toEqual(['1', '2']);
  });

  it('getDeck returns null when key is missing', () => {
    localStorage.removeItem('tcg_s1_deck');
    expect(Progression.getDeck()).toBeNull();
  });

  it('getDeck falls back when main key has invalid format (not array)', () => {
    localStorage.setItem('tcg_s1_deck', '"just_a_string"');
    expect(Progression.getDeck()).toBeNull();
  });

  it('getDeck falls back when main key has non-string items', () => {
    localStorage.setItem('tcg_s1_deck', '[1, 2, 3]');
    // Validator rejects because items are not strings
    expect(Progression.getDeck()).toBeNull();
  });

  it('saveDeck with empty array persists empty deck', () => {
    Progression.saveDeck([]);
    expect(Progression.getDeck()).toEqual([]);
  });
});

// ── Opponents edge cases ─────────────────────────────────────

describe('opponents edge cases', () => {
  it('getOpponents returns 10 opponents with correct initial state', () => {
    const ops = Progression.getOpponents();
    const keys = Object.keys(ops).map(Number);
    expect(keys).toHaveLength(10);
    expect(keys).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i <= 10; i++) {
      expect(ops[i].unlocked).toBe(i === 1);
      expect(ops[i].wins).toBe(0);
      expect(ops[i].losses).toBe(0);
    }
  });

  it('recordDuelResult with string opponentId works (parseInt)', () => {
    Progression.recordDuelResult('1', true);
    expect(Progression.getOpponents()[1].wins).toBe(1);
    expect(Progression.getOpponents()[2].unlocked).toBe(true);
  });

  it('recordDuelResult does nothing for non-existent opponent id', () => {
    Progression.recordDuelResult(99, true);
    // Should not throw, opponents should remain unchanged
    const ops = Progression.getOpponents();
    expect(ops[1].wins).toBe(0);
  });

  it('recordDuelResult does nothing for id 0', () => {
    Progression.recordDuelResult(0, true);
    const ops = Progression.getOpponents();
    expect(Object.values(ops).every(o => o.wins === 0)).toBe(true);
  });

  it('winning opponent 10 does not unlock opponent 11 (boundary)', () => {
    // Unlock all opponents up to 10
    for (let i = 1; i < 10; i++) {
      Progression.recordDuelResult(i, true);
    }
    // Win against opponent 10
    Progression.recordDuelResult(10, true);
    const ops = Progression.getOpponents();
    expect(ops[10].wins).toBe(1);
    expect(ops[11]).toBeUndefined();
  });

  it('multiple wins increment counter but only unlock next once', () => {
    Progression.recordDuelResult(1, true);
    Progression.recordDuelResult(1, true);
    Progression.recordDuelResult(1, true);
    const ops = Progression.getOpponents();
    expect(ops[1].wins).toBe(3);
    expect(ops[2].unlocked).toBe(true);
    // Opponent 3 should still be locked (only next is unlocked)
    expect(ops[3].unlocked).toBe(false);
  });

  it('losing does not unlock next opponent', () => {
    Progression.recordDuelResult(1, false);
    Progression.recordDuelResult(1, false);
    const ops = Progression.getOpponents();
    expect(ops[1].losses).toBe(2);
    expect(ops[2].unlocked).toBe(false);
  });

  it('isOpponentUnlocked with string id works', () => {
    expect(Progression.isOpponentUnlocked('1')).toBe(true);
    expect(Progression.isOpponentUnlocked('2')).toBe(false);
  });

  it('isOpponentUnlocked returns false for non-existent id', () => {
    expect(Progression.isOpponentUnlocked(99)).toBe(false);
  });

  it('getOpponents falls back to defaults when data is corrupted', () => {
    localStorage.setItem('tcg_s1_opponents', '[1,2,3]');
    const ops = Progression.getOpponents();
    expect(ops[1].unlocked).toBe(true);
    expect(ops[2].unlocked).toBe(false);
  });

  it('progressive unlock chain works across multiple opponents', () => {
    // Win opponent 1 → unlocks 2
    Progression.recordDuelResult(1, true);
    expect(Progression.isOpponentUnlocked(2)).toBe(true);
    expect(Progression.isOpponentUnlocked(3)).toBe(false);

    // Win opponent 2 → unlocks 3
    Progression.recordDuelResult(2, true);
    expect(Progression.isOpponentUnlocked(3)).toBe(true);
    expect(Progression.isOpponentUnlocked(4)).toBe(false);

    // Win opponent 3 → unlocks 4
    Progression.recordDuelResult(3, true);
    expect(Progression.isOpponentUnlocked(4)).toBe(true);
  });

  it('winning already-unlocked-next does not reset unlock', () => {
    // Win once to unlock 2
    Progression.recordDuelResult(1, true);
    expect(Progression.isOpponentUnlocked(2)).toBe(true);

    // Win again — should not break anything
    Progression.recordDuelResult(1, true);
    expect(Progression.isOpponentUnlocked(2)).toBe(true);
    expect(Progression.getOpponents()[1].wins).toBe(2);
  });
});

// ── Settings ─────────────────────────────────────────────────

describe('settings', () => {
  it('getSettings returns defaults when no settings saved', () => {
    const s = Progression.getSettings();
    expect(s).toEqual({ lang: 'en', volMaster: 50, volMusic: 50, volSfx: 50 });
  });

  it('saveSettings persists and getSettings retrieves', () => {
    const custom = { lang: 'de', volMaster: 80, volMusic: 30, volSfx: 100 };
    Progression.saveSettings(custom);
    expect(Progression.getSettings()).toEqual(custom);
  });

  it('getSettings returns defaults for corrupted data', () => {
    localStorage.setItem('tcg_settings', '{{{bad');
    const s = Progression.getSettings();
    expect(s).toEqual({ lang: 'en', volMaster: 50, volMusic: 50, volSfx: 50 });
  });
});

// ── Seen cards ───────────────────────────────────────────────

describe('seen cards', () => {
  it('getSeenCards returns empty Set initially', () => {
    const seen = Progression.getSeenCards();
    expect(seen.size).toBe(0);
    expect(seen instanceof Set).toBe(true);
  });

  it('markCardsAsSeen adds cards to seen set', () => {
    Progression.markCardsAsSeen(['1', '2']);
    const seen = Progression.getSeenCards();
    expect(seen.has('1')).toBe(true);
    expect(seen.has('2')).toBe(true);
    expect(seen.size).toBe(2);
  });

  it('markCardsAsSeen with empty array is a no-op', () => {
    Progression.markCardsAsSeen(['1']);
    Progression.markCardsAsSeen([]);
    expect(Progression.getSeenCards().size).toBe(1);
  });

  it('markCardsAsSeen deduplicates across calls', () => {
    Progression.markCardsAsSeen(['1', '2']);
    Progression.markCardsAsSeen(['2', '3']);
    const seen = Progression.getSeenCards();
    expect(seen.size).toBe(3);
    expect(seen.has('1')).toBe(true);
    expect(seen.has('2')).toBe(true);
    expect(seen.has('3')).toBe(true);
  });

  it('getSeenCards falls back to empty set for corrupted data', () => {
    localStorage.setItem('tcg_s1_seen_cards', '"not_array"');
    const seen = Progression.getSeenCards();
    expect(seen.size).toBe(0);
  });
});

// ── init edge cases ──────────────────────────────────────────

describe('init edge cases', () => {
  it('init fills missing fields on existing saves', () => {
    localStorage.clear();
    Progression.selectSlot(1);
    localStorage.setItem('tcg_s1_initialized', '1');
    // All other keys missing — init should fill them
    Progression.init();
    expect(Progression.getCoins()).toBe(0);
    expect(Progression.getCollection()).toEqual([]);
    const ops = Progression.getOpponents();
    expect(ops[1].unlocked).toBe(true);
  });

  it('double init does not reset existing data', () => {
    Progression.addCoins(500);
    Progression.addCardsToCollection(['1']);
    Progression.init(); // second init
    expect(Progression.getCoins()).toBe(500);
    expect(Progression.cardCount('1')).toBe(1);
  });

  it('init sets save version stamp', () => {
    const ver = JSON.parse(localStorage.getItem('tcg_s1_save_version'));
    expect(ver).toBe(2);
  });

  it('init adds version stamp to existing saves missing it', () => {
    localStorage.clear();
    Progression.selectSlot(1);
    localStorage.setItem('tcg_s1_initialized', '1');
    Progression.init();
    const ver = JSON.parse(localStorage.getItem('tcg_s1_save_version'));
    expect(ver).toBe(2);
  });

  it('migrates old flat keys into slot 1', () => {
    localStorage.clear();
    sessionStorage.clear();
    // Simulate old flat-key save (no tcg_active_slot set)
    localStorage.setItem('tcg_initialized', '1');
    localStorage.setItem('eos_jade_coins', '999');
    localStorage.setItem('tcg_collection', JSON.stringify([{ id: '1', count: 2 }]));
    // Call init without selectSlot — migration should auto-detect flat keys
    Progression.init();
    // Old keys should be migrated to slot 1
    expect(Progression.getActiveSlot()).toBe(1);
    expect(Progression.getCoins()).toBe(999);
    expect(Progression.cardCount('1')).toBe(2);
    // Old flat keys should be removed
    expect(localStorage.getItem('tcg_initialized')).toBeNull();
    expect(localStorage.getItem('eos_jade_coins')).toBeNull();
  });
});
