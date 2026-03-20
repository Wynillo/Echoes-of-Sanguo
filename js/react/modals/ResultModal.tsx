import { useRef, useEffect } from 'react';
import { gsap }         from 'gsap';
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
  const { navigateTo }  = useScreen();
  const { refresh }     = useProgression();

  const victory = resultType === 'victory';

  const contentRef = useRef<HTMLDivElement>(null);
  const titleRef   = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    gsap.set(contentRef.current, { y: 40, scale: 0.88, opacity: 0 });
    const tl = gsap.timeline();
    tl.to(contentRef.current, { y: 0, scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.4)' });
    if (victory && titleRef.current) {
      tl.to(titleRef.current, { textShadow: '0 0 30px rgba(255,215,0,0.9)', duration: 0.3, yoyo: true, repeat: 3, ease: 'power2.inOut' }, '<0.2');
    }
  }, []);

  function playAgain() {
    closeModal();
    startGame(lastOpponent);
  }

  function chooseOpponent() {
    closeModal();
    navigateTo('opponent');
  }

  function backToTitle() {
    closeModal();
    refresh();
    navigateTo('title');
  }

  return (
    <div id="result-modal" className="modal" role="dialog" aria-modal="true">
      <div className="result-content" ref={contentRef}>
        <h1 ref={titleRef} style={{ color: victory ? '#ffd700' : '#cc4444' }}>
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
