import { createContext, useContext, useState, useCallback } from 'react';
import type { CardData } from '../../types.js';

export type SelMode =
  | 'hand' | 'attack' | 'fusion1' | 'spell-target'
  | 'grave-target' | 'trap-target' | null;

export interface Selection {
  mode:           SelMode;
  handIndex:      number | null;
  attackerZone:   number | null;
  fusion1:        { handIndex: number } | null;
  spellHandIndex: number | null;
  spellCard:      CardData | null;
  trapFieldZone:  number | null;
  callback:       ((card: CardData) => void) | null;
  hint:           string;
}

const EMPTY: Selection = {
  mode: null, handIndex: null, attackerZone: null, fusion1: null,
  spellHandIndex: null, spellCard: null, trapFieldZone: null, callback: null, hint: '',
};

interface SelectionCtx {
  sel: Selection;
  setSel: (s: Partial<Selection>) => void;
  resetSel: () => void;
}

const SelectionContext = createContext<SelectionCtx>({
  sel: EMPTY, setSel: () => {}, resetSel: () => {},
});

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [sel, setSelState] = useState<Selection>(EMPTY);

  const setSel = useCallback((patch: Partial<Selection>) => {
    setSelState(prev => ({ ...prev, ...patch }));
  }, []);

  const resetSel = useCallback(() => setSelState(EMPTY), []);

  return (
    <SelectionContext.Provider value={{ sel, setSel, resetSel }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() { return useContext(SelectionContext); }
