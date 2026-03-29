import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useCampaign }    from '../contexts/CampaignContext.js';
import { Progression }    from '../../progression.js';
import type { SlotId, SlotMeta } from '../../progression.js';
import styles from './SaveSlotScreen.module.css';

export default function SaveSlotScreen() {
  const { screenData, navigateTo } = useScreen();
  const { refresh, loadDeck }   = useProgression();
  const { refreshCampaignProgress } = useCampaign();
  const { t } = useTranslation();

  const mode = (screenData?.slotMode as 'new' | 'load') ?? 'new';
  const [slots, setSlots] = useState<SlotMeta[]>(() => Progression.getSlotMeta());

  function refreshSlots() {
    setSlots(Progression.getSlotMeta());
  }

  function handleSelectSlot(meta: SlotMeta) {
    if (mode === 'load') {
      if (meta.empty) return;
      Progression.selectSlot(meta.slot);
      Progression.init();
      refresh();
      loadDeck();
      refreshCampaignProgress();
      navigateTo('save-point');
    } else {
      // New game mode
      if (!meta.empty) {
        const ok = window.confirm(t('slots.confirm_overwrite'));
        if (!ok) return;
        Progression.deleteSlot(meta.slot);
      }
      Progression.selectSlot(meta.slot);
      Progression.resetAll();
      Progression.init();
      refresh();
      refreshCampaignProgress();
      navigateTo('starter');
    }
  }

  function handleDelete(slot: SlotId, e: React.MouseEvent) {
    e.stopPropagation();
    const ok = window.confirm(t('slots.confirm_delete'));
    if (!ok) return;
    Progression.deleteSlot(slot);
    refreshSlots();
  }

  function handleBack() {
    navigateTo('title');
  }

  return (
    <div className={styles.screen}>
      <div className="title-bg"></div>
      <div className={styles.content}>
        <div className="title-rune">★</div>
        <h2 className={styles.title}>
          {mode === 'new' ? t('slots.title_new') : t('slots.title_load')}
        </h2>

        <div className={styles.slotList}>
          {slots.map(meta => (
            <button
              key={meta.slot}
              className={`${styles.slotCard} ${meta.empty ? styles.slotEmpty : styles.slotFilled} ${mode === 'load' && meta.empty ? styles.slotDisabled : ''}`}
              onClick={() => handleSelectSlot(meta)}
              disabled={mode === 'load' && meta.empty}
            >
              <div className={styles.slotHeader}>
                <span className={styles.slotLabel}>{t('slots.slot_label', { num: meta.slot })}</span>
                {!meta.empty && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDelete(meta.slot, e)}
                    title={t('slots.btn_delete')}
                  >✕</button>
                )}
              </div>

              {meta.empty ? (
                <div className={styles.emptyLabel}>{t('slots.empty')}</div>
              ) : (
                <div className={styles.slotInfo}>
                  {meta.starterRace && (
                    <div className={styles.infoRow}>
                      <span>{t('slots.race_label', { race: t(`cards.race_${meta.starterRace}`) })}</span>
                    </div>
                  )}
                  <div className={styles.infoRow}>
                    <span>{t('slots.coins_label', { coins: meta.coins.toLocaleString() })}</span>
                  </div>
                  <div className={styles.infoRow}>
                    <span>{t('slots.chapter_label', { chapter: t(`campaign.${meta.currentChapter}`, meta.currentChapter) })}</span>
                  </div>
                  {meta.lastSaved && (
                    <div className={styles.infoRow + ' ' + styles.dateLine}>
                      <span>{t('slots.last_saved', { date: new Date(meta.lastSaved).toLocaleDateString() })}</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>

        <button className={`btn-menu ${styles.backBtn}`} onClick={handleBack}>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
