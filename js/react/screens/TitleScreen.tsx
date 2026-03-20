import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }        from '../contexts/ModalContext.js';
import { Progression }     from '../../progression.js';

export default function TitleScreen() {
  const { setScreen }  = useScreen();
  const { coins }      = useProgression();
  const { openModal }  = useModal();

  function startDuel() {
    if (Progression.isFirstLaunch()) {
      setScreen('starter');
    } else {
      setScreen('opponent');
    }
  }

  return (
    <div id="title-screen">
      <div className="title-bg"></div>
      <div className="title-content">
        <div className="title-rune">✦</div>
        <h1 className="game-title">AETHERIAL<br />CLASH</h1>
        <p className="subtitle">Das Kartenduel der Elemente</p>
        <div id="title-coins-bar">
          <span className="coins-icon">◈</span>
          <span id="title-coin-display">{coins.toLocaleString('de-DE')}</span>
          <span className="coins-label">Äther-Münzen</span>
        </div>
        <div className="title-buttons">
          <button className="btn-primary"   onClick={startDuel}>⚔ Duell Beginnen</button>
          <button className="btn-secondary" onClick={() => setScreen('shop')}>🛒 Shop</button>
          <button className="btn-secondary" onClick={() => setScreen('collection')}>📚 Sammlung</button>
          <button className="btn-secondary" onClick={() => setScreen('deckbuilder')}>🃏 Deckbuilder</button>
          <button className="btn-secondary" onClick={() => openModal({ type: 'card-list' })}>📖 Kartenliste</button>
        </div>
        <p className="title-hint">Baue Decks, fusioniere Monster und besiege deinen Gegner!</p>
      </div>
    </div>
  );
}
