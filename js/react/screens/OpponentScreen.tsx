import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { useGame }        from '../contexts/GameContext.js';
import { OPPONENT_CONFIGS } from '../../cards.js';
import { getRaceById } from '../../type-metadata.js';
import type { OpponentConfig } from '../../types.js';
import styles from './OpponentScreen.module.css';

export default function OpponentScreen() {
  const { navigateTo } = useScreen();
  const { opponents }   = useProgression();
  const { campaignData, progress } = useCampaign();
  const { startGame }   = useGame();
  const [hovered, setHovered] = useState<OpponentConfig | null>(null);
  const { t } = useTranslation();

  // Collect opponent IDs beaten in campaign (completed duel nodes)
  const beatenInCampaign = useMemo(() => {
    const ids = new Set<number>();
    for (const chapter of campaignData.chapters) {
      for (const node of chapter.nodes) {
        if (node.type === 'duel' && node.opponentId !== undefined && progress.completedNodes.includes(node.id)) {
          ids.add(node.opponentId);
        }
      }
    }
    return ids;
  }, [campaignData, progress.completedNodes]);

  function selectOpponent(cfg: OpponentConfig) {
    startGame(cfg);
    navigateTo('game');
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('opponent.headline')}</h2>
        <p className={styles.subtitle}>{t('opponent.subtitle')}</p>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('opponent.back')}</button>
      </div>

      <div className={styles.grid}>
        {(OPPONENT_CONFIGS as OpponentConfig[]).map(cfg => {
          const oppData = opponents[cfg.id] || { unlocked: cfg.id === 1, wins: 0, losses: 0 };
          const isAvailable = beatenInCampaign.has(cfg.id);
          const raceMeta = getRaceById(cfg.race);
          const accent = raceMeta?.color ?? '#888';

          return (
            <div
              key={cfg.id}
              className={`${styles.tile}${isAvailable ? '' : ` ${styles.locked}`}`}
              onClick={() => isAvailable && selectOpponent(cfg)}
              onMouseEnter={() => isAvailable && setHovered(cfg)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className={styles.frame} style={{ borderColor: accent }}>
                <div className={styles.art} style={{ background: `linear-gradient(135deg,${accent}44,#111830)` }}>
                  <div className={styles.symbol}>{raceMeta?.icon ?? '?'}</div>
                </div>
                {!isAvailable && <div className={styles.lockedOverlay}>🔒</div>}
              </div>
              <div className={styles.name}>{isAvailable ? cfg.name : '???'}</div>
              {isAvailable && (
                <div className={styles.record}>{(oppData as any).wins ?? 0}W / {(oppData as any).losses ?? 0}L</div>
              )}
            </div>
          );
        })}
      </div>

      <div className={styles.info}>
        <span id="opp-info-name">{hovered ? `${hovered.name} – ${(hovered as any).title}` : '—'}</span>
        <span id="opp-info-record">{hovered ? (hovered as any).flavor : ''}</span>
      </div>
    </div>
  );
}
