import { gsap } from 'gsap';

type ActiveAnim = { tl: gsap.core.Timeline; clone: HTMLElement; atkCard: HTMLElement };
const _activeAnims = new Set<ActiveAnim>();

/** Kill all in-flight attack animations and clean up DOM nodes. Call on game screen unmount. */
export function cleanupAttackAnimations(): void {
  for (const anim of _activeAnims) {
    anim.tl.kill();
    anim.clone.remove();
    anim.atkCard.style.opacity = '';
  }
  _activeAnims.clear();
}

/** Module-level imperative attack animation — called by GameContext's UICallbacks.playAttackAnimation */
export function playAttackAnim(
  atkOwner: string, atkZone: number,
  defOwner: string, defZone: number | null,
): Promise<void> {
  return new Promise(resolve => {
    const atkContId = atkOwner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
    const atkSlot   = document.querySelectorAll(`#${atkContId} .zone-slot`)[atkZone];
    const atkCard   = atkSlot?.querySelector<HTMLElement>('.card');
    if (!atkCard) { resolve(); return; }

    const isDirect = defZone === null || defZone === undefined;
    let defCard: HTMLElement | null = null;
    let defSlot: Element | null = null;
    if (!isDirect) {
      const defContId = defOwner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
      defSlot = document.querySelectorAll(`#${defContId} .zone-slot`)[defZone!];
      defCard = defSlot?.querySelector<HTMLElement>('.card') ?? null;
    }

    const atkRect = atkCard.getBoundingClientRect();
    const atkCX   = atkRect.left + atkRect.width  / 2;
    const atkCY   = atkRect.top  + atkRect.height / 2;

    let impX: number, impY: number;
    if (defCard) {
      const r = defCard.getBoundingClientRect();
      impX = r.left + r.width  / 2;
      impY = r.top  + r.height / 2;
    } else {
      const lpId  = defOwner === 'player' ? 'player-lp' : 'opp-lp';
      const lpEl  = document.getElementById(lpId);
      const lpR   = lpEl?.getBoundingClientRect() ?? null;
      impX = lpR ? lpR.left + lpR.width  / 2 : window.innerWidth / 2;
      impY = lpR ? lpR.top  + lpR.height / 2
                 : (defOwner === 'player' ? window.innerHeight - 90 : 70);
    }

    const dx = impX - atkCX;
    const dy = impY - atkCY;

    const clone = atkCard.cloneNode(true) as HTMLElement;
    Object.assign(clone.style, {
      position: 'fixed', margin: '0', padding: '0', boxSizing: 'border-box',
      left: atkRect.left + 'px', top: atkRect.top + 'px',
      width: atkRect.width + 'px', height: atkRect.height + 'px',
      zIndex: '420', pointerEvents: 'none',
    });
    document.body.appendChild(clone);
    atkCard.style.opacity = '0.25';

    function spawnBurst(x: number, y: number) {
      const el = document.createElement('div');
      el.className = 'atk-burst' + (isDirect ? ' direct' : '');
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }

    const animRef: ActiveAnim = { tl: null as unknown as gsap.core.Timeline, clone, atkCard };
    _activeAnims.add(animRef);

    const tl = gsap.timeline({
      onComplete() {
        _activeAnims.delete(animRef);
        clone.remove();
        atkCard.style.opacity = '';
        if (defCard) defCard.classList.remove('atk-hit');
        if (defSlot) defSlot.classList.remove('atk-impact');
        resolve();
      },
    });
    animRef.tl = tl;

    tl.to(clone, { duration: 0.12, ease: 'steps(6)', x: -dx * 0.14, y: -dy * 0.14, scale: 1.18, outline: '2px solid rgba(255,200,60,0.9)', onStart() { clone.style.opacity = '0.5'; } });
    tl.to(clone, { duration: 0.16, ease: 'steps(6)',  x: dx, y: dy, scale: 1.06 });
    tl.call(() => {
      clone.style.opacity = '1';
      spawnBurst(impX, impY);
      if (defCard) defCard.classList.add('atk-hit');
      if (defSlot) defSlot.classList.add('atk-impact');
    });
    tl.to(clone, { duration: 0.08, ease: 'steps(6)', x: dx - dx * 0.08, y: dy - dy * 0.08 });
    tl.to(clone, { duration: 0.22, ease: 'steps(6)',  x: 0, y: 0, scale: 1, opacity: 0, outline: 'none' });
  });
}
