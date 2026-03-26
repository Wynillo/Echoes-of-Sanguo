import { createContext, useContext, useState } from 'react';
import type { CardData, GameState, PromptOptions } from '../../types.js';

export type ModalState =
  | null
  | { type: 'card-detail'; card: CardData; fc?: any | null; index?: number; state?: GameState; source?: 'hand' | 'field' | 'field-spell' | 'deckbuilder-collection' | 'deckbuilder-deck'; onDeckAction?: (action: 'add' | 'remove') => void }
  | { type: 'trap-prompt'; opts: PromptOptions; resolve: (v: boolean) => void }
  | { type: 'grave-select'; cards: CardData[]; resolve: (card: CardData) => void }
  | { type: 'card-list' }
  | { type: 'result'; resultType: 'victory' | 'defeat'; coinsEarned: number }
  | { type: 'main-options' }
  | { type: 'battle-log' }
  | { type: 'coin-toss'; playerGoesFirst: boolean; resolve: () => void }
  | { type: 'gauntlet-transition'; duelIndex: number; totalDuels: number; nextOpponentName: string; resolve: () => void };

interface ModalCtx {
  modal: ModalState;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalCtx>({ modal: null, openModal: () => {}, closeModal: () => {} });

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  return (
    <ModalContext.Provider value={{ modal, openModal: setModal, closeModal: () => setModal(null) }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() { return useContext(ModalContext); }
