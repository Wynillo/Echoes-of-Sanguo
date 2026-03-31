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
import styles from './PackOpeningScreen.module.css';

type Phase = 'pack' | 'reveal' | 'summary';

/* ── Constants ────────────────────────────────────────────── */
const TAPS_TO_OPEN = 3;

const HOLD_BY_RARITY: Record<number, number> = {
  [Rarity.Common]:    0.5,
  [Rarity.Uncommon]:  0.5,
  [Rarity.Rare]:      0.8,
  [Rarity.SuperRare]: 1.2,
  [Rarity.UltraRare]: 1.6,
};

/** Rarity → sparkle config */
const SPARKLE_CONFIG: Record<number, { count: number; color: string; beams: number; burstSize: 'normal' | 'large'; small: boolean }> = {
  [Rarity.Rare]:      { count: 6,  color: '#7090ff', beams: 0, burstSize: 'normal', small: true },
  [Rarity.SuperRare]: { count: 12, color: '#ffd700', beams: 4, burstSize: 'normal', small: false },
  [Rarity.UltraRare]: { count: 18, color: '#e080ff', beams: 6, burstSize: 'large',  small: false },
};

/** Card type icons for mini strip */
const TYPE_ICONS: Record<number, string> = {
  [CardType.Monster]: '⚔',
  [CardType.Fusion]: '★',
  [CardType.Spell]: '✦',
  [CardType.Trap]: '⚡',
  [CardType.Equipment]: '🛡',
};

/* ── Helpers ───────────────────────────────────────────────── */

function spawnRevealFX(container: HTMLElement, rarity: number) {
  const cfg = SPARKLE_CONFIG[rarity];
  if (!cfg) return;

  // Spawn sparkle particles
  for (let i = 0; i < cfg.count; i++) {
    const el = document.createElement('div');
    el.className = cfg.small ? styles['sparkle-particle-small'] : styles['sparkle-particle'];
    el.style.setProperty('--sparkle-angle', `${(i / cfg.count) * 360}deg`);
    el.style.setProperty('--sparkle-color', cfg.color);
    el.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1200);
  }

  // Spawn light beams for SR/UR
  for (let i = 0; i < cfg.beams; i++) {
    const beam = document.createElement('div');
    beam.className = styles.lightBeam;
    beam.style.setProperty('--beam-angle', `${(i / cfg.beams) * 180}deg`);
    beam.style.setProperty('--sparkle-color', cfg.color);
    beam.style.animationDelay = `${i * 0.08}s`;
    container.appendChild(beam);
    beam.addEventListener('animationend', () => beam.remove(), { once: true });
    setTimeout(() => { if (beam.parentNode) beam.remove(); }, 1500);
  }

  // Spawn burst
  const burst = document.createElement('div');
  burst.className = cfg.burstSize === 'large' ? styles['sparkle-burst-large'] : styles['sparkle-burst'];
  burst.style.setProperty('--sparkle-color', cfg.color);
  container.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: true });
  setTimeout(() => { if (burst.parentNode) burst.remove(); }, 1000);
}

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

/** Get rarity background class */
function getBgClass(rarity: number): string {
  switch (rarity) {
    case Rarity.Uncommon:  return styles.bgUncommon;
    case Rarity.Rare:      return styles.bgRare;
    case Rarity.SuperRare: return styles.bgSuperRare;
    case Rarity.UltraRare: return styles.bgUltraRare;
    default: return '';
  }
}

