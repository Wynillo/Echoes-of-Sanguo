import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../contexts/GameContext.js';
import { useModal }     from '../contexts/ModalContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { cleanupAttackAnimations } from '../hooks/useAttackAnimation.js';

import { OpponentField }   from './game/OpponentField.js';
import { PlayerField }     from './game/PlayerField.js';
import { HandArea }        from './game/HandArea.js';
import { LPPanel }         from './game/LPPanel.js';
import {
  PhaseDivider,
  DirectAttackButton,
  NextPhaseButton,
} from './game/PhaseControls.js';

export default function GameScreen() {
  const { gameState, gameRef, logEntries, pendingDraw, clearPendingDraw } = useGame();
  const { openModal }          = useModal();
  const { sel, resetSel }      = useSelection();
  const { t }                  = useTranslation();
  const [showDirect, setShowDirect] = useState(false);

  const hideDirect         = useCallback(() => setShowDirect(false), []);
  const hideDirectAndReset = useCallback(() => { resetSel(); setShowDirect(false); }, [resetSel]);

  useKeyboardShortcuts({ gameState, gameRef, resetSel, onHideDirect: hideDirect });

  // Kill any in-flight attack animations when the game screen unmounts
  useEffect(() => () => cleanupAttackAnimations(), []);

  useEffect(() => {
    if (pendingDraw > 0) {
      const timer = setTimeout(clearPendingDraw, 600);
      return () => clearTimeout(timer);
    }
  }, [pendingDraw, clearPendingDraw]);

  const onDirectAttack = useCallback(() => {
    const game = gameRef.current;
    if (!game || sel.mode !== 'attack') return;
    game.attackDirect('player', sel.attackerZone!);
    resetSel();
    setShowDirect(false);
  }, [gameRef, sel.mode, sel.attackerZone, resetSel]);

  if (!gameState) return null;

  const player = gameState.player;
  const opp    = gameState.opponent;

  function onGraveClick(owner: 'player' | 'opponent') {
    const grave = owner === 'player' ? player.graveyard : opp.graveyard;
    if (grave.length > 0) openModal({ type: 'card-detail', card: grave[grave.length - 1] });
  }

  return (
    <div id="game-screen">

      {/* Opponent hand */}
      <div id="opp-hand-area">
        <div id="opp-hand">
          {Array.from({ length: opp.hand.length }).map((_, i) => (
            <div key={i} className="card face-down opp-hand-card">
              <div className="card-back-pattern"><span className="back-label">A</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* Field: 3 columns */}
      <div id="field">

        {/* Left panel */}
        <div id="field-left">
          <button id="btn-options" title="Optionen" onClick={() => {}}>
            <span className="btn-options-mobile">☰</span>
            <span className="btn-options-desktop">OPTIONS</span>
          </button>
          <div id="field-effect-slot">
            <span className="field-effect-label">CURRENT<br />FIELD</span>
          </div>
        </div>

        {/* Center: zone rows */}
        <div id="field-center">
          <OpponentField />

          <PhaseDivider />
          <DirectAttackButton showDirect={showDirect} onDirectAttack={onDirectAttack} />

          <PlayerField showDirect={showDirect} setShowDirect={setShowDirect} />

          {sel.hint && (
            <div id="action-hint" role="status" aria-live="polite">{sel.hint}</div>
          )}
        </div>

        {/* Right panel */}
        <div id="field-right">
          <div
            id="opp-grave"
            className="grave-icon opp-grave-icon"
            title={t('game.grave_opp')}
            onClick={() => onGraveClick('opponent')}
          >
            <span className="grave-icon-sym">🪦</span>
            <span className="grave-icon-count">{opp.graveyard.length}</span>
          </div>

          <div id="field-right-center">
            <NextPhaseButton onHideDirectAndReset={hideDirectAndReset} />
            <LPPanel
              playerLp={player.lp}
              oppLp={opp.lp}
              playerDeck={player.deck?.length ?? 0}
              oppDeck={opp.deck?.length ?? 0}
            />
          </div>

          <div
            id="player-grave"
            className="grave-icon player-grave-icon"
            title={t('game.grave_player')}
            onClick={() => onGraveClick('player')}
          >
            <span className="grave-icon-sym">🪦</span>
            <span className="grave-icon-count">{player.graveyard.length}</span>
          </div>
        </div>

      </div>{/* end #field */}

      <HandArea />

      {/* Battle log — hidden, accessible via options later */}
      <div id="battle-log" style={{ display: 'none' }}>
        <div className="log-header">📜 Protokoll</div>
        <div id="log-entries">
          {logEntries.map((entry, i) => (
            <div key={i} className="log-entry">{entry}</div>
          ))}
        </div>
      </div>

    </div>
  );
}
