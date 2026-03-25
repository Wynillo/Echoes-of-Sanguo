import { useRef } from 'react';
import { Card, cardTypeCss, ATTR_CSS } from './Card.js';
import { attachHover } from './hoverApi.js';

interface Props {
  card: any;
  index: number;
  playable: boolean;
  fusionable: boolean;
  targetable: boolean;
  newlyDrawn: boolean;
  drawDelay: number;
  onClick: () => void;
}

export function HandCard({ card, index, playable, fusionable, targetable, newlyDrawn, drawDelay, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const cls = [
    'card hand-card',
    `${cardTypeCss(card)}-card`,
    `attr-${card.attribute ? ATTR_CSS[card.attribute] || 'spell' : 'spell'}`,
    playable   ? 'playable'   : '',
    fusionable ? 'fusionable' : '',
    targetable ? 'targetable' : '',
    newlyDrawn ? 'newly-drawn' : '',
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
      onClick={playable || targetable ? onClick : undefined}
    >
      <Card card={card} small />
    </div>
  );
}
