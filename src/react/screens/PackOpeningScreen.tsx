import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useScreen }   from '../contexts/ScreenContext.js';
import { useModal }    from '../contexts/ModalContext.js';
import { getRarityById } from '../../type-metadata.js';
import { Card } from '../components/Card.js';
import { Audio }        from '../../audio.js';
import { CardType, Rarity } from '../../types.js';
import type { CardData }          from '../../types.js';
import type { CollectionEntry }   from '../../types.js';
import RaceIcon from '../components/RaceIcon.js';
import styles from './PackOpeningScreen.module.css';
import { fxManager } from '../pixi/fxManager.js';

type Phase = 'pack' | 'reveal' | 'summary';

const TAPS_TO_OPEN = 3;

const HOLD_BY_RARITY: Record<number, number> = {
  [Rarity.Common]:    0.5,
  [Rarity.Uncommon]:  0.5,
  [Rarity.Rare]:      0.8,
  [Rarity.SuperRare]: 1.2,
  [Rarity.UltraRare]: 1.6,
};

const SCANLINE_COLORS: Record<number, string> = {
  [Rarity.Rare]:      'rgba(112, 144, 255, 0.08)',
  [Rarity.SuperRare]: 'rgba(255, 215, 0, 0.06)',
  [Rarity.UltraRare]: 'rgba(224, 112, 255, 0.08)',
};

/** Card type icons for mini strip */
const TYPE_ICONS: Record<number, string> = {
  [CardType.Monster]: 'GiCrossedSwords',
  [CardType.Fusion]: 'GiStarShuriken',
  [CardType.Spell]: 'GiSparkles',
  [CardType.Trap]: 'GiLightningTrio',
  [CardType.Equipment]: 'GiShield',
};

const RARITY_LABELS: Record<number, string> = {
  [Rarity.Common]:    'C',
  [Rarity.Uncommon]:  'U',
  [Rarity.Rare]:      'R',
  [Rarity.SuperRare]: 'SR',
  [Rarity.UltraRare]: 'UR',
};

function getRarityBorderClass(rarity: number, s: Record<string, string>): string {
  switch (rarity) {
    case Rarity.Common:    return s.borderCommon;
    case Rarity.Uncommon:  return s.borderUncommon;
    case Rarity.Rare:      return s.borderRare;
    case Rarity.SuperRare: return s.borderSuperRare;
    case Rarity.UltraRare: return s.borderUltraRare;
    default: return '';
  }
}

function getNewBadgeClass(rarity: number, s: Record<string, string>): string {
  switch (rarity) {
    case Rarity.Common:    return s.newBadgeCommon;
    case Rarity.Uncommon:  return s.newBadgeUncommon;
    case Rarity.Rare:      return s.newBadgeRare;
    case Rarity.SuperRare: return s.newBadgeSuperRare;
    case Rarity.UltraRare: return s.newBadgeUltraRare;
    default: return s.newBadgeCommon;
  }
}

/* ── Helpers ───────────────────────────────────────────────── */

/** Screen shake utility */
function shakeScreen(screenEl: HTMLElement, intensity: number, duration: number) {
  const tl = gsap.timeline();
  const steps = Math.floor(duration / 0.03);
  for (let i = 0; i < steps; i++) {
    const x = (Math.random() - 0.5) * 2 * intensity;
    const y = (Math.random() - 0.5) * 2 * intensity;
    tl.to(screenEl, { x, y, duration: 0.03, ease: 'none' });
  }
  tl.to(screenEl, { x: 0, y: 0, duration: 0.05, ease: 'steps(2)' });
  return tl;
}

