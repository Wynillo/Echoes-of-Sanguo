import { useState }       from 'react';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { Progression }    from '../../progression.js';
import styles from './SavePointScreen.module.css';

export default function SavePointScreen() {
  const { navigateTo }     = useScreen();
  const { coins, refresh } = useProgression();
  const { openModal }      = useModal();
  const [savedMsg, setSavedMsg] = useState(false);
  const hasBackup = Progression.hasBackup();

  function handleSave() {
    if (hasBackup) {
      const ok = window.confirm('Das alte Spiel wird überschrieben. Fortfahren?');
      if (!ok) return;
      Progression.clearBackup();
    }
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  function handleToMainMenu() {
    if (Progression.hasBackup()) {
      Progression.restoreFromBackup();
      refresh();
    }
    navigateTo('title');
  }

  return (
    <div className={styles.screen}>
      <div className="title-bg"></div>
      <div className={styles.content}>
        <div className="title-rune">★</div>
        <h2 className={styles.title}>SPEICHERPUNKT</h2>
        <div className={styles.coinsBar}>
          <span className="coins-icon">◈</span>
          <span className={styles.coinsValue}>{coins.toLocaleString('de-DE')}</span>
          <span className="coins-label">Äther-Münzen</span>
        </div>
        {hasBackup && (
          <p className={styles.backupWarning}>
            Neues Spiel aktiv — speichere um den alten Stand zu überschreiben,
            oder kehre zurück um abzubrechen.
          </p>
        )}
        <div className={styles.menu}>
          <button className="btn-primary" onClick={handleSave}>
            {savedMsg ? '✓ Gespeichert!' : '💾 Speichern'}
          </button>
          <button className="btn-secondary" onClick={() => navigateTo('opponent')}>📖 Story</button>
          <button className="btn-secondary" onClick={() => navigateTo('opponent')}>⚔ Freies Duell Beginnen</button>
          <button className="btn-secondary" onClick={() => navigateTo('shop')}>🛒 Shop</button>
          <button className="btn-secondary" onClick={() => navigateTo('collection')}>📚 Sammlung</button>
          <button className="btn-secondary" onClick={() => navigateTo('deckbuilder')}>🃏 Deckbuilder</button>
          <button className="btn-secondary" onClick={() => openModal({ type: 'card-list' })}>📋 Kartenliste</button>
          <button className="btn-secondary" onClick={handleToMainMenu}>🏠 Zum Hauptmenü</button>
        </div>
      </div>
    </div>
  );
}
