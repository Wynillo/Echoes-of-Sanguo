import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { useScreen } from '../contexts/ScreenContext.js';
import { Audio } from '../../audio.js';
import type { DuelStats } from '../../types.js';
import styles from './DuelResultScreen.module.css';

const PARTICLE_COUNT = 22;
const ANIM_LOCK_MS = 2500;

interface Rewards {
  coins?: number;
  cards?: string[];
}

export default function DuelResultScreen() {
  const { screenData, navigateTo } = useScreen();
  const { t } = useTranslation();

  const result = (screenData?.result as 'victory' | 'defeat') ?? 'defeat';
  const victory = result === 'victory';
  const stats = screenData?.stats as DuelStats | undefined;
  const rewards = screenData?.rewards as Rewards | undefined;

  const [locked, setLocked] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sepRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLParagraphElement>(null);
  const statsPanelRef = useRef<HTMLDivElement>(null);
  const rewardsRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLParagraphElement>(null);

  // Colors based on result
  const accent = victory ? '#d4a017' : '#cc4444';
  const glow = victory
    ? 'rgba(212,160,23,0.6)'
    : 'rgba(200,50,50,0.6)';

  // Generate particle positions once
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => ({
        left: `${Math.random() * 100}%`,
        bottom: `${-(Math.random() * 10)}%`,
        dur: `${3 + Math.random() * 4}s`,
        delay: `${Math.random() * 3}s`,
        size: `${4 + Math.random() * 4}px`,
      })),
    [],
  );

  function proceed() {
    if (locked) return;
    if (victory) {
      const next = screenData?.nextScreen as string | undefined;
      if (next === 'dialogue') {
        navigateTo('dialogue', screenData?.dialogueData as Record<string, unknown>);
      } else {
        navigateTo('campaign');
      }
    } else {
      navigateTo('press-start');
    }
  }

  // Staged GSAP entrance
  useEffect(() => {
    const tl = gsap.timeline();

    // Title entrance
    if (titleRef.current) {
      gsap.set(titleRef.current, { scale: 0, opacity: 0 });
      tl.to(titleRef.current, {
        scale: 1, opacity: 1, duration: 0.5,
        ease: 'back.out(1.6)',
      }, 0.2);
    }

    // Separator
    if (sepRef.current) {
      gsap.set(sepRef.current, { scaleX: 0, opacity: 0 });
      tl.to(sepRef.current, {
        scaleX: 1, opacity: 1, duration: 0.4,
        ease: 'power2.out',
      }, 0.55);
    }

    // Message
    if (msgRef.current) {
      gsap.set(msgRef.current, { y: 10, opacity: 0 });
      tl.to(msgRef.current, {
        y: 0, opacity: 1, duration: 0.4,
        ease: 'power2.out',
      }, 0.8);
    }

    // Stats panel
    if (statsPanelRef.current) {
      gsap.set(statsPanelRef.current, { y: 20, opacity: 0 });
      tl.to(statsPanelRef.current, {
        y: 0, opacity: 1, duration: 0.45,
        ease: 'power2.out',
      }, 1.0);
    }

    // Rewards (victory only)
    if (rewardsRef.current) {
      gsap.set(rewardsRef.current, { y: 15, opacity: 0 });
      tl.to(rewardsRef.current, {
        y: 0, opacity: 1, duration: 0.4,
        ease: 'power2.out',
        onStart: () => {
          if (victory && rewards?.coins) Audio.playSfx('sfx_coin');
        },
      }, 1.5);
    }

    // Continue prompt
    if (continueRef.current) {
      gsap.set(continueRef.current, { opacity: 0 });
      tl.to(continueRef.current, {
        opacity: 1, duration: 0.3,
        ease: 'none',
      }, 2.0);
    }

    // Unlock input after animation
    const timer = setTimeout(() => setLocked(false), ANIM_LOCK_MS);
    return () => { tl.kill(); clearTimeout(timer); };
  }, []);

  // Keyboard / click to proceed
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      proceed();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const hasRewards = victory && rewards && ((rewards.coins ?? 0) > 0 || (rewards.cards?.length ?? 0) > 0);

  const statRows = stats
    ? [
        { label: t('duelResult.stat_turns'),    value: stats.turns },
        { label: t('duelResult.stat_monsters'), value: stats.monstersPlayed },
        { label: t('duelResult.stat_fusions'),  value: stats.fusionsPerformed },
        { label: t('duelResult.stat_spells'),   value: stats.spellsActivated },
        { label: t('duelResult.stat_traps'),    value: stats.trapsActivated },
        { label: t('duelResult.stat_deck'),     value: stats.deckRemaining },
        { label: t('duelResult.stat_lp'),       value: stats.lpRemaining },
      ]
    : [];

  return (
    <div
      className={styles.screen}
      style={{ '--accent': accent, '--glow': glow, '--accent-dim': victory ? 'rgba(212,160,23,0.3)' : 'rgba(200,50,50,0.3)' } as React.CSSProperties}
      onClick={proceed}
    >
      {/* Floating particles */}
      <div className={styles.particleLayer}>
        {particles.map((p, i) => (
          <div
            key={i}
            className={styles.particle}
            style={{
              left: p.left,
              bottom: p.bottom,
              '--dur': p.dur,
              '--delay': p.delay,
              width: p.size,
              height: p.size,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className={styles.content} ref={contentRef}>
        <h1
          ref={titleRef}
          className={`${styles.title} ${victory ? styles.titleVictory : styles.titleDefeat}`}
        >
          {victory ? t('duelResult.victory_title') : t('duelResult.defeat_title')}
        </h1>

        <div ref={sepRef} className={styles.separator} />

        <p ref={msgRef} className={styles.message}>
          {victory ? t('duelResult.victory_message') : t('duelResult.defeat_message')}
        </p>

        {/* Duel stats */}
        {stats && (
          <div ref={statsPanelRef} className={styles.statsPanel}>
            <div className={styles.statsTitle}>{t('duelResult.stats_title')}</div>
            <div className={styles.statsGrid}>
              {statRows.map((row) => (
                <div key={row.label} className={styles.statRow}>
                  <span className={styles.statLabel}>{row.label}</span>
                  <span className={styles.statValue}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rewards (victory only) */}
        {hasRewards && (
          <div ref={rewardsRef} className={styles.rewards}>
            {(rewards.coins ?? 0) > 0 && (
              <div className={styles.rewardItem}>
                {t('duelResult.coins_earned', { coins: rewards.coins })}
              </div>
            )}
            {(rewards.cards?.length ?? 0) > 0 && (
              <div className={`${styles.rewardItem} ${styles.rewardCards}`}>
                {t('duelResult.cards_earned', { count: rewards.cards!.length })}
              </div>
            )}
          </div>
        )}

        <p ref={continueRef} className={`${styles.pressStart} ${locked ? '' : styles.blinking}`}>
          {t('duelResult.continue')}
        </p>
      </div>
    </div>
  );
}
