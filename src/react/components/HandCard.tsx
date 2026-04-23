import { useRef } from 'react';
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';
import { attachHover } from './hoverApi.js';
import { useLongPress } from '../hooks/useLongPress.js';
import type { CardData } from '../../types.js';

interface HandCardProps {
  card: CardData;
  index: number;
  playable: boolean;
  dimmed?: boolean;
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

export function HandCard({ card, index, playable, dimmed, fusionable, targetable, chainSelected, chainIndex, fusionSelected, fusionIndex, newlyDrawn, drawDelay, onClick, onLongPress }: HandCardProps) {
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
    dimmed         ? 'dimmed'         : '',
    fusionable     ? 'fusionable'     : '',
    targetable     ? 'targetable'     : '',
    isSelected     ? 'chain-selected' : '',
    newlyDrawn     ? 'newly-drawn'    : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={el => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (el) attachHover(el, card, null);
      }}
      className={cls}
      role="button"
      aria-label={`${card.name}${playable ? ' (playable)' : ''}${isSelected ? ' (selected)' : ''}`}
      tabIndex={0}
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
