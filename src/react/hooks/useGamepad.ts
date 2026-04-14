import { useGamepadContext } from '../contexts/GamepadContext.js';

export function useGamepad() {
  const { connected, gamepadId, buttons, axes, registerCallbacks } = useGamepadContext();
  return { connected, gamepadId, buttons, axes, registerCallbacks };
}
