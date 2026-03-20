import { useModal }      from '../contexts/ModalContext.js';
import { useGame }       from '../contexts/GameContext.js';
import { useScreen }     from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'result' }>; }

export function ResultModal({ modal }: Props) {
  const { resultType, coinsEarned } = modal;
  const { closeModal }  = useModal();
  const { startGame, lastOpponent } = useGame();
  const { setScreen }   = useScreen();
  const { refresh }     = useProgression();

  const victory = resultType === 'victory';

  function playAgain() {
    closeModal();
    startGame(lastOpponent);
  }

  function chooseOpponent() {
    closeModal();
    setScreen('opponent');
  }

  function backToTitle() {
    closeModal();
    refresh();
    setScreen('title');
  }

  return (
    <div id="result-modal" className="modal" role="dialog" aria-modal="true">
      <div className="result-content">
        <h1 style={{ color: victory ? '#ffd700' : '#cc4444' }}>
          {victory ? 'Sieg!' : 'Niederlage'}
        </h1>
        <p>
          {victory
            ? 'Du hast den Gegner besiegt! Die Macht der Aetherial liegt in deinen Händen.'
            : 'Du wurdest besiegt. Doch jeder Krieger kann aus einer Niederlage lernen...'}
        </p>
        {coinsEarned > 0 && (
          <div className="result-coins">+{coinsEarned} Äther-Münzen</div>
        )}
        <div className="result-buttons">
          <button className="btn-primary"   onClick={playAgain}>🔄 Nochmal Spielen</button>
          <button className="btn-secondary" onClick={chooseOpponent}>⚔ Gegner wählen</button>
          <button className="btn-secondary" onClick={backToTitle}>🏠 Hauptmenü</button>
        </div>
      </div>
    </div>
  );
}
