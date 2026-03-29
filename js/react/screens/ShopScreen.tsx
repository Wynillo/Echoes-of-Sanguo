import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { Progression }    from '../../progression.js';
import { getAllRaces, getRaceByKey, getRarityById } from '../../type-metadata.js';
import { PACK_TYPES, openPack, openPackage, isPackageUnlocked, buildCardPool } from '../utils/pack-logic.js';
import type { PackTypeInfo } from '../utils/pack-logic.js';
import { SHOP_DATA } from '../../shop-data.js';
import type { PackDef, PackageDef, PackSlotDef } from '../../shop-data.js';
import { Audio }               from '../../audio.js';
import { Rarity, Race } from '../../types.js';
import type { CardData } from '../../types.js';
import styles from './ShopScreen.module.css';

type Tab = 'standard' | 'packages';

/** Compute total card count from slots. */
function totalCards(slots: PackSlotDef[]): number {
  return slots.reduce((sum, s) => sum + s.count, 0);
}

/**
 * Compute rarity distribution summary from pack slots.
 * `guaranteed` = number of fixed slots for that rarity.
 * `chancePct` = combined probability (0-100) of getting that rarity
 *               from all distribution-based bonus slots.
 */
function computeDistribution(slots: PackSlotDef[]): { rarity: number; guaranteed: number; chancePct: number }[] {
  const map = new Map<number, { guaranteed: number; chancePct: number }>();

  for (const slot of slots) {
    if (slot.distribution) {
      // Each distribution slot picks one rarity per card.
      // Show per-card probability (all distribution slots share the same distribution).
      for (const [rarityStr, prob] of Object.entries(slot.distribution)) {
        const r = Number(rarityStr);
        const entry = map.get(r) ?? { guaranteed: 0, chancePct: 0 };
        // prob is per-card; show it as percentage
        entry.chancePct = Math.round(prob * 100);
        map.set(r, entry);
      }
    } else {
      const r = slot.rarity ?? Rarity.Common;
      const entry = map.get(r) ?? { guaranteed: 0, chancePct: 0 };
      entry.guaranteed += slot.count;
      map.set(r, entry);
    }
  }

  return Array.from(map.entries())
    .map(([rarity, data]) => ({ rarity, ...data }))
    .sort((a, b) => a.rarity - b.rarity);
}

/** Group cards by rarity and count. */
function countByRarity(cards: CardData[]): { rarity: number; count: number }[] {
  const map = new Map<number, number>();
  for (const c of cards) {
    const r = c.rarity ?? Rarity.Common;
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([rarity, count]) => ({ rarity, count }))
    .sort((a, b) => a.rarity - b.rarity);
}

