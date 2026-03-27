import { useState }      from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { STARTER_DECKS }  from '../../cards.js';
import { getRaceByKey }   from '../../type-metadata.js';
import { Race } from '../../types.js';
import styles from './StarterScreen.module.css';

// Starter deck race options (subset of all races)
const STARTER_RACES = ['drache', 'magier', 'krieger'] as const;

const RACE_TO_NUM: Record<string, number> = {
  drache:  Race.Dragon,
  magier:  Race.Spellcaster,
  krieger: Race.Warrior,
};

/** Map starter keys (used for i18n style/flavor lookups) to PascalCase race keys */
const RACE_KEY_MAP: Record<string, string> = {
  drache:  'Dragon',
  magier:  'Spellcaster',
  krieger: 'Warrior',
};

export default function StarterScreen() {
  const { navigateTo }             = useScreen();
  const { refresh, setCurrentDeck } = useProgression();
  const [selected, setSelected]    = useState<string | null>(null);
  const { t } = useTranslation();

  function confirm() {
    if (!selected) return;
    const deckIds = STARTER_DECKS[RACE_TO_NUM[selected]];
    if (!deckIds) return;
    Progression.markStarterChosen(selected);
    Progression.addCardsToCollection(deckIds);
    Progression.saveDeck(deckIds);
    setCurrentDeck(deckIds);
    refresh();
    navigateTo('save-point');
  }

  const selectedMeta = selected ? getRaceByKey(RACE_KEY_MAP[selected]) : null;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.rune}>✦</div>
        <h2 className={styles.title}>{t('starter.headline')}</h2>
        <p className={styles.subtitle}>{t('starter.subtitle')}</p>
      </div>

      <div className={styles.raceGrid}>
        {STARTER_RACES.map(race => {
          const meta = getRaceByKey(RACE_KEY_MAP[race]);
          return (
            <div
              key={race}
              className={`${styles.raceCard}${selected === race ? ` ${styles.selected}` : ''}`}
              style={{ '--race-color': meta?.color ?? '#888' } as React.CSSProperties}
              onClick={() => setSelected(race)}
            >
              <div className={styles.raceIcon}>{meta?.icon ?? '?'}</div>
              <div className={styles.raceName}>{t(`cards.race_${RACE_KEY_MAP[race]}`)}</div>
              <div className={styles.raceStyle}>{t(`starter.${race}_style`)}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.preview}>
        <p id="starter-preview-name">
          {selectedMeta ? `${selectedMeta.icon} ${t(`cards.race_${RACE_KEY_MAP[selected!]}`)}${t('starter.deck_suffix')}` : ''}
        </p>
        <p id="starter-preview-desc">{selected ? t(`starter.${selected}_flavor`) : ''}</p>
        {selected && (
          <button id="btn-starter-confirm" onClick={confirm}>{t('starter.confirm_btn')}</button>
        )}
      </div>
    </div>
  );
}
