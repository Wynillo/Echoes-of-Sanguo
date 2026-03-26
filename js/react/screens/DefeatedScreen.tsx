import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen } from '../contexts/ScreenContext.js';
import styles from './DefeatedScreen.module.css';

export default function DefeatedScreen() {
  const { navigateTo } = useScreen();
  const { t } = useTranslation();

  function proceed() {
    navigateTo('press-start');
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      proceed();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className={styles.screen} onClick={proceed}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('defeated.title')}</h1>
        <p className={styles.message}>{t('defeated.message')}</p>
        <p className={styles.pressStart}>{t('defeated.continue')}</p>
      </div>
    </div>
  );
}
