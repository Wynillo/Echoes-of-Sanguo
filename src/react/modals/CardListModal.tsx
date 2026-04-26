import { useTranslation } from 'react-i18next';
import { useModal }        from '../contexts/ModalContext.js';
import { DeckCard }            from '../components/card/views/DeckCard.js';
import { CARD_DB, FUSION_RECIPES } from '../../cards.js';
import { CardType } from '../../types.js';
import type { CardData } from '../../types.js';
import { cardTypeCss, ATTR_CSS } from '../components/Card.js';

export function CardListModal() {
  const { openModal, closeModal } = useModal();
  const { t } = useTranslation();

  const allCards: CardData[] = Object.values(CARD_DB);
  const groups: Record<string, CardData[]> = {
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
      <button className="btn-secondary" id="cardlist-close-btn" onClick={closeModal}>{t('card_list.close')}</button>
      <div id="cardlist-content">
        {Object.entries(groups).map(([groupName, cards]) => cards.length === 0 ? null : (
          <div key={groupName}>
            <h3 className="cardlist-group-title">{groupName}</h3>
            <div className="cardlist-row">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`card hand-card ${cardTypeCss(card)}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openModal({ type: 'card-detail', card })}
                >
                  <DeckCard card={card} size="sm" />
                </div>
              ))}
            </div>
            {groupName === fusionGroupName && (
              <div className="fusion-recipes">
                {FUSION_RECIPES.map((r, i) => {
                  const c1 = CARD_DB[r.materials[0]];
                  const c2 = CARD_DB[r.materials[1]];
                  const cr = CARD_DB[r.result];
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
      <button className="btn-secondary" id="cardlist-close-btn-bottom" onClick={closeModal}>{t('card_list.close')}</button>
    </div>
  );
}
