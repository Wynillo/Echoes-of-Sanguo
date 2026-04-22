import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useScreen }   from '../contexts/ScreenContext.js';
import { useModal }    from '../contexts/ModalContext.js';
import { getRarityById } from '../../type-metadata.js';
import { Card } from '../components/Card.js';
import { Audio }        from '../../audio.js';
import { CardType, Rarity } from '../../types.js';
import { ANIMATION_TIMING } from '../../constants.js';
import type { CardData }          from '../../types.js';
import type { CollectionEntry }   from '../../types.js';
import RaceIcon from '../components/RaceIcon.js';
import styles from './PackOpeningScreen.module.css';

type Phase = 'pack' | 'reveal' | 'summary';
type Rarity = 4 | 5 | 6 | 7 | 8;

/**
 * Number of taps required to open a pack.
 * Design rationale: 3 taps builds anticipation and engagement without frustrating users.
 * Mobile UX research shows 2-4 taps is the sweet spot for gacha-style reveals.
 * 
 * Future accessibility enhancement: this could be made configurable via settings
 * for users with motor impairments who need fewer taps.
 */
const TAPS_TO_OPEN = 3;

/**
 * Default hold duration in seconds for card reveals when rarity is not in HOLD_BY_RARITY.
 * Matches the Common/Uncommon duration.
 */
const DEFAULT_HOLD_DURATION_S = 0.5;

/**
 * Base rarity colors used across animation effects.
 * These colors follow a fantasy rarity progression:
 * - Rare: Cool blue (#7090ff) - mystical, uncommon feel
 * - Super Rare: Gold (#ffd700) - classic treasure/legendary association
 * - Ultra Rare: Purple (#e080ff) - regal, otherworldly power
 */
const RARITY_COLORS = {
  RARE: '#7090ff',
  SUPER_RARE: '#ffd700',
  ULTRA_RARE: '#e080ff',
} as const;

/**
 * Hold duration in seconds for card reveal, scaled by rarity.
 * Higher rarities have longer holds to emphasize the reveal and build anticipation.
 *
 * Design formula: base (0.5s) + (rarity_tier - 1) * 0.3s
 * - Common (4) / Uncommon (5): 0.5s - baseline for standard cards
 * - Rare (6): 0.8s - slight increase for notable pulls
 * - Super Rare (7): 1.2s - significant pause for excitement
 * - Ultra Rare (8): 1.6s - maximum duration for premium experience
 *
 * These values sync with haptic feedback and animation timing.
 * Accessibility note: reduced-motion preferences already supported via skipRef.
 */
const HOLD_BY_RARITY: Record<Rarity, number> = {
  [4]: DEFAULT_HOLD_DURATION_S,  // Common: 0.5s
  [5]: DEFAULT_HOLD_DURATION_S,  // Uncommon: 0.5s
  [6]: 0.8,  // Rare: 0.8s
  [7]: 1.2,  // Super Rare: 1.2s
  [8]: 1.6,  // Ultra Rare: 1.6s
};

/**
 * Sparkle particle effects configuration for rare cards.
 * Triggered only for Rare (6) and above during card reveal.
 * 
 * Progression formula:
 * - Particle count = (rarity - 5) × 6  =>  R:6, SR:12, UR:18
 * - Beam count = (rarity - 6) × 2      =>  R:0, SR:4, UR:6
 * - Burst size: 'large' only for Ultra Rare
 * 
 * Design rationale:
 * - Rare: Subtle sparkle (6 particles, no beams, small burst) - pleasant surprise
 * - Super Rare: Gold burst (12 particles, 4 beams) - legendary moment
 * - Ultra Rare: Purple spectacle (18 particles, 6 beams, large burst) - pinnacle pull
 */
const SPARKLE_CONFIG: Record<number, { count: number; color: string; beams: number; burstSize: 'normal' | 'large'; small: boolean }> = {
  [6]:  { count: 6,  color: RARITY_COLORS.RARE,       beams: 0, burstSize: 'normal', small: true },   // Rare: subtle
  [7]:  { count: 12, color: RARITY_COLORS.SUPER_RARE, beams: 4, burstSize: 'normal', small: false },  // SR: dramatic
  [8]:  { count: 18, color: RARITY_COLORS.ULTRA_RARE, beams: 6, burstSize: 'large',  small: false },  // UR: maximum
};

