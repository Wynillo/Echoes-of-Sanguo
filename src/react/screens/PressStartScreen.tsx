import { useEffect } from 'react';
import { useScreen } from '../contexts/ScreenContext.js';
import { useGamepadContext } from '../contexts/GamepadContext.js';
import styles from './PressStartScreen.module.css';

export default function PressStartScreen() {
  const { navigateTo } = useScreen();
  const { connected, registerCallbacks } = useGamepadContext();

  function proceed() {
    navigateTo('title');
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      proceed();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!connected) return;
    registerCallbacks({
      onA: proceed,
      onStart: proceed,
      onB: proceed,
    });
    return () => registerCallbacks({});
  }, [connected, registerCallbacks]);

  return (
    <div className={styles.screen} onClick={proceed}>
      <div className="title-bg"></div>
      <div className={styles.content}>
        <p className={styles.pressStart}>PRESS ANY KEY</p>
      </div>
    </div>
  );
}
