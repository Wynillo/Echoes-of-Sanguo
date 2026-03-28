// ============================================================
// vfxApi — imperative VFX particle API (no React)
// Same pattern as cardActivationApi.ts — module-level dispatch
// ============================================================

export type VFXType = 'buff' | 'heal' | 'damage';

export interface VFXRequest {
  type:      VFXType;
  /** Target element to anchor the effect on (card, LP panel, etc.) */
  targetEl:  HTMLElement;
  resolve:   () => void;
}

let _dispatch: ((req: VFXRequest) => void) | null = null;

/** Called by VFXOverlay on mount/unmount to register its dispatcher. */
export function setVFXDispatch(fn: ((req: VFXRequest) => void) | null) {
  _dispatch = fn;
}

/**
 * Play a visual effect anchored to a DOM element.
 * Returns a promise that resolves when the animation completes.
 */
export function playVFX(type: VFXType, targetEl: HTMLElement): Promise<void> {
  return new Promise<void>(resolve => {
    if (!_dispatch) { resolve(); return; }
    _dispatch({ type, targetEl, resolve });
  });
}

/**
 * Play a VFX anchored to a zone slot on the field.
 * owner + zone identify the monster slot; falls back to LP panel.
 */
export function playVFXAtZone(
  type: VFXType,
  owner: 'player' | 'opponent',
  zone?: number,
): Promise<void> {
  let el: HTMLElement | null = null;

  if (zone !== undefined && zone !== null) {
    const contId = owner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
    const slot = document.querySelectorAll(`#${contId} .zone-slot`)[zone];
    el = (slot?.querySelector<HTMLElement>('.card') ?? slot as HTMLElement) || null;
  }

  // Fallback: monster zone area (center of the field)
  if (!el) {
    const zoneId = owner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
    el = document.getElementById(zoneId);
  }
  // Fallback: LP panel area
  if (!el) {
    const lpId = owner === 'player' ? 'player-lp' : 'opp-lp';
    el = document.getElementById(lpId);
  }
  // Last resort: body center
  if (!el) {
    el = document.body;
  }

  return playVFX(type, el);
}
