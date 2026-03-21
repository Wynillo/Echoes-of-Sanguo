import { useTranslation } from 'react-i18next';
import { useModal }        from '../contexts/ModalContext.js';
import { Card }            from '../components/Card.js';
import { CARD_DB, FUSION_RECIPES } from '../../cards.js';
import { CardType, isEffectMonster } from '../../types.js';
import { TYPE_CSS, ATTR_CSS } from '../components/Card.js';

export function CardListModal() {
  const { openModal, closeModal } = useModal();
  const { t } = useTranslation();

  const allCards = Object.values(CARD_DB) as any[];
  const groups: Record<string, any[]> = {
    [t('card_list.group_normal')]:  allCards.filter(c => c.type === CardType.Monster && !c.effect),
    [t('card_list.group_effect')]:  allCards.filter(c => c.type === CardType.Monster && c.effect),
    [t('card_list.group_fusion')]:  allCards.filter(c => c.type === CardType.Fusion),
    [t('card_list.group_spell')]:   allCards.filter(c => c.type === CardType.Spell),
    [t('card_list.group_trap')]:    allCards.filter(c => c.type === CardType.Trap),
  };

  const fusionGroupName = t('card_list.group_fusion');

  return (
    <div id="cardlist-modal" className="modal" role="dialog" aria-modal="true">
      <h2>{t('card_list.title')}</h2>
      <div id="cardlist-content">
        {Object.entries(groups).map(([groupName, cards]) => cards.length === 0 ? null : (
          <div key={groupName}>
            <h3 className="cardlist-group-title">{groupName}</h3>
            <div className="cardlist-row">
              {cards.map((card: any) => (
                <div
                  key={card.id}
                  className={`card hand-card ${TYPE_CSS[card.type] || 'monster'}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openModal({ type: 'card-detail', card })}
                >
                  <Card card={card} />
                </div>
              ))}
            </div>
            {groupName === fusionGroupName && (
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
      <button className="btn-cancel" onClick={closeModal}>{t('card_list.close')}</button>
    </div>
  );
}
