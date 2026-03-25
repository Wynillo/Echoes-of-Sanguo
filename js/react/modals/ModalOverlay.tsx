import { useModal } from '../contexts/ModalContext.js';
import { CardDetailModal }  from './CardDetailModal.js';
import { TrapPromptModal }  from './TrapPromptModal.js';
import { GraveSelectModal } from './GraveSelectModal.js';
import { CardListModal }    from './CardListModal.js';
import { ResultModal }      from './ResultModal.js';
import { OptionsModal }     from './OptionsModal.js';
import { BattleLogModal }  from './BattleLogModal.js';
import { CoinTossModal }   from './CoinTossModal.js';

export function ModalOverlay() {
  const { modal, closeModal } = useModal();
  if (!modal) return null;

  return (
    <div id="modal-overlay" onClick={e => {
      // Close on overlay click for non-critical modals
      if (e.target === e.currentTarget &&
          modal.type !== 'trap-prompt' &&
          modal.type !== 'grave-select' &&
          modal.type !== 'coin-toss') {
        closeModal();
      }
    }}>
      {modal.type === 'card-detail'  && <CardDetailModal  modal={modal} />}
      {modal.type === 'trap-prompt'  && <TrapPromptModal  modal={modal} />}
      {modal.type === 'grave-select' && <GraveSelectModal modal={modal} />}
      {modal.type === 'card-list'    && <CardListModal />}
      {modal.type === 'result'       && <ResultModal      modal={modal} />}
      {modal.type === 'main-options' && <OptionsModal />}
      {modal.type === 'battle-log'  && <BattleLogModal />}
      {modal.type === 'coin-toss'   && <CoinTossModal   modal={modal} />}
    </div>
  );
}
