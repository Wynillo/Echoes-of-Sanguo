import { useModal }  from '../contexts/ModalContext.js';
import { Card }       from '../components/Card.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'grave-select' }>; }

export function GraveSelectModal({ modal }: Props) {
  const { cards, resolve } = modal;
  const { closeModal }    = useModal();

  return (
    <div id="grave-select-modal" className="modal" role="dialog" aria-modal="true">
      <h3>Monster aus dem Friedhof wählen</h3>
      <div className="card-select-list" role="list">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`card hand-card ${card.type}-card attr-${card.attribute || 'spell'}`}
            style={{ cursor: 'pointer' }}
            onClick={() => { closeModal(); resolve(card); }}
          >
            <Card card={card} />
          </div>
        ))}
      </div>
      <button className="btn-cancel" onClick={closeModal}>✕ Abbrechen</button>
    </div>
  );
}
