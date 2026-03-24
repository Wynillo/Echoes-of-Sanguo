import { useTranslation } from 'react-i18next';
import { useEffect }   from 'react';
import { useScreen }   from '../contexts/ScreenContext.js';
import { getRarityById } from '../../type-metadata.js';
import { TYPE_CSS, ATTR_CSS } from '../components/Card.js';
import { Audio }        from '../../audio.js';
import { CardType, isEffectMonster } from '../../types.js';
import type { CardData }          from '../../types.js';
import type { CollectionEntry }   from '../../types.js';
import styles from './PackOpeningScreen.module.css';

export default function PackOpeningScreen() {
  const { navigateTo, screenData } = useScreen();
  const { t } = useTranslation();

  useEffect(() => { Audio.playSfx('sfx_pack_open'); }, []);

  const { cards: _cards, preOpen: _preOpen } = (screenData as { cards: CardData[]; preOpen: CollectionEntry[] } | null) ?? { cards: [], preOpen: [] };

  const ownedBefore = new Set(_preOpen.filter(e => e.count > 0).map(e => e.id));

  function getTypeLabel(card: CardData) {
    if (card.type === CardType.Monster && card.effect) return t('pack_opening.type_effect');
    if (card.type === CardType.Monster) return t('pack_opening.type_normal');
    if (card.type === CardType.Fusion) return t('pack_opening.type_fusion');
    if (card.type === CardType.Spell)  return t('pack_opening.type_spell');
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
          const rarColor = getRarityById((card as any).rarity)?.color ?? '#aaa';
          return (
            <div
              key={i}
              className={styles.cardWrapper}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className={`${styles.cardInner} card ${TYPE_CSS[card.type] || 'monster'}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
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
                  <div className="card-type-line">{getTypeLabel(card)}</div>
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
