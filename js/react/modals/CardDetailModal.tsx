import { useTranslation } from 'react-i18next';
import { useModal }  from '../contexts/ModalContext.js';
import { Card }       from '../components/Card.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'card-detail' }>; }

export function CardDetailModal({ modal }: Props) {
  const { card, fc } = modal;
  const { closeModal } = useModal();
  const { t } = useTranslation();

  const attrName = card.attribute ? t(`cards.attr_${card.attribute}`) : '';
  const typeLabel = {
    normal: t('card_detail.type_normal'),
    effect: t('card_detail.type_effect'),
    fusion: t('card_detail.type_fusion'),
    spell:  t('card_detail.type_spell'),
    trap:   t('card_detail.type_trap'),
  }[card.type as string] || '';
  const levelStr = card.level ? ` · ${t('card_detail.level_prefix')} ${card.level}` : '';

  let statsText = '';
  if (card.atk !== undefined) {
    statsText = `ATK: ${fc ? fc.effectiveATK() : card.atk}  DEF: ${fc ? fc.effectiveDEF() : card.def}`;
    if (fc && (fc.permATKBonus || fc.tempATKBonus)) statsText += t('card_detail.atk_bonus');
  }

  return (
    <div id="card-detail-modal" className="modal" role="dialog" aria-modal="true">
      <div className="detail-layout">
        <Card card={card} fc={fc} big />
        <div className="detail-info">
          <h2 id="detail-card-name">{card.name}</h2>
          <p className="detail-type">{[attrName, typeLabel].filter(Boolean).join(' · ')}{levelStr}</p>
          <p className="detail-desc">{card.description || ''}</p>
          <p className="detail-stats">{statsText}</p>
        </div>
      </div>
      <button className="btn-cancel" onClick={closeModal}>{t('card_detail.close')}</button>
    </div>
  );
}
