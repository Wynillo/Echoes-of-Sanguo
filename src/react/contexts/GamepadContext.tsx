import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Progression } from '../../progression.js';

export interface GamepadButtons {
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  start: boolean;
  select: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  leftBumper: boolean;
  rightBumper: boolean;
}

const EMPTY_BUTTONS: GamepadButtons = {
  a: false, b: false, x: false, y: false,
  start: false, select: false,
  dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
  leftBumper: false, rightBumper: false,
};

export interface GamepadCallbacks {
  onA?: () => void;
  onB?: () => void;
  onStart?: () => void;
  onSelect?: () => void;
  onDpad?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onLB?: () => void;
  onRB?: () => void;
}

interface GamepadCtx {
  connected: boolean;
  gamepadId: string | null;
  buttons: GamepadButtons;
  axes: number[];
  controllerEnabled: boolean;
  setControllerEnabled: (v: boolean) => void;
  vibrationEnabled: boolean;
  setVibrationEnabled: (v: boolean) => void;
  registerCallbacks: (cbs: GamepadCallbacks) => void;
  vibrate: (pattern: VibratePattern) => void;
}

type VibratePattern = 'light' | 'medium' | 'heavy' | 'double-light' | 'double-medium' | 'double-heavy';

const GAMEPAD_POLL_INTERVAL = 100;

const GamepadContext = createContext<GamepadCtx>({
  connected: false,
  gamepadId: null,
  buttons: EMPTY_BUTTONS,
  axes: [0, 0, 0, 0],
  controllerEnabled: true,
  setControllerEnabled: () => {},
  vibrationEnabled: true,
  setVibrationEnabled: () => {},
  registerCallbacks: () => {},
  vibrate: () => {},
});

function readButtons(gamepad: Gamepad): GamepadButtons {
  return {
    a: gamepad.buttons[0]?.pressed ?? false,
    b: gamepad.buttons[1]?.pressed ?? false,
    x: gamepad.buttons[2]?.pressed ?? false,
    y: gamepad.buttons[3]?.pressed ?? false,
    start: gamepad.buttons[9]?.pressed ?? false,
    select: gamepad.buttons[8]?.pressed ?? false,
    dpadUp: gamepad.buttons[12]?.pressed ?? false,
    dpadDown: gamepad.buttons[13]?.pressed ?? false,
    dpadLeft: gamepad.buttons[14]?.pressed ?? false,
    dpadRight: gamepad.buttons[15]?.pressed ?? false,
    leftBumper: gamepad.buttons[4]?.pressed ?? false,
    rightBumper: gamepad.buttons[5]?.pressed ?? false,
  };
}

function fireEdgeTriggered(
  buttons: GamepadButtons,
  prev: GamepadButtons,
  cbs: GamepadCallbacks,
) {
  if (buttons.a && !prev.a) cbs.onA?.();
  if (buttons.b && !prev.b) cbs.onB?.();
  if (buttons.start && !prev.start) cbs.onStart?.();
  if (buttons.select && !prev.select) cbs.onSelect?.();
  if (buttons.leftBumper && !prev.leftBumper) cbs.onLB?.();
  if (buttons.rightBumper && !prev.rightBumper) cbs.onRB?.();
  if (buttons.dpadUp && !prev.dpadUp) cbs.onDpad?.('up');
  if (buttons.dpadDown && !prev.dpadDown) cbs.onDpad?.('down');
  if (buttons.dpadLeft && !prev.dpadLeft) cbs.onDpad?.('left');
  if (buttons.dpadRight && !prev.dpadRight) cbs.onDpad?.('right');
}

