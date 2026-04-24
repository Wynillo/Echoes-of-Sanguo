import { useCallback } from 'react';
import { useGame }      from '../../contexts/GameContext';
import { useModal }     from '../../contexts/ModalContext';
import { useSelection } from '../../contexts/SelectionContext';
import { FieldCardComponent }     from '../../components/FieldCardComponent';
import { FieldSpellTrapComponent } from '../../components/FieldSpellTrapComponent';
import { meetsEquipRequirement }  from '../../../types';
import { FIELD_RULES } from '../../../rules';
import type { FieldCard } from '../../../field';
import type { FieldSpellTrap } from '../../../field';

const FIELD_ZONES = Array.from({ length: FIELD_RULES.MONSTER_ZONES_PER_PLAYER }, (_, i) => i);

export function OpponentField() {
  const { gameState, gameRef } = useGame();
  const { openModal }          = useModal();
  const { sel, resetSel }      = useSelection();

  if (!gameState) return null;

  const opp     = gameState.opponent;
  const selMode = sel.mode;

  function isOppMonsterTargetable(zone: number) {
    if (!opp.field.monsters[zone]) return false;
    if (selMode === 'equip-target') {
      const fc = opp.field.monsters[zone];
      return !!fc && !fc.faceDown && meetsEquipRequirement(sel.equipCard!, fc.card);
    }
    return selMode === 'attack' || selMode === 'trap-target';
  }

  /** Face-up opponent monsters are viewable when not in a targeting mode */
  function isOppMonsterViewable(zone: number) {
    const fc = opp.field.monsters[zone];
    if (!fc || fc.faceDown) return false;
    return selMode === null;
  }

  const onDefenderSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || selMode !== 'attack' || sel.attackerZone === null) return;
    game.attack('player', sel.attackerZone, zone);
    resetSel();
  }, [gameRef, selMode, sel.attackerZone, resetSel]);

  const onTrapTargetSelect = useCallback((fc: FieldCard) => {
    const game = gameRef.current;
    if (!game || selMode !== 'trap-target') return;
    if (sel.spellHandIndex !== null) {
      game.activateSpell('player', sel.spellHandIndex, fc);
      resetSel();
    }
  }, [gameRef, selMode, sel.spellHandIndex, resetSel]);

  const onEquipTargetSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || selMode !== 'equip-target' || sel.equipHandIndex === null) return;
    game.equipCard('player', sel.equipHandIndex, 'opponent', zone);
    resetSel();
  }, [gameRef, selMode, sel.equipHandIndex, resetSel]);

  const onOppMonsterView = useCallback((fc: FieldCard) => {
    openModal({ type: 'card-detail', card: fc.card, fc });
  }, [openModal]);

  /** Face-up opponent spell/traps are viewable */
  const onOppSpellTrapView = useCallback((fst: FieldSpellTrap) => {
    openModal({ type: 'card-detail', card: fst.card });
  }, [openModal]);

  return (
    <div className="field-side opponent-side">
      <div id="opp-spelltrap-zone" className="spell-trap-zone zone-row">
        {FIELD_ZONES.map(i => {
          const fst = opp.field.spellTraps[i];
          return (
            <div key={i} className="zone-slot" data-zone={i}>
              {!fst && <div className="zone-label" title="Spell/Trap Zone">Z/F</div>}
              {fst && (
                <FieldSpellTrapComponent
                  fst={fst} owner="opponent" zone={i} interactive={false}
                  onDetail={() => onOppSpellTrapView(fst)}
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
          const viewable   = isOppMonsterViewable(i);
          return (
            <div key={i} className={`zone-slot${targetable ? ' targetable' : ''}`} data-zone={i}>
              {!fc && <div className="zone-label" title="Monster Zone">M</div>}
              {fc && (
                <FieldCardComponent
                  fc={fc} owner="opponent" zone={i}
                  selected={false} targetable={targetable}
                  interactive={false} canAttack={false}
                  viewable={viewable}
                  onViewClick={() => onOppMonsterView(fc)}
                  onDefenderClick={() => {
                    if (selMode === 'attack')           onDefenderSelect(i);
                    else if (selMode === 'trap-target') onTrapTargetSelect(fc);
                    else if (selMode === 'equip-target') onEquipTargetSelect(i);
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
