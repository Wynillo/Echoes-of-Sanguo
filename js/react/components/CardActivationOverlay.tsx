// ============================================================
// CardActivationOverlay — GSAP-based card activation animation
// Imperative API: showActivation(card, text) → Promise<void>
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Card } from './Card.js';

interface ActivationState {
  card: any;
  text: string;
  resolve: () => void;
}

let _setActivation: React.Dispatch<React.SetStateAction<ActivationState | null>> | null = null;

export function showActivation(card: any, text: string): Promise<void> {
  return new Promise<void>(resolve => {
    _setActivation?.({ card, text, resolve });
  });
}

const LABELS: Record<string, string> = {
  spell: 'ZAUBER AKTIVIERT', trap: 'FALLE AKTIVIERT',
  effect: 'EFFEKT AUSGELÖST', fusion: 'FUSION!', normal: 'EFFEKT AUSGELÖST',
};

export function CardActivationOverlay() {
  const [act, setAct] = useState<ActivationState | null>(null);
  const bgRef      = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => { _setActivation = setAct; return () => { _setActivation = null; }; }, []);

  useEffect(() => {
    if (!act || !bgRef.current || !contentRef.current) return;
    const bg  = bgRef.current;
    const con = contentRef.current;

    gsap.set(bg,  { backgroundColor: 'rgba(0,0,0,0)' });
    gsap.set(con, { y: 50, scale: 0.75, opacity: 0 });

    const tl = gsap.timeline({
      onComplete() { setAct(null); act.resolve(); },
    });
    tl.to(bg,  { duration: 0.3,  ease: 'none', backgroundColor: 'rgba(0,0,10,0.72)' }, 0);
    tl.to(con, { duration: 0.38, ease: 'back.out(1.7)', y: 0, scale: 1, opacity: 1 }, 0);
    tl.to({},  { duration: 1.6 });
    tl.to(con, { duration: 0.55, ease: 'power2.in', y: -30, scale: 1.18, opacity: 0 });
    tl.to(bg,  { duration: 0.5,  ease: 'power2.in', backgroundColor: 'rgba(0,0,0,0)' }, '<');
  }, [act]);

  if (!act) return null;

  return (
    <div id="card-activate-overlay">
      <div id="card-activate-bg" ref={bgRef} />
      <div id="card-activate-content" ref={contentRef}>
        <div id="card-activate-render">
          <Card card={act.card} big />
        </div>
        <div id="card-activate-effect-box">
          <div id="card-activate-label">{LABELS[act.card.type] || 'AKTIVIERT'}</div>
          <div id="card-activate-effect-text">{act.text || act.card.description || '—'}</div>
        </div>
      </div>
    </div>
  );
}
