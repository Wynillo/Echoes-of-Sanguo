import { useState }      from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { CARD_DB, RACE_NAME, RARITY_COLOR, RARITY_NAME } from '../../cards.js';
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
          const owned    = countMap[card.id] || 0;
          const rarColor = (RARITY_COLOR as any)[(card as any).rarity] || '#aaa';
          return (
            <div
              key={card.id}
              className={`coll-card${owned ? '' : ' coll-unowned'}`}
              style={{ cursor: owned ? 'pointer' : 'default' }}
              onClick={() => owned && openModal({ type: 'card-detail', card })}
            >
              <div className="coll-rarity-bar" style={{ background: rarColor }}></div>
              {owned > 1 && <div className="coll-card-count">×{owned}</div>}
              {owned ? (
                <>
                  <div className="coll-card-name">{card.name}</div>
                  <div className="coll-card-meta">{(RACE_NAME as any)[(card as any).race] || ''} · {(RARITY_NAME as any)[(card as any).rarity] || ''}</div>
                  {card.atk !== undefined && (
                    <div className="coll-card-meta">ATK {card.atk} / DEF {card.def}</div>
                  )}
                </>
              ) : (
                <>
                  <div className="coll-unknown-label">???</div>
                  <div className="coll-card-meta" style={{ textAlign: 'center', opacity: 0.4 }}>{(RACE_NAME as any)[(card as any).race] || ''}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
