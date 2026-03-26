import { useEffect, useRef, useCallback } from 'react';
import { useModal } from '../contexts/ModalContext.js';
import { CardDetailModal }  from './CardDetailModal.js';
import { TrapPromptModal }  from './TrapPromptModal.js';
import { GraveSelectModal } from './GraveSelectModal.js';
import { CardListModal }    from './CardListModal.js';
import { ResultModal }      from './ResultModal.js';
import { OptionsModal }     from './OptionsModal.js';
import { BattleLogModal }  from './BattleLogModal.js';
import { CoinTossModal }   from './CoinTossModal.js';
import { GauntletTransitionModal } from './GauntletTransitionModal.js';

const NON_DISMISSIBLE = new Set(['trap-prompt', 'grave-select', 'coin-toss', 'gauntlet-transition']);

export function ModalOverlay() {
  const { modal, closeModal } = useModal();
  const overlayRef = useRef<HTMLDivElement>(null);

  const isDismissible = modal ? !NON_DISMISSIBLE.has(modal.type) : false;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDismissible) {
      closeModal();
    }
  }, [isDismissible, closeModal]);

  useEffect(() => {
    if (!modal) return;
    document.addEventListener('keydown', handleKeyDown);
    // Focus the overlay so screen readers announce it
    overlayRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modal, handleKeyDown]);

  if (!modal) return null;

  return (
    <div
      id="modal-overlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
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
      {modal.type === 'card-list'    && <CardListModal />}
      {modal.type === 'result'       && <ResultModal      modal={modal} />}
      {modal.type === 'main-options' && <OptionsModal />}
      {modal.type === 'battle-log'  && <BattleLogModal />}
      {modal.type === 'coin-toss'   && <CoinTossModal   modal={modal} />}
      {modal.type === 'gauntlet-transition' && <GauntletTransitionModal modal={modal} />}
    </div>
  );
}
