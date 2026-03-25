import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../../contexts/GameContext.js';
import { useModal }     from '../../contexts/ModalContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { FieldCardComponent }     from '../../components/FieldCardComponent.js';
import { FieldSpellTrapComponent } from '../../components/FieldSpellTrapComponent.js';
import { CardType }               from '../../../types.js';

const FIELD_ZONES = [0, 1, 2, 3, 4] as const;

interface Props {
  showDirect:    boolean;
  setShowDirect: (v: boolean) => void;
}

export function PlayerField({ showDirect, setShowDirect }: Props) {
  const { gameState, gameRef } = useGame();
  const { openModal }          = useModal();
  const { sel, setSel, resetSel } = useSelection();

  if (!gameState) return null;

  const player   = gameState.player;
  const opp      = gameState.opponent;
  const phase    = gameState.phase;
  const isMyTurn = gameState.activePlayer === 'player';
  const selMode  = sel.mode;
  const { t } = useTranslation();

  function isPlayerMonsterInteractive(zone: number) {
    if (!player.field.monsters[zone]) return false;
    if (!isMyTurn || phase === 'battle') return false;
    return phase === 'main';
  }

  function playerMonsterCanAttack(zone: number) {
    const fc = player.field.monsters[zone];
    if (!fc) return false;
    if (!isMyTurn || phase !== 'battle') return false;
    return !fc.hasAttacked && (fc.position === 'atk' || fc.faceDown) && !fc.summonedThisTurn;
  }

  function isPlayerSpellTrapInteractive(zone: number) {
    const fst = player.field.spellTraps[zone];
    if (!fst) return false;
    return isMyTurn && phase === 'main' && fst.faceDown && fst.card.type === CardType.Spell;
  }

  function isPlayerMonsterSpellTarget(zone: number) {
    return selMode === 'spell-target' && !!player.field.monsters[zone];
  }

  const onOwnFieldCardClick = useCallback((fc: any, zone: number) => {
    const game = gameRef.current;
    if (!game || !isMyTurn || phase !== 'main') return;
    openModal({ type: 'card-action', card: fc.card, index: zone, state: gameState, source: 'field' });
  }, [gameRef, isMyTurn, phase, openModal, gameState]);

  const onAttackerSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || !isMyTurn || phase !== 'battle') return;
    const fc = player.field.monsters[zone];
    if (!fc || fc.hasAttacked || fc.position !== 'atk' || fc.summonedThisTurn) return;
    resetSel();
    const oppHasMonsters = opp.field.monsters.some((m: any) => m !== null);
    setSel({ mode: 'attack', attackerZone: zone, hint: t('game.hint_selected', { name: fc.card.name }) });
    setShowDirect(!oppHasMonsters || fc.canDirectAttack);
  }, [gameRef, isMyTurn, phase, player.field.monsters, opp.field.monsters, resetSel, setSel, setShowDirect]);

  const onSpellTargetSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || selMode !== 'spell-target') return;
    const target = player.field.monsters[zone];
    if (!target) return;
    game.activateSpell('player', sel.spellHandIndex, target);
    resetSel();
  }, [gameRef, selMode, player.field.monsters, sel.spellHandIndex, resetSel]);

  const onFieldSpellTrapClick = useCallback((zone: number, fst: any) => {
    const game = gameRef.current;
    if (!game || !isMyTurn || phase !== 'main' || !fst.faceDown) return;
    if (fst.card.type === CardType.Spell) {
      if (fst.card.spellType !== 'targeted' && fst.card.spellType !== 'fromGrave') {
        game.activateSpellFromField('player', zone);
      }
    }
  }, [gameRef, isMyTurn, phase]);

  return (
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
          const fst      = player.field.spellTraps[i];
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
  );
}
