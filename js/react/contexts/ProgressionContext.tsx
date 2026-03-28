import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Progression } from '../../progression.js';
import { CARD_DB } from '../../cards.js';
import { GAME_RULES } from '../../rules.js';
import type { CollectionEntry, OpponentRecord } from '../../types.js';

interface ProgressionCtx {
  coins: number;
  collection: CollectionEntry[];
  opponents: Record<number, OpponentRecord>;
  currentDeck: string[];
  refresh: () => void;
  setCurrentDeck: (ids: string[]) => void;
  loadDeck: () => void;
}

const ProgressionContext = createContext<ProgressionCtx>({
  coins: 0, collection: [], opponents: {}, currentDeck: [],
  refresh: () => {}, setCurrentDeck: () => {}, loadDeck: () => {},
});

export function ProgressionProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoins]           = useState(0);
  const [collection, setCollection] = useState<CollectionEntry[]>([]);
  const [opponents, setOpponents]   = useState<Record<number, OpponentRecord>>({});
  const [currentDeck, setCurrentDeck] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setCoins(Progression.getCoins());
    setCollection(Progression.getCollection());
    setOpponents(Progression.getOpponents());
  }, []);

  const loadDeck = useCallback(() => {
    const saved = Progression.getDeck();
    if (saved && saved.length > 0) {
      // Validate: strip unknown IDs, enforce copy limits, enforce max deck size
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
      setCurrentDeck(sanitized);
      return;
    }
    // Fallback: import PLAYER_DECK_IDS lazily to avoid circular dep
    import('../../cards.js').then(m => setCurrentDeck([...m.PLAYER_DECK_IDS]));
  }, []);

  useEffect(() => {
    Progression.init();
    refresh();
    loadDeck();
  // intentional: runs once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ coins, collection, opponents, currentDeck, refresh, setCurrentDeck, loadDeck }),
    [coins, collection, opponents, currentDeck, refresh, setCurrentDeck, loadDeck],
  );

  return (
    <ProgressionContext.Provider value={value}>
      {children}
    </ProgressionContext.Provider>
  );
}

export function useProgression() { return useContext(ProgressionContext); }
