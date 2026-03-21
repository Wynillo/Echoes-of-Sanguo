import { useState }      from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useGame }        from '../contexts/GameContext.js';
import { OPPONENT_CONFIGS } from '../../cards.js';
import { Race } from '../../types.js';
import type { OpponentConfig } from '../../types.js';
import styles from './OpponentScreen.module.css';

const RACE_COLORS: Record<number, string> = {
  [Race.Fire]:'#e05030', [Race.Dragon]:'#8040c0', [Race.Flyer]:'#4090c0',
  [Race.Stone]:'#808060', [Race.Plant]:'#40a050', [Race.Warrior]:'#c09030',
  [Race.Spellcaster]:'#6060c0', [Race.Elf]:'#90c060', [Race.Demon]:'#503060', [Race.Water]:'#3080b0',
};

const RACE_SYMBOL: Record<number, string> = {
  [Race.Fire]:'♨', [Race.Dragon]:'⚡', [Race.Flyer]:'🜁', [Race.Stone]:'⬡',
  [Race.Plant]:'✿', [Race.Warrior]:'⚔', [Race.Spellcaster]:'✦', [Race.Elf]:'☽',
  [Race.Demon]:'☠', [Race.Water]:'≋',
};

export default function OpponentScreen() {
  const { setScreen, navigateTo } = useScreen();
  const { opponents }   = useProgression();
  const { startGame }   = useGame();
  const [hovered, setHovered] = useState<OpponentConfig | null>(null);
  const { t } = useTranslation();

  function selectOpponent(cfg: OpponentConfig) {
    startGame(cfg);
    navigateTo('game');
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('opponent.headline')}</h2>
        <p className={styles.subtitle}>{t('opponent.subtitle')}</p>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('title')}>{t('opponent.back')}</button>
      </div>

      <div className={styles.grid}>
        {(OPPONENT_CONFIGS as OpponentConfig[]).map(cfg => {
          const oppData = opponents[cfg.id] || { unlocked: cfg.id === 1, wins: 0, losses: 0 };
          const isUnlocked = oppData.unlocked;
          const accent = RACE_COLORS[cfg.race] || '#888';

          return (
            <div
              key={cfg.id}
              className={`${styles.tile}${isUnlocked ? '' : ` ${styles.locked}`}`}
              onClick={() => isUnlocked && selectOpponent(cfg)}
              onMouseEnter={() => isUnlocked && setHovered(cfg)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className={styles.frame} style={{ borderColor: accent }}>
                <div className={styles.art} style={{ background: `linear-gradient(135deg,${accent}44,#111830)` }}>
                  <div className={styles.symbol}>{RACE_SYMBOL[cfg.race] || '?'}</div>
                </div>
                {!isUnlocked && <div className={styles.lockedOverlay}>🔒</div>}
              </div>
              <div className={styles.name}>{isUnlocked ? cfg.name : '???'}</div>
              {isUnlocked && (
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
