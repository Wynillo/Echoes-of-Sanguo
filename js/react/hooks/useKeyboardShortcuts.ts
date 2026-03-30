import { useEffect, useState } from 'react';
import type { GameState } from '../../types.js';
import type { GameEngine } from '../../engine.js';

interface Params {
  gameState: GameState | null;
  gameRef:   React.MutableRefObject<GameEngine | null>;
  resetSel:  () => void;
  onHideDirect: () => void;
}

export function useKeyboardShortcuts({ gameState, gameRef, resetSel, onHideDirect }: Params) {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const game = gameRef.current;
      if (!game || !gameState) return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      if (e.key === '?') {
        e.preventDefault();
        setShowHelp(prev => !prev);
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        game.advancePhase();
        resetSel();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        game.advancePhase();
        resetSel();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        game.endTurn();
        resetSel();
        onHideDirect();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetSel();
        setShowHelp(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [gameState, gameRef, resetSel, onHideDirect]);

  return { showHelp, setShowHelp };
}
