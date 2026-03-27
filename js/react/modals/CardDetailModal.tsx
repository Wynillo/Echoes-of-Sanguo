import { useTranslation } from 'react-i18next';
import { useModal }  from '../contexts/ModalContext.js';
import { useGame }   from '../contexts/GameContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { Card }       from '../components/Card.js';
import { highlightCardText } from '../utils/highlightCardText.js';
import { CardType, Attribute, isMonsterType, meetsEquipRequirement } from '../../types.js';
import { getAttrById } from '../../type-metadata.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'card-detail' }>; }

export function CardDetailModal({ modal }: Props) {
  const { card, fc, index, state, source, onDeckAction } = modal;
  const { closeModal, openModal } = useModal();
  const { gameRef }           = useGame();
  const { setSel }            = useSelection();
  const { t } = useTranslation();

  const game = gameRef.current;

  const attrName = card.attribute ? (getAttrById(card.attribute)?.value ?? '') : '';
  const typeLabels: Record<number, string> = {
    [CardType.Monster]:   card.effect ? t('card_detail.type_effect') : t('card_detail.type_normal'),
    [CardType.Fusion]:    t('card_detail.type_fusion'),
    [CardType.Spell]:     t('card_detail.type_spell'),
    [CardType.Trap]:      t('card_detail.type_trap'),
    [CardType.Equipment]: t('card_detail.type_equipment', 'Equipment'),
  };
  const typeLabel = typeLabels[card.type] || '';
  const isMonLevel = card.type === CardType.Monster || card.type === CardType.Fusion;
  const levelStr = isMonLevel && card.level ? ` · ${t('card_detail.level_prefix')} ${card.level}` : '';

  let statsText = '';
  if (card.type === CardType.Equipment) {
    const parts: string[] = [];
    if (card.atkBonus) parts.push(`ATK ${card.atkBonus >= 0 ? '+' : ''}${card.atkBonus}`);
    if (card.defBonus) parts.push(`DEF ${card.defBonus >= 0 ? '+' : ''}${card.defBonus}`);
    statsText = parts.join('  ');
  } else if (card.atk !== undefined) {
    statsText = `ATK: ${fc ? fc.effectiveATK() : card.atk}  DEF: ${fc ? fc.effectiveDEF() : card.def}`;
    if (fc && (fc.permATKBonus || fc.tempATKBonus)) statsText += t('card_detail.atk_bonus');
  }

  // ── Action buttons (only when action context is provided) ──
  const actions: React.ReactNode[] = [];

  if (state && index !== undefined && game) {
    const phase = state.phase;
    const isMon = isMonsterType(card.type);
    const isSp  = card.type === CardType.Spell;
    const isTr  = card.type === CardType.Trap;
    const freeZone = state.player.field.monsters.findIndex((z: any) => z === null);

    if (isMon && phase === 'main' && source === 'field') {
      const fieldCard = state.player.field.monsters[index];
      if (fieldCard && fieldCard.faceDown && !fieldCard.summonedThisTurn) {
        actions.push(actionBtn(t('card_action.flip_summon'), () => { game.flipSummon('player', index); closeModal(); }));
      }
      if (fieldCard && !fieldCard.faceDown && !fieldCard.summonedThisTurn) {
        const label = fieldCard.position === 'atk' ? t('card_action.change_to_def') : t('card_action.change_to_atk');
        actions.push(actionBtn(label, () => { game.changePosition('player', index); closeModal(); }));
      }
    } else if (isMon && phase === 'main') {
      if (state.player.normalSummonUsed) {
        actions.push(actionBtn(t('card_action.already_played'), null, true));
      } else if (freeZone !== -1) {
        actions.push(actionBtn(t('card_action.play'), () => {
          game.performFusionChain('player', [index]);
          closeModal();
        }));
        actions.push(actionBtn(t('card_action.set_def'), () => { game.setMonster('player', index, freeZone); closeModal(); }));
      }
    }

    if (isSp && phase === 'main' && source === 'field-spell') {
      if (card.spellType === 'targeted' || card.spellType === 'fromGrave') {
        actions.push(actionBtn(t('card_action.activate'), () => {
          startFieldSpellTargeting(card, index, state, game, setSel, openModal, closeModal, t);
        }));
      } else {
        actions.push(actionBtn(t('card_action.activate'), () => {
          game.activateSpellFromField('player', index);
          closeModal();
        }));
      }
    } else if (isSp && card.spellType === 'field' && phase === 'main') {
      actions.push(actionBtn(t('card_action.activate_field_spell', 'Activate Field Spell'), () => {
        game.activateFieldSpell('player', index);
        closeModal();
      }));
    } else if (isSp && phase === 'main') {
      actions.push(actionBtn(t('card_action.activate'), () => {
        if (card.spellType === 'targeted' || card.spellType === 'fromGrave') {
          startSpellTargeting(card, index, state, game, setSel, openModal, closeModal, t);
        } else {
          game.activateSpell('player', index);
        }
        closeModal();
      }));
      actions.push(actionBtn(t('card_action.set_spell'), () => {
        const zone = state.player.field.spellTraps.findIndex((z: any) => z === null);
        if (zone !== -1) game.setSpellTrap('player', index, zone);
        closeModal();
      }));
    }

    const isEq = card.type === CardType.Equipment;
    if (isEq && phase === 'main' && source !== 'field-spell') {
      // Check if any face-up monster exists that meets equipment requirements
      const hasTarget = state.player.field.monsters.some((m: any) => m && !m.faceDown && meetsEquipRequirement(card, m.card))
                     || state.opponent.field.monsters.some((m: any) => m && !m.faceDown && meetsEquipRequirement(card, m.card));
      const freeSTZone = state.player.field.spellTraps.findIndex((z: any) => z === null);
      if (hasTarget && freeSTZone !== -1) {
        actions.push(actionBtn(t('card_action.equip', 'Equip'), () => {
          setSel({ mode: 'equip-target', equipHandIndex: index, equipCard: card, hint: t('card_action.hint_equip', 'Select a monster to equip') });
          closeModal();
        }));
      }
      if (freeSTZone !== -1) {
        actions.push(actionBtn(t('card_action.set_equipment', 'Set'), () => {
          game.setSpellTrap('player', index, freeSTZone);
          closeModal();
        }));
      }
    }

    if (isTr && (phase === 'main' || phase === 'battle')) {
      if (phase === 'main') {
        actions.push(actionBtn(t('card_action.set_trap'), () => {
          const zone = state.player.field.spellTraps.findIndex((z: any) => z === null);
          if (zone !== -1) game.setSpellTrap('player', index, zone);
          closeModal();
        }));
      }
      if (phase === 'battle' && card.trapTrigger === 'manual') {
        actions.push(actionBtn(t('card_action.activate_trap'), () => {
          startTrapTargeting(card, index, state, game, setSel, closeModal, t);
          closeModal();
        }));
      }
    }
  }

  // Deckbuilder action buttons
  if (source === 'deckbuilder-collection' && onDeckAction) {
    actions.push(actionBtn(t('deckbuilder.add_to_deck'), () => {
      onDeckAction('add');
      closeModal();
    }));
  }
  if (source === 'deckbuilder-deck' && onDeckAction) {
    actions.push(actionBtn(t('deckbuilder.remove_from_deck'), () => {
      onDeckAction('remove');
      closeModal();
    }));
  }

  return (
    <div id="card-detail-modal" className="modal" role="dialog" aria-modal="true">
      <div className="detail-layout">
        <Card card={card} fc={fc} big />
        <div className="detail-info">
          <h2 id="detail-card-name">{card.name}</h2>
          <p className="detail-type">{[attrName, typeLabel].filter(Boolean).join(' · ')}{levelStr}</p>
          <p className="detail-desc">{card.description ? highlightCardText(card.description) : ''}</p>
          <p className="detail-stats">{statsText}</p>
        </div>
      </div>
      {actions.length > 0 && <div id="action-buttons">{actions}</div>}
      <button className="btn-cancel" onClick={closeModal}>{t('card_detail.close')}</button>
    </div>
  );
}

