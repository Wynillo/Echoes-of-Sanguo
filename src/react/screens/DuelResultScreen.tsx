import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { useScreen } from '../contexts/ScreenContext.js';
import { Audio } from '../../audio.js';
import { CARD_DB } from '../../cards.js';
import { getRarityById, getCardTypeById } from '../../type-metadata.js';
import type { DuelStats } from '../../types.js';
import type { BattleBadges } from '../../battle-badges.js';
import styles from './DuelResultScreen.module.css';

const PARTICLE_COUNT = 22;
const ANIM_LOCK_MS = 3600;

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
  const mode = screenData?.mode as 'campaign' | 'free' | undefined;
  const badges = screenData?.badges as BattleBadges | undefined;
  const newCardIds = screenData?.newCardIds as string[] | undefined;
  const newCardSet = useMemo(() => new Set(newCardIds ?? []), [newCardIds]);

  const [locked, setLocked] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sepRef = useRef<HTMLDivElement>(null);
  const msgRef = useRef<HTMLParagraphElement>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const statsPanelRef = useRef<HTMLDivElement>(null);
  const oppStatsPanelRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

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
    if (mode === 'free') {
      navigateTo('opponent');
      return;
    }
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

    // Win/loss reason
    if (reasonRef.current) {
      gsap.set(reasonRef.current, { y: 8, opacity: 0 });
      tl.to(reasonRef.current, {
        y: 0, opacity: 1, duration: 0.35,
        ease: 'power2.out',
      }, 1.0);
    }

    // Stats panel (player)
    if (statsPanelRef.current) {
      gsap.set(statsPanelRef.current, { y: 20, opacity: 0 });
      tl.to(statsPanelRef.current, {
        y: 0, opacity: 1, duration: 0.45,
        ease: 'power2.out',
      }, 1.2);
    }

    // Stats panel (opponent)
    if (oppStatsPanelRef.current) {
      gsap.set(oppStatsPanelRef.current, { y: 20, opacity: 0 });
      tl.to(oppStatsPanelRef.current, {
        y: 0, opacity: 1, duration: 0.45,
        ease: 'power2.out',
      }, 1.4);
    }

    // Badges (victory only)
    if (badgesRef.current) {
      gsap.set(badgesRef.current, { y: 15, opacity: 0 });
      tl.to(badgesRef.current, {
        y: 0, opacity: 1, duration: 0.4,
        ease: 'back.out(1.4)',
      }, 1.6);
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
      }, 2.1);
    }

    // Continue prompt
    if (continueRef.current) {
      gsap.set(continueRef.current, { opacity: 0 });
      tl.to(continueRef.current, {
        opacity: 1, duration: 0.3,
        ease: 'none',
      }, 2.8);
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

  // Win/loss reason text
  const reasonKey = stats?.endReason
    ? victory
      ? (stats.endReason === 'deck_out' ? 'duelResult.win_reason_deckout' : 'duelResult.win_reason_lp')
      : (stats.endReason === 'surrender' ? 'duelResult.loss_reason_surrender'
         : stats.endReason === 'deck_out' ? 'duelResult.loss_reason_deckout'
         : 'duelResult.loss_reason_lp')
    : null;

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

  const opponentStatRows = stats
    ? [
        { label: t('duelResult.opp_stat_monsters'),  value: stats.opponentMonstersPlayed },
        { label: t('duelResult.opp_stat_fusions'),   value: stats.opponentFusionsPerformed },
        { label: t('duelResult.opp_stat_spells'),    value: stats.opponentSpellsActivated },
        { label: t('duelResult.opp_stat_traps'),     value: stats.opponentTrapsActivated },
        { label: t('duelResult.opp_stat_lp'),        value: stats.opponentLpRemaining },
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

        {/* Win/loss reason */}
        {reasonKey && (
          <p ref={reasonRef} className={styles.winReason}>
            {t(reasonKey)}
          </p>
        )}

        {/* Stats columns: player + opponent */}
        {stats && (
          <div className={styles.statsColumns}>
            {/* Player stats */}
            <div ref={statsPanelRef} className={styles.statsPanel}>
              <div className={styles.statsTitle}>{t('duelResult.player_stats_title')}</div>
              <div className={styles.statsGrid}>
                {statRows.map((row) => (
                  <div key={row.label} className={styles.statRow}>
                    <span className={styles.statLabel}>{row.label}</span>
                    <span className={styles.statValue}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Opponent stats */}
            <div ref={oppStatsPanelRef} className={styles.statsPanel}>
              <div className={styles.statsTitle}>{t('duelResult.opponent_stats_title')}</div>
              <div className={styles.statsGrid}>
                {opponentStatRows.map((row) => (
                  <div key={row.label} className={styles.statRow}>
                    <span className={styles.statLabel}>{row.label}</span>
                    <span className={styles.statValue}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Battle Badges (victory only) */}
        {victory && badges && (
          <>
            <div ref={badgesRef} className={styles.badges}>
              {([badges.pow, badges.tec] as const).map((b) => (
                <div
                  key={b.category}
                  className={`${styles.badge} ${b.rank === 'S' ? styles.badgeS : b.rank === 'A' ? styles.badgeA : styles.badgeB}`}
                >
                  <span className={styles.badgeCategory}>
                    {t(`duelResult.badge_${b.category.toLowerCase()}`)}
                  </span>
                  <span className={styles.badgeRank}>
                    {t(`duelResult.badge_rank_${b.rank.toLowerCase()}`)}
                  </span>
                </div>
              ))}
            </div>
          </>
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
              <div className={styles.rewardCardList}>
                {rewards.cards!.map((cardId, i) => {
                  const card = CARD_DB[cardId];
                  if (!card) return null;
                  const rarityMeta = getRarityById(card.rarity ?? 0);
                  const typeMeta = getCardTypeById(card.type);
                  const isNew = newCardSet.has(cardId);
                  return (
                    <div key={`${cardId}-${i}`} className={styles.rewardCardRow}>
                      {rarityMeta && (
                        <span className={styles.rewardCardRarity} style={{ color: rarityMeta.color }}>
                          {rarityMeta.value}
                        </span>
                      )}
                      {typeMeta && (
                        <span className={styles.rewardCardType} style={{ color: typeMeta.color }}>
                          {typeMeta.value}
                        </span>
                      )}
                      <span className={styles.rewardCardName}>{card.name}</span>
                      {isNew && <span className={styles.rewardNewBadge}>{t('pack_opening.new_badge')}</span>}
                    </div>
                  );
                })}
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
