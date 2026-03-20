// ============================================================
// hoverApi — imperative hover-preview API (no React)
// Separated from HoverPreview.tsx so React Fast Refresh can
// hot-update the component without resetting module-level state.
// ============================================================

export interface HoverState {
  card: any;
  fc:   any | null;
  x:    number;
  y:    number;
}

let _set: ((s: HoverState | null) => void) | null = null;

/** Called by HoverPreview on mount/unmount to register its state setter. */
export function setHoverDispatch(fn: ((s: HoverState | null) => void) | null) {
  _set = fn;
}

export function showHoverPreview(card: any, fc: any | null, x: number, y: number) {
  _set?.({ card, fc, x, y });
}

export function hideHoverPreview() {
  _set?.(null);
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
