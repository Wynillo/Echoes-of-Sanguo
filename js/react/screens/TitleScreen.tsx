import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { Progression }    from '../../progression.js';
import styles from './TitleScreen.module.css';

export default function TitleScreen() {
  const { navigateTo } = useScreen();
  const { refresh }   = useProgression();
  const { openModal } = useModal();
  const { refreshCampaignProgress } = useCampaign();
  const { t } = useTranslation();
  const hasSave = !Progression.isFirstLaunch();

  function handleNewGame() {
    Progression.backupToSession();
    Progression.resetAll();
    Progression.init();
    refresh();
    refreshCampaignProgress();
    navigateTo('starter');
  }

  function handleLoadGame() {
    Progression.clearBackup();
    navigateTo('save-point');
  }

  return (
    <div id="title-screen" className={styles.screen}>
      <div className="title-bg"></div>
      <div className={styles.header}>
        <h1 className={styles.gameTitle}>ECHOES OF SANGUO</h1>
        <p className={styles.subtitle}>{t('title.subtitle')}</p>
      </div>
      <div className={styles.content}>
        <div className={styles.menu}>
          <button className="btn-menu" onClick={handleNewGame}>{t('title.new_game')}</button>
          {hasSave && (
            <button className="btn-menu" onClick={handleLoadGame}>{t('title.load_game')}</button>
          )}
<button className="btn-menu" onClick={() => openModal({ type: 'main-options' })}>{t('title.options')}</button>
          <button className="btn-menu" onClick={() => window.close()}>{t('title.quit')}</button>
        </div>
      </div>
    </div>
  );
}
