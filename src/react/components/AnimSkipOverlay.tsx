// ============================================================
// AnimSkipOverlay — transparent full-screen click-capture overlay
// Visible only while a skippable animation is active.
// ============================================================
import { useSyncExternalStore } from 'react';
import { fireSkip, isAnimActive, subscribeActive } from './animSkipSignal.js';

export function AnimSkipOverlay() {
  const active = useSyncExternalStore(subscribeActive, isAnimActive);

  if (!active) return null;

  return (
    <button
      id="anim-skip-overlay"
      onClick={fireSkip}
      aria-label="Skip animation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 490,
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    />
  );
}
