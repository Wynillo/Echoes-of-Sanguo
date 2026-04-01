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
  const { gameState, gameRef, logEntries, pendingDraw, clearPendingDraw, lastOpponent } = useGame();
  const { openModal }          = useModal();
  const { sel, resetSel }      = useSelection();
  const { t }                  = useTranslation();
  const [showDirect, setShowDirect] = useState(false);

  const hideDirect         = useCallback(() => setShowDirect(false), []);
  const hideDirectAndReset = useCallback(() => { resetSel(); setShowDirect(false); }, [resetSel]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts({ gameState, gameRef, resetSel, onHideDirect: hideDirect });

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

  const player   = gameState.player;
  const opp      = gameState.opponent;
  const phase    = gameState.phase;
  const isMyTurn = gameState.activePlayer === 'player';

  function onGraveClick(owner: 'player' | 'opponent') {
    const grave = owner === 'player' ? player.graveyard : opp.graveyard;
    if (grave.length > 0) openModal({ type: 'card-detail', card: grave[grave.length - 1] });
  }

  function onPortraitPhase() {
    const game = gameRef.current;
    if (!game || !isMyTurn) return;
    hideDirectAndReset();
    if (phase === 'end') game.endTurn();
    else game.advancePhase();
  }

  return (
    <div id="game-screen">

      <div id="portrait-bar">
        <button
          className="portrait-opts-btn"
          title="Optionen"
          onClick={() => openModal({ type: 'main-options' })}
        >☰</button>

        <div className="portrait-hud">
          <span className="phud-lp phud-player">♥ {player.lp} <span className="phud-deck">🂠{player.deck?.length ?? 0}</span></span>
          <span className="phud-phase">{lastOpponent?.name ?? t('game.phase_battle')}</span>
          <span className="phud-lp phud-opp">♥ {opp.lp} <span className="phud-deck">🂠{opp.deck?.length ?? 0}</span></span>
        </div>
      </div>

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
          <button id="btn-options" title={t('title.options')} aria-label={t('title.options')} onClick={() => openModal({ type: 'main-options' })}>
            <span className="btn-options-mobile" aria-hidden="true">☰</span>
            <span className="btn-options-desktop">OPTIONS</span>
          </button>
          <div id="field-effect-slot">
            {gameState?.opponent.field.fieldSpell ? (
              <div className="field-spell-active field-spell-opp" title={gameState.opponent.field.fieldSpell.card.name}
                onClick={() => openModal({ type: 'card-detail', card: gameState.opponent.field.fieldSpell!.card })}>
                <span className="field-spell-icon">&#x2726;</span>
                <span className="field-spell-name">{gameState.opponent.field.fieldSpell.card.name}</span>
              </div>
            ) : (
              <div className="field-spell-empty"><span className="field-effect-label">{t('game.opp_field', 'OPP')}</span></div>
            )}
            {gameState?.player.field.fieldSpell ? (
              <div className="field-spell-active field-spell-own" title={gameState.player.field.fieldSpell.card.name}
                onClick={() => openModal({ type: 'card-detail', card: gameState.player.field.fieldSpell!.card })}>
                <span className="field-spell-icon">&#x2726;</span>
                <span className="field-spell-name">{gameState.player.field.fieldSpell.card.name}</span>
              </div>
            ) : (
              <div className="field-spell-empty"><span className="field-effect-label">{t('game.your_field', 'FIELD')}</span></div>
            )}
          </div>
        </div>

        {/* Center: zone rows */}
        <div id="field-center">
          <OpponentField />

          <PhaseDivider />
          <DirectAttackButton showDirect={showDirect} onDirectAttack={onDirectAttack} />

          <PlayerField showDirect={showDirect} setShowDirect={setShowDirect} />

          {sel.hint && (
            <div id="action-hint" role="status" aria-live="polite">
              {sel.hint}
              {(sel.mode === 'place-monster' || sel.mode === 'place-spell') && (
                <button className="hint-cancel-btn" onClick={() => resetSel()}>{t('card_action.cancel', '✕ Cancel')}</button>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div id="field-right">
          <button
            id="opp-grave"
            className="grave-icon opp-grave-icon"
            title={t('game.grave_opp')}
            aria-label={`${t('game.grave_opp')} (${opp.graveyard.length})`}
            onClick={() => onGraveClick('opponent')}
          >
            <span className="grave-icon-sym">🪦</span>
            <span className="grave-icon-count">{opp.graveyard.length}</span>
          </button>

          <div id="field-right-center">
            <NextPhaseButton onHideDirectAndReset={hideDirectAndReset} />
            <LPPanel
              playerLp={player.lp}
              oppLp={opp.lp}
              playerDeck={player.deck?.length ?? 0}
              oppDeck={opp.deck?.length ?? 0}
            />
          </div>

          <button
            id="player-grave"
            className="grave-icon player-grave-icon"
            title={t('game.grave_player')}
            aria-label={`${t('game.grave_player')} (${player.graveyard.length})`}
            onClick={() => onGraveClick('player')}
          >
            <span className="grave-icon-sym">🪦</span>
            <span className="grave-icon-count">{player.graveyard.length}</span>
          </button>
        </div>

      </div>{/* end #field */}

      <HandArea />

      {/* Floating phase button — visible only on portrait mobile via CSS */}
      <button
        id="floating-phase-btn"
        className={`floating-phase-btn phase-${phase}${!isMyTurn ? ' waiting' : ''}`}
        disabled={!isMyTurn}
        onClick={onPortraitPhase}
        aria-label={t('game.aria_next_phase')}
      >
        {!isMyTurn ? '⏸'
          : phase === 'main'   ? '⚔ BATTLE'
          : phase === 'battle' ? '→ END'
          : '⏭ NEXT'}
      </button>

      {!isMyTurn && (
        <div className="ai-thinking-indicator" role="status" aria-live="polite">
          {t('game.ai_thinking', 'Opponent is thinking...')}
        </div>
      )}

      {showHelp && (
        <div className="keyboard-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="keyboard-help-panel" onClick={e => e.stopPropagation()}>
            <h3>{t('game.keyboard_help_title', 'Keyboard Shortcuts')}</h3>
            <dl>
              <dt>B / E</dt><dd>{t('game.keyboard_advance', 'Advance Phase')}</dd>
              <dt>T</dt><dd>{t('game.keyboard_end_turn', 'End Turn')}</dd>
              <dt>Esc</dt><dd>{t('game.keyboard_cancel', 'Cancel Selection')}</dd>
              <dt>?</dt><dd>{t('game.keyboard_help', 'Toggle this help')}</dd>
            </dl>
            <button className="btn-small" onClick={() => setShowHelp(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}

    </div>
  );
}
