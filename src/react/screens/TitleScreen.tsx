import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { Progression }    from '../../progression.js';
import styles from './TitleScreen.module.css';

export default function TitleScreen() {
  const { navigateTo } = useScreen();
  const { openModal } = useModal();
  const { t } = useTranslation();
  const hasSave = Progression.hasAnySave();

  function handleNewGame() {
    navigateTo('save-slots', { slotMode: 'new' });
  }

  function handleLoadGame() {
    navigateTo('save-slots', { slotMode: 'load' });
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
<button className="btn-menu" onClick={() => openModal({ type: 'how-to-play' })}>{t('howToPlay.title')}</button>
          <button className="btn-menu" onClick={() => openModal({ type: 'main-options' })}>{t('title.options')}</button>
          <button className="btn-menu" onClick={() => window.close()}>{t('title.quit')}</button>
        </div>
      </div>
    </div>
  );
}
