import { useModal }  from '../contexts/ModalContext.js';
import { Card }       from '../components/Card.js';
import { ATTR_NAME }  from '../../cards.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'card-detail' }>; }

export function CardDetailModal({ modal }: Props) {
  const { card, fc } = modal;
  const { closeModal } = useModal();

  const attrName = ATTR_NAME[card.attribute] || '';
  const typeLabel = { normal:'Normal', effect:'Effekt', fusion:'Fusion', spell:'Zauberkarte', trap:'Fallenkarte' }[card.type as string] || '';
  const levelStr = card.level ? ` · Stufe ${card.level}` : '';

  let statsText = '';
  if (card.atk !== undefined) {
    statsText = `ATK: ${fc ? fc.effectiveATK() : card.atk}  DEF: ${fc ? fc.effectiveDEF() : card.def}`;
    if (fc && (fc.permATKBonus || fc.tempATKBonus)) statsText += ' (+Bonus)';
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
      <button className="btn-cancel" onClick={closeModal}>✕ Schließen</button>
    </div>
  );
}