/* ── Component ─────────────────────────────────────────────── */

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

  const [phase, setPhase] = useState<Phase>('pack');
  const [tapCount, setTapCount] = useState(0);
  const [tearing, setTearing] = useState(false);
  const [revealIndex, setRevealIndex] = useState(-1);
  const [showFlash, setShowFlash] = useState(false);
  const [currentRarity, setCurrentRarity] = useState<number>(Rarity.Common);
  const skipRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const revealCardRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const lightRaysRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  /* ── Reduced motion: skip everything ─── */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skipRef.current = true;
      setPhase('summary');
    }
  }, []);

  /* ── Skip handler ─── */
  const handleSkip = useCallback(() => {
    if (phase === 'summary') return;
    if (phase === 'pack' && !tearing) return; // don't skip during tap phase
    skipRef.current = true;
    tlRef.current?.kill();
    setPhase('summary');
  }, [phase, tearing]);

  /* ── Pack tap handler ─── */
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

  /* ── Phase 1: Pack tear-open animation (triggered when tearing=true) ─── */
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

    // Final dramatic wobble before tear
    tl.to(pack, { rotation: -8, scale: 1.08, duration: 0.12, ease: 'steps(3)' })
      .to(pack, { rotation: 10, scale: 1.1, duration: 0.12, ease: 'steps(3)' })
      .to(pack, { rotation: -12, scale: 1.12, duration: 0.12, ease: 'steps(3)' })
      .to(pack, { rotation: 14, scale: 1.14, duration: 0.1, ease: 'steps(2)' })
      .to(pack, { rotation: 0, scale: 1, duration: 0.08, ease: 'steps(2)' });

    // Hide original, show halves
    tl.call(() => {
      gsap.set(pack, { visibility: 'hidden' });
      gsap.set([left, right], { visibility: 'visible' });
    });

    // Tear apart
    tl.to(left, {
      x: -130, rotation: -20, opacity: 0,
      duration: 0.7, ease: 'steps(10)',
    }, '+=0')
      .to(right, {
        x: 130, rotation: 20, opacity: 0,
        duration: 0.7, ease: 'steps(10)',
      }, '<');

    // Flash + screen shake
    tl.call(() => {
      setShowFlash(true);
      if (screenRef.current) shakeScreen(screenRef.current, 3, 0.3);
    }, undefined, '-=0.25');
    tl.to({}, { duration: 0.25 }); // wait for flash to fade

    return () => { tl.kill(); };
  }, [phase, tearing]);

  /* ── Phase 2: Card reveal sequence ─── */
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

        // Update index & rarity to render the card
        setRevealIndex(i);
        setCurrentRarity(rarity);

        // Wait a tick for React to render
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled || skipRef.current) break;

        const cardEl = revealCardRef.current;
        const screenEl = screenRef.current;
        const bgEl = bgRef.current;
        const raysEl = lightRaysRef.current;
        if (!cardEl) continue;

        const holdTime = HOLD_BY_RARITY[rarity] ?? 0.5;
        const hasSparkle = rarity in SPARKLE_CONFIG;
        const hasBg = rarity >= Rarity.Uncommon;
        const hasRays = rarity >= Rarity.SuperRare;

        const tl = gsap.timeline();
        currentTl = tl;
        tlRef.current = tl;

        // Find the inner element for flip
        const innerEl = cardEl.querySelector(`.${styles.revealCardInner}`) as HTMLElement | null;
        const frontEl = cardEl.querySelector(`.${styles.revealCardFront}`) as HTMLElement | null;

        // Reset card state: face-down, off-screen
        gsap.set(cardEl, { y: '-120vh', opacity: 0, scale: 0.85 });
        if (innerEl) gsap.set(innerEl, { rotateY: 0 });

        // Fade in background effect
        if (hasBg && bgEl) {
          tl.to(bgEl, { opacity: 1, duration: 0.3, ease: 'steps(4)' }, 0);
        }

        // Fade in light rays for SR/UR
        if (hasRays && raysEl) {
          tl.to(raysEl, { opacity: 1, duration: 0.4, ease: 'steps(5)' }, 0);
        }

        // Card entrance: slide from top (face-down)
        tl.to(cardEl, {
          y: 0, opacity: 1, scale: 1,
          duration: 0.45, ease: 'steps(8)',
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

        // Screen shake for SR/UR at flip moment
        if (rarity >= Rarity.SuperRare && screenEl) {
          const shakeIntensity = rarity === Rarity.UltraRare ? 5 : 3;
          tl.call(() => {
            shakeScreen(screenEl, shakeIntensity, 0.35);
          }, undefined, '-=0.1');
        }

        // Sparkle + beam effects after flip
        if (hasSparkle) {
          tl.call(() => {
            if (cardEl) spawnRevealFX(cardEl, rarity);
            if (frontEl) frontEl.classList.add(styles.sparkle);
          });
        }

        // Hold to admire
        tl.to({}, { duration: holdTime });

        // Fade out background + rays
        if (hasBg && bgEl) {
          tl.to(bgEl, { opacity: 0, duration: 0.2, ease: 'steps(3)' }, `-=${0.15}`);
        }
        if (hasRays && raysEl) {
          tl.to(raysEl, { opacity: 0, duration: 0.2, ease: 'steps(3)' }, '<');
        }

        // Shrink & move down to mini strip area
        tl.to(cardEl, {
          scale: 0.3, opacity: 0, y: '30vh',
          duration: 0.3, ease: 'steps(5)',
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

  /* ── Render ─── */

  // Phase 1: Pack
  if (phase === 'pack') {
    return (
      <div ref={screenRef} className={styles.screen} onClick={tearing ? handleSkip : undefined}>
        {showFlash && <div className={styles.flash} />}
        <div className={styles.packPhase}>
          <div ref={packRef} className={styles.packWrapper} onClick={handlePackTap}>
            <div className={styles.packFoil} />
            <div className={styles.packLabel}>
              <div className={styles.packIcon}>🀄</div>
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

  // Phase 2: Reveal
  if (phase === 'reveal') {
    const currentCard = revealIndex >= 0 ? sortedCards[revealIndex] : null;
    const rarColor = currentCard ? (getRarityById((currentCard as any).rarity)?.color ?? '#aaa') : '#aaa';
    const bgClass = getBgClass(currentRarity);
    const hasRays = currentRarity >= Rarity.SuperRare;

    return (
      <div ref={screenRef} className={styles.screen} onClick={handleSkip}>
        {/* Rarity background glow */}
        <div ref={bgRef} className={`${styles.bgEffect} ${bgClass}`} />

        {/* Rotating light rays for SR/UR */}
        {hasRays && (
          <div ref={lightRaysRef} className={styles.lightRaysContainer}>
            <div className={currentRarity === Rarity.UltraRare ? styles.lightRaysUR : styles.lightRaysSR} />
          </div>
        )}

        <div className={styles.revealPhase}>
          <div className={styles.revealStage}>
            {currentCard && (
              <div
                ref={revealCardRef}
                className={styles.revealCard}
                style={{ '--rarity-color': rarColor } as React.CSSProperties}
              >
                <div className={styles.revealCardInner}>
                  {/* Back face (visible initially) */}
                  <div className={styles.revealCardBack}>
                    <div className={styles.cardBackPattern}>
                      <span className={styles.backLabel}>A</span>
                    </div>
                  </div>

                  {/* Front face (revealed after flip) */}
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

          {/* Counter */}
          <div className={styles.revealCounter}>
            {revealIndex + 1} / {sortedCards.length}
          </div>

          {/* Mini strip of already-revealed cards */}
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
                  <span className={styles.miniCardIcon}>{icon}</span>
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
      <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('shop')}>{t('pack_opening.back_shop')}</button>
      <div className={styles.summaryPhase}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('pack_opening.title')}</h2>
        </div>

        <div className={styles.grid}>
          {sortedCards.map((card, i) => {
            const isNew = !ownedBefore.has(card.id);
            return (
              <div
                key={i}
                className={styles.cardWrapper}
                style={{ animationDelay: `${i * 0.12}s`, cursor: 'pointer' }}
                onClick={() => openModal({ type: 'card-detail', card })}
              >
                {isNew && <div className={styles.newBadge}>{t('pack_opening.new_badge')}</div>}
                <Card card={card} />
              </div>
            );
          })}
        </div>

        <div className={styles.buttons}>
          <button className="btn-primary" onClick={() => navigateTo('save-point')}>{t('pack_opening.home')}</button>
        </div>
      </div>
    </div>
  );
}
