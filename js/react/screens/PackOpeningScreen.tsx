import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { useScreen }   from '../contexts/ScreenContext.js';
import { getRarityById } from '../../type-metadata.js';
import { Card, cardTypeCss, ATTR_CSS } from '../components/Card.js';
import { Audio }        from '../../audio.js';
import { CardType, Rarity } from '../../types.js';
import type { CardData }          from '../../types.js';
import type { CollectionEntry }   from '../../types.js';
import styles from './PackOpeningScreen.module.css';

type Phase = 'pack' | 'reveal' | 'summary';

/* ── Timing constants ──────────────────────────────────── */
const HOLD_BY_RARITY: Record<number, number> = {
  [Rarity.Common]:    0.5,
  [Rarity.Uncommon]:  0.5,
  [Rarity.Rare]:      0.8,
  [Rarity.SuperRare]: 1.0,
  [Rarity.UltraRare]: 1.2,
};

const SPARKLE_RARITIES = new Set([Rarity.SuperRare, Rarity.UltraRare]);
const SPARKLE_COUNT = 12;

/* ── Helpers ───────────────────────────────────────────── */

function getTypeLabel(card: CardData, t: (k: string) => string) {
  if (card.type === CardType.Monster && card.effect) return t('pack_opening.type_effect');
  if (card.type === CardType.Monster) return t('pack_opening.type_normal');
  if (card.type === CardType.Fusion) return t('pack_opening.type_fusion');
  if (card.type === CardType.Spell)  return t('pack_opening.type_spell');
  return t('pack_opening.type_trap');
}

function spawnSparkles(container: HTMLElement) {
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const el = document.createElement('div');
    el.className = styles['sparkle-particle'];
    el.style.setProperty('--sparkle-angle', `${(i / SPARKLE_COUNT) * 360}deg`);
    el.style.animationDelay = `${Math.random() * 0.15}s`;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => { if (el.parentNode) el.remove(); }, 1200);
  }
  // burst
  const burst = document.createElement('div');
  burst.className = styles['sparkle-burst'];
  container.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: true });
  setTimeout(() => { if (burst.parentNode) burst.remove(); }, 1000);
}

/* ── Component ─────────────────────────────────────────── */