/**
 * Scanline overlay colors during card reveal.
 * Opacity values tuned for subtle atmospheric effect without obscuring card art.
 * 
 * Opacity rationale:
 * - 0.06-0.08 range: Visible enough to notice, transparent enough to not interfere
 * - Rare/Ultra Rare (0.08): Slightly stronger presence for high-tier cards
 * - Uncommon (0.06): Lighter touch for lower tier
 * 
 * Note: Common (rarity 4) uses fallback white tint in code.
 */
const SCANLINE_COLORS: Record<number, string> = {
  [4]: `rgba(${hexToRgb(RARITY_COLORS.RARE)}, 0.08)`,     // Common: blue tint
  [5]: `rgba(${hexToRgb(RARITY_COLORS.SUPER_RARE)}, 0.06)`, // Uncommon: gold tint (lighter)
  [6]: `rgba(${hexToRgb(RARITY_COLORS.ULTRA_RARE)}, 0.08)`, // Rare: purple tint
};

/**
 * Screen shake intensity for SR/UR reveals.
 * Intensity scale: 1.0 = baseline wobble, higher = more dramatic
 * 
 * Values:
 * - Super Rare (5): Moderate shake - noticeable but controlled
 * - Ultra Rare (8): Strong shake - powerful impact
 * 
 * Rationale: UR shake is 60% stronger than SR to emphasize the rarity gap.
 */
const SHAKE_INTENSITY: Record<number, number> = {
  [7]: 5,   // Super Rare: moderate intensity
  [8]: 8,   // Ultra Rare: maximum intensity
};

/**
 * Animation timing constants (milliseconds).
 * Extracted for consistency and easy tuning.
 */
const ANIMATION_TIMINGS = {
  SPARKLE_PARTICLE_LIFETIME: 1200,      // Individual sparkle particle duration
  BEAM_LIFETIME: 1500,                  // Light beam animation duration
  BURST_LIFETIME: 1000,                 // Sparkle burst duration
  CARD_SLIDE_DURATION: 300,             // Card entrance/exit slide (ms)
  CARD_FLIP_DURATION: 400,              // Card flip animation (ms)
  SHAKE_DURATION: 250,                  // Screen shake duration (ms)
  BG_FADE_DURATION: 300,                // Background effect fade (ms)
  RAYS_FADE_DURATION: 400,              // Light rays fade (ms)
} as const;

/** Helper: Convert hex color to RGB string for rgba() composition */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}

/** Card type icons for mini strip */
const TYPE_ICONS: Record<number, string> = {
  [CardType.Monster]: 'GiCrossedSwords',
  [CardType.Fusion]: 'GiStarShuriken',
  [CardType.Spell]: 'GiSparkles',
  [CardType.Trap]: 'GiLightningTrio',
  [CardType.Equipment]: 'GiShield',
};

const RARITY_LABELS: Record<number, string> = {
  [4]:    'C',
  [5]:  'U',
  [6]:      'R',
  [7]: 'SR',
  [8]: 'UR',
};

function getRarityBorderClass(rarity: number, s: Record<string, string>): string {
  switch (rarity) {
    case 4:    return s.borderCommon;
    case 5:  return s.borderUncommon;
    case 6:      return s.borderRare;
    case 7: return s.borderSuperRare;
    case 8: return s.borderUltraRare;
    default: return '';
  }
}

function getNewBadgeClass(rarity: number, s: Record<string, string>): string {
  switch (rarity) {
    case 4:    return s.newBadgeCommon;
    case 5:  return s.newBadgeUncommon;
    case 6:      return s.newBadgeRare;
    case 7: return s.newBadgeSuperRare;
    case 8: return s.newBadgeUltraRare;
    default: return s.newBadgeCommon;
  }
}

/* ── Helpers ───────────────────────────────────────────────── */

