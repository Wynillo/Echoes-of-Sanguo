import { useGame }      from '../contexts/GameContext.js';
import { useModal }     from '../contexts/ModalContext.js';
import { useSelection } from '../contexts/SelectionContext.js';
import { ATTR }         from '../../cards.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'card-action' }>; }

export function CardActionMenu({ modal }: Props) {
  const { card, index, state } = modal;
  const { gameRef }           = useGame();
  const { openModal, closeModal } = useModal();
  const { setSel }            = useSelection();

  const game  = gameRef.current;
  const phase = state.phase;
  const isMon = ['normal','effect','fusion'].includes(card.type);
  const isSp  = card.type === 'spell';
  const isTr  = card.type === 'trap';

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

  if (isMon && phase === 'main') {
    if (state.player.normalSummonUsed) {
      actions.push(btn('⛔ Monster bereits gespielt', null, true));
    } else {
      if (freeZone !== -1) {
        actions.push(btn('⚔ Beschwören (ATK)', () => { game.summonMonster('player', index, freeZone, 'atk'); closeModal(); }));
        actions.push(btn('🛡 Als Verteidigung setzen', () => { game.summonMonster('player', index, freeZone, 'def'); closeModal(); }));
      }
    }
    if (fusionOpts.length > 0 && !state.player.normalSummonUsed) {
      actions.push(btn('✨ Fusion wählen', () => {
        setSel({ mode: 'fusion1', fusion1: { handIndex: index }, hint: 'Wähle die zweite Fusionskarte aus der Hand.' });
        closeModal();
      }));
    }
  }

  if (isSp && phase === 'main') {
    actions.push(btn('✦ Aktivieren', () => {
      if (card.spellType === 'targeted' || card.spellType === 'fromGrave') {
        startSpellTargeting(card, index, state, game, setSel, openModal, closeModal);
      } else {
        game.activateSpell('player', index);
      }
      closeModal();
    }));
    actions.push(btn('🔽 Setzen', () => {
      const zone = state.player.field.spellTraps.findIndex((z: any) => z === null);
      if (zone !== -1) game.setSpellTrap('player', index, zone);
      closeModal();
    }));
  }

  if (isTr && (phase === 'main' || phase === 'battle')) {
    if (phase === 'main') {
      actions.push(btn('🔽 Fallen setzen', () => {
        const zone = state.player.field.spellTraps.findIndex((z: any) => z === null);
        if (zone !== -1) game.setSpellTrap('player', index, zone);
        closeModal();
      }));
    }
    if (phase === 'battle' && card.trapTrigger === 'manual') {
      actions.push(btn('⚠ Falle aktivieren', () => {
        startTrapTargeting(card, index, state, game, setSel, closeModal);
        closeModal();
      }));
    }
  }

  actions.push(btn('🔍 Ansehen', () => openModal({ type: 'card-detail', card })));

  return (
    <div id="card-action-menu" className="modal" role="dialog" aria-modal="true">
      <h3>{card.name}</h3>
      <div id="action-buttons">{actions}</div>
      <button className="btn-cancel" onClick={closeModal}>✕ Abbrechen</button>
    </div>
  );
}

// ── Targeting helpers ──────────────────────────────────────

function startSpellTargeting(card: any, handIndex: number, state: any, game: any, setSel: any, openModal: any, close: any) {
  if (card.spellType === 'targeted' && card.target === 'ownMonster') {
    const targets = state.player.field.monsters
      .map((fc: any, i: number) => ({ fc, zone: i }))
      .filter(({ fc }: any) => fc);
    if (!targets.length) return;
    if (targets.length === 1) { game.activateSpell('player', handIndex, targets[0].fc); return; }
    setSel({ mode: 'spell-target', spellHandIndex: handIndex, spellCard: card, hint: 'Wähle ein eigenes Monster als Ziel.' });
  } else if (card.spellType === 'targeted' && card.target === 'ownDarkMonster') {
    const fc = state.player.field.monsters.find((m: any) => m && m.card.attribute === ATTR.DARK);
    if (fc) game.activateSpell('player', handIndex, fc);
  } else if (card.spellType === 'fromGrave') {
    const monsters = state.player.graveyard.filter((c: any) => ['normal','effect','fusion'].includes(c.type));
    if (!monsters.length) return;
    openModal({ type: 'grave-select', cards: monsters, resolve: (chosen: any) => game.activateSpell('player', handIndex, chosen) });
  }
}

function startTrapTargeting(card: any, handIndex: number, state: any, game: any, setSel: any, close: any) {
  if (card.target === 'oppMonster') {
    setSel({ mode: 'trap-target', spellHandIndex: handIndex, spellCard: card, hint: 'Wähle ein Monster des Gegners als Ziel.' });
  }
}
