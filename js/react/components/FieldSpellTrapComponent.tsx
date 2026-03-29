import { useTranslation } from 'react-i18next';
import { attachHover } from './hoverApi.js';
import { Card, cardTypeCss } from './Card.js';
import { CardType } from '../../types.js';
import type { FieldSpellTrap } from '../../types.js';

interface Props {
  fst: FieldSpellTrap;
  owner: 'player' | 'opponent';
  zone: number;
  interactive: boolean;
  onClick?: () => void;
  onDetail?: () => void;
}

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

export function FieldSpellTrapComponent({ fst, owner, zone, interactive, onClick, onDetail }: Props) {
  const { t } = useTranslation();
  const { card } = fst;
  const isPlayer = owner === 'player';

  let cls: string;
  if (fst.faceDown && !isPlayer) {
    cls = 'card field-card face-down st-facedown';
  } else if (fst.faceDown && isPlayer) {
    const fdType = card.type === CardType.Trap ? 'facedown-trap' : card.type === CardType.Equipment ? 'facedown-equip' : 'facedown-spell';
    cls = `card field-card face-down own-facedown ${fdType}`;
  } else {
    cls = `card field-card ${cardTypeCss(card)}-card attr-spell`;
  }
  if (interactive) cls += ' interactive';

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (!fst.faceDown || isPlayer) onDetail?.();
  }

  function attachRef(el: HTMLDivElement | null) {
    if (el && (!fst.faceDown || isPlayer)) attachHover(el, card, null);
  }

  if (fst.faceDown && !isPlayer) {
    return (
      <div className={cls} ref={attachRef}>
        <div className="card-back-pattern"><span className="back-label">A</span></div>
      </div>
    );
  }

  if (fst.faceDown && isPlayer) {
    return (
      <div className={cls} ref={attachRef}
           onClick={interactive ? onClick : undefined}
           onContextMenu={!IS_TOUCH ? handleContextMenu : undefined}>
        <div className="facedown-overlay">
          {card.type === CardType.Trap ? t('card_action.facedown_trap') : card.type === CardType.Equipment ? t('card_action.facedown_equip') : t('card_action.facedown_spell')}
        </div>
      </div>
    );
  }

  return (
    <div className={cls} ref={attachRef}
         onClick={!interactive ? () => onDetail?.() : undefined}
         onContextMenu={!IS_TOUCH ? handleContextMenu : undefined}>
      <Card card={card} small />
    </div>
  );
}
