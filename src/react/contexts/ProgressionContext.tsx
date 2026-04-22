import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Progression } from '../../progression.js';
import { CARD_DB } from '../../cards.js';
import { GAME_RULES } from '../../rules.js';
import type { CollectionEntry, OpponentRecord } from '../../types.js';
import type { SlotId } from '../../progression.js';

interface ProgressionCtx {
  coins: number;
  currencies: Record<string, number>;
  collection: CollectionEntry[];
  opponents: Record<number, OpponentRecord>;
  currentDeck: string[];
  activeSlot: SlotId | null;
  refresh: () => void;
  setCurrentDeck: (ids: string[]) => void;
  loadDeck: () => void;
}

const ProgressionContext = createContext<ProgressionCtx>({
  coins: 0, currencies: {}, collection: [], opponents: {}, currentDeck: [], activeSlot: null,
  refresh: () => {}, setCurrentDeck: () => {}, loadDeck: () => {},
});

export function ProgressionProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoins]           = useState(0);
  const [currencies, setCurrencies] = useState<Record<string, number>>({});
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [opponents, setOpponents]   = useState<Record<number, OpponentRecord>>({});
  const [currentDeck, setCurrentDeck] = useState<string[]>([]);
  const [activeSlot, setActiveSlot] = useState<SlotId | null>(null);

  const refresh = useCallback(() => {
    const slot = Progression.getActiveSlot();
    setActiveSlot(slot);
    if (slot === null) return;
    const coinBalance = Progression.getCoins();
    setCoins(coinBalance);
    setCurrencies({ coins: coinBalance });
    setCollection(Progression.getCollection());
    setOpponents(Progression.getOpponents());
  }, []);

  const loadDeck = useCallback(() => {
    if (Progression.getActiveSlot() === null) return;

    const repairCollection = (deckIds: string[]) => {
      const col = Progression.getCollection();
      const ownedSet = new Set(col.map(e => e.id));
      const missing = deckIds.filter(id => !ownedSet.has(id));
      if (missing.length > 0) {
        Progression.addCardsToCollection(missing);
        refresh();
      }
    };

    const saved = Progression.getDeck();
    if (saved && saved.length > 0) {
      const copyCounts: Record<string, number> = {};
      const sanitized = saved.filter(id => {
        if (!CARD_DB[id]) {
          console.warn(`[ProgressionContext] Removing unknown card "${id}" from saved deck.`);
          return false;
        }
        copyCounts[id] = (copyCounts[id] ?? 0) + 1;
        if (copyCounts[id] > GAME_RULES.maxCardCopies) {
          console.warn(`[ProgressionContext] Removing excess copy of "${id}" from saved deck.`);
          return false;
        }
        return true;
      }).slice(0, GAME_RULES.maxDeckSize);
      repairCollection(sanitized);
      setCurrentDeck(sanitized);
      return;
    }
    import('../../cards.js').then(m => {
      const ids = [...m.PLAYER_DECK_IDS];
      if (ids.length > 0) {
        Progression.addCardsToCollection(ids);
        Progression.saveDeck(ids);
        refresh();
      }
      setCurrentDeck(ids);
    });
  }, [refresh]);

  useEffect(() => {
    Progression.init().then(() => {
      refresh();
      loadDeck();
    });
  }, [refresh, loadDeck]);

  const value = useMemo(
    () => ({ coins, currencies, collection, opponents, currentDeck, activeSlot, refresh, setCurrentDeck, loadDeck }),
    [coins, currencies, collection, opponents, currentDeck, activeSlot, refresh, setCurrentDeck, loadDeck],
  );

  return (
    <ProgressionContext.Provider value={value}>
      {children}
    </ProgressionContext.Provider>
  );
}

export function useProgression() { return useContext(ProgressionContext); }
