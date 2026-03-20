import { useModal }  from '../contexts/ModalContext.js';
import { Card }       from '../components/Card.js';
import { CARD_DB }    from '../../cards.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'trap-prompt' }>; }

export function TrapPromptModal({ modal }: Props) {
  const { opts, resolve } = modal;
  const { closeModal }   = useModal();
  const card             = (CARD_DB as any)[opts.cardId];

  function answer(val: boolean) { closeModal(); resolve(val); }

  return (
    <div id="trap-prompt-modal" className="modal" role="dialog" aria-modal="true">
      <h3 id="trap-prompt-title">{opts.title}</h3>
      <div id="trap-prompt-card" style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
        {card && <Card card={card} />}
      </div>
      <p id="trap-prompt-msg">{opts.message}</p>
      <div className="prompt-buttons">
        <button className="btn-primary"   onClick={() => answer(true)}>{opts.yes}</button>
        <button className="btn-secondary" onClick={() => answer(false)}>{opts.no}</button>
      </div>
    </div>
  );
}
