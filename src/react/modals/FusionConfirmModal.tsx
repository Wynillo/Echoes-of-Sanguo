import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';
import { Card } from '../components/Card.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'fusion-confirm' }>; }

export function FusionConfirmModal({ modal }: Props) {
  const { closeModal } = useModal();
  const { t } = useTranslation();
  const { handCard, fieldCard, resultCard, onConfirm } = modal;

  return (
    <div id="fusion-confirm-modal" className="modal" role="dialog" aria-modal="true">
      <h2>{t('fusion_confirm.title', 'Fusion Preview')}</h2>
      <div className="fusion-confirm-cards">
        <div className="fusion-confirm-material">
          <Card card={handCard} small />
          <span className="fusion-confirm-name">{handCard.name}</span>
        </div>
        <span className="fusion-confirm-plus">+</span>
        <div className="fusion-confirm-material">
          <Card card={fieldCard} small />
          <span className="fusion-confirm-name">{fieldCard.name}</span>
        </div>
        <span className="fusion-confirm-arrow">=</span>
        <div className="fusion-confirm-result">
          <Card card={resultCard} small />
          <span className="fusion-confirm-name">{resultCard.name}</span>
          {resultCard.atk !== undefined && (
            <span className="fusion-confirm-stats">ATK: {resultCard.atk} DEF: {resultCard.def}</span>
          )}
        </div>
      </div>
      <div id="action-buttons">
        <button className="menu-action-btn" onClick={() => { onConfirm(); closeModal(); }}>
          {t('fusion_confirm.confirm', 'Confirm Fusion')}
        </button>
        <button className="btn-cancel" onClick={closeModal}>
          {t('fusion_confirm.cancel', 'Cancel')}
        </button>
      </div>
    </div>
  );
}