export default function ShopScreen() {
  const { navigateTo } = useScreen();
  const { coins, refresh } = useProgression();
  const { progress } = useCampaign();
  const bgUrl = SHOP_DATA.backgrounds[progress.currentChapter] ?? SHOP_DATA.backgrounds['ch1'] ?? '';
  const { t } = useTranslation();

  const hasPackages = SHOP_DATA.packages.length > 0;
  const [activeTab, setActiveTab] = useState<Tab>('standard');
  const [infoTarget, setInfoTarget] = useState<{ pack: PackDef; type: 'pack' } | { pack: PackageDef; type: 'package' } | null>(null);

  const packs = Object.values(PACK_TYPES);
  const packages = SHOP_DATA.packages;

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

  function showInfo(pack: PackDef | PackageDef, type: 'pack' | 'package') {
    setInfoTarget({ pack: pack as any, type });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.shopBg} style={{ backgroundImage: `url(${bgUrl})` }} />

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.shopTitle}>{t('shop.title')}</h2>
        <div className={styles.coinsBar}>
          <span className="coins-icon">◈</span>
          <span className={styles.coinsValue}>{coins.toLocaleString()}</span>
          <span className="coins-label">{t('common.coins')}</span>
        </div>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('shop.back')}</button>
      </div>

      {/* Tabs */}
      {hasPackages && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn}${activeTab === 'standard' ? ` ${styles.activeTab}` : ''}`}
            onClick={() => setActiveTab('standard')}
          >{t('shop.tab_standard')}</button>
          <button
            className={`${styles.tabBtn}${activeTab === 'packages' ? ` ${styles.activeTab}` : ''}`}
            onClick={() => setActiveTab('packages')}
          >{t('shop.tab_packages')}</button>
        </div>
      )}

      {/* Pack Grid */}
      <div className={styles.packGrid}>
        {activeTab === 'standard'
          ? packs.map(pt => {
              const packDef = SHOP_DATA.packs.find(p => p.id === pt.id)!;
              const affordable = coins >= pt.price;
              return (
                <PackTile
                  key={pt.id}
                  pt={pt}
                  packDef={packDef}
                  affordable={affordable}
                  onBuy={buy}
                  onInfo={() => showInfo(packDef, 'pack')}
                />
              );
            })
          : packages.map(pkg => {
              const unlocked = isPackageUnlocked(pkg);
              const affordable = coins >= pkg.price;
              return (
                <PackageTile
                  key={pkg.id}
                  pkg={pkg}
                  unlocked={unlocked}
                  affordable={affordable}
                  onBuy={buyPackage}
                  onInfo={() => showInfo(pkg, 'package')}
                />
              );
            })
        }
      </div>

      {/* Info Modal */}
      {infoTarget && (
        <PackInfoModal
          pack={infoTarget.pack}
          type={infoTarget.type}
          onClose={() => setInfoTarget(null)}
        />
      )}
    </div>
  );
}

// ── Pack Tile ──────────────────────────────────────────────

interface PackTileProps {
  pt: PackTypeInfo;
  packDef: PackDef;
  affordable: boolean;
  onBuy: (packType: string, race: string | null) => void;
  onInfo: () => void;
}

function PackTile({ pt, packDef, affordable, onBuy, onInfo }: PackTileProps) {
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
      <button className={styles.infoBtn} onClick={(e) => { e.stopPropagation(); onInfo(); }} aria-label="Pack info">?</button>

      <div className={styles.packTop}>
        <div className={styles.packIcon}>{pt.icon}</div>
        <div className={styles.packName}>{t(`pack.${pt.id}_name`)}</div>
        <div className={styles.packCardCount}>{t('shop.cards_count', { count: totalCards(packDef.slots) })}</div>
      </div>

      <div className={styles.packBottom}>
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
    </div>
  );
}

// ── Package Tile ───────────────────────────────────────────

interface PackageTileProps {
  pkg: PackageDef;
  unlocked: boolean;
  affordable: boolean;
  onBuy: (packageId: string) => void;
  onInfo: () => void;
}

function PackageTile({ pkg, unlocked, affordable, onBuy, onInfo }: PackageTileProps) {
  const { t } = useTranslation();
  const canBuy = unlocked && affordable;

  return (
    <div
      className={`${styles.packTile}${canBuy ? '' : ` ${styles.packDisabled}`}`}
      style={{ '--pack-color': pkg.color } as React.CSSProperties}
    >
      <button className={styles.infoBtn} onClick={(e) => { e.stopPropagation(); onInfo(); }} aria-label="Pack info">?</button>

      <div className={styles.packTop}>
        <div className={styles.packIcon}>{pkg.icon}</div>
        <div className={styles.packName}>{pkg.name}</div>
        <div className={styles.packCardCount}>{t('shop.cards_count', { count: totalCards(pkg.slots) })}</div>
      </div>

      <div className={styles.packBottom}>
        <div className={styles.packPrice}>◈ {pkg.price.toLocaleString()}</div>
        {!unlocked && (
          <div className={styles.packLocked}>{t('shop.locked')}</div>
        )}
        <button className={styles.buyBtn} disabled={!canBuy} onClick={() => onBuy(pkg.id)}>
          {t('shop.buy_btn')}
        </button>
      </div>
    </div>
  );
}

// ── Pack Info Modal ────────────────────────────────────────

interface PackInfoModalProps {
  pack: PackDef | PackageDef;
  type: 'pack' | 'package';
  onClose: () => void;
}

function PackInfoModal({ pack, type, onClose }: PackInfoModalProps) {
  const { t } = useTranslation();

  const distribution = useMemo(() => computeDistribution(pack.slots), [pack]);

  const pool = useMemo(() => {
    const cardPool = 'cardPool' in pack ? pack.cardPool : undefined;
    return buildCardPool(cardPool);
  }, [pack]);

  const poolByRarity = useMemo(() => countByRarity(pool), [pool]);

  const isRacePack = type === 'pack' && (pack as PackDef).filter === 'byRace';
  const total = totalCards(pack.slots);
  const displayName = type === 'pack' ? t(`pack.${pack.id}_name`) : pack.name;
  const displayDesc = type === 'pack' ? t(`pack.${pack.id}_desc`) : pack.desc;

  return (
    <div className={styles.infoOverlay} onClick={onClose}>
      <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.infoModalHeader}>
          <span className={styles.infoModalIcon}>{pack.icon}</span>
          <div>
            <div className={styles.infoModalTitle}>{displayName}</div>
            <div className={styles.infoModalDesc}>{displayDesc}</div>
          </div>
        </div>

        {/* Distribution */}
        <div className={styles.infoSection}>
          <div className={styles.infoSectionTitle}>{t('shop.info_per_pack', { count: total })}</div>
          {distribution.map(({ rarity, guaranteed, chancePct }) => {
            const meta = getRarityById(rarity);
            const name = meta?.value ?? `Rarity ${rarity}`;
            const color = meta?.color ?? '#aaa';
            const parts: string[] = [];
            if (guaranteed > 0) parts.push(t('shop.info_guaranteed', { count: guaranteed }));
            if (chancePct > 0) parts.push(t('shop.info_chance', { percent: chancePct }));
            return (
              <div key={rarity} className={styles.rarityRow}>
                <span className={styles.rarityLabel}>
                  <span className={styles.rarityDot} style={{ background: color }} />
                  {name}
                </span>
                <span className={styles.rarityInfo}>{parts.join(' + ')}</span>
              </div>
            );
          })}
        </div>

        {/* Card Pool */}
        <div className={styles.infoSection}>
          <div className={styles.infoSectionTitle}>{t('shop.info_cards_in_pool', { count: pool.length })}</div>
          <div className={styles.poolSection}>
            {poolByRarity.map(({ rarity, count }) => {
              const meta = getRarityById(rarity);
              const name = meta?.value ?? `Rarity ${rarity}`;
              const color = meta?.color ?? '#aaa';
              return (
                <div key={rarity} className={styles.poolRow}>
                  <span className={styles.poolLabel}>
                    <span className={styles.rarityDot} style={{ background: color }} />
                    {name}
                  </span>
                  <span className={styles.poolCount}>{count}</span>
                </div>
              );
            })}
          </div>
          {isRacePack && <div className={styles.raceNote}>{t('shop.info_race_note')}</div>}
        </div>

        <button className={styles.infoCloseBtn} onClick={onClose}>{t('shop.info_close')}</button>
      </div>
    </div>
  );
}
