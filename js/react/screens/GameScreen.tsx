import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../contexts/GameContext.js';
import { useModal }     from '../contexts/ModalContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { HandCard }              from '../components/HandCard.js';
import { FieldCardComponent }    from '../components/FieldCardComponent.js';
import { FieldSpellTrapComponent } from '../components/FieldSpellTrapComponent.js';
import { useKeyboardShortcuts }  from '../hooks/useKeyboardShortcuts.js';
import { useAnimatedNumber }     from '../hooks/useAnimatedNumber.js';
import { checkFusion }           from '../../cards.js';
import { CardType }              from '../../types.js';

const FIELD_ZONES = [0, 1, 2, 3, 4] as const;


export default function GameScreen() {
  const { gameState, gameRef, logEntries, pendingDraw, clearPendingDraw } = useGame();
  const { openModal } = useModal();
  const { sel, setSel, resetSel } = useSelection();
  const { t } = useTranslation();
  const [showDirect, setShowDirect] = useState(false);

  const PHASE_LABEL: Record<string, string> = {
    draw: t('game.phase_draw'), standby: t('game.phase_standby'), main: t('game.phase_main'),
    battle: t('game.phase_battle'), end: t('game.phase_end'),
  };

  const hideDirect = useCallback(() => setShowDirect(false), []);

  useKeyboardShortcuts({ gameState, gameRef, resetSel, onHideDirect: hideDirect });

  const playerLpDisplay = useAnimatedNumber(gameState?.player.lp ?? 0);
  const oppLpDisplay    = useAnimatedNumber(gameState?.opponent.lp ?? 0);

  useEffect(() => {
    if (pendingDraw > 0) {
      const timer = setTimeout(clearPendingDraw, 600);
      return () => clearTimeout(timer);
    }
  }, [pendingDraw, clearPendingDraw]);

  if (!gameState) return null;

  const game    = gameRef.current;
  const player  = gameState.player;
  const opp     = gameState.opponent;
  const phase   = gameState.phase;
  const isMyTurn = gameState.activePlayer === 'player';

  const START_LP = 8000;
  function lpPct(lp: number) { return `${Math.max(0, Math.min(100, lp / START_LP * 100))}%`; }

  const selMode = sel.mode;

  function isOppMonsterTargetable(zone: number) {
    if (!opp.field.monsters[zone]) return false;
    return selMode === 'attack' || selMode === 'trap-target';
  }

  function isPlayerMonsterInteractive(zone: number) {
    if (!player.field.monsters[zone]) return false;
    if (!isMyTurn || phase === 'battle') return false;
    return phase === 'main';
  }

  function playerMonsterCanAttack(zone: number) {
    const fc = player.field.monsters[zone];
    if (!fc) return false;
    if (!isMyTurn || phase !== 'battle') return false;
    return !fc.hasAttacked && fc.position === 'atk' && !fc.summonedThisTurn;
  }

  function isPlayerSpellTrapInteractive(zone: number) {
    const fst = player.field.spellTraps[zone];
    if (!fst) return false;
    return isMyTurn && phase === 'main' && fst.faceDown && fst.card.type === CardType.Spell;
  }

  function isPlayerMonsterSpellTarget(zone: number) {
    return selMode === 'spell-target' && !!player.field.monsters[zone];
  }

  function onHandCardClick(card: any, index: number) {
    if (!game) return;
    if (selMode === 'fusion1') {
      if (index === sel.fusion1!.handIndex) { resetSel(); return; }
      const firstCard = player.hand[sel.fusion1!.handIndex];
      if (!firstCard) { resetSel(); return; }
      const recipe = checkFusion(card.id, firstCard.id);
      if (recipe) {
        const zone = player.field.monsters.findIndex((z: any) => z === null);
        if (zone !== -1) game.performFusion('player', sel.fusion1!.handIndex, index);
      }
      resetSel();
      return;
    }
    openModal({ type: 'card-action', card, index, state: gameState! });
  }

  function onOwnFieldCardClick(fc: any, zone: number) {
    if (!game || !isMyTurn || phase !== 'main') return;
    openModal({ type: 'card-action', card: fc.card, index: zone, state: gameState! });
  }

  function onAttackerSelect(zone: number) {
    if (!game || !isMyTurn || phase !== 'battle') return;
    const fc = player.field.monsters[zone];
    if (!fc || fc.hasAttacked || fc.position !== 'atk' || fc.summonedThisTurn) return;
    resetSel();
    const oppHasMonsters = opp.field.monsters.some((m: any) => m !== null);
    setSel({ mode: 'attack', attackerZone: zone, hint: t('game.hint_selected', { name: fc.card.name }) });
    setShowDirect(!oppHasMonsters || fc.canDirectAttack);
  }

  function onDefenderSelect(zone: number) {
    if (!game || selMode !== 'attack') return;
    game.attack('player', sel.attackerZone, zone);
    resetSel();
    setShowDirect(false);
  }

  function onSpellTargetSelect(zone: number) {
    if (!game || selMode !== 'spell-target') return;
    const target = player.field.monsters[zone];
    if (!target) return;
    game.activateSpell('player', sel.spellHandIndex, target);
    resetSel();
  }

  function onFieldSpellTrapClick(zone: number, fst: any) {
    if (!game || !isMyTurn || phase !== 'main' || !fst.faceDown) return;
    if (fst.card.type === CardType.Spell) {
      if (fst.card.spellType !== 'targeted' && fst.card.spellType !== 'fromGrave') {
        game.activateSpellFromField('player', zone);
      }
    }
  }

  function onDirectAttack() {
    if (!game || selMode !== 'attack') return;
    game.attackDirect('player', sel.attackerZone!);
    resetSel();
    setShowDirect(false);
  }

  function onGraveClick(owner: 'player' | 'opponent') {
    const grave = owner === 'player' ? player.graveyard : opp.graveyard;
    if (grave.length > 0) openModal({ type: 'card-detail', card: grave[grave.length - 1] });
  }

  function getNextPhaseLabel() {
    if (!isMyTurn) return t('game.btn_wait');
    if (phase === 'main')   return t('game.btn_battle');
    if (phase === 'battle') return t('game.btn_end');
    return t('game.btn_next_turn');
  }

  function onNextPhase() {
    if (!game || !isMyTurn) return;
    if (phase === 'end') {
      game.endTurn(); resetSel(); setShowDirect(false);
    } else {
      game.advancePhase(); resetSel(); setShowDirect(false);
    }
  }

  const handLen     = player.hand.length;
  const newDrawBase = handLen - pendingDraw;

  return (
    <div id="game-screen">

      {/* Opponent hand — 3/4 above viewport */}
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

          <div className="field-side opponent-side">
            <div id="opp-spelltrap-zone" className="spell-trap-zone zone-row">
              {FIELD_ZONES.map(i => {
                const fst = opp.field.spellTraps[i];
                return (
                  <div key={i} className="zone-slot" data-zone={i}>
                    {!fst && <div className="zone-label">Z/F</div>}
                    {fst && <FieldSpellTrapComponent fst={fst} owner="opponent" zone={i} interactive={false} />}
                  </div>
                );
              })}
            </div>
            <div id="opponent-monster-zone" className="monster-zone zone-row">
              {FIELD_ZONES.map(i => {
                const fc = opp.field.monsters[i];
                const targetable = isOppMonsterTargetable(i);
                return (
                  <div key={i} className={`zone-slot${targetable ? ' targetable' : ''}`} data-zone={i}>
                    {!fc && <div className="zone-label">M</div>}
                    {fc && (
                      <FieldCardComponent
                        fc={fc} owner="opponent" zone={i}
                        selected={false} targetable={targetable}
                        interactive={false} canAttack={false}
                        onDefenderClick={() => {
                          if (selMode === 'attack') onDefenderSelect(i);
                          else if (selMode === 'trap-target') {
                            if (game && sel.spellHandIndex !== null) {
                              game.activateSpell('player', sel.spellHandIndex, fc);
                              resetSel();
                            }
                          }
                        }}
                        onDetail={() => openModal({ type: 'card-detail', card: fc.card, fc })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phase display — floating divider */}
          <div id="phase-display">
            <div id="phase-name">{PHASE_LABEL[phase] || phase.toUpperCase()}</div>
            <div className="turn-info">{t('game.round')} <span id="turn-num">{gameState.turn}</span></div>
          </div>

          {/* Direct attack button */}
          <button
            id="btn-direct-attack"
            className={showDirect && selMode === 'attack' ? '' : 'hidden'}
            onClick={onDirectAttack}
          >
            {t('game.btn_direct_attack')}
          </button>

          <div className="field-side player-side">
            <div id="player-monster-zone" className="monster-zone zone-row">
              {FIELD_ZONES.map(i => {
                const fc        = player.field.monsters[i];
                const selected  = selMode === 'attack' && sel.attackerZone === i;
                const canAtk    = playerMonsterCanAttack(i);
                const interact  = isPlayerMonsterInteractive(i);
                const targetable = isPlayerMonsterSpellTarget(i);
                return (
                  <div key={i} className="zone-slot" data-zone={i}>
                    {!fc && <div className="zone-label">M</div>}
                    {fc && (
                      <FieldCardComponent
                        fc={fc} owner="player" zone={i}
                        selected={selected} targetable={targetable}
                        interactive={interact} canAttack={canAtk}
                        onOwnClick={() => onOwnFieldCardClick(fc, i)}
                        onAttackerSelect={() => onAttackerSelect(i)}
                        onDefenderClick={() => onSpellTargetSelect(i)}
                        onDetail={() => openModal({ type: 'card-detail', card: fc.card, fc })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div id="player-spelltrap-zone" className="spell-trap-zone zone-row">
              {FIELD_ZONES.map(i => {
                const fst = player.field.spellTraps[i];
                const interact = isPlayerSpellTrapInteractive(i);
                return (
                  <div key={i} className="zone-slot" data-zone={i}>
                    {!fst && <div className="zone-label">Z/F</div>}
                    {fst && (
                      <FieldSpellTrapComponent
                        fst={fst} owner="player" zone={i} interactive={interact}
                        onClick={() => onFieldSpellTrapClick(i, fst)}
                        onDetail={() => openModal({ type: 'card-detail', card: fst.card })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action hint overlay */}
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

          {/* Vertically centered: Next Phase (left) + LP panel (right) */}
          <div id="field-right-center">
            <button
              id="btn-next-phase"
              className={`phase-${phase}${!isMyTurn ? ' waiting' : ''}`}
              disabled={!isMyTurn}
              onClick={onNextPhase}
              aria-label={t('game.aria_next_phase')}
            >
              {getNextPhaseLabel()}
            </button>

            <div id="lp-panel">
              <div className="lp-row opp-lp-row">
                <span className="lp-who">COM</span>
                <div className="lp-bottom">
                  <div className="io-bar-bg">
                    <div id="opp-lp-bar" className="lp-bar opp-lp-bar" style={{ width: lpPct(opp.lp) }}></div>
                  </div>
                  <span className="lp-value" id="opp-lp">{oppLpDisplay}</span>
                  <span className="lp-deck" id="opp-deck-count">{opp.deck?.length ?? 0}</span>
                </div>
              </div>
              <div className="lp-row player-lp-row">
                <span className="lp-who">YOU</span>
                <div className="lp-bottom">
                  <div className="io-bar-bg">
                    <div id="player-lp-bar" className="lp-bar" style={{ width: lpPct(player.lp) }}></div>
                  </div>
                  <span className="lp-value" id="player-lp">{playerLpDisplay}</span>
                  <span className="lp-deck" id="player-deck-count">{player.deck?.length ?? 0}</span>
                </div>
              </div>
            </div>
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

      {/* Player hand — 1/4 below viewport */}
      <div id="hand-area">
        <div id="player-hand">
          {player.hand.map((card: any, i: number) => {
            const isNewlyDrawn = i >= newDrawBase;
            const playable  = isMyTurn && phase === 'main';
            const fusionable = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
            const targetable = selMode === 'fusion1' && i !== sel.fusion1?.handIndex;
            return (
              <HandCard
                key={`${card.id}-${i}`}
                card={card} index={i}
                playable={playable}
                fusionable={fusionable}
                targetable={targetable && selMode === 'fusion1'}
                newlyDrawn={isNewlyDrawn}
                drawDelay={isNewlyDrawn ? (i - newDrawBase) * 80 : 0}
                onClick={() => onHandCardClick(card, i)}
              />
            );
          })}
        </div>
      </div>

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
