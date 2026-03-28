// ============================================================
// animSkipSignal — global animation skip signal (no React)
// Same module-level pattern as cardActivationApi.ts / vfxApi.ts
// ============================================================

type Listener = () => void;
const _skipListeners = new Set<Listener>();
const _activeListeners = new Set<Listener>();
let _activeCount = 0;

/** Subscribe to skip events. Returns unsubscribe function. */
export function onSkip(fn: Listener): () => void {
  _skipListeners.add(fn);
  return () => { _skipListeners.delete(fn); };
}

/** Fire the skip signal (called by click handlers). */
export function fireSkip(): void {
  for (const fn of _skipListeners) fn();
}

/** Increment/decrement active animation count. */
export function pushAnim(): void {
  _activeCount++;
  if (_activeCount === 1) _notifyActive();
}
export function popAnim(): void {
  _activeCount = Math.max(0, _activeCount - 1);
  if (_activeCount === 0) _notifyActive();
}
export function isAnimActive(): boolean { return _activeCount > 0; }

/** Subscribe to active-state changes (for AnimSkipOverlay). */
export function subscribeActive(fn: Listener): () => void {
  _activeListeners.add(fn);
  return () => { _activeListeners.delete(fn); };
}

function _notifyActive() {
  for (const fn of _activeListeners) fn();
}
