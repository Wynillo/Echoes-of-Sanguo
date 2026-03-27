import { useState }      from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';
import { STARTER_DECKS }  from '../../cards.js';
import { getRaceByKey }   from '../../type-metadata.js';
import { Race } from '../../types.js';
import styles from './StarterScreen.module.css';

// Starter deck race options using PascalCase race keys
const STARTER_RACES: { key: string; race: Race }[] = [
  { key: 'Dragon',      race: Race.Dragon },
  { key: 'Spellcaster', race: Race.Spellcaster },
  { key: 'Warrior',     race: Race.Warrior },
];

export default function StarterScreen() {
  const { navigateTo }             = useScreen();
  const { refresh, setCurrentDeck } = useProgression();
  const [selected, setSelected]    = useState<typeof STARTER_RACES[number] | null>(null);
  const { t } = useTranslation();

  function confirm() {
    if (!selected) return;
    const deckIds = STARTER_DECKS[selected.race];
    if (!deckIds) return;
    Progression.markStarterChosen(String(selected.race));
    Progression.addCardsToCollection(deckIds);
    Progression.saveDeck(deckIds);
    setCurrentDeck(deckIds);
    refresh();
    navigateTo('save-point');
  }

  const selectedMeta = selected ? getRaceByKey(selected.key) : null;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.rune}>✦</div>
        <h2 className={styles.title}>{t('starter.headline')}</h2>
        <p className={styles.subtitle}>{t('starter.subtitle')}</p>
      </div>

      <div className={styles.raceGrid}>
        {STARTER_RACES.map(entry => {
          const meta = getRaceByKey(entry.key);
          return (
            <div
              key={entry.key}
              className={`${styles.raceCard}${selected === entry ? ` ${styles.selected}` : ''}`}
              style={{ '--race-color': meta?.color ?? '#888' } as React.CSSProperties}
              onClick={() => setSelected(entry)}
            >
              <div className={styles.raceIcon}>{meta?.icon ?? '?'}</div>
              <div className={styles.raceName}>{t(`cards.race_${entry.key}`)}</div>
              <div className={styles.raceStyle}>{t(`starter.${entry.key}_style`)}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.preview}>
        <p id="starter-preview-name">
          {selectedMeta ? `${selectedMeta.icon} ${t(`cards.race_${selected!.key}`)}${t('starter.deck_suffix')}` : ''}
        </p>
        <p id="starter-preview-desc">{selected ? t(`starter.${selected.key}_flavor`) : ''}</p>
        {selected && (
          <button id="btn-starter-confirm" onClick={confirm}>{t('starter.confirm_btn')}</button>
        )}
      </div>
    </div>
  );
}
