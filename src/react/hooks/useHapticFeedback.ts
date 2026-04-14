import { useRef, useCallback } from 'react';
import { useGamepadContext } from '../contexts/GamepadContext.js';

type VibrateStrength = 'light' | 'medium' | 'heavy';

interface HapticConfig {
  enabled: boolean;
  duration: number;
  strength: VibrateStrength;
}

const STRENGTH_MAP: Record<VibrateStrength, { weak: number; strong: number }> = {
  light: { weak: 0.3, strong: 0.2 },
  medium: { weak: 0.6, strong: 0.4 },
  heavy: { weak: 1.0, strong: 0.8 },
};

const PHONE_STRENGTH: Record<VibrateStrength, number> = {
  light: 0.3,
  medium: 0.6,
  heavy: 1.0,
};

function rumbleGamepad(duration: number, strength: VibrateStrength) {
  const gamepads = navigator.getGamepads();
  const gamepad = gamepads[0];
  const actuator = gamepad?.vibrationActuator;

  if (actuator && 'playEffect' in actuator) {
    const s = STRENGTH_MAP[strength];
    try {
      actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: s.weak,
        strongMagnitude: s.strong,
      });
    } catch {}
    return true;
  }
  return false;
}

function rumblePhone(duration: number, strength: VibrateStrength) {
  if (!navigator.vibrate) return;
  const actualDuration = Math.round(duration * PHONE_STRENGTH[strength]);
  navigator.vibrate(actualDuration);
}

export function useHapticFeedback(config: HapticConfig = { enabled: true, duration: 50, strength: 'light' }) {
  const { connected, vibrationEnabled } = useGamepadContext();
  const timeoutRef = useRef<number | null>(null);
  const lastVibrateRef = useRef<number>(0);
  const MIN_VIBRATE_GAP = 30;

  const vibrate = useCallback((
    duration = config.duration,
    strength = config.strength,
  ) => {
    if (!config.enabled || !vibrationEnabled) return;

    const now = Date.now();
    if (now - lastVibrateRef.current < MIN_VIBRATE_GAP) return;

    lastVibrateRef.current = now;

    if (connected) {
      const handled = rumbleGamepad(duration, strength);
      if (!handled) rumblePhone(duration, strength);
    } else {
      rumblePhone(duration, strength);
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
    }, duration);
  }, [config.enabled, config.duration, config.strength, connected, vibrationEnabled]);

  const vibratePatterns = {
    onCardDraw: () => vibrate(30, 'light'),
    onCardPlay: () => vibrate(50, 'medium'),
    onAttack: () => {
      vibrate(50, 'medium');
      setTimeout(() => vibrate(50, 'medium'), 80);
    },
    onDamage: () => {
      vibrate(100, 'heavy');
      setTimeout(() => vibrate(100, 'heavy'), 150);
    },
    onPhaseChange: () => vibrate(40, 'light'),
    onTurnEnd: () => vibrate(60, 'medium'),
    onVictory: () => {
      vibrate(200, 'heavy');
      setTimeout(() => vibrate(200, 'heavy'), 250);
      setTimeout(() => vibrate(300, 'heavy'), 500);
    },
    onDefeat: () => {
      vibrate(150, 'heavy');
      setTimeout(() => vibrate(150, 'heavy'), 200);
    },
  };

  return { vibrate, vibratePatterns };
}