function actionBtn(label: string, handler: (() => void) | null, disabled = false) {
  return (
    <button
      key={label}
      className="menu-action-btn"
      disabled={disabled}
      style={disabled ? { opacity: 0.45, cursor: 'default' } : undefined}
      onClick={handler ?? undefined}
    >
      {label}
    </button>
  );
}

// ── Targeting helpers ──────────────────────────────────────

function startSpellTargeting(card: any, handIndex: number, state: any, game: any, setSel: any, openModal: any, close: any, t: any) {
  if (card.spellType === 'targeted' && card.target === 'ownMonster') {
    const targets = state.player.field.monsters
      .map((fc: any, i: number) => ({ fc, zone: i }))
      .filter(({ fc }: any) => fc);
    if (!targets.length) return;
    if (targets.length === 1) { game.activateSpell('player', handIndex, targets[0].fc); return; }
    setSel({ mode: 'spell-target', spellHandIndex: handIndex, spellCard: card, hint: t('card_action.hint_spell_own') });
  } else if (card.spellType === 'targeted' && card.target === 'ownDarkMonster') {
    const fc = state.player.field.monsters.find((m: any) => m && m.card.attribute === Attribute.Dark);
    if (fc) game.activateSpell('player', handIndex, fc);
  } else if (card.spellType === 'fromGrave') {
    const monsters = state.player.graveyard.filter((c: any) => isMonsterType(c.type));
    if (!monsters.length) return;
    openModal({ type: 'grave-select', cards: monsters, resolve: (chosen: any) => game.activateSpell('player', handIndex, chosen) });
  }
}

function startFieldSpellTargeting(card: any, zone: number, state: any, game: any, setSel: any, openModal: any, close: any, t: any) {
  if (card.spellType === 'targeted' && card.target === 'ownMonster') {
    const targets = state.player.field.monsters
      .map((fc: any, i: number) => ({ fc, zone: i }))
      .filter(({ fc }: any) => fc);
    if (!targets.length) return;
    if (targets.length === 1) { game.activateSpellFromField('player', zone, targets[0].fc); close(); return; }
    setSel({ mode: 'field-spell-target', spellFieldZone: zone, spellCard: card, hint: t('card_action.hint_spell_own') });
    close();
  } else if (card.spellType === 'targeted' && card.target === 'ownDarkMonster') {
    const fc = state.player.field.monsters.find((m: any) => m && m.card.attribute === Attribute.Dark);
    if (fc) { game.activateSpellFromField('player', zone, fc); close(); }
  } else if (card.spellType === 'fromGrave') {
    const monsters = state.player.graveyard.filter((c: any) => isMonsterType(c.type));
    if (!monsters.length) return;
    openModal({ type: 'grave-select', cards: monsters, resolve: (chosen: any) => game.activateSpellFromField('player', zone, chosen) });
  }
}

function startTrapTargeting(card: any, handIndex: number, state: any, game: any, setSel: any, close: any, t: any) {
  if (card.target === 'oppMonster') {
    setSel({ mode: 'trap-target', spellHandIndex: handIndex, spellCard: card, hint: t('card_action.hint_trap_opp') });
  }
}
