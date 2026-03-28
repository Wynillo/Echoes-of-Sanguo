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
    <div
      id="anim-skip-overlay"
      onClick={fireSkip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 490,
        cursor: 'pointer',
      }}
    />
  );
}
