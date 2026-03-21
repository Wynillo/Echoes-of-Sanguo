import { useState }      from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RARITY_COLOR } from '../../cards.js';
import { Card, TYPE_CSS, ATTR_CSS } from '../components/Card.js';
import { attachHover }     from '../components/hoverApi.js';
import { Race, Rarity } from '../../types.js';
import type { CardData } from '../../types.js';
import styles from './CollectionScreen.module.css';

const RACE_FILTER_BTNS: { filter: 'all' | Race; label: string }[] = [
  { filter: 'all',             label: '🌐' },
  { filter: Race.Fire,         label: '🔥' },
  { filter: Race.Dragon,       label: '🐲' },
  { filter: Race.Flyer,        label: '🦅' },
  { filter: Race.Stone,        label: '🪨' },
  { filter: Race.Plant,        label: '🌿' },
  { filter: Race.Warrior,      label: '⚔️' },
  { filter: Race.Spellcaster,  label: '🔮' },
  { filter: Race.Elf,          label: '✨' },
  { filter: Race.Demon,        label: '💀' },
  { filter: Race.Water,        label: '🌊' },
];

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
          onChange={e => setRarityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value) as Rarity)}
        >
          <option value="all">{t('collection.rarity_all')}</option>
          <option value={Rarity.Common}>Common</option>
          <option value={Rarity.Uncommon}>Uncommon</option>
          <option value={Rarity.Rare}>Rare</option>
          <option value={Rarity.SuperRare}>Super Rare</option>
          <option value={Rarity.UltraRare}>Ultra Rare</option>
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
