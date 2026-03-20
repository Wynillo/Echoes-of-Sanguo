import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { RACE_ICON }      from '../../cards.js';
import { PACK_TYPES, openPack } from '../utils/pack-logic.js';
import { setPackOpeningCards }  from './PackOpeningScreen.js';
import type { CardData } from '../../types.js';

export default function ShopScreen() {
  const { navigateTo } = useScreen();
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
    navigateTo('pack-opening');
  }

  const { t } = useTranslation();

  return (
    <div id="shop-screen">
      <div className="shop-header">
        <h2 className="shop-title">{t('shop.title')}</h2>
        <div className="shop-coins-bar">
          <span className="coins-icon">◈</span>
          <span id="shop-coin-display">{coins.toLocaleString()}</span>
          <span className="coins-label">{t('common.coins')}</span>
        </div>
        <button className="btn-secondary shop-back-btn" onClick={() => navigateTo('title')}>{t('shop.back')}</button>
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
  const { t } = useTranslation();
  const starterRace = Progression.getStarterRace() || '';
  const raceKeys = Object.keys(RACE_ICON as Record<string, string>);

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
      <div className="shop-pack-name">{t(`pack.${pt.id}_name`)}</div>
      <div className="shop-pack-desc">{t(`pack.${pt.id}_desc`)}</div>
      <div className="shop-pack-price">◈ {pt.price.toLocaleString()}</div>
      {pt.id === 'race' && (
        <div className="shop-race-select-wrap">
          <select id={`shop-race-select-${pt.id}`} className="shop-race-select" defaultValue={starterRace}>
            {raceKeys.map(k => (
              <option key={k} value={k}>{(RACE_ICON as any)[k] || ''} {t(`cards.race_${k}`)}</option>
            ))}
          </select>
        </div>
      )}
      <button className="btn-buy-pack" disabled={!affordable} onClick={handleBuy}>{t('shop.buy_btn')}</button>
    </div>
  );
}
