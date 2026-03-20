import { useState }       from 'react';
import { useTranslation }  from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { Progression }    from '../../progression.js';

export default function SavePointScreen() {
  const { navigateTo }     = useScreen();
  const { coins, refresh } = useProgression();
  const { openModal }      = useModal();
  const { t } = useTranslation();
  const [savedMsg, setSavedMsg] = useState(false);
  const hasBackup = Progression.hasBackup();

  function handleSave() {
    if (hasBackup) {
      const ok = window.confirm(t('save.confirm_overwrite'));
      if (!ok) return;
      Progression.clearBackup();
    }
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  }

  function handleToMainMenu() {
    if (Progression.hasBackup()) {
      Progression.restoreFromBackup();
      refresh();
    }
    navigateTo('title');
  }

  return (
    <div id="save-point-screen">
      <div className="title-bg"></div>
      <div className="save-point-content">
        <div className="title-rune">★</div>
        <h2 className="save-point-title">{t('save.headline')}</h2>
        <div className="save-coins-bar">
          <span className="coins-icon">◈</span>
          <span className="save-coins-value">{coins.toLocaleString()}</span>
          <span className="coins-label">{t('common.coins')}</span>
        </div>
        {hasBackup && (
          <p className="save-backup-warning">{t('save.backup_warning')}</p>
        )}
        <div className="save-point-menu">
          <button className="btn-primary" onClick={handleSave}>
            {savedMsg ? t('save.btn_saved') : t('save.btn_save')}
          </button>
          <button className="btn-secondary" onClick={() => navigateTo('opponent')}>{t('save.btn_story')}</button>
          <button className="btn-secondary" onClick={() => navigateTo('opponent')}>{t('save.btn_duel')}</button>
          <button className="btn-secondary" onClick={() => navigateTo('shop')}>{t('save.btn_shop')}</button>
          <button className="btn-secondary" onClick={() => navigateTo('collection')}>{t('save.btn_collection')}</button>
          <button className="btn-secondary" onClick={() => navigateTo('deckbuilder')}>{t('save.btn_deckbuilder')}</button>
          <button className="btn-secondary" onClick={() => openModal({ type: 'card-list' })}>{t('save.btn_cardlist')}</button>
          <button className="btn-secondary" onClick={handleToMainMenu}>{t('save.btn_mainmenu')}</button>
        </div>
      </div>
    </div>
  );
}