export default function PackOpeningScreen() {
  const { navigateTo, screenData } = useScreen();
  const { openModal } = useModal();
  const { t } = useTranslation();

  const { cards: _cards, preOpen: _preOpen } = (screenData as { cards: CardData[]; preOpen: CollectionEntry[] } | null) ?? { cards: [], preOpen: [] };
  const ownedBefore = useMemo(() => new Set(_preOpen.filter(e => e.count > 0).map(e => e.id)), [_preOpen]);

  // Sort cards by rarity ascending (Common first → UltraRare last)
  const sortedCards = useMemo(() =>
    [..._cards].sort((a, b) => (a.rarity ?? 1) - (b.rarity ?? 1)),
    [_cards],
  );

  const rarityBreakdown = useMemo(() => {
    const counts = new Map<number, number>();
    for (const card of sortedCards) {
      const r = card.rarity ?? Rarity.Common;
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => b - a)
      .map(([r, n]) => `${n} ${RARITY_LABELS[r] ?? '?'}`)
      .join(' · ');
  }, [sortedCards]);

  const [phase, setPhase] = useState<Phase>('pack');
  const [tapCount, setTapCount] = useState(0);
  const [tearing, setTearing] = useState(false);
  const [revealIndex, setRevealIndex] = useState(-1);
  const skipRef = useRef(false);
  const fastForwardRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const revealCardRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const scanlineTintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skipRef.current = true;
      setPhase('summary');
    }
  }, []);

  const handleSkip = useCallback(() => {
    if (phase === 'summary') return;
    if (phase === 'pack' && !tearing) return;
    fxManager.clearAll();
    if (phase === 'pack') {
      skipRef.current = true;
      tlRef.current?.kill();
      setPhase('summary');
      return;
    }
    fastForwardRef.current = true;
    tlRef.current?.timeScale(8);
  }, [phase, tearing]);

  const handlePackTap = useCallback(() => {
    if (tearing || skipRef.current) return;
    const pack = packRef.current;
    if (!pack) return;

    const newCount = tapCount + 1;
    setTapCount(newCount);
    Audio.playSfx('sfx_button');

    // Escalating wobble
    const wobbleIntensity = newCount * 3; // 3°, 6°, 9°+
    const wobbleScale = 1 + newCount * 0.02;
    const tl = gsap.timeline();
    tl.to(pack, { rotation: -wobbleIntensity, scale: wobbleScale, duration: 0.08, ease: 'steps(2)' })
      .to(pack, { rotation: wobbleIntensity, scale: wobbleScale, duration: 0.08, ease: 'steps(2)' })
      .to(pack, { rotation: -wobbleIntensity * 0.5, duration: 0.06, ease: 'steps(2)' })
      .to(pack, { rotation: 0, scale: 1, duration: 0.06, ease: 'steps(2)' });

    if (newCount >= TAPS_TO_OPEN) {
      // Trigger tear on last tap
      tl.eventCallback('onComplete', () => {
        setTearing(true);
      });
    }
  }, [tapCount, tearing]);

  useEffect(() => {
    if (phase !== 'pack' || !tearing) return;
    if (skipRef.current) { setPhase('summary'); return; }

    const pack = packRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!pack || !left || !right) return;

    Audio.playSfx('sfx_pack_open');

    const tl = gsap.timeline({
      onComplete: () => {
        if (!skipRef.current) setPhase('reveal');
      },
    });
    tlRef.current = tl;

    // Aggressive wobble before tear
    tl.to(pack, { rotation: -15, scale: 1.12, duration: 0.05, ease: 'steps(2)' })
      .to(pack, { rotation: 15, scale: 1.15, duration: 0.05, ease: 'steps(2)' })
      .to(pack, { rotation: -20, scale: 1.18, duration: 0.05, ease: 'steps(2)' })
      .to(pack, { rotation: 0, scale: 1, duration: 0.04, ease: 'steps(2)' });

    // Hide original, show halves
    tl.call(() => {
      gsap.set(pack, { visibility: 'hidden' });
      gsap.set([left, right], { visibility: 'visible' });
    })
      .addLabel('tear');

    // Flash at tear moment
    tl.to(flashRef.current, { opacity: 1, duration: 0.05, ease: 'none' }, 'tear')
      .to(flashRef.current, { opacity: 0, duration: 0.15, ease: 'power2.out' });

    // Screen shake at tear moment
    tl.call(() => {
      if (screenRef.current) shakeScreen(screenRef.current, 8, 0.2);
    }, undefined, 'tear');

    // Tear apart halves simultaneously with flash
    tl.to(left, {
      x: '-30vw', rotation: -45, opacity: 0,
      duration: 0.4, ease: 'steps(6)',
    }, 'tear')
      .to(right, {
        x: '30vw', rotation: 45, opacity: 0,
        duration: 0.4, ease: 'steps(6)',
      }, 'tear');

    return () => { tl.kill(); };
  }, [phase, tearing]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    if (skipRef.current) { setPhase('summary'); return; }
    if (sortedCards.length === 0) { setPhase('summary'); return; }

    let cancelled = false;
    let currentTl: gsap.core.Timeline | null = null;

    async function revealSequence() {
      for (let i = 0; i < sortedCards.length; i++) {
        if (cancelled || skipRef.current) break;

        const card = sortedCards[i];
        const rarity = card.rarity ?? Rarity.Common;

        // Update index to render the card
        setRevealIndex(i);

        // Wait a tick for React to render
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled || skipRef.current) break;

        const cardEl = revealCardRef.current;
        const screenEl = screenRef.current;
        if (!cardEl) continue;

        const holdTime = HOLD_BY_RARITY[rarity] ?? 0.5;

        const tl = gsap.timeline();
        currentTl = tl;
        tlRef.current = tl;

        if (fastForwardRef.current) {
          tl.timeScale(8);
        }

        // Find the inner element for flip
        const innerEl = cardEl.querySelector(`.${styles.revealCardInner}`) as HTMLElement | null;

        // Reset card state: face-down, off-screen
        gsap.set(cardEl, { y: '-120vh', opacity: 0, scale: 0.85 });
        if (innerEl) gsap.set(innerEl, { rotateY: 0 });

        // Card entrance: slide from top (face-down)
        tl.to(cardEl, {
          y: 0, opacity: 1, scale: 1,
          duration: 0.3, ease: 'steps(6)',
        }, 0);

        // Brief pause before flip
        tl.to({}, { duration: 0.15 });

        // Card flip: face-down → face-up
        if (innerEl) {
          tl.to(innerEl, {
            rotateY: 180, duration: 0.4, ease: 'steps(6)',
          });
        }

        // Play reveal SFX at flip moment
        tl.call(() => {
          Audio.playSfx('sfx_pack_reveal');
        }, undefined, '-=0.2');

        tl.call(() => {
          if (rarity >= Rarity.Rare && cardEl) {
            fxManager.packReveal(rarity, cardEl);
            const tintEl = scanlineTintRef.current;
            if (tintEl) {
              tintEl.style.setProperty(
                '--scanline-color',
                SCANLINE_COLORS[rarity] ?? 'rgba(255,255,255,0.04)',
              );
            }
          }
        });

        if (rarity >= Rarity.Rare) {
          const tintEl = scanlineTintRef.current;
          if (tintEl) {
            tl.fromTo(
              tintEl,
              { opacity: 0 },
              { opacity: 1, duration: 0.05, ease: 'none' },
            ).to(tintEl, { opacity: 0, duration: 0.3, ease: 'power2.in' });
          }
        }

        // Screen shake for SR/UR at flip moment
        if (rarity >= Rarity.SuperRare && screenEl) {
          const shakeIntensity = rarity === Rarity.UltraRare ? 8 : 5;
          tl.call(() => {
            shakeScreen(screenEl, shakeIntensity, 0.25);
          }, undefined, '-=0.1');
        }

        // Hold to admire
        tl.to({}, { duration: holdTime });

        // Exit: card flies off-screen downward
        tl.to(cardEl, {
          scale: 0.3, opacity: 0, y: '120vh',
          duration: 0.2, ease: 'steps(4)',
        });

        // Wait for timeline to complete
        await new Promise<void>(resolve => {
          tl.eventCallback('onComplete', resolve);
        });

        if (cancelled || skipRef.current) break;
      }

      if (!cancelled && !skipRef.current) {
        // Brief pause before summary
        await new Promise(r => setTimeout(r, 300));
        setPhase('summary');
      }
    }

    revealSequence();

    return () => {
      cancelled = true;
      currentTl?.kill();
    };
  }, [phase, sortedCards]);

  // Phase 1: Pack
  if (phase === 'pack') {
    return (
      <div ref={screenRef} className={styles.screen} onClick={tearing ? handleSkip : undefined}>
        <div ref={flashRef} className={styles.flash} />
        <div className={styles.packPhase}>
          <div ref={packRef} className={styles.packWrapper} onClick={handlePackTap}>
            <div className={styles.packFoil} />
            <div className={styles.packLabel}>
              <div className={styles.packIcon}><RaceIcon icon="GiCardPlay" /></div>
              <div className={styles.packName}>{t('pack_opening.title')}</div>
            </div>
          </div>

          {/* Tear halves (hidden until tear moment) */}
          <div ref={leftRef} className={styles.packHalfLeft} style={{ visibility: 'hidden', position: 'absolute' }}>
            <div className={styles.packHalfInner}>
              <div className={styles.packFoil} />
            </div>
          </div>
          <div ref={rightRef} className={styles.packHalfRight} style={{ visibility: 'hidden', position: 'absolute' }}>
            <div className={styles.packHalfInner}>
              <div className={styles.packFoil} />
            </div>
          </div>

          {/* Tap prompt + dots */}
          {!tearing && (
            <>
              <div className={styles.tapPrompt}>{t('pack_opening.tap_hint')}</div>
              <div className={styles.tapDots}>
                {Array.from({ length: TAPS_TO_OPEN }).map((_, i) => (
                  <div key={i} className={`${styles.tapDot} ${i < tapCount ? styles.filled : ''}`} />
                ))}
              </div>
            </>
          )}

          {tearing && (
            <div className={styles.skipHint}>{t('pack_opening.skip_hint')}</div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'reveal') {
    const currentCard = revealIndex >= 0 ? sortedCards[revealIndex] : null;
    const rarColor = currentCard ? (getRarityById((currentCard as any).rarity)?.color ?? '#aaa') : '#aaa';

    return (
      <div ref={screenRef} className={styles.screen} onClick={handleSkip}>
        {/* Scanline tint — opacity driven by GSAP at rare reveal moment */}
        <div ref={scanlineTintRef} className={styles.scanlineTint} />

        <div className={styles.revealPhase}>
          <div className={styles.revealStage}>
            {currentCard && (
              <div
                ref={revealCardRef}
                className={styles.revealCard}
                style={{ '--rarity-color': rarColor } as React.CSSProperties}
              >
                <div className={styles.revealCardInner}>
                  <div className={styles.revealCardBack}>
                    <div className={styles.cardBackPattern}>
                      <span className={styles.backLabel}>A</span>
                    </div>
                  </div>
                  <div className={styles.revealCardFront}>
                    <Card card={currentCard} big />
                    {!ownedBefore.has(currentCard.id) && (
                      <div className={styles.newBadge}>{t('pack_opening.new_badge')}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.revealCounter}>
            {revealIndex + 1} / {sortedCards.length}
          </div>

          <div className={styles.miniStrip}>
            {sortedCards.slice(0, revealIndex).map((card, i) => {
              const rc = getRarityById((card as any).rarity)?.color ?? '#aaa';
              const icon = TYPE_ICONS[card.type] ?? '?';
              return (
                <div
                  key={i}
                  className={styles.miniCard}
                  style={{ '--rarity-color': rc, borderColor: rc } as React.CSSProperties}
                >
                  <span className={styles.miniCardIcon}><RaceIcon icon={icon} /></span>
                </div>
              );
            })}
          </div>

          <div className={styles.skipHint}>{t('pack_opening.skip_hint')}</div>
        </div>
      </div>
    );
  }

  // Phase 3: Summary
  return (
    <div className={styles.screen}>
      <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('shop')}>
        {t('pack_opening.back_shop')}
      </button>
      <div className={styles.summaryPhase}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('pack_opening.title')}</h2>
          {rarityBreakdown && <p className={styles.breakdown}>{rarityBreakdown}</p>}
        </div>

        <div className={styles.grid}>
          {sortedCards.map((card, i) => {
            const isNew = !ownedBefore.has(card.id);
            const rarity = card.rarity ?? Rarity.Common;
            return (
              <div
                key={i}
                className={`${styles.cardWrapper} ${getRarityBorderClass(rarity, styles)}`}
                style={{ animationDelay: `${i * 0.08}s`, cursor: 'pointer' }}
                onClick={() => openModal({ type: 'card-detail', card })}
              >
                {isNew && (
                  <div className={`${styles.newBadge} ${getNewBadgeClass(rarity, styles)}`}>
                    {t('pack_opening.new_badge')}
                  </div>
                )}
                <Card card={card} />
              </div>
            );
          })}
        </div>

        <div className={styles.buttons}>
          <button className="btn-primary" onClick={() => navigateTo('save-point')}>
            {t('pack_opening.home')}
          </button>
        </div>
      </div>
    </div>
  );
}
