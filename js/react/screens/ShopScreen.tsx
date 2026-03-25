import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { getAllRaces, getRaceByKey } from '../../type-metadata.js';
import { PACK_TYPES, openPack, openPackage, isPackageUnlocked } from '../utils/pack-logic.js';
import type { PackTypeInfo } from '../utils/pack-logic.js';
import { SHOP_DATA } from '../../shop-data.js';
import type { PackageDef } from '../../shop-data.js';
import { Audio }               from '../../audio.js';
import { Race } from '../../types.js';
import type { CardData } from '../../types.js';
import styles from './ShopScreen.module.css';

export default function ShopScreen() {
  const { navigateTo } = useScreen();
  const { coins, refresh } = useProgression();

  function buyPackage(packageId: string) {
    const pkg = SHOP_DATA.packages.find(p => p.id === packageId);
    if (!pkg || coins < pkg.price) return;
    if (!Progression.spendCoins(pkg.price)) return;
    Audio.playSfx('sfx_coin');
    const preOpen = Progression.getCollection();
    const cards   = openPackage(packageId);
    Progression.addCardsToCollection(cards.map((c: CardData) => c.id));
    refresh();
    navigateTo('pack-opening', { cards, preOpen });
  }

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

      {SHOP_DATA.packages.length > 0 && (
        <>
          <h3 className={styles.sectionTitle}>{t('shop.packages_title')}</h3>
          <div className={styles.grid}>
            {SHOP_DATA.packages.map(pkg => {
              const unlocked = isPackageUnlocked(pkg);
              const affordable = coins >= pkg.price;
              return (
                <PackageTile key={pkg.id} pkg={pkg} unlocked={unlocked} affordable={affordable} onBuy={buyPackage} />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface PackTileProps {
  pt: PackTypeInfo;
  affordable: boolean;
  onBuy: (packType: string, race: string | null) => void;
}

interface PackageTileProps {
  pkg: PackageDef;
  unlocked: boolean;
  affordable: boolean;
  onBuy: (packageId: string) => void;
}

function PackageTile({ pkg, unlocked, affordable, onBuy }: PackageTileProps) {
  const { t } = useTranslation();
  const canBuy = unlocked && affordable;

  return (
    <div
      className={`${styles.packTile}${canBuy ? '' : ` ${styles.packDisabled}`}`}
      style={{ '--pack-color': pkg.color } as React.CSSProperties}
    >
      <div className={styles.packIcon}>{pkg.icon}</div>
      <div className={styles.packName}>{pkg.name}</div>
      <div className={styles.packDesc}>{pkg.desc}</div>
      <div className={styles.packPrice}>◈ {pkg.price.toLocaleString()}</div>
      {!unlocked && (
        <div className={styles.packLocked}>{t('shop.locked')}</div>
      )}
      <button className={styles.buyBtn} disabled={!canBuy} onClick={() => onBuy(pkg.id)}>
        {t('shop.buy_btn')}
      </button>
    </div>
  );
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
