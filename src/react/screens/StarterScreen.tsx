import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext';
import { useProgression } from '../contexts/ProgressionContext';
import { Progression }    from '../../progression';
import { STARTER_DECKS }  from '../../cards';
import { getRaceById }    from '../../type-metadata';
import RaceIcon from '../components/RaceIcon';
import { Race } from '../../types';
import styles from './StarterScreen.module.css';

interface StarterRaceEntry { key: string; race: Race }

export default function StarterScreen() {
  const { navigateTo }             = useScreen();
  const { refresh, setCurrentDeck } = useProgression();
  const [selected, setSelected]    = useState<StarterRaceEntry | null>(null);
  const { t } = useTranslation();

  const starterRaces = useMemo<StarterRaceEntry[]>(() =>
    Object.keys(STARTER_DECKS)
      .map(Number)
      .filter(id => STARTER_DECKS[id]?.length > 0)
      .map(id => {
        const meta = getRaceById(id);
        return meta ? { key: meta.key, race: id as Race } : null;
      })
      .filter((e): e is StarterRaceEntry => e !== null),
  []);

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

  const selectedMeta = selected ? getRaceById(selected.race) : null;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div className={styles.rune}><RaceIcon icon="GiSparkles" /></div>
        <h2 className={styles.title}>{t('starter.headline')}</h2>
        <p className={styles.subtitle}>{t('starter.subtitle')}</p>
      </div>

      <div className={styles.raceGrid}>
        {starterRaces.map(entry => {
          const meta = getRaceById(entry.race);
          return (
            <div
              key={entry.key}
              className={`${styles.raceCard}${selected?.race === entry.race ? ` ${styles.selected}` : ''}`}
              style={{ '--race-color': meta?.color ?? '#888' } as React.CSSProperties}
              onClick={() => setSelected(entry)}
            >
              <div className={styles.raceIcon}><RaceIcon icon={meta?.icon} /></div>
              <div className={styles.raceName}>{meta?.value ?? entry.key}</div>
              <div className={styles.raceStyle}>{t(`starter.${entry.key}_style`, { defaultValue: '' })}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.preview}>
        <p id="starter-preview-name">
          {selectedMeta ? `${selectedMeta.icon ?? ''} ${selectedMeta.value}${t('starter.deck_suffix')}` : ''}
        </p>
        <p id="starter-preview-desc">{selected ? t(`starter.${selected.key}_flavor`, { defaultValue: '' }) : ''}</p>
        {selected && (
          <button id="btn-starter-confirm" onClick={confirm}>{t('starter.confirm_btn')}</button>
        )}
      </div>
    </div>
  );
}
