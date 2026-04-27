// ============================================================
// HoverPreview — GSAP-based hover card preview (component only)
// Imperative API lives in hoverApi.ts
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { getAttrById } from '../../type-metadata.js';
import { CardType } from '../../types.js';
import { DetailCard } from './card/views/DetailCard.js';
import { highlightCardText } from '../utils/highlightCardText.js';
import { EffectTextBlock } from './EffectTextBlock.js';
import { setHoverDispatch } from './hoverApi.js';
import type { HoverState } from './hoverApi.js';

export function HoverPreview() {
  const { t } = useTranslation();
  const [hover, setHover] = useState<HoverState | null>(null);
  const ref    = useRef<HTMLDivElement>(null);
  const tween  = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    setHoverDispatch(setHover);
    return () => setHoverDispatch(null);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (tween.current) tween.current.kill();
    if (hover) {
      const pw = el.offsetWidth  || 280;
      const ph = el.offsetHeight || 320;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = hover.x + 18;
      let top  = hover.y - 20;
      if (left + pw > vw - 8) left = hover.x - pw - 18;
      if (top  + ph > vh - 8) top  = vh - ph - 8;
      if (top < 8)            top  = 8;
      if (left < 8)           left = 8;
      el.style.left = left + 'px';
      el.style.top  = top  + 'px';
      el.style.display = '';
      tween.current = gsap.to(el, { duration: 0.12, ease: 'power1.out', opacity: 1, y: 0 });
    } else {
      tween.current = gsap.to(el, {
        duration: 0.13, delay: 0.06, ease: 'power1.in', opacity: 0, y: 4,
        onComplete() { if (el) el.style.display = 'none'; },
      });
    }
  }, [hover]);

  const { card, fc } = hover ?? {};
  const attrMeta = card?.attribute ? getAttrById(card.attribute) : undefined;
  const attrNameStr = attrMeta?.value ?? '';
  const typeNameMap: Record<number, string> = { [CardType.Monster]:t('card_detail.type_normal'), [CardType.Fusion]:t('card_detail.type_fusion'), [CardType.Spell]:t('card_detail.type_spell'), [CardType.Trap]:t('card_detail.type_trap') };
  const typeName = card ? (card.type === CardType.Monster && card.effect ? t('card_detail.type_effect') : typeNameMap[card.type] || '') : '';
  const isMonLevel = card && (card.type === CardType.Monster || card.type === CardType.Fusion);
  const levelStr = isMonLevel && card?.level ? ` · ${t('card_detail.level_prefix')} ${card.level}` : '';
  const baseATK = card?.atk ?? 0;
  const baseDEF = card?.def ?? 0;
  const hoverEffATK = fc ? fc.effectiveATK() : baseATK;
  const hoverEffDEF = fc ? fc.effectiveDEF() : baseDEF;
  const atkColor = fc ? (hoverEffATK > baseATK ? '#88ff88' : hoverEffATK < baseATK ? '#ff6666' : undefined) : undefined;
  const defColor = fc ? (hoverEffDEF > baseDEF ? '#88ff88' : hoverEffDEF < baseDEF ? '#ff6666' : undefined) : undefined;

  return (
    <div
      id="card-hover-preview"
      ref={ref}
      style={{ display: 'none', opacity: 0, transform: 'translateY(4px)' }}
    >
      {card && (
        <>
          <div id="hover-card-render">
            <DetailCard card={card} fc={fc} />
          </div>
          <div className="hover-info">
            <div id="hover-card-name">{card.name}</div>
            <div id="hover-card-meta">{[attrNameStr, typeName].filter(Boolean).join(' · ')}{levelStr}</div>
            <div id="hover-card-desc">{card.description ? highlightCardText(card.description) : ''}</div>
            <EffectTextBlock card={card} />
            <div id="hover-card-stats">
              {card.atk !== undefined
                ? <>
                    <span style={atkColor ? { color: atkColor } : undefined}>ATK {hoverEffATK}</span>
                    {'  '}
                    <span style={defColor ? { color: defColor } : undefined}>DEF {hoverEffDEF}</span>
                  </>
                : ''}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
