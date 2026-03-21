import { useTranslation } from 'react-i18next';
import { useEffect }   from 'react';
import { useScreen }   from '../contexts/ScreenContext.js';
import { RARITY_COLOR } from '../../cards.js';
import { Audio }        from '../../audio.js';
import type { CardData }          from '../../types.js';
import type { CollectionEntry }   from '../../types.js';
import styles from './PackOpeningScreen.module.css';

// Module-level store — set by ShopScreen before navigating here
let _cards: CardData[]           = [];
let _preOpen: CollectionEntry[]  = [];

export function setPackOpeningCards(cards: CardData[], preOpen: CollectionEntry[]) {
  _cards   = cards;
  _preOpen = preOpen;
}

export default function PackOpeningScreen() {
  const { navigateTo } = useScreen();
  const { t } = useTranslation();

  useEffect(() => { Audio.playSfx('sfx_pack_open'); }, []);

  const ownedBefore = new Set(_preOpen.filter(e => e.count > 0).map(e => e.id));

  function getTypeLabel(type: string) {
    if (type === 'normal') return t('pack_opening.type_normal');
    if (type === 'effect') return t('pack_opening.type_effect');
    if (type === 'fusion') return t('pack_opening.type_fusion');
    if (type === 'spell')  return t('pack_opening.type_spell');
    return t('pack_opening.type_trap');
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('pack_opening.title')}</h2>
      </div>

      <div className={styles.grid}>
        {_cards.map((card, i) => {
          const isNew    = !ownedBefore.has(card.id);
          const rarColor = (RARITY_COLOR as any)[(card as any).rarity] || '#aaa';
          return (
            <div
              key={i}
              className={styles.cardWrapper}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className={`${styles.cardInner} card ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                style={{ '--rarity-color': rarColor } as React.CSSProperties}
              >
                {isNew && <div className={styles.newBadge}>{t('pack_opening.new_badge')}</div>}
                <div className={styles.rarityBar} style={{ background: rarColor }}></div>
                <div className="card-header">
                  <span className="card-name">{card.name}</span>
                  <span className="card-level">
                    {card.level ? '★'.repeat(Math.min(card.level, 5)) : ''}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-type-line">{getTypeLabel(card.type)}</div>
                  <div className="card-desc">{card.description || ''}</div>
                </div>
                {card.atk !== undefined && (
                  <div className="card-footer">
                    <span>ATK {card.atk}</span>
                    <span>DEF {card.def}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.buttons}>
        <button className="btn-secondary" onClick={() => navigateTo('shop')}>{t('pack_opening.back_shop')}</button>
        <button className="btn-primary"   onClick={() => navigateTo('title')}>{t('pack_opening.home')}</button>
      </div>
    </div>
  );
}
