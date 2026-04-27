import { useTranslation } from 'react-i18next';
import { useModal }  from '../contexts/ModalContext.js';
import { DeckCard } from '../components/card/views/DeckCard.js';
import { cardTypeCss, ATTR_CSS } from '../components/Card.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'deck-select' }>; }

export function DeckSelectModal({ modal }: Props) {
  const { cards, resolve } = modal;
  const { closeModal }    = useModal();
  const { t } = useTranslation();

  return (
    <div id="deck-select-modal" className="modal" role="dialog" aria-modal="true">
      <h3>{t('deckSearch.title')}</h3>
      <div className="card-select-list" role="list">
        {cards.map((card, i) => (
          <button
            key={i}
            type="button"
            className={`card hand-card ${cardTypeCss(card)}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
            onClick={() => { closeModal(); resolve(card); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeModal(); resolve(card); } }}
          >
            <DeckCard card={card} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}
