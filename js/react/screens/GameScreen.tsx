import { useState, useCallback, useEffect } from 'react';
import { useGame }      from '../contexts/GameContext.js';
import { useModal }     from '../contexts/ModalContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { HandCard }              from '../components/HandCard.js';
import { FieldCardComponent }    from '../components/FieldCardComponent.js';
import { FieldSpellTrapComponent } from '../components/FieldSpellTrapComponent.js';
import { useKeyboardShortcuts }  from '../hooks/useKeyboardShortcuts.js';
import { checkFusion }           from '../../cards.js';

const PHASE_LABEL: Record<string, string> = {
  draw: 'ZIEHPHASE', standby: 'BEREITSCHAFT', main: 'HAUPTPHASE',
  battle: 'KAMPFPHASE', end: 'ENDPHASE',
};

export default function GameScreen() {
  const { gameState, gameRef, logEntries, pendingDraw, clearPendingDraw } = useGame();
  const { openModal } = useModal();
  const { sel, setSel, resetSel } = useSelection();
  const [showDirect, setShowDirect] = useState(false);

  const hideDirect = useCallback(() => setShowDirect(false), []);

  useKeyboardShortcuts({ gameState, gameRef, resetSel, onHideDirect: hideDirect });

  // Animate draw: newly drawn cards get the class for `pendingDraw` count
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

  // ── LP bar widths ─────────────────────────────────────────
  const START_LP = 8000;
  function lpPct(lp: number) { return `${Math.max(0, Math.min(100, lp / START_LP * 100))}%`; }

  // ── Selection-derived flags ────────────────────────────────
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
    return isMyTurn && phase === 'main' && fst.faceDown && fst.card.type === 'spell';
  }

  function isPlayerMonsterSpellTarget(zone: number) {
    return selMode === 'spell-target' && !!player.field.monsters[zone];
  }

  // ── Handlers ──────────────────────────────────────────────
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
    openModal({ type: 'card-action', card, index, state: gameState });
  }

  function onOwnFieldCardClick(fc: any, zone: number) {
    if (!game || !isMyTurn || phase !== 'main') return;
    openModal({ type: 'card-action', card: fc.card, index: zone, state: gameState });
  }

  function onAttackerSelect(zone: number) {
    if (!game || !isMyTurn || phase !== 'battle') return;
    const fc = player.field.monsters[zone];
    if (!fc || fc.hasAttacked || fc.position !== 'atk' || fc.summonedThisTurn) return;
    resetSel();
    const oppHasMonsters = opp.field.monsters.some((m: any) => m !== null);
    setSel({ mode: 'attack', attackerZone: zone, hint: `${fc.card.name} ausgewählt.` });
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
    if (fst.card.type === 'spell') {
      if (fst.card.spellType !== 'targeted' && fst.card.spellType !== 'fromGrave') {
        game.activateSpellFromField('player', zone);
      }
      // targeted spells from field are currently no-op (require zone-click targeting, future work)
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

  // ── Phase button logic ─────────────────────────────────────
  const canGoToBattle = isMyTurn && phase === 'main';
  const canGoToEnd    = isMyTurn && phase === 'battle';
  const canEndTurn    = isMyTurn && (phase === 'main' || phase === 'battle' || phase === 'end');

  function advancePhase() {
    if (game) { game.advancePhase(); resetSel(); setShowDirect(false); }
  }
  function endTurn() {
    if (game) { game.endTurn(); resetSel(); setShowDirect(false); }
  }

  // ── Newly drawn hand cards ─────────────────────────────────
  const handLen     = player.hand.length;
  const newDrawBase = handLen - pendingDraw;

  return (
    <div id="game-screen">
      <div id="field">

        {/* Opponent info overlay */}
        <div id="opp-info-overlay" className="info-overlay">
          <span className="io-label">GEGNER</span>
          <span className="io-lp" id="opp-lp">{opp.lp}</span>
          <div className="io-bar-bg"><div id="opp-lp-bar" className="lp-bar opp-lp-bar" style={{ width: lpPct(opp.lp) }}></div></div>
          <span className="io-deck">Deck: <span id="opp-deck-count">{opp.deck?.length ?? 0}</span> | Hand: <span id="opp-hand-count">{opp.hand.length}</span></span>
        </div>

        {/* Opponent side */}
        <div className="field-side opponent-side">
          <div id="opp-spelltrap-zone" className="spell-trap-zone zone-row">
            {[0,1,2,3,4].map(i => {
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
            {[0,1,2,3,4].map(i => {
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

        {/* Direct attack button */}
        <button
          id="btn-direct-attack"
          className={showDirect && selMode === 'attack' ? '' : 'hidden'}
          onClick={onDirectAttack}
        >
          💥 Direkt Angreifen
        </button>

        {/* Middle divider */}
        <div id="field-middle">
          <div className="grave-area" id="opp-grave-area">
            <div id="opp-grave" className="graveyard-pile" title="Gegner Friedhof" onClick={() => onGraveClick('opponent')}>
              <div className="grave-count" id="opp-grave-count">{opp.graveyard.length}</div>
              <div className="grave-label">☠</div>
            </div>
          </div>
          <div className="fdiv-line"></div>
          <div id="phase-display">
            <div id="phase-name">{PHASE_LABEL[phase] || phase.toUpperCase()}</div>
            <div className="turn-info">Runde <span id="turn-num">{gameState.turn}</span></div>
          </div>
          <div className="fdiv-line"></div>
          <div className="grave-area" id="player-grave-area">
            <div id="player-grave" className="graveyard-pile" title="Spieler Friedhof" onClick={() => onGraveClick('player')}>
              <div className="grave-count" id="player-grave-count">{player.graveyard.length}</div>
              <div className="grave-label">☠</div>
            </div>
          </div>
        </div>

        {/* Player side */}
        <div className="field-side player-side">
          <div id="player-monster-zone" className="monster-zone zone-row">
            {[0,1,2,3,4].map(i => {
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
            {[0,1,2,3,4].map(i => {
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

        {/* Player info overlay */}
        <div id="player-info-overlay" className="info-overlay">
          <span className="io-label">SPIELER</span>
          <span className="io-lp" id="player-lp">{player.lp}</span>
          <div className="io-bar-bg"><div id="player-lp-bar" className="lp-bar" style={{ width: lpPct(player.lp) }}></div></div>
          <span className="io-deck">Deck: <span id="player-deck-count">{player.deck?.length ?? 0}</span></span>
        </div>

      </div>{/* end #field */}

      {/* Hand */}
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

      {/* Action bar */}
      <div id="action-bar" role="toolbar" aria-label="Spielsteuerung">
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            id="btn-main-to-battle"
            className="phase-btn"
            disabled={!canGoToBattle}
            onClick={advancePhase}
            aria-label="Zur Kampfphase wechseln (B)"
          >⚔ Kampfphase</button>
          <button
            id="btn-battle-to-end"
            className="phase-btn"
            disabled={!canGoToEnd}
            onClick={advancePhase}
            aria-label="Zur Endphase wechseln (E)"
          >→ Endphase</button>
          <button
            id="btn-end-turn"
            className="phase-btn btn-end-turn"
            disabled={!canEndTurn}
            onClick={endTurn}
            aria-label="Zug beenden (T)"
          >⏭ Zug Beenden</button>
        </div>
        <div id="action-hint" role="status" aria-live="polite">{sel.hint}</div>
        <button
          id="btn-card-list-game"
          className="btn-small"
          aria-label="Alle Karten anzeigen"
          onClick={() => openModal({ type: 'card-list' })}
        >📖 Karten</button>
        <button
          id="btn-download-log"
          className="btn-small btn-log"
          aria-label="Debug-Log herunterladen"
          onClick={() => (window as any).AetherialClash?.downloadLog?.('manuell')}
        >💾 Log</button>
      </div>

      {/* Battle log */}
      <div id="battle-log">
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
