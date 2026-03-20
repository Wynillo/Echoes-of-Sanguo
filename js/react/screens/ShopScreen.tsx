import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { RACE_NAME, RACE_ICON } from '../../cards.js';
import { PACK_TYPES, openPack } from '../utils/pack-logic.js';
import { setPackOpeningCards }  from './PackOpeningScreen.js';
import type { CardData } from '../../types.js';

export default function ShopScreen() {
  const { setScreen }  = useScreen();
  const { coins, refresh } = useProgression();

  function buy(packType: string, race: string | null) {
    const pt = PACK_TYPES[packType];
    if (!pt || coins < pt.price) return;
    if (!Progression.spendCoins(pt.price)) return;
    const preOpen = Progression.getCollection();
    const cards   = openPack(packType, race);
    Progression.addCardsToCollection(cards.map((c: CardData) => c.id));
    refresh();
    setPackOpeningCards(cards, preOpen);
    setScreen('pack-opening');
  }

  return (
    <div id="shop-screen">
      <div className="shop-header">
        <h2 className="shop-title">◈ ÄTHER-SHOP</h2>
        <div className="shop-coins-bar">
          <span className="coins-icon">◈</span>
          <span id="shop-coin-display">{coins.toLocaleString('de-DE')}</span>
          <span className="coins-label">Äther-Münzen</span>
        </div>
        <button className="btn-secondary shop-back-btn" onClick={() => setScreen('title')}>← Hauptmenü</button>
      </div>

      <div id="shop-pack-grid">
        {Object.values(PACK_TYPES).map(pt => {
          const affordable = coins >= pt.price;
          return (
            <PackTile key={pt.id} pt={pt} affordable={affordable} onBuy={buy} />
          );
        })}
      </div>
    </div>
  );
}

interface PackTileProps {
  pt: typeof PACK_TYPES[string];
  affordable: boolean;
  onBuy: (packType: string, race: string | null) => void;
}

function PackTile({ pt, affordable, onBuy }: PackTileProps) {
  const starterRace = Progression.getStarterRace() || '';
  const raceEntries = Object.entries(RACE_NAME as Record<string, string>);

  function handleBuy() {
    let race: string | null = null;
    if (pt.id === 'race') {
      const sel = document.getElementById(`shop-race-select-${pt.id}`) as HTMLSelectElement | null;
      race = sel ? sel.value : starterRace || null;
    }
    onBuy(pt.id, race);
  }

  return (
    <div
      className={`shop-pack-tile${affordable ? '' : ' shop-pack-disabled'}`}
      style={{ '--pack-color': pt.color } as React.CSSProperties}
    >
      <div className="shop-pack-icon">{pt.icon}</div>
      <div className="shop-pack-name">{pt.name}</div>
      <div className="shop-pack-desc">{pt.desc}</div>
      <div className="shop-pack-price">◈ {pt.price.toLocaleString('de-DE')}</div>
      {pt.id === 'race' && (
        <div className="shop-race-select-wrap">
          <select id={`shop-race-select-${pt.id}`} className="shop-race-select" defaultValue={starterRace}>
            {raceEntries.map(([k, v]) => (
              <option key={k} value={k}>{(RACE_ICON as any)[k] || ''} {v}</option>
            ))}
          </select>
        </div>
      )}
      <button className="btn-buy-pack" disabled={!affordable} onClick={handleBuy}>Pack kaufen</button>
    </div>
  );
}