function spawnRevealFX(container: HTMLElement, rarity: number) {
  const cfg = SPARKLE_CONFIG[rarity];
  if (!cfg) return;

  for (let i = 0; i < cfg.count; i++) {
    const el = document.createElement('div');
    el.className = cfg.small ? styles['sparkle-particle-small'] : styles['sparkle-particle'];
    el.style.setProperty('--sparkle-angle', `${(i / cfg.count) * 360}deg`);
    el.style.setProperty('--sparkle-color', cfg.color);
    el.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => { if (el.parentNode) el.remove(); }, ANIMATION_TIMING.PACK_SPARKLE_REMOVE_MS);
  }

  for (let i = 0; i < cfg.beams; i++) {
    const beam = document.createElement('div');
    beam.className = styles.lightBeam;
    beam.style.setProperty('--beam-angle', `${(i / cfg.beams) * 180}deg`);
    beam.style.setProperty('--sparkle-color', cfg.color);
    beam.style.animationDelay = `${i * 0.08}s`;
    container.appendChild(beam);
    beam.addEventListener('animationend', () => beam.remove(), { once: true });
    setTimeout(() => { if (beam.parentNode) beam.remove(); }, ANIMATION_TIMING.PACK_BEAM_REMOVE_MS);
  }

  const burst = document.createElement('div');
  burst.className = cfg.burstSize === 'large' ? styles['sparkle-burst-large'] : styles['sparkle-burst'];
  burst.style.setProperty('--sparkle-color', cfg.color);
  container.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: true });
    setTimeout(() => { if (burst.parentNode) burst.remove(); }, ANIMATION_TIMING.PACK_BURST_REMOVE_MS);
}

function getBgClass(rarity: number): string {
  switch (rarity) {
    case 5:  return styles.bgUncommon;
    case 6:  return styles.bgRare;
    case 7:  return styles.bgSuperRare;
    case 8:  return styles.bgUltraRare;
    default: return '';
  }
}

