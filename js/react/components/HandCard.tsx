import { useRef } from 'react';
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';
import { attachHover } from './hoverApi.js';
import { useLongPress } from '../hooks/useLongPress.js';

interface Props {
  card: any;
  index: number;
  playable: boolean;
  fusionable: boolean;
  targetable: boolean;
  chainSelected?: boolean;
  chainIndex?: number;
  fusionSelected?: boolean;
  fusionIndex?: number;
  newlyDrawn: boolean;
  drawDelay: number;
  onClick: () => void;
  onLongPress?: () => void;
}

export function HandCard({ card, index, playable, fusionable, targetable, chainSelected, chainIndex, fusionSelected, fusionIndex, newlyDrawn, drawDelay, onClick, onLongPress }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const isSelected = chainSelected || fusionSelected;
  const badgeNumber = chainIndex ?? fusionIndex;

  const longPressHandlers = useLongPress({
    onLongPress: onLongPress ?? (() => {}),
    onClick,
  });

  const cls = [
    'card hand-card',
    `${cardTypeCss(card)}-card`,
    `attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`,
    playable       ? 'playable'       : '',
    fusionable     ? 'fusionable'     : '',
    targetable     ? 'targetable'     : '',
    isSelected     ? 'chain-selected' : '',
    newlyDrawn     ? 'newly-drawn'    : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={el => {
        (ref as any).current = el;
        if (el) attachHover(el, card, null);
      }}
      className={cls}
      data-hand-index={index}
      style={newlyDrawn ? { animationDelay: `${drawDelay}ms` } : undefined}
      {...longPressHandlers}
    >
      <Card card={card} small />
      {badgeNumber !== undefined && (
        <span className="chain-badge">{badgeNumber + 1}</span>
      )}
    </div>
  );
}
