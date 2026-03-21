import { useTranslation } from 'react-i18next';
import { useModal }  from '../contexts/ModalContext.js';
import { Card, TYPE_CSS, ATTR_CSS } from '../components/Card.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'grave-select' }>; }

export function GraveSelectModal({ modal }: Props) {
  const { cards, resolve } = modal;
  const { closeModal }    = useModal();
  const { t } = useTranslation();

  return (
    <div id="grave-select-modal" className="modal" role="dialog" aria-modal="true">
      <h3>{t('grave.title')}</h3>
      <div className="card-select-list" role="list">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`card hand-card ${TYPE_CSS[card.type] || 'monster'}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
            style={{ cursor: 'pointer' }}
            onClick={() => { closeModal(); resolve(card); }}
          >
            <Card card={card} />
          </div>
        ))}
      </div>
      <button className="btn-cancel" onClick={closeModal}>{t('grave.cancel')}</button>
    </div>
  );
}
