import { useEffect, useRef, useCallback } from 'react';
import { setDamageNumberDispatch } from './damageNumberApi.js';
import type { Owner } from '../../types.js';

export function DamageNumberOverlay() {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleNumber = useCallback((amount: number, owner: Owner) => {
    const container = containerRef.current;
    if (!container) return;

    const lpId = owner === 'player' ? 'player-lp' : 'opp-lp';
    const anchor = document.getElementById(lpId) ?? document.body;
    const rect = anchor.getBoundingClientRect();

    const el = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = `-${amount}`;
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.top}px`;
    container.appendChild(el);

    const cleanup = () => { if (el.parentNode) el.remove(); };
    el.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 1500);
  }, []);

  useEffect(() => {
    setDamageNumberDispatch(handleNumber);
    return () => setDamageNumberDispatch(null);
  }, [handleNumber]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 501 }}
    />
  );
}
