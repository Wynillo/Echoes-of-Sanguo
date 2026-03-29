import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { Progression }    from '../../progression.js';
import { getRarityById } from '../../type-metadata.js';
import { openPackage, isPackageUnlocked, buildCardPool } from '../utils/pack-logic.js';
import { SHOP_DATA } from '../../shop-data.js';
import type { PackageDef, PackSlotDef } from '../../shop-data.js';
import { Audio }               from '../../audio.js';
import { Rarity } from '../../types.js';
import type { CardData } from '../../types.js';
import styles from './ShopScreen.module.css';

/** Compute total card count from slots. */
function totalCards(slots: PackSlotDef[]): number {
  return slots.reduce((sum, s) => sum + s.count, 0);
}

/**
 * Compute rarity distribution summary from pack slots.
 * `guaranteed` = number of fixed slots for that rarity.
 * `chancePct` = probability (0-100) of getting that rarity from a bonus slot.
 */
function computeDistribution(slots: PackSlotDef[]): { rarity: number; guaranteed: number; chancePct: number }[] {
  const map = new Map<number, { guaranteed: number; chancePct: number }>();

  for (const slot of slots) {
    if (slot.distribution) {
      for (const [rarityStr, prob] of Object.entries(slot.distribution)) {
        const r = Number(rarityStr);
        const entry = map.get(r) ?? { guaranteed: 0, chancePct: 0 };
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

function useItemsPerPage() {
  const [ipp, setIpp] = useState(() => window.matchMedia('(min-width: 700px)').matches ? 4 : 3);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 700px)');
    const handler = (e: MediaQueryListEvent) => setIpp(e.matches ? 4 : 3);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return ipp;
}

export default function ShopScreen() {
  const { navigateTo } = useScreen();
  const { coins, refresh } = useProgression();
  const { progress } = useCampaign();
  const bgUrl = SHOP_DATA.backgrounds[progress.currentChapter] ?? SHOP_DATA.backgrounds['ch1'] ?? '';
  const { t } = useTranslation();

  const [page, setPage] = useState(0);
  const itemsPerPage = useItemsPerPage();
  const [infoTarget, setInfoTarget] = useState<{ pack: PackageDef } | null>(null);

  // Touch swipe tracking
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const unlockedPackages = SHOP_DATA.packages.filter(pkg => isPackageUnlocked(pkg));
  const items = unlockedPackages;
  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Reset page when items per page changes
  useEffect(() => { setPage(0); }, [itemsPerPage]);

  const goPage = useCallback((p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
  }, [totalPages]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) goPage(page + 1);
      else goPage(page - 1);
    }
  }, [goPage, page]);

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

  function showInfo(pack: PackageDef) {
    setInfoTarget({ pack });
  }

  // Slice items for current page
  const startIdx = page * itemsPerPage;
  const visibleItems = items.slice(startIdx, startIdx + itemsPerPage);

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

      {/* Carousel */}
      <div className={styles.carousel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Arrow left */}
        {totalPages > 1 && (
          <button
            className={`${styles.arrowBtn} ${styles.arrowLeft}`}
            disabled={page === 0}
            onClick={() => goPage(page - 1)}
            aria-label="Previous"
          >‹</button>
        )}

        <div
          className={styles.carouselTrack}
          style={{ '--items-per-page': itemsPerPage } as React.CSSProperties}
        >
          {(visibleItems as PackageDef[]).map(pkg => {
            const affordable = coins >= pkg.price;
            return (
              <PackageTile
                key={pkg.id}
                pkg={pkg}
                affordable={affordable}
                onBuy={buyPackage}
                onInfo={() => showInfo(pkg)}
              />
            );
          })}
        </div>

        {/* Arrow right */}
        {totalPages > 1 && (
          <button
            className={`${styles.arrowBtn} ${styles.arrowRight}`}
            disabled={page >= totalPages - 1}
            onClick={() => goPage(page + 1)}
            aria-label="Next"
          >›</button>
        )}
      </div>

      {/* Dots */}
      {totalPages > 1 && (
        <div className={styles.dots}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`${styles.dot}${i === page ? ` ${styles.dotActive}` : ''}`}
              onClick={() => goPage(i)}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Info Modal */}
      {infoTarget && (
        <PackInfoModal
          pack={infoTarget.pack}
          onClose={() => setInfoTarget(null)}
        />
      )}
    </div>
  );
}

// ── Package Tile ───────────────────────────────────────────

interface PackageTileProps {
  pkg: PackageDef;
  affordable: boolean;
  onBuy: (packageId: string) => void;
  onInfo: () => void;
}

function PackageTile({ pkg, affordable, onBuy, onInfo }: PackageTileProps) {
  const { t } = useTranslation();

  return (
    <div
      className={styles.packTile}
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
        <button className={styles.buyBtn} disabled={!affordable} onClick={() => onBuy(pkg.id)}>
          {t('shop.buy_btn')}
        </button>
      </div>
    </div>
  );
}

// ── Pack Info Modal ────────────────────────────────────────

interface PackInfoModalProps {
  pack: PackageDef;
  onClose: () => void;
}

function PackInfoModal({ pack, onClose }: PackInfoModalProps) {
  const { t } = useTranslation();

  const distribution = useMemo(() => computeDistribution(pack.slots), [pack]);

  const pool = useMemo(() => {
    return buildCardPool(pack.cardPool);
  }, [pack]);

  const poolByRarity = useMemo(() => countByRarity(pool), [pool]);

  const total = totalCards(pack.slots);

  return (
    <div className={styles.infoOverlay} onClick={onClose}>
      <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.infoModalHeader}>
          <span className={styles.infoModalIcon}>{pack.icon}</span>
          <div>
            <div className={styles.infoModalTitle}>{pack.name}</div>
            <div className={styles.infoModalDesc}>{pack.desc}</div>
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
        </div>

        <button className={styles.infoCloseBtn} onClick={onClose}>{t('shop.info_close')}</button>
      </div>
    </div>
  );
}
