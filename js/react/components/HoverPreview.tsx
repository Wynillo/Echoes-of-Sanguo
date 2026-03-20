// ============================================================
// HoverPreview — GSAP-based hover card preview
// Imperative API: showHoverPreview / hideHoverPreview
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ATTR_NAME } from '../../cards.js';
import { Card } from './Card.js';

interface HoverState {
  card: any;
  fc:   any | null;
  x:    number;
  y:    number;
}

// Module-level imperative controls
let _setHover: React.Dispatch<React.SetStateAction<HoverState | null>> | null = null;
let _tween: gsap.core.Tween | null = null;

export function showHoverPreview(card: any, fc: any | null, x: number, y: number) {
  _setHover?.({ card, fc, x, y });
}

export function hideHoverPreview() {
  _setHover?.(null);
}

function position(el: HTMLElement, mx: number, my: number) {
  const pw = el.offsetWidth  || 280;
  const ph = el.offsetHeight || 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = mx + 18;
  let top  = my - 20;
  if (left + pw > vw - 8) left = mx - pw - 18;
  if (top  + ph > vh - 8) top  = vh - ph - 8;
  if (top < 8)            top  = 8;
  if (left < 8)           left = 8;
  el.style.left = left + 'px';
  el.style.top  = top  + 'px';
}

export function HoverPreview() {
  const [hover, setHover] = useState<HoverState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { _setHover = setHover; return () => { _setHover = null; }; }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (_tween) _tween.kill();
    if (hover) {
      position(el, hover.x, hover.y);
      el.style.display = '';
      _tween = gsap.to(el, { duration: 0.12, ease: 'power1.out', opacity: 1, y: 0 });
    } else {
      _tween = gsap.to(el, {
        duration: 0.13, delay: 0.06, ease: 'power1.in', opacity: 0, y: 4,
        onComplete() { if (el) el.style.display = 'none'; },
      });
    }
  }, [hover]);

  const { card, fc } = hover ?? {};
  const attrName = card ? ATTR_NAME[card.attribute] || '' : '';
  const typeName = card ? ({ normal:'Normal', effect:'Effekt', fusion:'Fusion', spell:'Zauberkarte', trap:'Fallenkarte' }[card.type as string] || '') : '';
  const levelStr = card?.level ? ` · Lv ${card.level}` : '';
  const atkBonus = fc && (fc.permATKBonus || fc.tempATKBonus);

  return (
    <div
      id="card-hover-preview"
      ref={ref}
      style={{ display: 'none', opacity: 0, transform: 'translateY(4px)' }}
    >
      {card && (
        <>
          <div id="hover-card-render">
            <Card card={card} fc={fc} />
          </div>
          <div className="hover-info">
            <div id="hover-card-name">{card.name}</div>
            <div id="hover-card-meta">{[attrName, typeName].filter(Boolean).join(' · ')}{levelStr}</div>
            <div id="hover-card-desc">{card.description || ''}</div>
            <div id="hover-card-stats">
              {card.atk !== undefined
                ? `ATK ${fc ? fc.effectiveATK() : card.atk}${atkBonus ? ' ▲' : ''}  DEF ${fc ? fc.effectiveDEF() : card.def}`
                : ''}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Attach hover listeners to a DOM element
export function attachHover(el: HTMLElement, card: any, fc: any | null) {
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (isTouchDevice) return;
  el.addEventListener('mouseenter', e => showHoverPreview(card, fc, (e as MouseEvent).clientX, (e as MouseEvent).clientY));
  el.addEventListener('mouseleave', hideHoverPreview);
  el.addEventListener('mousemove',  e => {
    const preview = document.getElementById('card-hover-preview');
    if (preview && preview.style.opacity !== '0') position(preview as HTMLDivElement, (e as MouseEvent).clientX, (e as MouseEvent).clientY);
  });
}
