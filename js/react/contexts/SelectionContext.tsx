import { createContext, useContext, useState, useCallback } from 'react';
import type { CardData } from '../../types.js';
import type { FusionChainResult } from '../../cards.js';

export type SelMode =
  | 'hand' | 'attack' | 'fusion1' | 'play-chain' | 'spell-target' | 'field-spell-target'
  | 'grave-target' | 'trap-target' | 'equip-target' | null;

export interface Selection {
  mode:           SelMode;
  handIndex:      number | null;
  attackerZone:   number | null;
  fusion1:        { handIndex: number } | null;
  playChain:      number[];
  playChainPreview: FusionChainResult | null;
  spellHandIndex: number | null;
  spellFieldZone: number | null;
  spellCard:      CardData | null;
  trapFieldZone:  number | null;
  equipHandIndex: number | null;
  equipCard:      CardData | null;
  callback:       ((card: CardData) => void) | null;
  hint:           string;
}

const EMPTY: Selection = {
  mode: null, handIndex: null, attackerZone: null, fusion1: null,
  playChain: [], playChainPreview: null,
  spellHandIndex: null, spellFieldZone: null, spellCard: null, trapFieldZone: null,
  equipHandIndex: null, equipCard: null, callback: null, hint: '',
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
