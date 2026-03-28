// ============================================================
// CardActivationOverlay — GSAP-based card activation animation (component only)
// Imperative API lives in cardActivationApi.ts
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { Card } from './Card.js';
import { CardType } from '../../types.js';
import { setActivationDispatch } from './cardActivationApi.js';
import type { ActivationState } from './cardActivationApi.js';
import { onSkip, pushAnim, popAnim, fireSkip } from './animSkipSignal.js';

const LABEL_KEYS: Record<number, string> = {
  [CardType.Spell]: 'game.activation_spell', [CardType.Trap]: 'game.activation_trap',
  [CardType.Monster]: 'game.activation_effect', [CardType.Fusion]: 'game.activation_fusion',
};

export function CardActivationOverlay() {
  const { t } = useTranslation();
  const [act, setAct] = useState<ActivationState | null>(null);
  const bgRef      = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActivationDispatch(setAct);
    return () => setActivationDispatch(null);
  }, []);

  useEffect(() => {
    if (!act || !bgRef.current || !contentRef.current) return;
    const bg  = bgRef.current;
    const con = contentRef.current;

    gsap.set(bg,  { backgroundColor: 'rgba(0,0,0,0)' });
    gsap.set(con, { y: 50, scale: 0.75, opacity: 0 });

    pushAnim();
    const unsub = onSkip(() => { tl.progress(1); });

    const tl = gsap.timeline({
      onComplete() { popAnim(); unsub(); setAct(null); act.resolve(); },
    });
    tl.to(bg,  { duration: 0.3,  ease: 'none', backgroundColor: 'rgba(0,0,10,0.72)' }, 0);
    tl.to(con, { duration: 0.38, ease: 'back.out(1.7)', y: 0, scale: 1, opacity: 1 }, 0);
    tl.to({},  { duration: 1.6 });
    tl.to(con, { duration: 0.55, ease: 'power2.in', y: -30, scale: 1.18, opacity: 0 });
    tl.to(bg,  { duration: 0.5,  ease: 'power2.in', backgroundColor: 'rgba(0,0,0,0)' }, '<');

    return () => { tl.kill(); popAnim(); unsub(); };
  }, [act]);

  if (!act) return null;

  return (
    <div id="card-activate-overlay" onClick={fireSkip} style={{ cursor: 'pointer' }}>
      <div id="card-activate-bg" ref={bgRef} />
      <div id="card-activate-content" ref={contentRef}>
        <div id="card-activate-render">
          <Card card={act.card} big />
        </div>
        <div id="card-activate-effect-box">
          <div id="card-activate-label">{t(LABEL_KEYS[act.card.type] || 'game.activation_default')}</div>
          <div id="card-activate-effect-text">{act.text || act.card.description || '—'}</div>
        </div>
      </div>
    </div>
  );
}