/** Screen shake utility — returns a timeline that always resets to origin */
function shakeScreen(screenEl: HTMLElement, intensity: number, duration: number) {
  gsap.killTweensOf(screenEl, 'x,y');
  const tl = gsap.timeline();
  const steps = Math.floor(duration / 0.03);
  for (let i = 0; i < steps; i++) {
    const x = (Math.random() - 0.5) * 2 * intensity;
    const y = (Math.random() - 0.5) * 2 * intensity;
    tl.to(screenEl, { x, y, duration: 0.03, ease: 'none' });
  }
  tl.to(screenEl, { x: 0, y: 0, duration: 0.05, ease: 'none' });
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
    [..._cards].sort((a, b) => (a.rarity ?? Rarity.COMMON) - (b.rarity ?? Rarity.COMMON)),
    [_cards],
  );

  const rarityBreakdown = useMemo(() => {
    const counts = new Map<number, number>();
    for (const card of sortedCards) {
      const r = card.rarity ?? Rarity.RARE;
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
  const [currentRarity, setCurrentRarity] = useState<number>(Rarity.RARE);
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
  const bgRef = useRef<HTMLDivElement>(null);
  const lightRaysRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      skipRef.current = true;
      setPhase('summary');
    }
  }, []);

  const handleSkip = useCallback(() => {
    if (phase === 'summary') return;
    if (phase === 'pack' && !tearing) return;
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

    return () => {
      tl.kill();
      if (screenRef.current) gsap.killTweensOf(screenRef.current);
    };
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
        const rarity = card.rarity ?? Rarity.RARE;

        setRevealIndex(i);
        setCurrentRarity(rarity);

        // Wait for React to commit the render and set refs
        let cardEl: HTMLElement | null = null;
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(r => requestAnimationFrame(r));
          if (cancelled || skipRef.current) break;
          cardEl = revealCardRef.current;
          if (cardEl) break;
        }
        if (cancelled || skipRef.current) break;

        const screenEl = screenRef.current;
        const bgEl = bgRef.current;
        const raysEl = lightRaysRef.current;
        if (!cardEl) continue;

        const holdTime = HOLD_BY_RARITY[rarity] ?? DEFAULT_HOLD_DURATION_S;
        const hasSparkle = rarity in SPARKLE_CONFIG;
        const hasBg = rarity >= Rarity.UNCOMMON;
        const hasRays = rarity >= Rarity.SUPER_RARE;

        const tl = gsap.timeline();
        currentTl = tl;
        tlRef.current = tl;

        if (fastForwardRef.current) {
          tl.timeScale(8);
        }

        // Find the inner element for flip
        const innerEl = cardEl.querySelector(`.${styles.revealCardInner}`) as HTMLElement | null;
        const frontEl = cardEl.querySelector(`.${styles.revealCardFront}`) as HTMLElement | null;

        // Reset card state: face-down, off-screen
        gsap.set(cardEl, { y: '-120vh', opacity: 0, scale: 0.85 });
        if (innerEl) gsap.set(innerEl, { rotateY: 0 });

if (hasBg && bgEl) {
          tl.to(bgEl, { opacity: 1, duration: ANIMATION_TIMINGS.BG_FADE_DURATION / 1000, ease: 'steps(4)' }, 0);
        }
        if (hasRays && raysEl) {
          tl.to(raysEl, { opacity: 1, duration: ANIMATION_TIMINGS.RAYS_FADE_DURATION / 1000, ease: 'steps(5)' }, 0);
        }

        // Card entrance: slide from top (face-down)
        tl.to(cardEl, {
          y: 0, opacity: 1, scale: 1,
          duration: ANIMATION_TIMINGS.CARD_SLIDE_DURATION / 1000, ease: 'steps(6)',
        }, 0);

        tl.to({}, { duration: 0.15 });

        // Card flip: face-down → face-up
        if (innerEl) {
          tl.to(innerEl, {
            rotateY: 180, duration: ANIMATION_TIMINGS.CARD_FLIP_DURATION / 1000, ease: 'steps(6)',
          });
        }

        // Play reveal SFX at flip moment
        tl.call(() => {
          Audio.playSfx('sfx_pack_reveal');
        }, undefined, '-=0.2');

        // Screen shake for SR/UR at flip moment
        if (rarity >= Rarity.SUPER_RARE && screenEl) {
          const intensity = SHAKE_INTENSITY[rarity] ?? 5;
          tl.call(() => {
            shakeScreen(screenEl, intensity, ANIMATION_TIMINGS.SHAKE_DURATION / 1000);
          }, undefined, '-=0.1');
        }

        // Sparkle + beam effects after flip
        tl.call(() => {
          if (hasSparkle && cardEl) {
            spawnRevealFX(cardEl, rarity);
            if (frontEl) frontEl.classList.add(styles.sparkle);
          }
          const tintEl = scanlineTintRef.current;
          if (tintEl && rarity >= Rarity.RARE) {
            tintEl.style.setProperty(
              '--scanline-color',
              SCANLINE_COLORS[rarity] ?? 'rgba(255,255,255,0.04)',
            );
          }
        });

        if (rarity >= Rarity.RARE) {
          const tintEl = scanlineTintRef.current;
          if (tintEl) {
            tl.fromTo(
              tintEl,
              { opacity: 0 },
              { opacity: 1, duration: 0.05, ease: 'none' },
            ).to(tintEl, { opacity: 0, duration: 0.3, ease: 'power2.in' });
          }
        }

        // Hold to admire
        tl.to({}, { duration: holdTime });

        if (hasBg && bgEl) {
          tl.to(bgEl, { opacity: 0, duration: 0.2, ease: 'steps(3)' }, `-=${0.15}`);
        }
        if (hasRays && raysEl) {
          tl.to(raysEl, { opacity: 0, duration: 0.2, ease: 'steps(3)' }, '<');
        }

        // Exit: card flies off-screen downward
        tl.to(cardEl, {
          scale: 0.3, opacity: 0, y: '120vh',
          duration: ANIMATION_TIMINGS.CARD_SLIDE_DURATION / 1000, ease: 'steps(4)',
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
      if (screenRef.current) {
        gsap.killTweensOf(screenRef.current);
        gsap.set(screenRef.current, { x: 0, y: 0 });
      }
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
          <div ref={leftRef} className={styles.packHalfLeft} style={{ visibility: 'hidden' }}>
            <div className={styles.packFoil} />
          </div>
          <div ref={rightRef} className={styles.packHalfRight} style={{ visibility: 'hidden' }}>
            <div className={styles.packFoil} />
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
        <div ref={bgRef} className={`${styles.bgEffect} ${getBgClass(currentRarity)}`} />

        {currentRarity >= Rarity.SUPER_RARE && (
          <div ref={lightRaysRef} className={styles.lightRaysContainer}>
            <div className={currentRarity === Rarity.ULTRA_RARE ? styles.lightRaysUR : styles.lightRaysSR} />
          </div>
        )}

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
            {sortedCards.slice(0, Math.max(0, revealIndex)).map((card, i) => {
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
            const rarity = card.rarity ?? Rarity.RARE;
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
