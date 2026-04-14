import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { useGamepadContext } from '../contexts/GamepadContext.js';
import { Progression }    from '../../progression.js';
import styles from './TitleScreen.module.css';

export default function TitleScreen() {
  const { navigateTo } = useScreen();
  const { openModal } = useModal();
  const { t } = useTranslation();
  const hasSave = Progression.hasAnySave();
  const { connected, registerCallbacks } = useGamepadContext();
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const items = [
    { label: t('title.new_game'), action: () => navigateTo('save-slots', { slotMode: 'new' }) },
    ...(hasSave ? [{ label: t('title.load_game'), action: () => navigateTo('save-slots', { slotMode: 'load' }) }] : []),
    { label: t('howToPlay.title'), action: () => openModal({ type: 'how-to-play' }) },
    { label: t('title.options'), action: () => openModal({ type: 'main-options' }) },
    { label: t('title.quit'), action: () => window.close() },
  ];

  useEffect(() => {
    if (!connected) return;
    registerCallbacks({
      onA: () => { items[focusIndex]?.action(); },
      onStart: () => { items[focusIndex]?.action(); },
      onB: () => {},
      onDpad: (dir) => {
        setFocusIndex(prev => {
          if (dir === 'up') return prev > 0 ? prev - 1 : prev;
          if (dir === 'down') return prev < items.length - 1 ? prev + 1 : prev;
          return prev;
        });
      },
    });
    return () => registerCallbacks({});
  }, [connected, registerCallbacks, focusIndex, items]);

  useEffect(() => {
    const btn = buttonRefs.current[focusIndex];
    btn?.focus();
  }, [focusIndex]);

  return (
    <div id="title-screen" className={styles.screen}>
      <div className="title-bg"></div>
      <div className={styles.header}>
        <h1 className={styles.gameTitle}>ECHOES OF SANGUO</h1>
        <p className={styles.subtitle}>{t('title.subtitle')}</p>
      </div>
      <div className={styles.content}>
        <div className={styles.menu}>
          {items.map((item, i) => (
            <button
              key={i}
              ref={el => { buttonRefs.current[i] = el; }}
              className={`btn-menu ${connected && i === focusIndex ? 'controller-focused' : ''}`}
              onClick={item.action}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
