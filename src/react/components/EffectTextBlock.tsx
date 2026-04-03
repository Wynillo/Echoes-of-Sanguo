import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CardData } from '../../types.js';
import { buildCardEffectSegments, type EffectTextSegment } from '../../effect-text-builder.js';

function Tooltip({ text, children }: { text?: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  if (!text) return <>{children}</>;

  return (
    <span
      className="effect-segment-wrap"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && <span className="effect-tooltip">{text}</span>}
    </span>
  );
}

function SegmentSpan({ segment }: { segment: EffectTextSegment }) {
  if (segment.type === 'separator') {
    return <span className="effect-segment-sep">{segment.text}</span>;
  }

  const className = `effect-segment-${segment.type}`;
  return (
    <Tooltip text={segment.tooltip}>
      <span className={className}>{segment.text}</span>
    </Tooltip>
  );
}

export function EffectTextBlock({ card }: { card: CardData }) {
  const { t } = useTranslation();

  const blockSegments = buildCardEffectSegments(card, t);
  if (blockSegments.length === 0) return null;

  return (
    <div className="effect-text-block">
      {blockSegments.map((segments, i) => (
        <p key={i} className="effect-text-line">
          {segments.map((seg, j) => (
            <SegmentSpan key={j} segment={seg} />
          ))}
        </p>
      ))}
    </div>
  );
}
