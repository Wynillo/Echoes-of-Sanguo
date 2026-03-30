import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../../contexts/GameContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';

interface DirectAttackProps {
  showDirect: boolean;
  onDirectAttack: () => void;
}

interface NextPhaseProps {
  onHideDirectAndReset: () => void;
}

/** Floating divider in the center column showing current phase + turn. */
export function PhaseDivider() {
  const { gameState } = useGame();
  const { t } = useTranslation();

  const PHASE_LABEL: Record<string, string> = useMemo(() => ({
    draw:    t('game.phase_draw'),
    standby: t('game.phase_standby'),
    main:    t('game.phase_main'),
    battle:  t('game.phase_battle'),
    end:     t('game.phase_end'),
  }), [t]);

  const phase = gameState?.phase ?? 'main';

  return (
    <div id="phase-display" aria-live="polite">
      <div id="phase-name">{PHASE_LABEL[phase] || phase.toUpperCase()}</div>
      <div className="turn-info">
        {t('game.round')} <span id="turn-num">{gameState?.turn}</span>
      </div>
    </div>
  );
}

/** Direct-attack button rendered in the center column. */
export function DirectAttackButton({ showDirect, onDirectAttack }: DirectAttackProps) {
  const { sel } = useSelection();
  const { t }   = useTranslation();

  return (
    <button
      id="btn-direct-attack"
      className={showDirect && sel.mode === 'attack' ? '' : 'hidden'}
      onClick={onDirectAttack}
    >
      {t('game.btn_direct_attack')}
    </button>
  );
}

/** Next-phase / end-turn button rendered in the right panel. */
export function NextPhaseButton({ onHideDirectAndReset }: NextPhaseProps) {
  const { gameState, gameRef } = useGame();
  const { t } = useTranslation();

  const phase    = gameState?.phase ?? 'main';
  const isMyTurn = gameState?.activePlayer === 'player';

  function getNextPhaseLabel() {
    if (!isMyTurn)          return t('game.btn_wait');
    if (phase === 'main') {
      return gameState?.firstTurnNoAttack ? t('game.btn_end') : t('game.btn_battle');
    }
    if (phase === 'battle') return t('game.btn_end');
    return t('game.btn_next_turn');
  }

  const cooldownRef = useRef(false);

  const handleClick = useCallback(() => {
    const game = gameRef.current;
    if (!game || !isMyTurn || cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 300);
    if (phase === 'end') {
      game.endTurn();
    } else {
      game.advancePhase();
    }
    onHideDirectAndReset();
  }, [gameRef, isMyTurn, phase, onHideDirectAndReset]);

  return (
    <button
      id="btn-next-phase"
      className={`phase-${phase}${!isMyTurn ? ' waiting' : ''}`}
      disabled={!isMyTurn}
      onClick={handleClick}
      aria-label={t('game.aria_next_phase')}
    >
      {getNextPhaseLabel()}
    </button>
  );
}
