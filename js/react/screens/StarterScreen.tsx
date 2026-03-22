import { useState }      from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { STARTER_DECKS }  from '../../cards.js';
import styles from './StarterScreen.module.css';

const RACE_INFO: Record<string, { icon: string; color: string }> = {
  drache:  { icon: '🐲', color: '#8040c0' },
  magier:  { icon: '🔮', color: '#6060c0' },
  krieger: { icon: '⚔️', color: '#c09030' },
};

export default function StarterScreen() {
  const { navigateTo }             = useScreen();
  const { refresh, setCurrentDeck } = useProgression();
  const [selected, setSelected]    = useState<string | null>(null);
  const { t } = useTranslation();

  function confirm() {
    if (!selected) return;
    const deckIds = (STARTER_DECKS as any)[selected];
    if (!deckIds) return;
    Progression.markStarterChosen(selected);
    Progression.addCardsToCollection(deckIds);
    Progression.saveDeck(deckIds);
    setCurrentDeck(deckIds);
    refresh();
    navigateTo('save-point');
  }

  const info = selected ? RACE_INFO[selected] : null;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.rune}>✦</div>
        <h2 className={styles.title}>{t('starter.headline')}</h2>
        <p className={styles.subtitle}>{t('starter.subtitle')}</p>
      </div>

      <div className={styles.raceGrid}>
        {Object.entries(RACE_INFO).map(([race, ri]) => (
          <div
            key={race}
            className={`${styles.raceCard}${selected === race ? ` ${styles.selected}` : ''}`}
            style={{ '--race-color': ri.color } as React.CSSProperties}
            onClick={() => setSelected(race)}
          >
            <div className={styles.raceIcon}>{ri.icon}</div>
            <div className={styles.raceName}>{t(`cards.race_${race}`)}</div>
            <div className={styles.raceStyle}>{t(`starter.${race}_style`)}</div>
          </div>
        ))}
      </div>

      <div className={styles.preview}>
        <p id="starter-preview-name">
          {info ? `${info.icon} ${t(`cards.race_${selected!}`)}${t('starter.deck_suffix')}` : ''}
        </p>
        <p id="starter-preview-desc">{selected ? t(`starter.${selected}_flavor`) : ''}</p>
        {selected && (
          <button id="btn-starter-confirm" onClick={confirm}>{t('starter.confirm_btn')}</button>
        )}
      </div>
    </div>
  );
}
