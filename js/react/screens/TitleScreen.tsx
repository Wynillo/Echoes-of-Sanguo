import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { Progression }    from '../../progression.js';

export default function TitleScreen() {
  const { setScreen } = useScreen();
  const { refresh }   = useProgression();
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
    setScreen('starter');
  }

  function handleLoadGame() {
    Progression.clearBackup();
    setScreen('save-point');
  }

  return (
    <div id="title-screen">
      <div className="title-bg"></div>
      <div className="title-content">
        <div className="title-rune">✦</div>
        <h1 className="game-title">AETHERIAL<br />CLASH</h1>
        <p className="subtitle">Das Kartenduel der Elemente</p>
        <div className="title-menu">
          <button className="btn-primary" onClick={handleNewGame}>⚔ Neues Spiel</button>
          {hasSave && (
            <button className="btn-secondary" onClick={handleLoadGame}>📂 Spiel Laden</button>
          )}
          <button className="btn-secondary" onClick={() => {}}>⚙ Optionen</button>
          <button className="btn-secondary" onClick={() => window.close()}>✕ Spiel beenden</button>
        </div>
      </div>
    </div>
  );
}
