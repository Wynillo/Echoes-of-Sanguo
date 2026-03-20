import { useModal }        from '../contexts/ModalContext.js';
import { Card }            from '../components/Card.js';
import { CARD_DB, FUSION_RECIPES } from '../../cards.js';

export function CardListModal() {
  const { openModal, closeModal } = useModal();

  const groups: Record<string, any[]> = {
    'Normale Monster':  Object.values(CARD_DB).filter((c: any) => c.type === 'normal'),
    'Effekt-Monster':   Object.values(CARD_DB).filter((c: any) => c.type === 'effect'),
    'Fusion-Monster':   Object.values(CARD_DB).filter((c: any) => c.type === 'fusion'),
    'Zauberkarten':     Object.values(CARD_DB).filter((c: any) => c.type === 'spell'),
    'Fallenkarten':     Object.values(CARD_DB).filter((c: any) => c.type === 'trap'),
  };

  return (
    <div id="cardlist-modal" className="modal" role="dialog" aria-modal="true">
      <h2>Alle Karten — Aetherial Clash</h2>
      <div id="cardlist-content">
        {Object.entries(groups).map(([groupName, cards]) => cards.length === 0 ? null : (
          <div key={groupName}>
            <h3 className="cardlist-group-title">{groupName}</h3>
            <div className="cardlist-row">
              {cards.map((card: any) => (
                <div
                  key={card.id}
                  className={`card hand-card ${card.type}-card attr-${card.attribute || 'spell'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openModal({ type: 'card-detail', card })}
                >
                  <Card card={card} />
                </div>
              ))}
            </div>
            {groupName === 'Fusion-Monster' && (
              <div className="fusion-recipes">
                {(FUSION_RECIPES as any[]).map((r: any, i: number) => {
                  const c1 = (CARD_DB as any)[r.materials[0]];
                  const c2 = (CARD_DB as any)[r.materials[1]];
                  const cr = (CARD_DB as any)[r.result];
                  return (
                    <div key={i} className="recipe-line">
                      {c1.name} + {c2.name} → {cr.name}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="btn-cancel" onClick={closeModal}>✕ Schließen</button>
    </div>
  );
}
