import { useTranslation } from 'react-i18next';
import { useModal }  from '../contexts/ModalContext.js';
import { Card }       from '../components/Card.js';
import { CARD_DB }    from '../../cards.js';
import type { ModalState } from '../contexts/ModalContext.js';

interface Props { modal: Extract<ModalState, { type: 'trap-prompt' }>; }

export function TrapPromptModal({ modal }: Props) {
  const { opts, resolve } = modal;
  const { closeModal }   = useModal();
  const { t }            = useTranslation();
  const card             = CARD_DB[opts.cardId];
  const bc               = opts.battleContext;

  function answer(val: boolean) { closeModal(); resolve(val); }

  // Build context line describing the battle situation
  let contextLine: string | null = null;
  if (bc) {
    if (bc.triggerType === 'onOwnMonsterAttacked' && bc.attackerName && bc.defenderName) {
      const defStat = bc.defenderPos === 'def' ? 'DEF' : 'ATK';
      const defVal  = bc.defenderPos === 'def' ? bc.defenderDef : bc.defenderAtk;
      contextLine = t('game.trap_ctx_attacks_monster', {
        attacker: bc.attackerName, atk: bc.attackerAtk,
        defender: bc.defenderName, stat: defStat, val: defVal,
      });
    } else if (bc.triggerType === 'onAttack' && bc.attackerName) {
      contextLine = t('game.trap_ctx_attacks', {
        attacker: bc.attackerName, atk: bc.attackerAtk,
      });
    } else if (bc.triggerType === 'onOpponentSummon' && bc.attackerName) {
      contextLine = t('game.trap_ctx_summon', {
        name: bc.attackerName, atk: bc.attackerAtk, def: bc.defenderDef ?? 0,
      });
    }
  }

  const attackerCard = bc?.attackerCardId != null ? CARD_DB[bc.attackerCardId] : null;
  const defenderCard = bc?.defenderCardId != null ? CARD_DB[bc.defenderCardId] : null;

  return (
    <div id="trap-prompt-modal" className="modal" role="dialog" aria-modal="true">
      <h3 id="trap-prompt-title">{opts.title}</h3>
      {contextLine && (
        <div className="trap-battle-context">{contextLine}</div>
      )}
      {(attackerCard || defenderCard) && (
        <div className="trap-battle-cards">
          {attackerCard && (
            <div className="trap-battle-card">
              <Card card={attackerCard} small />
            </div>
          )}
          <span className="trap-battle-vs">&#x2694;</span>
          {defenderCard && (
            <div className="trap-battle-card">
              <Card card={defenderCard} small />
            </div>
          )}
        </div>
      )}
      <div id="trap-prompt-card" style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
        {card && <Card card={card} />}
      </div>
      <p id="trap-prompt-msg">{opts.message}</p>
      <div className="prompt-buttons">
        <button className="btn-primary"   onClick={() => answer(true)}>{opts.yes}</button>
        <button className="btn-secondary" onClick={() => answer(false)}>{opts.no}</button>
      </div>
    </div>
  );
}
