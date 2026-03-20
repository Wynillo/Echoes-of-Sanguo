import { useState }      from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RACE_NAME, RARITY_COLOR, RARITY_NAME } from '../../cards.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/HoverPreview.js';
import type { CardData } from '../../types.js';
import styles from './CollectionScreen.module.css';

const RACE_FILTER_BTNS = [
  { filter: 'all',     label: 'Alle' },
  { filter: 'feuer',   label: '🔥' },
  { filter: 'drache',  label: '🐲' },
  { filter: 'flug',    label: '🦅' },
  { filter: 'stein',   label: '🪨' },
  { filter: 'pflanze', label: '🌿' },
  { filter: 'krieger', label: '⚔️' },
  { filter: 'magier',  label: '🔮' },
  { filter: 'elfe',    label: '✨' },
  { filter: 'daemon',  label: '💀' },
  { filter: 'wasser',  label: '🌊' },
];

export default function CollectionScreen() {
  const { navigateTo }  = useScreen();
  const { collection }  = useProgression();
  const { openModal }   = useModal();
  const [raceFilter,   setRaceFilter]   = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');

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
        <h2 className={styles.title}>📚 MEINE SAMMLUNG</h2>
        <div className={styles.stats}>
          <span id="collection-count">{ownedCount} / {totalCards} Karten</span>
        </div>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('title')}>← Hauptmenü</button>
      </div>

      <div className={styles.filters}>
        {RACE_FILTER_BTNS.map(({ filter, label }) => (
          <button
            key={filter}
            className={`${styles.filterBtn}${raceFilter === filter ? ` ${styles.active}` : ''}`}
            onClick={() => setRaceFilter(filter)}
          >
            {label}
          </button>
        ))}
        <select
          className={styles.raritySelect}
          value={rarityFilter}
          onChange={e => setRarityFilter(e.target.value)}
        >
          <option value="all">Alle Seltenheiten</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="super_rare">Super Rare</option>
          <option value="ultra_rare">Ultra Rare</option>
        </select>
      </div>

      <div className={styles.grid}>
        {allCards.map(card => {
          const owned = countMap[card.id] || 0;
          const rarColor = (RARITY_COLOR as any)[(card as any).rarity] || '#aaa';
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
                  className={`card ${(card as any).type}-card attr-${(card as any).attribute || 'spell'}`}
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
                {(RACE_NAME as any)[(card as any).race] || ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
