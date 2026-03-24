import { useCallback } from 'react';
import { useGame }      from '../../contexts/GameContext.js';
import { useModal }     from '../../contexts/ModalContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { FieldCardComponent }     from '../../components/FieldCardComponent.js';
import { FieldSpellTrapComponent } from '../../components/FieldSpellTrapComponent.js';

const FIELD_ZONES = [0, 1, 2, 3, 4] as const;

export function OpponentField() {
  const { gameState, gameRef } = useGame();
  const { openModal }          = useModal();
  const { sel, resetSel }      = useSelection();

  if (!gameState) return null;

  const opp     = gameState.opponent;
  const selMode = sel.mode;

  function isOppMonsterTargetable(zone: number) {
    if (!opp.field.monsters[zone]) return false;
    return selMode === 'attack' || selMode === 'trap-target';
  }

  const onDefenderSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || selMode !== 'attack') return;
    game.attack('player', sel.attackerZone, zone);
    resetSel();
  }, [gameRef, selMode, sel.attackerZone, resetSel]);

  const onTrapTargetSelect = useCallback((fc: any) => {
    const game = gameRef.current;
    if (!game || selMode !== 'trap-target') return;
    if (sel.spellHandIndex !== null) {
      game.activateSpell('player', sel.spellHandIndex, fc);
      resetSel();
    }
  }, [gameRef, selMode, sel.spellHandIndex, resetSel]);

  return (
    <div className="field-side opponent-side">
      <div id="opp-spelltrap-zone" className="spell-trap-zone zone-row">
        {FIELD_ZONES.map(i => {
          const fst = opp.field.spellTraps[i];
          return (
            <div key={i} className="zone-slot" data-zone={i}>
              {!fst && <div className="zone-label">Z/F</div>}
              {fst && (
                <FieldSpellTrapComponent
                  fst={fst} owner="opponent" zone={i} interactive={false}
                />
              )}
            </div>
          );
        })}
      </div>

      <div id="opponent-monster-zone" className="monster-zone zone-row">
        {FIELD_ZONES.map(i => {
          const fc         = opp.field.monsters[i];
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
                    if (selMode === 'attack')      onDefenderSelect(i);
                    else if (selMode === 'trap-target') onTrapTargetSelect(fc);
                  }}
                  onDetail={() => openModal({ type: 'card-detail', card: fc.card, fc })}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
