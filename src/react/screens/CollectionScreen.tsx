import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext';
import { useProgression } from '../contexts/ProgressionContext';
import { useModal }        from '../contexts/ModalContext';
import { CARD_DB } from '../../cards';
import { Progression }     from '../../progression';
import { Card, cardTypeCss, ATTR_CSS } from '../components/Card';
import { attachHover }     from '../components/hoverApi';
import { Race, Rarity } from '../../types';
import { getAllRarities, getRarityById, getRaceById } from '../../type-metadata';
import RaceFilterBar from '../components/RaceFilterBar';
import type { CardData } from '../../types';
import styles from './CollectionScreen.module.css';

const PAGE_SIZE = 100;

export default function CollectionScreen() {
  const { navigateTo }  = useScreen();
  const { collection }  = useProgression();
  const { openModal }   = useModal();
  const { t } = useTranslation();
  const [raceFilter,   setRaceFilter]   = useState<'all' | Race>('all');
  const [rarityFilter, setRarityFilter] = useState<'all' | Rarity>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const countMap: Record<string, number> = {};
  collection.forEach(e => { countMap[e.id] = e.count; });

  const seenCards = useMemo(() => Progression.getSeenCards(), [collection]);
  const isNew = (id: string) => !seenCards.has(id) && (countMap[id] || 0) > 0;

  const totalCards = Object.keys(CARD_DB).length;
  const ownedCount = Object.keys(countMap).length;

  let allCards = Object.values(CARD_DB) as CardData[];
  if (raceFilter   !== 'all') allCards = allCards.filter(c => c.race   === raceFilter);
  if (rarityFilter !== 'all') allCards = allCards.filter(c => c.rarity === rarityFilter);

  // Reset visible count when filters change
  const visibleCards = allCards.slice(0, visibleCount);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('collection.back')}</button>
        <h2 className={styles.title}>{t('collection.title')}</h2>
        <div className={styles.stats}>
          <span id="collection-count">{t('collection.cards_count', { owned: ownedCount, total: totalCards })}</span>
        </div>
      </div>

      <div className={styles.filters}>
        <RaceFilterBar value={raceFilter} onChange={r => { setRaceFilter(r); setVisibleCount(PAGE_SIZE); }} />
        <select
          className={styles.raritySelect}
          value={rarityFilter}
          onChange={e => { setRarityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as Rarity); setVisibleCount(PAGE_SIZE); }}
        >
          <option value="all">{t('collection.rarity_all')}</option>
          {getAllRarities().map(rm => (
            <option key={rm.id} value={rm.id}>{rm.value}</option>
          ))}
        </select>
      </div>

      <div className={styles.grid}>
        {visibleCards.map(card => {
          const owned = countMap[card.id] || 0;
          const rarColor = getRarityById(card.rarity ?? 0)?.color ?? '#aaa';
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
                  className={`card ${cardTypeCss(card)}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`}
                >
                  <Card card={card} small />
                </div>
                {owned > 1 && <div className={styles.cardCount}>×{owned}</div>}
                <div className={styles.rarityDot} style={{ background: rarColor }} />
                {isNew(card.id) && <div className={styles.newBadge}>NEW</div>}
              </div>
            );
          }
          return (
            <div key={card.id} className={`${styles.card} ${styles.unowned}`}>
              <div className={styles.unknownLabel}>???</div>
              <div className={styles.cardMeta} style={{ textAlign: 'center', opacity: 0.4 }}>
                {card.race ? (getRaceById(card.race)?.value ?? '') : ''}
              </div>
            </div>
          );
        })}
      </div>
      {visibleCount < allCards.length && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button className="btn-secondary" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
            {t('common.load_more', { count: Math.min(PAGE_SIZE, allCards.length - visibleCount) })}
          </button>
        </div>
      )}
    </div>
  );
}