export default function PackOpeningScreen() {
  const { navigateTo, screenData } = useScreen();
  const { t } = useTranslation();

  const { cards: _cards, preOpen: _preOpen } = (screenData as { cards: CardData[]; preOpen: CollectionEntry[] } | null) ?? { cards: [], preOpen: [] };
  const ownedBefore = useMemo(() => new Set(_preOpen.filter(e => e.count > 0).map(e => e.id)), [_preOpen]);

  // Sort cards by rarity ascending (Common first → UltraRare last)
  const sortedCards = useMemo(() =>
    [..._cards].sort((a, b) => (a.rarity ?? 1) - (b.rarity ?? 1)),
    [_cards],
  );

  const [phase, setPhase] = useState<Phase>('pack');
  const [revealIndex, setRevealIndex] = useState(-1);
  const [showFlash, setShowFlash] = useState(false);
  const skipRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const packRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const revealCardRef = useRef<HTMLDivElement>(null);

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
    skipRef.current = true;
    tlRef.current?.kill();
    setPhase('summary');
  }, [phase]);

  /* ── Phase 1: Pack tear-open animation ─── */
  useEffect(() => {
    if (phase !== 'pack') return;
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

    // Wobble the pack
    tl.to(pack, { rotation: -3, duration: 0.12, ease: 'steps(3)' })
      .to(pack, { rotation: 3, duration: 0.12, ease: 'steps(3)' })
      .to(pack, { rotation: -2, duration: 0.1, ease: 'steps(2)' })
      .to(pack, { rotation: 0, duration: 0.08, ease: 'steps(2)' });

    // Hide original, show halves
    tl.call(() => {
      gsap.set(pack, { visibility: 'hidden' });
      gsap.set([left, right], { visibility: 'visible' });
    });

    // Tear apart
    tl.to(left, {
      x: -80, rotation: -12, opacity: 0,
      duration: 0.4, ease: 'steps(6)',
    }, '+=0')
      .to(right, {
        x: 80, rotation: 12, opacity: 0,
        duration: 0.4, ease: 'steps(6)',
      }, '<');

    // Flash
    tl.call(() => setShowFlash(true), undefined, '-=0.15');
    tl.to({}, { duration: 0.5 }); // wait for flash to fade

    return () => { tl.kill(); };
  }, [phase]);

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

        // Update index to render the card
        setRevealIndex(i);

        // Wait a tick for React to render
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (cancelled || skipRef.current) break;

        const cardEl = revealCardRef.current;
        if (!cardEl) continue;

        const card = sortedCards[i];
        const rarity = card.rarity ?? Rarity.Common;
        const holdTime = HOLD_BY_RARITY[rarity] ?? 0.5;
        const isSparkly = SPARKLE_RARITIES.has(rarity);

        Audio.playSfx('sfx_pack_reveal');

        // Animate card: slide from top to center
        const tl = gsap.timeline();
        currentTl = tl;
        tlRef.current = tl;

        gsap.set(cardEl, { y: '-120vh', opacity: 0, scale: 0.85 });

        tl.to(cardEl, {
          y: 0, opacity: 1, scale: 1,
          duration: 0.45, ease: 'steps(8)',
        });

        // Sparkle effect for SR/UR
        if (isSparkly) {
          tl.call(() => {
            if (cardEl) {
              spawnSparkles(cardEl);
              cardEl.classList.add(styles.sparkle);
            }
          });
        }

        // Hold
        tl.to({}, { duration: holdTime });

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
      <div className={styles.screen} onClick={handleSkip}>
        {showFlash && <div className={styles.flash} />}
        <div className={styles.packPhase}>
          <div ref={packRef} className={styles.packWrapper}>
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

          <div className={styles.skipHint}>{t('pack_opening.skip_hint')}</div>
        </div>
      </div>
    );
  }

  // Phase 2: Reveal
  if (phase === 'reveal') {
    const currentCard = revealIndex >= 0 ? sortedCards[revealIndex] : null;
    const rarColor = currentCard ? (getRarityById((currentCard as any).rarity)?.color ?? '#aaa') : '#aaa';

    return (
      <div className={styles.screen} onClick={handleSkip}>
        <div className={styles.revealPhase}>
          <div className={styles.revealStage}>
            {currentCard && (
              <div
                ref={revealCardRef}
                className={`${styles.revealCard} card ${cardTypeCss(currentCard)}-card attr-${currentCard.attribute ? ATTR_CSS[currentCard.attribute] || 'spell' : 'spell'}`}
                style={{ '--rarity-color': rarColor } as React.CSSProperties}
              >
                <div className={styles.revealRarityBar} style={{ background: rarColor }} />
                {!ownedBefore.has(currentCard.id) && (
                  <div className={styles.newBadge}>{t('pack_opening.new_badge')}</div>
                )}
                <div className="card-header">
                  <span className="card-name">{currentCard.name}</span>
                  <span className="card-level">
                    {currentCard.level ? '★'.repeat(Math.min(currentCard.level, 5)) : ''}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-type-line">{getTypeLabel(currentCard, t)}</div>
                  <div className="card-desc">{currentCard.description || ''}</div>
                </div>
                {currentCard.atk !== undefined && (
                  <div className="card-footer">
                    <span>ATK {currentCard.atk}</span>
                    <span>DEF {currentCard.def}</span>
                  </div>
                )}
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
              return (
                <div
                  key={i}
                  className={styles.miniCard}
                  style={{ '--rarity-color': rc, borderColor: rc } as React.CSSProperties}
                >
                  <span>{card.name?.charAt(0) ?? '?'}</span>
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
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {isNew && <div className={styles.newBadge}>{t('pack_opening.new_badge')}</div>}
                <Card card={card} />
              </div>
            );
          })}
        </div>

        <div className={styles.buttons}>
          <button className="btn-secondary" onClick={() => navigateTo('shop')}>{t('pack_opening.back_shop')}</button>
          <button className="btn-primary" onClick={() => navigateTo('save-point')}>{t('pack_opening.home')}</button>
        </div>
      </div>
    </div>
  );
}
