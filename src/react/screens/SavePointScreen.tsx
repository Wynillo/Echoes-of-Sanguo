import { useState, useEffect, useRef } from 'react';
import { useTranslation }  from 'react-i18next';
import { useScreen }      from '../contexts/ScreenContext.js';
import { useProgression } from '../contexts/ProgressionContext.js';
import { useModal }       from '../contexts/ModalContext.js';
import { useGamepadContext } from '../contexts/GamepadContext.js';
import { Progression }    from '../../progression.js';
import { ANIMATION_TIMING } from '../../constants.js';
import RaceIcon from '../components/RaceIcon.js';
import styles from './SavePointScreen.module.css';

export default function SavePointScreen() {
  const { navigateTo }     = useScreen();
  const { coins, activeSlot } = useProgression();
  const { openModal }      = useModal();
  const { t } = useTranslation();
  const { connected, registerCallbacks } = useGamepadContext();
  const [savedMsg, setSavedMsg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleSave() {
    if (isSaving) return;
    Progression.updateSlotMeta();
    Progression.clearBackup();
    setIsSaving(true);
    setSavedMsg(true);
    setTimeout(() => { setSavedMsg(false); setIsSaving(false); }, ANIMATION_TIMING.SAVE_CONFIRMATION_MS);
  }

  function handleToMainMenu() {
    if (Progression.hasBackup()) {
      Progression.restoreFromBackup();
    }
    navigateTo('title');
  }

  const items = [
    { label: t('save.btn_story'), action: () => navigateTo('campaign') },
    { label: t('save.btn_duel'), action: () => navigateTo('opponent') },
    { label: t('save.btn_shop'), action: () => navigateTo('shop') },
    { label: t('save.btn_collection'), action: () => navigateTo('collection') },
    { label: t('save.btn_deckbuilder'), action: () => navigateTo('deckbuilder') },
    { label: t('save.btn_cardlist'), action: () => openModal({ type: 'card-list' }) },
    { label: t('save.btn_mainmenu'), action: handleToMainMenu },
    { label: savedMsg ? t('save.btn_saved') : t('save.btn_save'), action: handleSave, disabled: isSaving },
  ];

  useEffect(() => {
    if (!connected) return;
    registerCallbacks({
      onA: () => { items[focusIndex]?.action(); },
      onStart: () => { items[focusIndex]?.action(); },
      onB: handleToMainMenu,
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
    <div className={styles.screen}>
      <button
        className="options-btn-floating"
        title={t('title.options')}
        aria-label={t('title.options')}
        onClick={() => openModal({ type: 'main-options' })}
      >
        <span className="btn-options-mobile" aria-hidden="true"><RaceIcon icon="GiHamburgerMenu" /></span>
        <span className="btn-options-desktop">OPTIONS</span>
      </button>
      <div className="title-bg"></div>
      <div className={styles.content}>
        <div className="title-rune"><RaceIcon icon="GiStarShuriken" /></div>
        <h2 className={styles.title}>
          {t('save.headline')}
          {activeSlot !== null && <span className={styles.slotBadge}>{t('slots.slot_label', { num: activeSlot })}</span>}
        </h2>
        <div className={styles.coinsBar}>
          <span className="coins-icon"><RaceIcon icon="GiTwoCoins" /></span>
          <span className={styles.coinsValue}>{coins.toLocaleString()}</span>
          <span className="coins-label">{t('common.coins')}</span>
        </div>
        <div className={styles.menu}>
          {items.map((item, i) => (
            <button
              key={i}
              ref={el => { buttonRefs.current[i] = el; }}
              className={`btn-menu ${connected && i === focusIndex ? 'controller-focused' : ''}`}
              onClick={item.action}
              disabled={item.disabled}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
