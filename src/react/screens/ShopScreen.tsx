import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { Progression }    from '../../progression.js';
import { getRarityById } from '../../type-metadata.js';
import { openPack, isPackUnlocked, buildCardPool } from '../utils/pack-logic.js';
import { SHOP_DATA, type PackPrice } from '../../shop-data.js';
import type { PackDef, PackSlotDef, CurrencyDef } from '../../shop-data.js';
import { ECONOMY, CURRENCY_UNLOCK_CHAPTERS } from '../../economy-config.js';
import { Audio }               from '../../audio.js';
import { Rarity } from '../../types.js';
import type { CardData } from '../../types.js';
import type { EffectSource } from '../../effect-items.js';
import { CraftingScreen } from '../CraftingScreen.js';
import styles from './ShopScreen.module.css';

function totalCards(slots: PackSlotDef[]): number {
  return slots.reduce((sum, s) => sum + s.count, 0);
}

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
      const r = slot.rarity ?? Rarity.RARE;
      const entry = map.get(r) ?? { guaranteed: 0, chancePct: 0 };
      entry.guaranteed += slot.count;
      map.set(r, entry);
    }
  }
  return Array.from(map.entries())
    .map(([rarity, data]) => ({ rarity, ...data }))
    .sort((a, b) => a.rarity - b.rarity);
}