function doVibrate(gamepad: Gamepad | null, pattern: VibratePattern, vibrationEnabled: boolean) {
  if (!vibrationEnabled) return;

  const actuator = gamepad?.vibrationActuator;
  if (actuator && 'playEffect' in actuator) {
    const presets: Record<VibratePattern, { duration: number; weak: number; strong: number }> = {
      'light':         { duration: 50,  weak: 0.3, strong: 0.2 },
      'medium':        { duration: 80,  weak: 0.6, strong: 0.4 },
      'heavy':         { duration: 120, weak: 1.0, strong: 0.8 },
      'double-light':  { duration: 50,  weak: 0.3, strong: 0.2 },
      'double-medium': { duration: 80,  weak: 0.6, strong: 0.4 },
      'double-heavy':  { duration: 120, weak: 1.0, strong: 0.8 },
    };
    const p = presets[pattern];
    try {
      actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: p.duration,
        weakMagnitude: p.weak,
        strongMagnitude: p.strong,
      });
      if (pattern.startsWith('double-')) {
        setTimeout(() => {
          try { actuator.playEffect('dual-rumble', { startDelay: 0, duration: p.duration, weakMagnitude: p.weak, strongMagnitude: p.strong }); } catch {}
        }, p.duration + 40);
      }
    } catch {}
    return;
  }

  if (navigator.vibrate) {
    const ms: Record<VibratePattern, number | number[]> = {
      'light': 30,
      'medium': 50,
      'heavy': 100,
      'double-light': [30, 40, 30],
      'double-medium': [50, 60, 50],
      'double-heavy': [100, 80, 100],
    };
    navigator.vibrate(ms[pattern]);
  }
}

export function GamepadProvider({ children }: { children: React.ReactNode }) {
  const settings = Progression.getSettings();
  const [connected, setConnected] = useState(false);
  const [gamepadId, setGamepadId] = useState<string | null>(null);
  const [buttons, setButtons] = useState<GamepadButtons>(EMPTY_BUTTONS);
  const [axes, setAxes] = useState<number[]>([0, 0, 0, 0]);
  const [controllerEnabled, setControllerEnabledState] = useState(settings.controllerEnabled);
  const [vibrationEnabled, setVibrationEnabledState] = useState(settings.vibrationEnabled);

  const prevButtons = useRef<GamepadButtons>(EMPTY_BUTTONS);
  const callbacks = useRef<GamepadCallbacks>({});

  const setControllerEnabled = useCallback((v: boolean) => {
    setControllerEnabledState(v);
    const s = Progression.getSettings();
    Progression.saveSettings({ ...s, controllerEnabled: v });
  }, []);

  const setVibrationEnabled = useCallback((v: boolean) => {
    setVibrationEnabledState(v);
    const s = Progression.getSettings();
    Progression.saveSettings({ ...s, vibrationEnabled: v });
  }, []);

  const registerCallbacks = useCallback((cbs: GamepadCallbacks) => {
    callbacks.current = cbs;
  }, []);

  const vibrate = useCallback((pattern: VibratePattern) => {
    if (!vibrationEnabled || !connected) return;
    const gamepads = navigator.getGamepads();
    doVibrate(gamepads[0], pattern, vibrationEnabled);
  }, [vibrationEnabled, connected]);

  useEffect(() => {
    if (!controllerEnabled) return;

    function pollGamepad() {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0];

      if (!gamepad || !gamepad.connected) {
        setConnected(prev => prev ? false : prev);
        setGamepadId(null);
        return;
      }

      const btns = readButtons(gamepad);
      fireEdgeTriggered(btns, prevButtons.current, callbacks.current);
      prevButtons.current = btns;

      setConnected(true);
      setGamepadId(gamepad.id);
      setButtons(btns);
      setAxes(Array.from(gamepad.axes));
    }

    pollGamepad();
    const interval = setInterval(pollGamepad, GAMEPAD_POLL_INTERVAL);

    const onConnect = (e: GamepadEvent) => {
      setConnected(true);
      setGamepadId(e.gamepad.id);
    };
    const onDisconnect = () => {
      setConnected(false);
      setGamepadId(null);
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    return () => {
      clearInterval(interval);
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, [controllerEnabled]);

  return (
    <GamepadContext.Provider value={{
      connected,
      gamepadId,
      buttons,
      axes,
      controllerEnabled,
      setControllerEnabled,
      vibrationEnabled,
      setVibrationEnabled,
      registerCallbacks,
      vibrate,
    }}>
      {children}
    </GamepadContext.Provider>
  );
}

export function useGamepadContext() { return useContext(GamepadContext); }
