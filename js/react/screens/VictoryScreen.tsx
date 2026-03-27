import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen } from '../contexts/ScreenContext.js';
import styles from './VictoryScreen.module.css';

export default function VictoryScreen() {
  const { screenData, navigateTo } = useScreen();
  const { t } = useTranslation();

  function proceed() {
    const next = screenData?.nextScreen as string | undefined;
    if (next === 'dialogue') {
      navigateTo('dialogue', screenData?.dialogueData as Record<string, unknown>);
    } else {
      navigateTo('campaign');
    }
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
        <h1 className={styles.title}>{t('victory.title')}</h1>
        <p className={styles.message}>{t('victory.message')}</p>
        <p className={styles.pressStart}>{t('victory.continue')}</p>
      </div>
    </div>
  );
}
