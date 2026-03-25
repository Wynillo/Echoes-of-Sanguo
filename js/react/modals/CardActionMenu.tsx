import { useTranslation } from 'react-i18next';
import { useGame }      from '../contexts/GameContext.js';
import { useModal }     from '../contexts/ModalContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { CardType, Attribute, isMonsterType } from '../../types.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'card-action' }>; }

export function CardActionMenu({ modal }: Props) {
  const { card, index, state, source } = modal;
  const { gameRef }           = useGame();
  const { openModal, closeModal } = useModal();
  const { setSel }            = useSelection();
  const { t }                 = useTranslation();

  const game  = gameRef.current;
  const phase = state.phase;
  const isMon = isMonsterType(card.type);
  const isSp  = card.type === CardType.Spell;
  const isTr  = card.type === CardType.Trap;

  const freeZone   = state.player.field.monsters.findIndex((z: any) => z === null);
  const fusionOpts = game ? game.getAllFusionOptions('player').filter((o: any) => o.i1 === index || o.i2 === index) : [];

  function btn(label: string, handler: (() => void) | null, disabled = false) {
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

  const actions: React.ReactNode[] = [];

  if (isMon && phase === 'main' && source === 'field') {
    // Field monster actions
    const fc = state.player.field.monsters[index];
    if (fc && fc.faceDown && !fc.summonedThisTurn) {
      actions.push(btn(t('card_action.flip_summon'), () => { game.flipSummon('player', index); closeModal(); }));
    }
  } else if (isMon && phase === 'main') {
    // Hand monster actions
    if (state.player.normalSummonUsed) {
      actions.push(btn(t('card_action.already_played'), null, true));
    } else {
      if (freeZone !== -1) {
        actions.push(btn(t('card_action.summon_atk'), () => { game.summonMonster('player', index, freeZone, 'atk'); closeModal(); }));
        actions.push(btn(t('card_action.summon_def'), () => { game.summonMonster('player', index, freeZone, 'def'); closeModal(); }));
        actions.push(btn(t('card_action.set_atk'), () => { game.summonMonster('player', index, freeZone, 'atk', true); closeModal(); }));
      }
    }
    if (fusionOpts.length > 0 && !state.player.normalSummonUsed) {
      actions.push(btn(t('card_action.fusion'), () => {
        setSel({ mode: 'fusion1', fusion1: { handIndex: index }, hint: t('card_action.hint_fusion') });
        closeModal();
      }));
    }
  }

  if (isSp && phase === 'main' && source === 'field-spell') {
    // Spell card already on the field — offer activate (non-targeted only for now)
    if (card.spellType !== 'targeted' && card.spellType !== 'fromGrave') {
      actions.push(btn(t('card_action.activate'), () => {
        game.activateSpellFromField('player', index);
        closeModal();
      }));
    }
  } else if (isSp && phase === 'main') {
    // Spell card in hand
    actions.push(btn(t('card_action.activate'), () => {
      if (card.spellType === 'targeted' || card.spellType === 'fromGrave') {
        startSpellTargeting(card, index, state, game, setSel, openModal, closeModal, t);
      } else {
        game.activateSpell('player', index);
      }
      closeModal();
    }));
    actions.push(btn(t('card_action.set_spell'), () => {
      const zone = state.player.field.spellTraps.findIndex((z: any) => z === null);
      if (zone !== -1) game.setSpellTrap('player', index, zone);
      closeModal();
    }));
  }

  if (isTr && (phase === 'main' || phase === 'battle')) {
    if (phase === 'main') {
      actions.push(btn(t('card_action.set_trap'), () => {
        const zone = state.player.field.spellTraps.findIndex((z: any) => z === null);
        if (zone !== -1) game.setSpellTrap('player', index, zone);
        closeModal();
      }));
    }
    if (phase === 'battle' && card.trapTrigger === 'manual') {
      actions.push(btn(t('card_action.activate_trap'), () => {
        startTrapTargeting(card, index, state, game, setSel, closeModal, t);
        closeModal();
      }));
    }
  }

  actions.push(btn(t('card_action.view'), () => openModal({ type: 'card-detail', card })));

  return (
    <div id="card-action-menu" className="modal" role="dialog" aria-modal="true">
      <h3>{card.name}</h3>
      <div id="action-buttons">{actions}</div>
      <button className="btn-cancel" onClick={closeModal}>{t('card_action.cancel')}</button>
    </div>
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

function startTrapTargeting(card: any, handIndex: number, state: any, game: any, setSel: any, close: any, t: any) {
  if (card.target === 'oppMonster') {
    setSel({ mode: 'trap-target', spellHandIndex: handIndex, spellCard: card, hint: t('card_action.hint_trap_opp') });
  }
}
