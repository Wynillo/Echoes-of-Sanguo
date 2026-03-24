import { useState }      from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB } from '../../cards.js';
import { Card, TYPE_CSS, ATTR_CSS } from '../components/Card.js';
import { attachHover }     from '../components/hoverApi.js';
import { Race, Rarity } from '../../types.js';
import { getAllRaces, getAllRarities, getRarityById } from '../../type-metadata.js';
import type { CardData } from '../../types.js';
import styles from './CollectionScreen.module.css';

export default function CollectionScreen() {
  const { navigateTo }  = useScreen();
  const { collection }  = useProgression();
  const { openModal }   = useModal();
  const { t } = useTranslation();
  const [raceFilter,   setRaceFilter]   = useState<'all' | Race>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');

  const countMap: Record<string, number> = {};
  collection.forEach(e => { countMap[e.id] = e.count; });

  const totalCards = Object.keys(CARD_DB).length;
  const ownedCount = Object.keys(countMap).length;

  let allCards = Object.values(CARD_DB) as CardData[];
  if (raceFilter   !== 'all') allCards = allCards.filter(c => (c as any).race   === raceFilter);
  if (rarityFilter !== 'all') allCards = allCards.filter(c => (c as any).rarity === rarityFilter);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('collection.title')}</h2>
        <div className={styles.stats}>
          <span id="collection-count">{t('collection.cards_count', { owned: ownedCount, total: totalCards })}</span>
        </div>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('title')}>{t('collection.back')}</button>
      </div>

      <div className={styles.filters}>
        <button
          key="all"
          className={`${styles.filterBtn}${raceFilter === 'all' ? ` ${styles.active}` : ''}`}
          onClick={() => setRaceFilter('all')}
        >
          🌐
        </button>
        {getAllRaces().map(rm => (
          <button
            key={rm.id}
            className={`${styles.filterBtn}${raceFilter === rm.id ? ` ${styles.active}` : ''}`}
            onClick={() => setRaceFilter(rm.id as Race)}
          >
            {rm.icon}
          </button>
        ))}
        <select
          className={styles.raritySelect}
          value={rarityFilter}
          onChange={e => setRarityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as Rarity)}
        >
          <option value="all">{t('collection.rarity_all')}</option>
          {getAllRarities().map(rm => (
            <option key={rm.id} value={rm.id}>{rm.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {allCards.map(card => {
          const owned = countMap[card.id] || 0;
          const rarColor = getRarityById((card as any).rarity)?.color ?? '#aaa';
          if (owned) {
            return (
              <div
                key={card.id}
                className={`${styles.card} ${styles.cardOwned}`}
                style={{ cursor: 'pointer' }}
                ref={el => { if (el) attachHover(el, card, null); }}
                onClick={() => openModal({ type: 'card-detail', card })}
              >
                <div
                  className={`card ${TYPE_CSS[card.type] || 'monster'}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
                >
                  <Card card={card} small />
                </div>
                {owned > 1 && <div className={styles.cardCount}>×{owned}</div>}
                <div className={styles.rarityDot} style={{ background: rarColor }} />
              </div>
            );
          }
          return (
            <div key={card.id} className={`${styles.card} ${styles.unowned}`}>
              <div className={styles.unknownLabel}>???</div>
              <div className={styles.cardMeta} style={{ textAlign: 'center', opacity: 0.4 }}>
                {t(`cards.race_${(card as any).race}`) || ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
