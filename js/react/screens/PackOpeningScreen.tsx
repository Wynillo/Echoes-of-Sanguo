import { useScreen }   from '../contexts/ScreenContext.js';
import { RARITY_COLOR } from '../../cards.js';
import type { CardData }          from '../../types.js';
import type { CollectionEntry }   from '../../types.js';

// Module-level store — set by ShopScreen before navigating here
let _cards: CardData[]           = [];
let _preOpen: CollectionEntry[]  = [];

export function setPackOpeningCards(cards: CardData[], preOpen: CollectionEntry[]) {
  _cards   = cards;
  _preOpen = preOpen;
}

export default function PackOpeningScreen() {
  const { setScreen } = useScreen();

  const ownedBefore = new Set(_preOpen.filter(e => e.count > 0).map(e => e.id));

  return (
    <div id="pack-opening-screen">
      <div className="pack-opening-header">
        <h2 className="pack-opening-title">✦ Pack geöffnet!</h2>
      </div>

      <div id="pack-card-grid">
        {_cards.map((card, i) => {
          const isNew    = !ownedBefore.has(card.id);
          const rarColor = (RARITY_COLOR as any)[(card as any).rarity] || '#aaa';
          return (
            <div
              key={i}
              className="pack-card-wrapper"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className={`pack-card-inner card ${card.type}-card attr-${(card as any).attribute || 'spell'}`}
                style={{ '--rarity-color': rarColor } as React.CSSProperties}
              >
                {isNew && <div className="pack-new-badge">NEU!</div>}
                <div className="pack-rarity-bar" style={{ background: rarColor }}></div>
                <div className="card-header">
                  <span className="card-name">{card.name}</span>
                  <span className="card-level">
                    {card.level ? '★'.repeat(Math.min(card.level, 5)) : ''}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-type-line">
                    {card.type === 'normal' ? 'Normal'
                      : card.type === 'effect' ? 'Effekt'
                      : card.type === 'fusion' ? 'Fusion'
                      : card.type === 'spell'  ? 'Zauber'
                      : 'Falle'}
                  </div>
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

      <div className="pack-opening-buttons">
        <button className="btn-secondary" onClick={() => setScreen('shop')}>← Zurück zum Shop</button>
        <button className="btn-primary"   onClick={() => setScreen('title')}>🏠 Hauptmenü</button>
      </div>
    </div>
  );
}
