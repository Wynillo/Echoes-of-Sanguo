// ============================================================
// cardActivationApi — imperative card-activation API (no React)
// Separated from CardActivationOverlay.tsx so React Fast Refresh
// can hot-update the component without resetting module-level state.
// ============================================================

export interface ActivationState {
  card:    any;
  text:    string;
  resolve: () => void;
}

let _set: ((s: ActivationState | null) => void) | null = null;

/** Called by CardActivationOverlay on mount/unmount to register its state setter. */
export function setActivationDispatch(fn: ((s: ActivationState | null) => void) | null) {
  _set = fn;
}

export function showActivation(card: any, text: string): Promise<void> {
  return new Promise<void>(resolve => {
    _set?.({ card, text, resolve });
  });
}
