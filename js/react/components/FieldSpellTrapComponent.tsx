import { attachHover } from './hoverApi.js';
import { Card, TYPE_CSS } from './Card.js';
import { CardType } from '../../types.js';

interface Props {
  fst: any;
  owner: 'player' | 'opponent';
  zone: number;
  interactive: boolean;
  onClick?: () => void;
  onDetail?: () => void;
}

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

export function FieldSpellTrapComponent({ fst, owner, zone, interactive, onClick, onDetail }: Props) {
  const { card } = fst;
  const isPlayer = owner === 'player';

  let cls: string;
  if (fst.faceDown && !isPlayer) {
    cls = 'card field-card face-down st-facedown';
  } else if (fst.faceDown && isPlayer) {
    cls = 'card field-card face-down own-facedown attr-spell';
  } else {
    cls = `card field-card ${TYPE_CSS[card.type] || 'spell'}-card attr-spell`;
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
          {card.type === CardType.Trap ? '⚠ Falle' : '✦ Zauber'}
        </div>
      </div>
    );
  }

  return (
    <div className={cls} ref={attachRef}
         onContextMenu={!IS_TOUCH ? handleContextMenu : undefined}>
      <Card card={card} small />
    </div>
  );
}
