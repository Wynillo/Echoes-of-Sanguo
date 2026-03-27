// ============================================================
// VFXOverlay — Renders particle effects (buff swirl, heal stars,
// damage fireballs) anchored to game elements.
// ============================================================
import { useEffect, useRef, useCallback } from 'react';
import { setVFXDispatch } from './vfxApi.js';
import type { VFXRequest, VFXType } from './vfxApi.js';
import { onSkip, pushAnim, popAnim } from './animSkipSignal.js';

/** Duration per effect type (ms) */
const DURATIONS: Record<VFXType, number> = {
  buff:   900,
  heal:   1000,
  damage: 800,
};

/** Number of particles per effect */
const COUNTS: Record<VFXType, number> = {
  buff:   8,
  heal:   7,
  damage: 6,
};

export function VFXOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleVFX = useCallback((req: VFXRequest) => {
    const container = containerRef.current;
    if (!container) { req.resolve(); return; }

    const rect = req.targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const count = COUNTS[req.type];
    const duration = DURATIONS[req.type];
    let finished = 0;
    let resolved = false;
    const particles: HTMLDivElement[] = [];

    pushAnim();

    const done = () => {
      if (resolved) return;
      resolved = true;
      unsub();
      popAnim();
      particles.forEach(p => { if (p.parentNode) p.remove(); });
      req.resolve();
    };

    const unsub = onSkip(done);

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = `vfx-particle vfx-${req.type}`;
      particles.push(particle);

      // Randomize position & timing per particle
      const angle = (i / count) * 360;
      const delay = Math.random() * (duration * 0.3);

      particle.style.setProperty('--vfx-cx', `${cx}px`);
      particle.style.setProperty('--vfx-cy', `${cy}px`);
      particle.style.setProperty('--vfx-angle', `${angle}deg`);
      particle.style.setProperty('--vfx-delay', `${delay}ms`);
      particle.style.setProperty('--vfx-i', `${i}`);
      particle.style.animationDelay = `${delay}ms`;

      container.appendChild(particle);

      const onEnd = () => {
        particle.remove();
        finished++;
        if (finished >= count) done();
      };
      particle.addEventListener('animationend', onEnd, { once: true });

      // Safety timeout in case animationend doesn't fire
      setTimeout(() => {
        if (resolved) return;
        if (particle.parentNode) {
          particle.remove();
          finished++;
          if (finished >= count) done();
        }
      }, duration + delay + 200);
    }
  }, []);

  useEffect(() => {
    setVFXDispatch(handleVFX);
    return () => setVFXDispatch(null);
  }, [handleVFX]);

  return (
    <div
      ref={containerRef}
      id="vfx-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 500,
        overflow: 'hidden',
      }}
    />
  );
}
