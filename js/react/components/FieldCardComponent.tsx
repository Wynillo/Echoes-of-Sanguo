import { attachHover } from './hoverApi.js';
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';

interface Props {
  fc: any;
  owner: 'player' | 'opponent';
  zone: number;
  selected: boolean;
  targetable: boolean;
  interactive: boolean;
  canAttack: boolean;
  onOwnClick?: () => void;
  onAttackerSelect?: () => void;
  onDefenderClick?: () => void;
  onDetail?: () => void;
}

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

export function FieldCardComponent({
  fc, owner, zone, selected, targetable, interactive, canAttack,
  onOwnClick, onAttackerSelect, onDefenderClick, onDetail,
}: Props) {
  const { card } = fc;
  const isPlayer = owner === 'player';

  let cls: string;
  if (fc.faceDown && !isPlayer) {
    cls = 'card field-card face-down';
  } else if (fc.faceDown && isPlayer) {
    cls = `card field-card face-down own-facedown attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`;
  } else {
    cls = `card field-card ${cardTypeCss(card)}-card attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'} pos-${fc.position}`;
  }
  if (fc.hasAttacked && isPlayer) cls += ' exhausted';
  if (selected)    cls += ' selected';
  if (interactive) cls += ' interactive';
  if (canAttack)   cls += ' can-attack';
  if (targetable)  cls += ' targetable';

  function handleClick() {
    if (canAttack)     { onAttackerSelect?.(); return; }
    if (interactive)   { onOwnClick?.(); return; }
    if (targetable)    { onDefenderClick?.(); }
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (!fc.faceDown || isPlayer) onDetail?.();
  }

  function attachRef(el: HTMLDivElement | null) {
    if (el && (!fc.faceDown || isPlayer)) attachHover(el, card, fc);
  }

  // Face-down opponent card
  if (fc.faceDown && !isPlayer) {
    return (
      <div className={cls} ref={attachRef} onClick={targetable ? onDefenderClick : undefined}>
        <div className="card-back-pattern"><span className="back-label">A</span></div>
      </div>
    );
  }

  // Face-down own card
  if (fc.faceDown && isPlayer) {
    return (
      <div className={cls} ref={attachRef} onClick={handleClick} onContextMenu={!IS_TOUCH ? handleContextMenu : undefined}>
        <Card card={card} fc={fc} small dimmed />
        <div className="facedown-overlay">Verdeckt</div>
      </div>
    );
  }

  return (
    <div className={cls} ref={attachRef} onClick={handleClick} onContextMenu={!IS_TOUCH ? handleContextMenu : undefined}>
      <Card card={card} fc={fc} small />
    </div>
  );
}
