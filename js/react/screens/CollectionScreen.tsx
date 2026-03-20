import { useState }      from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RACE_NAME, RARITY_COLOR, RARITY_NAME } from '../../cards.js';
import { Card }            from '../components/Card.js';
import { attachHover }     from '../components/HoverPreview.js';
import type { CardData } from '../../types.js';

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
    <div id="collection-screen">
      <div className="collection-header">
        <h2 className="collection-title">📚 MEINE SAMMLUNG</h2>
        <div className="collection-stats">
          <span id="collection-count">{ownedCount} / {totalCards} Karten</span>
        </div>
        <button className="btn-secondary collection-back-btn" onClick={() => navigateTo('title')}>← Hauptmenü</button>
      </div>

      <div className="collection-filters">
        {RACE_FILTER_BTNS.map(({ filter, label }) => (
          <button
            key={filter}
            className={`coll-filter-btn${raceFilter === filter ? ' active' : ''}`}
            onClick={() => setRaceFilter(filter)}
          >
            {label}
          </button>
        ))}
        <select
          className="coll-rarity-select"
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

      <div id="collection-grid">
        {allCards.map(card => {
          const owned = countMap[card.id] || 0;
          const rarColor = (RARITY_COLOR as any)[(card as any).rarity] || '#aaa';
          if (owned) {
            return (
              <div
                key={card.id}
                className="coll-card coll-card-owned"
                style={{ cursor: 'pointer' }}
                ref={el => { if (el) attachHover(el, card, null); }}
                onClick={() => openModal({ type: 'card-detail', card })}
              >
                <div
                  className={`card ${(card as any).type}-card attr-${(card as any).attribute || 'spell'}`}
                >
                  <Card card={card} small />
                </div>
                {owned > 1 && <div className="coll-card-count">×{owned}</div>}
                <div className="coll-rarity-dot" style={{ background: rarColor }} />
              </div>
            );
          }
          return (
            <div key={card.id} className="coll-card coll-unowned">
              <div className="coll-unknown-label">???</div>
              <div className="coll-card-meta" style={{ textAlign: 'center', opacity: 0.4 }}>
                {(RACE_NAME as any)[(card as any).race] || ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
