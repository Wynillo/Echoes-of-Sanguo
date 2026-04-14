import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../contexts/GameContext.js';
import { useModal }     from '../contexts/ModalContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { useGamepadContext } from '../contexts/GamepadContext.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useHapticFeedback } from '../hooks/useHapticFeedback.js';
import { cleanupAttackAnimations } from '../hooks/useAttackAnimation.js';
import RaceIcon from '../components/RaceIcon.js';
import { ControllerFocusOverlay } from '../components/ControllerFocusOverlay.js';

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
  const [showControllerHelp, setShowControllerHelp] = useState(false);
  const [controllerFocus, setControllerFocus] = useState<{
    type: 'monster' | 'spell' | 'field-spell' | 'hand' | 'grave' | 'phase-btn' | 'direct-btn';
    owner: 'player' | 'opponent';
    zone: number;
  } | null>(null);

  const hideDirect         = useCallback(() => setShowDirect(false), []);
  const hideDirectAndReset = useCallback(() => { resetSel(); setShowDirect(false); }, [resetSel]);

  const { showHelp, setShowHelp } = useKeyboardShortcuts({ gameState, gameRef, resetSel, onHideDirect: hideDirect });
  const { connected: controllerConnected, registerCallbacks } = useGamepadContext();
  const { vibratePatterns } = useHapticFeedback({ enabled: true, duration: 50, strength: 'light' });

  useEffect(() => () => cleanupAttackAnimations(), []);

  useEffect(() => {
    if (pendingDraw > 0) {
      const timer = setTimeout(clearPendingDraw, 600);
      return () => clearTimeout(timer);
    }
  }, [pendingDraw, clearPendingDraw]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game || !gameState) return;

    registerCallbacks({
      onA: () => {
        if (sel.mode === 'attack' && sel.attackerZone !== null) {
          const defZone = sel.trapFieldZone ?? null;
          if (defZone !== null) {
            game.attackMonster('player', sel.attackerZone, defZone);
            vibratePatterns.onAttack();
            resetSel();
          } else {
            setShowDirect(true);
            resetSel();
          }
        } else if (sel.mode === 'spell-target' && sel.spellHandIndex !== null && sel.spellFieldZone !== null) {
          game.setSpell('player', sel.spellHandIndex, sel.spellFieldZone);
          vibratePatterns.onCardPlay();
          resetSel();
        } else if (sel.mode === 'equip-target' && sel.equipHandIndex !== null && sel.equipCard) {
          vibratePatterns.onCardPlay();
        }
      },
      onB: () => {
        resetSel();
        setShowHelp(false);
        setShowControllerHelp(false);
      },
      onStart: () => {
        if (gameState.phase === 'end') {
          game.endTurn();
          vibratePatterns.onTurnEnd();
        } else {
          game.advancePhase();
          vibratePatterns.onPhaseChange();
        }
        hideDirectAndReset();
      },
      onSelect: () => {
        openModal({ type: 'main-options' });
      },
      onLB: () => {
        setControllerFocus(prev => {
          if (prev && prev.type === 'hand' && prev.owner === 'player' && prev.zone > 0) {
            return { ...prev, zone: prev.zone - 1 };
          }
          return prev;
        });
      },
      onRB: () => {
        setControllerFocus(prev => {
          if (prev && prev.type === 'hand' && prev.owner === 'player' && prev.zone < 5) {
            return { ...prev, zone: prev.zone + 1 };
          }
          return prev;
        });
      },
      onDpad: (direction) => {
        setControllerFocus(prev => {
          if (!prev) return { type: 'monster', owner: 'player', zone: 0 };

          const key = `${prev.type}-${prev.owner}`;

          if (prev.type === 'monster' && prev.owner === 'player') {
            if (direction === 'left' && prev.zone > 0) return { ...prev, zone: prev.zone - 1 };
            if (direction === 'right' && prev.zone < 2) return { ...prev, zone: prev.zone + 1 };
            if (direction === 'up') return { type: 'monster', owner: 'opponent', zone: prev.zone };
            if (direction === 'down') return { type: 'spell', owner: 'player', zone: 0 };
          }

          if (prev.type === 'monster' && prev.owner === 'opponent') {
            if (direction === 'left' && prev.zone > 0) return { ...prev, zone: prev.zone - 1 };
            if (direction === 'right' && prev.zone < 2) return { ...prev, zone: prev.zone + 1 };
            if (direction === 'up') return { type: 'spell', owner: 'opponent', zone: 0 };
            if (direction === 'down') return { type: 'monster', owner: 'player', zone: prev.zone };
          }

          if (prev.type === 'spell' && prev.owner === 'player') {
            if (direction === 'up' && prev.zone > 0) return { ...prev, zone: prev.zone - 1 };
            if (direction === 'up') return { type: 'monster', owner: 'player', zone: 0 };
            if (direction === 'down' && prev.zone < 4) return { ...prev, zone: prev.zone + 1 };
            if (direction === 'down') return { type: 'grave', owner: 'player', zone: 0 };
            if (direction === 'left') return { type: 'grave', owner: 'player', zone: 0 };
            if (direction === 'right') return { type: 'field-spell', owner: 'player', zone: 0 };
          }

          if (prev.type === 'spell' && prev.owner === 'opponent') {
            if (direction === 'up' && prev.zone < 4) return { ...prev, zone: prev.zone + 1 };
            if (direction === 'down' && prev.zone > 0) return { ...prev, zone: prev.zone - 1 };
            if (direction === 'up') return { type: 'field-spell', owner: 'opponent', zone: 0 };
            if (direction === 'down') return { type: 'monster', owner: 'opponent', zone: 0 };
            if (direction === 'left') return { type: 'grave', owner: 'opponent', zone: 0 };
            if (direction === 'right') return { type: 'field-spell', owner: 'opponent', zone: 0 };
          }

          if (prev.type === 'hand' && prev.owner === 'player') {
            if (direction === 'left' && prev.zone > 0) return { ...prev, zone: prev.zone - 1 };
            if (direction === 'right' && prev.zone < 5) return { ...prev, zone: prev.zone + 1 };
            if (direction === 'up') return { type: 'monster', owner: 'player', zone: Math.min(prev.zone, 2) };
            if (direction === 'down') return { type: 'phase-btn', owner: 'player', zone: 0 };
          }

          if (prev.type === 'grave' && prev.owner === 'player') {
            if (direction === 'right') return { type: 'spell', owner: 'player', zone: 0 };
            if (direction === 'down') return { type: 'hand', owner: 'player', zone: 0 };
            if (direction === 'up') return { type: 'spell', owner: 'player', zone: 4 };
          }

          if (prev.type === 'grave' && prev.owner === 'opponent') {
            if (direction === 'right') return { type: 'spell', owner: 'opponent', zone: 0 };
          }

          if (prev.type === 'field-spell' && prev.owner === 'player') {
            if (direction === 'left') return { type: 'spell', owner: 'player', zone: 0 };
            if (direction === 'up') return { type: 'field-spell', owner: 'opponent', zone: 0 };
          }

          if (prev.type === 'field-spell' && prev.owner === 'opponent') {
            if (direction === 'down') return { type: 'field-spell', owner: 'player', zone: 0 };
            if (direction === 'left') return { type: 'spell', owner: 'opponent', zone: 0 };
          }

          if (prev.type === 'phase-btn' && prev.owner === 'player') {
            if (direction === 'up') return { type: 'hand', owner: 'player', zone: 0 };
            if (direction === 'left') return { type: 'direct-btn', owner: 'player', zone: 0 };
          }

          if (prev.type === 'direct-btn' && prev.owner === 'player') {
            if (direction === 'right') return { type: 'phase-btn', owner: 'player', zone: 0 };
            if (direction === 'up') return { type: 'monster', owner: 'player', zone: 1 };
          }

          return prev;
        });
      },
    });

    return () => {
      registerCallbacks({});
    };
  }, [gameRef, gameState, sel.mode, sel.attackerZone, sel.spellHandIndex, sel.spellFieldZone, sel.equipHandIndex, sel.equipCard, registerCallbacks, resetSel, hideDirectAndReset, openModal, vibratePatterns]);

  useEffect(() => {
    if (controllerConnected) {
      vibratePatterns.onCardDraw();
    }
  }, [controllerConnected, vibratePatterns]);

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

  function onPortraitPhase(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
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
        ><RaceIcon icon="GiHamburgerMenu" /></button>

        <div className="portrait-hud">
          <span className="phud-lp phud-player"><RaceIcon icon="GiHearts" /> {player.lp} <span className="phud-deck"><RaceIcon icon="GiCardDraw" />{player.deck?.length ?? 0}</span></span>
          <span className="phud-phase">{lastOpponent?.name ?? t('game.phase_battle')}</span>
          <span className="phud-lp phud-opp"><RaceIcon icon="GiHearts" /> {opp.lp} <span className="phud-deck"><RaceIcon icon="GiCardDraw" />{opp.deck?.length ?? 0}</span></span>
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
            <span className="btn-options-mobile" aria-hidden="true"><RaceIcon icon="GiHamburgerMenu" /></span>
            <span className="btn-options-desktop">OPTIONS</span>
          </button>
          <div id="field-effect-slot">
            {gameState?.opponent.field.fieldSpell ? (
              <div className="field-spell-active field-spell-opp" title={gameState.opponent.field.fieldSpell.card.name}
                onClick={() => openModal({ type: 'card-detail', card: gameState.opponent.field.fieldSpell!.card })}>
                <span className="field-spell-icon"><RaceIcon icon="GiSparkles" /></span>
                <span className="field-spell-name">{gameState.opponent.field.fieldSpell.card.name}</span>
              </div>
            ) : (
              <div className="field-spell-empty"><span className="field-effect-label">{t('game.opp_field', 'OPP')}</span></div>
            )}
            {gameState?.player.field.fieldSpell ? (
              <div className="field-spell-active field-spell-own" title={gameState.player.field.fieldSpell.card.name}
                onClick={() => openModal({ type: 'card-detail', card: gameState.player.field.fieldSpell!.card })}>
                <span className="field-spell-icon"><RaceIcon icon="GiSparkles" /></span>
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
            <span className="grave-icon-sym"><RaceIcon icon="GiTombstone" /></span>
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
            <span className="grave-icon-sym"><RaceIcon icon="GiTombstone" /></span>
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
        onPointerUp={onPortraitPhase}
        aria-label={t('game.aria_next_phase')}
      >
        {!isMyTurn ? <RaceIcon icon="GiPauseButton" />
          : phase === 'main'   ? <><RaceIcon icon="GiCrossedSwords" /> BATTLE</>
          : phase === 'battle' ? <><RaceIcon icon="GiFastForwardButton" /> END</>
          : <><RaceIcon icon="GiFastForwardButton" /> NEXT</>}
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

      {showControllerHelp && (
        <div className="controller-help-overlay" onClick={() => setShowControllerHelp(false)}>
          <div className="controller-help-panel" onClick={e => e.stopPropagation()}>
            <h3>{t('controller.help_title')}</h3>
            <div className="controller-help-grid">
              <div className="controller-help-item">
                <span className="controller-button large">A</span>
                <span>{t('controller.help_a')}</span>
              </div>
              <div className="controller-help-item">
                <span className="controller-button large">B</span>
                <span>{t('controller.help_b')}</span>
              </div>
              <div className="controller-help-item">
                <span className="controller-button large">▶</span>
                <span>{t('controller.help_start')}</span>
              </div>
              <div className="controller-help-item">
                <span className="controller-button large">⬚</span>
                <span>{t('controller.help_select')}</span>
              </div>
              <div className="controller-help-item">
                <div className="dpad-icon">⟡</div>
                <span>{t('controller.help_dpad')}</span>
              </div>
            </div>
            <button className="btn-small" onClick={() => setShowControllerHelp(false)}>{t('common.close')}</button>
          </div>
        </div>
      )}

      <ControllerFocusOverlay connected={controllerConnected} focusedZone={controllerFocus} />

      {controllerConnected && (
        <div className="controller-hints">
          <span className="controller-hint">
            <span className="controller-button">A</span> {t('controller.btn_confirm')}
          </span>
          <span className="controller-hint">
            <span className="controller-button">B</span> {t('controller.btn_cancel')}
          </span>
          <span className="controller-hint">
            <span className="controller-button small">▶</span> {t('controller.help_start')}
          </span>
        </div>
      )}

    </div>
  );
}
