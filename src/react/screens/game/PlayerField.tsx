import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame }      from '../../contexts/GameContext.js';
import { useModal }     from '../../contexts/ModalContext.js';
import { useSelection } from '../../contexts/SelectionContext.js';
import { FieldCardComponent }     from '../../components/FieldCardComponent.js';
import { FieldSpellTrapComponent } from '../../components/FieldSpellTrapComponent.js';
import { CardType, meetsEquipRequirement } from '../../../types.js';
import { checkFusion, CARD_DB } from '../../../cards.js';
import { FIELD_RULES } from '../../../rules.js';
import type { FieldCard } from '../../../field.js';
import type { FieldSpellTrap } from '../../../field.js';

const FIELD_ZONES = Array.from({ length: FIELD_RULES.MONSTER_ZONES_PER_PLAYER }, (_, i) => i);

interface PlayerFieldProps {
  showDirect:    boolean;
  setShowDirect: (v: boolean) => void;
}

export function PlayerField({ showDirect, setShowDirect }: PlayerFieldProps) {
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
    if (selMode === 'spell-target' || selMode === 'field-spell-target' || selMode === 'equip-target' || selMode === 'place-monster' || selMode === 'place-spell') return false;
    return phase === 'main';
  }

  function playerMonsterCanAttack(zone: number) {
    const fc = player.field.monsters[zone];
    if (!fc) return false;
    if (!isMyTurn || phase !== 'battle') return false;
    return !fc.hasAttacked && (fc.position === 'atk' || fc.faceDown);
  }

  function isPlayerSpellTrapInteractive(zone: number) {
    const fst = player.field.spellTraps[zone];
    if (!fst) return false;
    if (!isMyTurn) return false;
    if (phase === 'main' && fst.faceDown && fst.card.type === CardType.Spell) return true;
    if (phase === 'battle' && fst.faceDown) return true;
    return false;
  }

  function isPlayerMonsterViewable(zone: number) {
    const fc = player.field.monsters[zone];
    if (!fc) return false;
    return selMode === null && !isPlayerMonsterInteractive(zone) && !playerMonsterCanAttack(zone);
  }

  function isPlayerMonsterSpellTarget(zone: number) {
    return (selMode === 'spell-target' || selMode === 'field-spell-target') && !!player.field.monsters[zone];
  }

  function isPlayerMonsterEquipTarget(zone: number) {
    const fc = player.field.monsters[zone];
    return selMode === 'equip-target' && !!fc && !fc.faceDown
      && meetsEquipRequirement(sel.equipCard!, fc.card);
  }

  function isMonsterZonePlaceable(zone: number) {
    if (selMode !== 'place-monster') return false;
    if (sel.placeFaceDown) return !player.field.monsters[zone];
    return true;
  }

  function isSpellZonePlaceable(_zone: number) {
    return selMode === 'place-spell';
  }

  const onMonsterZoneSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || selMode !== 'place-monster') return;
    const handIndex = sel.placeHandIndex;
    if (handIndex === null || handIndex === undefined) return;

    const fc = player.field.monsters[zone];
    if (!fc) {
      if (sel.placeFaceDown) {
        game.setMonster('player', handIndex, zone);
      } else {
        game.summonMonster('player', handIndex, zone, sel.placePosition ?? 'atk');
      }
      resetSel();
      return;
    }

    if (sel.placeFaceDown) return;

    const handCard = player.hand[handIndex];
    if (!handCard) { resetSel(); return; }

    const recipe = checkFusion(handCard.id, fc.card.id);
    if (!recipe) {
      setSel({ hint: t('card_action.no_fusion', 'These cards cannot fuse.') });
      return;
    }

    const resultCard = CARD_DB[recipe.result];
    if (!resultCard) { resetSel(); return; }

    openModal({
      type: 'fusion-confirm',
      handCard,
      fieldCard: fc.card,
      resultCard,
      onConfirm: () => {
        game.fuseHandWithField('player', handIndex, zone);
        resetSel();
      },
    });
  }, [gameRef, selMode, sel.placeHandIndex, sel.placeFaceDown, sel.placePosition, player.field.monsters, player.hand, resetSel, setSel, openModal, t]);

  const onSpellZoneSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || selMode !== 'place-spell') return;
    const handIndex = sel.placeHandIndex;
    if (handIndex === null || handIndex === undefined) return;

    const fst = player.field.spellTraps[zone];
    if (!fst) {
      game.setSpellTrap('player', handIndex, zone);
    } else {
      game.replaceSpellTrap('player', handIndex, zone);
    }
    resetSel();
  }, [gameRef, selMode, sel.placeHandIndex, player.field.spellTraps, resetSel]);

  const onOwnFieldCardClick = useCallback((fc: FieldCard, zone: number) => {
    const game = gameRef.current;
    if (!game || !isMyTurn || phase !== 'main') return;
    openModal({ type: 'card-detail', card: fc.card, fc, index: zone, state: gameState, source: 'field' });
  }, [gameRef, isMyTurn, phase, openModal, gameState]);

  const onAttackerSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game || !isMyTurn || phase !== 'battle') return;
    const fc = player.field.monsters[zone];
    if (!fc || fc.hasAttacked || fc.position !== 'atk') return;
    resetSel();
    const oppHasMonsters = opp.field.monsters.some(m => m !== null);
    setSel({ mode: 'attack', attackerZone: zone, hint: t('game.hint_selected', { name: fc.card.name }) });
    setShowDirect(!oppHasMonsters || fc.canDirectAttack);
  }, [gameRef, isMyTurn, phase, player.field.monsters, opp.field.monsters, resetSel, setSel, setShowDirect]);

  const onSpellTargetSelect = useCallback((zone: number) => {
    const game = gameRef.current;
    if (!game) return;
    const target = player.field.monsters[zone];
    if (!target) return;
    if (selMode === 'spell-target') {
      game.activateSpell('player', sel.spellHandIndex!, target);
    } else if (selMode === 'field-spell-target') {
      game.activateSpellFromField('player', sel.spellFieldZone!, target);
    } else if (selMode === 'equip-target') {
      game.equipCard('player', sel.equipHandIndex!, 'player', zone);
    } else {
      return;
    }
    resetSel();
  }, [gameRef, selMode, player.field.monsters, sel.spellHandIndex, sel.spellFieldZone, sel.equipHandIndex, resetSel]);

  const onFieldSpellTrapClick = useCallback((zone: number, fst: FieldSpellTrap) => {
    const game = gameRef.current;
    if (!game || !isMyTurn || !fst.faceDown) return;
    if (phase === 'main' && fst.card.type === CardType.Spell) {
      openModal({ type: 'card-detail', card: fst.card, index: zone, state: gameState, source: 'field-spell' });
    }
    if (phase === 'battle') {
      openModal({ type: 'card-detail', card: fst.card, index: zone, state: gameState, source: 'field-spell' });
    }
  }, [gameRef, isMyTurn, phase, openModal, gameState]);

  return (
    <div className="field-side player-side">
      <div id="player-monster-zone" className="monster-zone zone-row">
        {FIELD_ZONES.map(i => {
          const fc        = player.field.monsters[i];
          const selected  = selMode === 'attack' && sel.attackerZone === i;
          const canAtk    = playerMonsterCanAttack(i);
          const interact  = isPlayerMonsterInteractive(i);
          const placeable  = isMonsterZonePlaceable(i);
          const targetable = isPlayerMonsterSpellTarget(i) || isPlayerMonsterEquipTarget(i) || (placeable && !!fc);
          const viewable   = isPlayerMonsterViewable(i);
          return (
            <div key={i} className={`zone-slot${placeable && !fc ? ' placeable' : ''}`} data-zone={i}
              onClick={placeable && !fc ? () => onMonsterZoneSelect(i) : undefined}
            >
              {!fc && <div className="zone-label" title="Monster Zone">M</div>}
              {fc && (
                <FieldCardComponent
                  fc={fc} owner="player" zone={i}
                  selected={selected} targetable={targetable}
                  interactive={interact} canAttack={canAtk}
                  viewable={viewable}
                  onOwnClick={() => onOwnFieldCardClick(fc, i)}
                  onAttackerSelect={() => onAttackerSelect(i)}
                  onDefenderClick={placeable ? () => onMonsterZoneSelect(i) : () => onSpellTargetSelect(i)}
                  onViewClick={() => openModal({ type: 'card-detail', card: fc.card, fc })}
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
          const placeable = isSpellZonePlaceable(i);
          return (
            <div key={i} className={`zone-slot${placeable ? ' placeable' : ''}`} data-zone={i}
              onClick={placeable && !fst ? () => onSpellZoneSelect(i) : undefined}
            >
              {!fst && <div className="zone-label" title="Spell/Trap Zone">Z/F</div>}
              {fst && (
                <FieldSpellTrapComponent
                  fst={fst} owner="player" zone={i} interactive={placeable || interact}
                  onClick={placeable ? () => onSpellZoneSelect(i) : () => onFieldSpellTrapClick(i, fst)}
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