function countByRarity(cards: CardData[]): { rarity: number; count: number }[] {
  const map = new Map<number, number>();
  for (const c of cards) {
    const r = c.rarity ?? Rarity.RARE;
    map.set(r, (map.get(r) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([rarity, count]) => ({ rarity, count }))
    .sort((a, b) => a.rarity - b.rarity);
}

function normalisePackPrice(price: number | PackPrice): PackPrice {
  if (typeof price === 'number') return { currencyId: ECONOMY.CURRENCY_COINS, amount: price };
  return price;
}

function isCurrencyVisible(currency: { id: string; requiredChapter?: number }, currentChapter: string): boolean {
  const chapterNum = ECONOMY.HELPERS.chapterNumber(currentChapter);
  const required = currency.requiredChapter ?? CURRENCY_UNLOCK_CHAPTERS[currency.id] ?? 1;
  return chapterNum >= required;
}

export default function ShopScreen() {
  const { navigateTo } = useScreen();
  const { currencies, refresh } = useProgression();
  const { progress } = useCampaign();
  const bgUrl = SHOP_DATA.backgrounds[progress.currentChapter] ?? SHOP_DATA.backgrounds[ECONOMY.DEFAULT_CHAPTER] ?? '';
  const { t } = useTranslation();
  const [infoTarget, setInfoTarget] = useState<{ pack: PackDef } | null>(null);
  const [activeTab, setActiveTab] = useState<'packs' | 'crafting'>('packs');

  function buyPack(packId: string) {
    const pkg = SHOP_DATA.packs.find(p => p.id === packId);
    if (!pkg) return;
    const { currencyId, amount } = normalisePackPrice(pkg.price);
    const slot = Progression.getActiveSlot();
    if (!slot) return;
    import('../../currencies.js').then(({ spendCurrency }) => {
      if (!spendCurrency(slot, currencyId, amount)) return;
      Audio.playSfx('sfx_coin');
      const preOpen = Progression.getCollection();
      const results = openPack(packId);
      const cards = results.filter((c): c is CardData => 'type' in c);
      const items = results.filter((c): c is EffectSource => !('type' in c));
      Progression.addCardsToCollection(cards.map(c => c.id));
      items.forEach(item => Progression.addEffectItem(item.id));
      Progression.updateSlotMeta();
      refresh();
      navigateTo('pack-opening', { cards, preOpen });
    });
  }

  function showInfo(pack: PackDef) {
    setInfoTarget({ pack });
  }

  return (
    <div className={styles.screen}>
      <div className={styles.shopBg} style={{ backgroundImage: `url(${bgUrl})` }} />
      <div className={styles.header}>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('shop.back')}</button>
        <h2 className={styles.shopTitle}>{t('shop.title')}</h2>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'packs' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('packs')}
        >
          {t('shop.tab_packs', { defaultValue: 'Packs' })}
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'crafting' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('crafting')}
        >
          {t('shop.tab_crafting', { defaultValue: 'Crafting' })}
        </button>
      </div>

      {activeTab === 'crafting' ? (
        <div className={styles.sectionsContainer}>
          <CraftingScreen />
        </div>
      ) : (
        <div className={styles.sectionsContainer}>
        {SHOP_DATA.currencies
          .filter(c => isCurrencyVisible(c, progress.currentChapter))
          .map(currency => {
            const balance = currencies[currency.id] ?? 0;
            const packs = SHOP_DATA.packs.filter(pkg => {
              const { currencyId } = normalisePackPrice(pkg.price);
              return currencyId === currency.id && isPackUnlocked(pkg);
            });
            if (packs.length === 0) return null;
            return (
              <div key={currency.id} className={styles.currencySection}>
                <div className={styles.sectionHeader}>
                  <span>{currency.icon}</span>
                  <span>{t(currency.nameKey, { defaultValue: currency.id })}</span>
                  <span className={styles.sectionBalance}>{balance.toLocaleString()}</span>
                </div>
                <div className={styles.packGrid}>
                  {packs.map(pkg => {
                    const { amount } = normalisePackPrice(pkg.price);
                    const affordable = balance >= amount;
                    return (
                      <PackTile
                        key={pkg.id}
                        pkg={pkg}
                        affordable={affordable}
                        onBuy={buyPack}
                        onInfo={() => showInfo(pkg)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {infoTarget && (
        <PackInfoModal
          pack={infoTarget.pack}
          onClose={() => setInfoTarget(null)}
        />
      )}
    </div>
  );
}

interface PackTileProps {
  pkg: PackDef;
  affordable: boolean;
  onBuy: (packId: string) => void;
  onInfo: () => void;
}

function PackTile({ pkg, affordable, onBuy, onInfo }: PackTileProps) {
  const { t } = useTranslation();
  const { currencyId, amount } = normalisePackPrice(pkg.price);
  const currencyDef = SHOP_DATA.currencies.find(c => c.id === currencyId);
  const currencyName = currencyDef ? t(currencyDef.nameKey, { defaultValue: currencyId }) : currencyId;

  return (
    <div className={styles.packTile} style={{ '--pack-color': pkg.color } as React.CSSProperties}>
      <button className={styles.infoBtn} onClick={(e) => { e.stopPropagation(); onInfo(); }} aria-label="Pack info">?</button>
      <div className={styles.packTop}>
        <div className={styles.packIcon}>{pkg.icon}</div>
        <div className={styles.packName}>{pkg.name}</div>
        <div className={styles.packCardCount}>{t('shop.cards_count', { count: totalCards(pkg.slots) })}</div>
      </div>
      <div className={styles.packBottom}>
        <div className={styles.packPrice} title={affordable ? '' : `Not enough ${currencyName}`}>
          <span>{currencyDef?.icon ?? '◈'}</span>
          <span>{amount.toLocaleString()}</span>
        </div>
        <button
          className={styles.buyBtn}
          disabled={!affordable}
          onClick={() => onBuy(pkg.id)}
          title={!affordable ? `Not enough ${currencyName}` : ''}
        >
          {t('shop.buy_btn')}
        </button>
      </div>
    </div>
  );
}

interface PackInfoModalProps {
  pack: PackDef;
  onClose: () => void;
}

function PackInfoModal({ pack, onClose }: PackInfoModalProps) {
  const { t } = useTranslation();
  const distribution = useMemo(() => computeDistribution(pack.slots), [pack]);
  const pool = useMemo(() => buildCardPool(pack.cardPool), [pack]);
  const poolByRarity = useMemo(() => countByRarity(pool), [pool]);
  const total = totalCards(pack.slots);

  return (
    <div className={styles.infoOverlay} onClick={onClose}>
      <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.infoModalHeader}>
          <span className={styles.infoModalIcon}>{pack.icon}</span>
          <div>
            <div className={styles.infoModalTitle}>{pack.name}</div>
            <div className={styles.infoModalDesc}>{pack.desc}</div>
          </div>
        </div>
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
