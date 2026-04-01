import { useState }       from 'react';
import { useTranslation }  from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { Progression }    from '../../progression.js';
import styles from './SavePointScreen.module.css';

export default function SavePointScreen() {
  const { navigateTo }     = useScreen();
  const { coins, activeSlot } = useProgression();
  const { openModal }      = useModal();
  const { t } = useTranslation();
  const [savedMsg, setSavedMsg] = useState(false);
<<<<<<< HEAD:src/react/screens/SavePointScreen.tsx
  const [isSaving, setIsSaving] = useState(false);

  function handleSave() {
    if (isSaving) return;
    Progression.updateSlotMeta();
    Progression.clearBackup();
    setIsSaving(true);
    setSavedMsg(true);
    setTimeout(() => { setSavedMsg(false); setIsSaving(false); }, 2000);
  }

  function handleToMainMenu() {
    if (Progression.hasBackup()) {
      Progression.restoreFromBackup();
    }
    navigateTo('title');
  }

  return (
    <div className={styles.screen}>
      <button
        className="options-btn-floating"
        title={t('title.options')}
        aria-label={t('title.options')}
        onClick={() => openModal({ type: 'main-options' })}
      >
        <span className="btn-options-mobile" aria-hidden="true">☰</span>
        <span className="btn-options-desktop">OPTIONS</span>
      </button>
      <div className="title-bg"></div>
      <div className={styles.content}>
        <div className="title-rune">★</div>
        <h2 className={styles.title}>
          {t('save.headline')}
          {activeSlot !== null && <span className={styles.slotBadge}>{t('slots.slot_label', { num: activeSlot })}</span>}
        </h2>
        <div className={styles.coinsBar}>
          <span className="coins-icon">◈</span>
          <span className={styles.coinsValue}>{coins.toLocaleString()}</span>
          <span className="coins-label">{t('common.coins')}</span>
        </div>
        <div className={styles.menu}>
          <button className="btn-menu" onClick={() => navigateTo('campaign')}>{t('save.btn_story')}</button>
          <button className="btn-menu" onClick={() => navigateTo('opponent')}>{t('save.btn_duel')}</button>
          <button className="btn-menu" onClick={() => navigateTo('shop')}>{t('save.btn_shop')}</button>
          <button className="btn-menu" onClick={() => navigateTo('collection')}>{t('save.btn_collection')}</button>
          <button className="btn-menu" onClick={() => navigateTo('deckbuilder')}>{t('save.btn_deckbuilder')}</button>
          <button className="btn-menu" onClick={() => openModal({ type: 'card-list' })}>{t('save.btn_cardlist')}</button>
          <button className="btn-menu" onClick={handleToMainMenu}>{t('save.btn_mainmenu')}</button>
          <button className="btn-menu" onClick={handleSave} disabled={isSaving}>
            {savedMsg ? t('save.btn_saved') : t('save.btn_save')}
          </button>
        </div>
      </div>
    </div>
  );
}
