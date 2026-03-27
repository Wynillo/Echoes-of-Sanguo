import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { Progression }    from '../../progression.js';
import { getAllRaces, getRaceByKey } from '../../type-metadata.js';
import { PACK_TYPES, openPack } from '../utils/pack-logic.js';
import { Audio }               from '../../audio.js';
import { Race } from '../../types.js';
import type { CardData } from '../../types.js';
import { SHOP_DATA } from '../../shop-data.js';
import styles from './ShopScreen.module.css';

export default function ShopScreen() {
  const { navigateTo } = useScreen();
  const { coins, refresh } = useProgression();
  const { progress } = useCampaign();
  const bgUrl = SHOP_DATA.backgrounds[progress.currentChapter] ?? SHOP_DATA.backgrounds['ch1'] ?? '';

  function buy(packType: string, race: string | null) {
    const pt = PACK_TYPES[packType];
    if (!pt || coins < pt.price) return;
    if (!Progression.spendCoins(pt.price)) return;
    Audio.playSfx('sfx_coin');
    const preOpen = Progression.getCollection();
    const cards   = openPack(packType, race !== null ? Number(race) as Race : null);
    Progression.addCardsToCollection(cards.map((c: CardData) => c.id));
    refresh();
    navigateTo('pack-opening', { cards, preOpen });
  }

  const { t } = useTranslation();

  return (
    <div className={styles.screen}>
      <div className={styles.shopBg} style={{ backgroundImage: `url(${bgUrl})` }} />
      <div className={styles.header}>
        <h2 className={styles.shopTitle}>{t('shop.title')}</h2>
        <div className={styles.coinsBar}>
          <span className="coins-icon">◈</span>
          <span id="shop-coin-display">{coins.toLocaleString()}</span>
          <span className="coins-label">{t('common.coins')}</span>
        </div>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('title')}>{t('shop.back')}</button>
      </div>

      <div className={styles.grid}>
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
  pt: PackTypeInfo;
  affordable: boolean;
  onBuy: (packType: string, race: string | null) => void;
}

function PackTile({ pt, affordable, onBuy }: PackTileProps) {
  const { t } = useTranslation();
  const starterRace = Progression.getStarterRace() || '';
  const raceKeys = getAllRaces().map(r => r.key);

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
      className={`${styles.packTile}${affordable ? '' : ` ${styles.packDisabled}`}`}
      style={{ '--pack-color': pt.color } as React.CSSProperties}
    >
      <div className={styles.packIcon}>{pt.icon}</div>
      <div className={styles.packName}>{t(`pack.${pt.id}_name`)}</div>
      <div className={styles.packDesc}>{t(`pack.${pt.id}_desc`)}</div>
      <div className={styles.packPrice}>◈ {pt.price.toLocaleString()}</div>
      {pt.id === 'race' && (
        <div className={styles.raceSelectWrap}>
          <select id={`shop-race-select-${pt.id}`} className={styles.raceSelect} defaultValue={starterRace}>
            {raceKeys.map(k => (
              <option key={k} value={k}>{getRaceByKey(k)?.icon ?? ''} {t(`cards.race_${k}`)}</option>
            ))}
          </select>
        </div>
      )}
      <button className={styles.buyBtn} disabled={!affordable} onClick={handleBuy}>{t('shop.buy_btn')}</button>
    </div>
  );
}
