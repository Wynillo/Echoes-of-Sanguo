import { useEffect, useCallback } from 'react';
import { useModal } from '../contexts/ModalContext.js';
import { useGamepadContext } from '../contexts/GamepadContext.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { CardDetailModal }  from './CardDetailModal.js';
import { TrapPromptModal }  from './TrapPromptModal.js';
import { GraveSelectModal } from './GraveSelectModal.js';
import { DeckSelectModal }  from './DeckSelectModal.js';
import { CardListModal }    from './CardListModal.js';
import { ResultModal }      from './ResultModal.js';
import { OptionsModal }     from './OptionsModal.js';
import { BattleLogModal }  from './BattleLogModal.js';
import { CoinTossModal }   from './CoinTossModal.js';
import { GauntletTransitionModal } from './GauntletTransitionModal.js';
import { HowToPlayModal } from './HowToPlayModal.js';
import { FusionConfirmModal } from './FusionConfirmModal.js';
import { ConfirmModal } from './ConfirmModal.js';
import { AlertModal } from './AlertModal.js';

const NON_DISMISSIBLE = new Set(['trap-prompt', 'grave-select', 'deck-select', 'coin-toss', 'gauntlet-transition', 'fusion-confirm', 'confirm', 'alert']);

const MODAL_LABELS: Record<string, string> = {
  'card-detail': 'Card Details',
  'trap-prompt': 'Trap Activation',
  'grave-select': 'Graveyard Selection',
  'deck-select': 'Deck Search',
  'card-list': 'Card List',
  'result': 'Duel Result',
  'main-options': 'Options',
  'battle-log': 'Battle Log',
  'coin-toss': 'Coin Toss',
  'gauntlet-transition': 'Gauntlet',
  'how-to-play': 'How to Play',
  'fusion-confirm': 'Fusion Preview',
  'confirm': 'Confirm',
  'alert': 'Notice',
};

export function ModalOverlay() {
  const { modal, closeModal } = useModal();
  const { connected, registerCallbacks } = useGamepadContext();
  const trapRef = useFocusTrap(!!modal);

  const isDismissible = modal ? !NON_DISMISSIBLE.has(modal.type) : false;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDismissible) {
      closeModal();
    }
  }, [isDismissible, closeModal]);

  useEffect(() => {
    if (!modal) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modal, handleKeyDown]);

  useEffect(() => {
    if (!connected || !modal || !isDismissible) return;
    registerCallbacks({
      onB: closeModal,
    });
    return () => registerCallbacks({});
  }, [connected, registerCallbacks, modal, isDismissible, closeModal]);

  if (!modal) return null;

  return (
    <div
      id="modal-overlay"
      ref={trapRef}
      role="dialog"
      aria-modal="true"
      aria-label={MODAL_LABELS[modal.type] ?? 'Dialog'}
      tabIndex={-1}
      onClick={e => {
        if (e.target === e.currentTarget && isDismissible) {
          closeModal();
        }
      }}
    >
      {modal.type === 'card-detail'  && <CardDetailModal  modal={modal} />}
      {modal.type === 'trap-prompt'  && <TrapPromptModal  modal={modal} />}
      {modal.type === 'grave-select' && <GraveSelectModal modal={modal} />}
      {modal.type === 'deck-select'  && <DeckSelectModal  modal={modal} />}
      {modal.type === 'card-list'    && <CardListModal />}
      {modal.type === 'result'       && <ResultModal      modal={modal} />}
      {modal.type === 'main-options' && <OptionsModal />}
      {modal.type === 'battle-log'  && <BattleLogModal />}
      {modal.type === 'coin-toss'   && <CoinTossModal   modal={modal} />}
      {modal.type === 'gauntlet-transition' && <GauntletTransitionModal modal={modal} />}
      {modal.type === 'how-to-play' && <HowToPlayModal />}
      {modal.type === 'fusion-confirm' && <FusionConfirmModal modal={modal} />}
      {modal.type === 'confirm'       && <ConfirmModal modal={modal} />}
      {modal.type === 'alert'         && <AlertModal   modal={modal} />}
    </div>
  );
}
