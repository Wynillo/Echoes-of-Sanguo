import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { Progression } from '../../progression.js';
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
    if (saved && saved.length > 0) { setCurrentDeck(saved); return; }
    // Fallback: import PLAYER_DECK_IDS lazily to avoid circular dep
    import('../../cards.js').then(m => setCurrentDeck([...m.PLAYER_DECK_IDS]));
  }, []);

  useEffect(() => {
    Progression.init();
    refresh();
    loadDeck();
  }, [refresh, loadDeck]);

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
