import { gsap } from 'gsap';

/**
 * Module-level imperative fusion animation.
 * Shows both material cards flying to the center, merging with a flash,
 * then the fusion result card popping out on the field.
 */
export function playFusionAnim(
  owner: string,
  handIdx1: number,
  handIdx2: number,
  resultZone: number,
): Promise<void> {
  return new Promise(resolve => {
    // ── Locate material cards in hand ──
    const handEl = document.getElementById(owner === 'player' ? 'player-hand' : 'opponent-hand');
    const handCards = handEl?.querySelectorAll<HTMLElement>('.hand-card') ?? [];
    const card1El = handCards[handIdx1] ?? null;
    const card2El = handCards[handIdx2] ?? null;

    if (!card1El && !card2El) { resolve(); return; }

    // ── Merge point: center of the viewport ──
    const mergeX = window.innerWidth / 2;
    const mergeY = window.innerHeight / 2;

    // ── Clone both material cards for animation ──
    function cloneCard(el: HTMLElement | null): HTMLElement | null {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const clone = el.cloneNode(true) as HTMLElement;
      Object.assign(clone.style, {
        position: 'fixed',
        margin: '0', padding: '0', boxSizing: 'border-box',
        left: rect.left + 'px', top: rect.top + 'px',
        width: rect.width + 'px', height: rect.height + 'px',
        zIndex: '430', pointerEvents: 'none',
        transformOrigin: 'center center',
      });
      document.body.appendChild(clone);
      el.style.opacity = '0.15';
      return clone;
    }

    const clone1 = cloneCard(card1El);
    const clone2 = cloneCard(card2El);

    // Calculate travel deltas for each clone
    function getDelta(el: HTMLElement | null) {
      if (!el) return { dx: 0, dy: 0 };
      const r = el.getBoundingClientRect();
      return {
        dx: mergeX - (r.left + r.width / 2),
        dy: mergeY - (r.top + r.height / 2),
      };
    }
    const d1 = getDelta(card1El);
    const d2 = getDelta(card2El);

    // ── Create fusion burst element ──
    function spawnFusionBurst() {
      const burst = document.createElement('div');
      burst.className = 'fusion-burst';
      burst.style.left = mergeX + 'px';
      burst.style.top = mergeY + 'px';
      document.body.appendChild(burst);
      burst.addEventListener('animationend', () => burst.remove(), { once: true });
      setTimeout(() => { if (burst.parentNode) burst.remove(); }, 1200);
    }

    // ── Spawn fusion sparks around the merge point ──
    function spawnSparks() {
      const count = 10;
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('div');
        spark.className = 'fusion-spark';
        const angle = (i / count) * 360;
        spark.style.left = mergeX + 'px';
        spark.style.top = mergeY + 'px';
        spark.style.setProperty('--fusion-angle', `${angle}deg`);
        document.body.appendChild(spark);
        spark.addEventListener('animationend', () => spark.remove(), { once: true });
        setTimeout(() => { if (spark.parentNode) spark.remove(); }, 1000);
      }
    }

    // ── Timeline ──
    const tl = gsap.timeline({
      onComplete() {
        clone1?.remove();
        clone2?.remove();
        if (card1El) card1El.style.opacity = '';
        if (card2El) card2El.style.opacity = '';
        resolve();
      },
    });

    // Phase 1: Both cards fly toward center (converge)
    if (clone1) {
      tl.to(clone1, {
        duration: 0.35,
        ease: 'steps(8)',
        x: d1.dx, y: d1.dy,
        scale: 0.85,
        rotation: -15,
      }, 0);
    }
    if (clone2) {
      tl.to(clone2, {
        duration: 0.35,
        ease: 'steps(8)',
        x: d2.dx, y: d2.dy,
        scale: 0.85,
        rotation: 15,
      }, 0);
    }

    // Phase 2: Cards overlap and glow intensifies
    if (clone1) {
      tl.to(clone1, {
        duration: 0.2,
        ease: 'steps(6)',
        scale: 0.6,
        rotation: 0,
        opacity: 0.7,
        boxShadow: '0 0 30px rgba(255,220,80,0.9)',
      });
    }
    if (clone2) {
      tl.to(clone2, {
        duration: 0.2,
        ease: 'steps(6)',
        scale: 0.6,
        rotation: 0,
        opacity: 0.7,
        boxShadow: '0 0 30px rgba(255,220,80,0.9)',
      }, '<'); // align with clone1
    }

    // Phase 3: Flash burst — cards vanish, sparks fly
    tl.call(() => {
      spawnFusionBurst();
      spawnSparks();
      if (clone1) clone1.style.opacity = '0';
      if (clone2) clone2.style.opacity = '0';
    });

    // Phase 4: Brief pause for the burst to be visible
    tl.to({}, { duration: 0.35 });

    // Phase 5: Highlight the result card on the field
    tl.call(() => {
      const zoneContId = owner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
      const slot = document.querySelectorAll(`#${zoneContId} .zone-slot`)[resultZone];
      const resultCard = slot?.querySelector<HTMLElement>('.card') ?? (slot as HTMLElement);
      if (resultCard) {
        resultCard.classList.add('fusion-result-pop');
        resultCard.addEventListener('animationend', () => {
          resultCard.classList.remove('fusion-result-pop');
        }, { once: true });
      }
    });

    // Phase 6: Let the result pop animation play out
    tl.to({}, { duration: 0.4 });
  });
}
