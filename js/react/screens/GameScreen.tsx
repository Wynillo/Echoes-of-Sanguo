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

  const PHASE_LABEL: Record<string, string> = {
    draw: t('game.phase_draw'), standby: t('game.phase_standby'),
    main: t('game.phase_main'), battle: t('game.phase_battle'),
    end:  t('game.phase_end'),
  };

  const portraitPhaseIcon = !isMyTurn ? '⏸'
    : phase === 'main'   ? '⚔'
    : phase === 'battle' ? '→'
    : '⏭';

  return (
    <div id="game-screen">

      {/* ── Portrait-only top control bar ─────────────────────── */}
      <div id="portrait-bar">
        <button
          className="portrait-opts-btn"
          title="Optionen"
          onClick={() => openModal({ type: 'main-options' })}
        >☰</button>

        <div className="portrait-hud">
          <span className="phud-lp phud-opp">♥ {opp.lp}</span>
          <span className="phud-phase">{PHASE_LABEL[phase] ?? phase}</span>
          <span className="phud-lp phud-player">♥ {player.lp}</span>
        </div>

        <button
          className={`portrait-phase-btn phase-${phase}${!isMyTurn ? ' waiting' : ''}`}
          disabled={!isMyTurn}
          onClick={onPortraitPhase}
          aria-label={t('game.aria_next_phase')}
        >
          {portraitPhaseIcon}
        </button>
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
          <button id="btn-options" title="Optionen" onClick={() => openModal({ type: 'main-options' })}>
            <span className="btn-options-mobile">☰</span>
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
