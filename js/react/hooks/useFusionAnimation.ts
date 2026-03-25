import { gsap } from 'gsap';

// ── Shared helpers ──

function cloneCardEl(el: HTMLElement, mergeX: number, mergeY: number): HTMLElement {
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

function getDeltaTo(el: HTMLElement, targetX: number, targetY: number) {
  const r = el.getBoundingClientRect();
  return { dx: targetX - (r.left + r.width / 2), dy: targetY - (r.top + r.height / 2) };
}

function spawnBurst(x: number, y: number) {
  const burst = document.createElement('div');
  burst.className = 'fusion-burst';
  burst.style.left = x + 'px';
  burst.style.top = y + 'px';
  document.body.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: true });
  setTimeout(() => { if (burst.parentNode) burst.remove(); }, 1200);
}

function spawnSparksAt(x: number, y: number) {
  for (let i = 0; i < 10; i++) {
    const spark = document.createElement('div');
    spark.className = 'fusion-spark';
    spark.style.left = x + 'px';
    spark.style.top = y + 'px';
    spark.style.setProperty('--fusion-angle', `${(i / 10) * 360}deg`);
    document.body.appendChild(spark);
    spark.addEventListener('animationend', () => spark.remove(), { once: true });
    setTimeout(() => { if (spark.parentNode) spark.remove(); }, 1000);
  }
}

function highlightResult(owner: string, resultZone: number) {
  const zoneContId = owner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
  const slot = document.querySelectorAll(`#${zoneContId} .zone-slot`)[resultZone];
  const resultCard = slot?.querySelector<HTMLElement>('.card') ?? (slot as HTMLElement);
  if (resultCard) {
    resultCard.classList.add('fusion-result-pop');
    resultCard.addEventListener('animationend', () => {
      resultCard.classList.remove('fusion-result-pop');
    }, { once: true });
  }
}

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
  return playFusionChainAnim(owner, [handIdx1, handIdx2], resultZone);
}

/**
 * Chain animation: all material cards fly to center sequentially in pairs,
 * with a burst for each fusion step, then the result pops on field.
 */
export function playFusionChainAnim(
  owner: string,
  handIndices: number[],
  resultZone: number,
): Promise<void> {
  return new Promise(resolve => {
    const handEl = document.getElementById(owner === 'player' ? 'player-hand' : 'opponent-hand');
    const handCards = handEl?.querySelectorAll<HTMLElement>('.hand-card') ?? [];

    // Gather all material elements
    const materials: HTMLElement[] = [];
    for (const idx of handIndices) {
      const el = handCards[idx];
      if (el) materials.push(el);
    }

    if (materials.length === 0) { resolve(); return; }

    const mergeX = window.innerWidth / 2;
    const mergeY = window.innerHeight / 2;

    // Clone all materials
    const clones = materials.map(el => cloneCardEl(el, mergeX, mergeY));

    const tl = gsap.timeline({
      onComplete() {
        clones.forEach(c => c.remove());
        materials.forEach(el => { el.style.opacity = ''; });
        resolve();
      },
    });

    // Animate all cards flying to center together
    clones.forEach((clone, i) => {
      const d = getDeltaTo(materials[i], mergeX, mergeY);
      const rotAngle = ((i % 2 === 0) ? -15 : 15) * (1 - i * 0.2);
      tl.to(clone, {
        duration: 0.35,
        ease: 'steps(8)',
        x: d.dx, y: d.dy,
        scale: 0.85,
        rotation: rotAngle,
      }, 0);
    });

    // Glow phase
    clones.forEach((clone, i) => {
      tl.to(clone, {
        duration: 0.2,
        ease: 'steps(6)',
        scale: 0.6,
        rotation: 0,
        opacity: 0.7,
        boxShadow: '0 0 30px rgba(255,220,80,0.9)',
      }, i === 0 ? undefined : '<');
    });

    // Flash burst
    tl.call(() => {
      spawnBurst(mergeX, mergeY);
      spawnSparksAt(mergeX, mergeY);
      clones.forEach(c => { c.style.opacity = '0'; });
    });

    tl.to({}, { duration: 0.35 });

    // Result pop on field
    tl.call(() => highlightResult(owner, resultZone));

    tl.to({}, { duration: 0.4 });
  });
}
