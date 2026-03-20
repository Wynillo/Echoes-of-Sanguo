import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { Progression }    from '../../progression.js';
import styles from './TitleScreen.module.css';

export default function TitleScreen() {
  const { navigateTo } = useScreen();
  const { refresh }   = useProgression();
  const { openModal } = useModal();
  const hasSave = !Progression.isFirstLaunch();

  function handleNewGame() {
    if (hasSave) {
      const ok = window.confirm(
        'Neues Spiel starten?\nDein Fortschritt bleibt bis zum nächsten Speicherpunkt erhalten.'
      );
      if (!ok) return;
    }
    Progression.backupToSession();
    Progression.resetAll();
    Progression.init();
    refresh();
    navigateTo('starter');
  }

  function handleLoadGame() {
    Progression.clearBackup();
    navigateTo('save-point');
  }

  return (
    <div className={styles.screen}>
      <div className="title-bg"></div>
      <div className={styles.content}>
        <div className="title-rune">✦</div>
        <h1 className={styles.gameTitle}>AETHERIAL<br />CLASH</h1>
        <p className={styles.subtitle}>Das Kartenduel der Elemente</p>
        <div className={styles.menu}>
          <button className="btn-primary" onClick={handleNewGame}>⚔ Neues Spiel</button>
          {hasSave && (
            <button className="btn-secondary" onClick={handleLoadGame}>📂 Spiel Laden</button>
          )}
          <button className="btn-secondary" onClick={() => openModal({ type: 'main-options' })}>⚙ Optionen</button>
          <button className="btn-secondary" onClick={() => window.close()}>✕ Spiel beenden</button>
        </div>
      </div>
    </div>
  );
}
