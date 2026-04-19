import { useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';
import { useGame } from '../contexts/GameContext.js';
import { useGamepadContext } from '../contexts/GamepadContext.js';
import { Progression, VOLUME_CONFIG } from '../../progression.js';
import { Audio, clampVolume } from '../../audio.js';
import { usePwaInstall } from '../hooks/usePwaInstall.js';
import i18n from '../../i18n.js';
import { reloadTcgLocale, getCurrentManifest, getLoadedMods } from '../../tcg-bridge.js';
import { ENGINE_VERSION, TCG_FORMAT_VERSION, ENGINE_BUILD, TCG_FORMAT_BUILD, MOD_BASE_BUILD } from '../../version.js';

type Tab = 'settings' | 'controller' | 'about';

export function OptionsModal() {
  const { closeModal, openModal } = useModal();
  const { t } = useTranslation();
  const { gameState, gameRef } = useGame();
  const {
    connected,
    gamepadId,
    buttons,
    controllerEnabled,
    setControllerEnabled,
    vibrationEnabled,
    setVibrationEnabled,
  } = useGamepadContext();
  const saved = Progression.getSettings();

  const [tab, setTab] = useState<Tab>('settings');
  const [lang, setLang] = useState(saved.lang);
  const [volMaster, setVolMaster] = useState(saved.volMaster);
  const [volMusic, setVolMusic] = useState(saved.volMusic);
  const [volSfx, setVolSfx] = useState(saved.volSfx);
  const [muted, setMuted] = useState(saved.volMaster === 0);
  const [preMuteVol, setPreMuteVol] = useState(saved.volMaster || VOLUME_CONFIG.DEFAULT_MASTER);
  const [showConfirm, setShowConfirm] = useState(false);
  const { canInstall, triggerInstall } = usePwaInstall();

  useLayoutEffect(() => {
    const s = Progression.getSettings();
    setLang(s.lang);
    setVolMaster(s.volMaster);
    setVolMusic(s.volMusic);
    setVolSfx(s.volSfx);
  }, []);

  function apply() {
    i18n.changeLanguage(lang);
    reloadTcgLocale(lang);
    Progression.saveSettings({ lang, volMaster, volMusic, volSfx, controllerEnabled, vibrationEnabled });
    Audio.setVolumes(volMaster, volMusic, volSfx);
  }

  function handleSurrender() {
    apply();
    gameRef.current?.surrender();
    closeModal();
  }

  const manifest = getCurrentManifest();
  const loadedMods = getLoadedMods();
  const currentMod = loadedMods[0];

  const activeButtons = Object.entries(buttons).filter(([, v]) => v);

  return (
    <div className="modal" id="options-modal">
      <h2>{t('options.title')}</h2>

      <div className="options-tabs">
        <button
          className={`options-tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          {t('options.tab_settings')}
        </button>
        <button
          className={`options-tab ${tab === 'controller' ? 'active' : ''}`}
          onClick={() => setTab('controller')}
        >
          {t('controller.tab')}
        </button>
        <button
          className={`options-tab ${tab === 'about' ? 'active' : ''}`}
          onClick={() => setTab('about')}
        >
          {t('options.tab_about')}
        </button>
      </div>

      {tab === 'settings' && (
        <>
          <div className="options-row">
            <label>{t('options.lang')}</label>
            <select value={lang} onChange={e => setLang(e.target.value)}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="options-row">
            <label>{t('options.mute', 'Mute')}</label>
            <button className="btn-small" onClick={() => {
              if (muted) {
                setVolMaster(preMuteVol);
                Audio.setVolumes(preMuteVol, volMusic, volSfx);
                setMuted(false);
              } else {
                setPreMuteVol(volMaster || VOLUME_CONFIG.DEFAULT_MASTER);
                setVolMaster(0);
                Audio.setVolumes(0, volMusic, volSfx);
                setMuted(true);
              }
            }}>{muted ? t('options.unmute', 'Unmute') : t('options.mute', 'Mute')}</button>
          </div>

          <div className="options-row">
            <label>
               {t('options.vol_master')}
              <span>{volMaster}%</span>
            </label>
            <input type="range" min={0} max={VOLUME_CONFIG.SCALE_MAX} value={volMaster}
              onChange={e => { const v = clampVolume(+e.target.value); setVolMaster(v); setMuted(v === 0); Audio.setVolumes(v, volMusic, volSfx); }} />
          </div>

          <div className="options-row">
            <label>
               {t('options.vol_music')}
              <span>{volMusic}%</span>
            </label>
            <input type="range" min={0} max={VOLUME_CONFIG.SCALE_MAX} value={volMusic}
              onChange={e => { const v = clampVolume(+e.target.value); setVolMusic(v); Audio.setVolumes(volMaster, v, volSfx); }} />
          </div>

          <div className="options-row">
            <label>
               {t('options.vol_sfx')}
              <span>{volSfx}%</span>
            </label>
            <input type="range" min={0} max={VOLUME_CONFIG.SCALE_MAX} value={volSfx}
              onChange={e => { const v = clampVolume(+e.target.value); setVolSfx(v); Audio.setVolumes(volMaster, volMusic, v); }} />
          </div>

          {canInstall && (
            <div className="options-row">
              <label>{t('options.install_app')}</label>
              <button className="btn-secondary" onClick={triggerInstall}>
                {t('options.install_app')}
              </button>
            </div>
          )}

          <div className="options-buttons">
            <button className="btn-cancel" onClick={closeModal}>{t('common.cancel')}</button>
            <button className="btn-secondary" onClick={apply}>{t('common.apply')}</button>
            <button className="btn-primary" onClick={() => { apply(); closeModal(); }}>{t('common.ok')}</button>
          </div>

          {gameState !== null && (
            <div className="options-log">
              <button className="btn-secondary" onClick={() => { apply(); openModal({ type: 'battle-log' }); }}>
                {t('options.view_log')}
              </button>
            </div>
          )}

          {gameState !== null && (
            <div className="options-surrender">
              {!showConfirm ? (
                <button className="btn-surrender" onClick={() => setShowConfirm(true)}>
                  {t('game.surrender')}
                </button>
              ) : (
                <div className="surrender-confirm">
                  <p>{t('game.surrender_confirm')}</p>
                  <div className="surrender-confirm-btns">
                    <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                      {t('game.surrender_cancel')}
                    </button>
                    <button className="btn-surrender" onClick={handleSurrender}>
                      {t('game.surrender_yes')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'controller' && (
        <>
          <div className="options-row controller-status-row">
            <label>{t('controller.status')}</label>
            <span className={`controller-status-indicator ${connected ? 'connected' : 'disconnected'}`}>
              <span className="controller-status-dot" />
              {connected
                ? (gamepadId ?? t('controller.status_detected'))
                : t('controller.status_not_detected')}
            </span>
          </div>

          <div className="options-row">
            <label>{t('controller.enable')}</label>
            <button className="btn-small" onClick={() => setControllerEnabled(!controllerEnabled)}>
              {controllerEnabled ? t('common.on', 'On') : t('common.off', 'Off')}
            </button>
          </div>

          <div className="options-row">
            <label>{t('controller.vibration')}</label>
            <button className="btn-small" onClick={() => setVibrationEnabled(!vibrationEnabled)}>
              {vibrationEnabled ? t('common.on', 'On') : t('common.off', 'Off')}
            </button>
          </div>

          <div className="controller-test-section">
            <h4>{t('controller.test_title')}</h4>
            {!connected ? (
              <p className="controller-test-prompt">{t('controller.test_prompt')}</p>
            ) : (
              <div className="controller-test-buttons">
                {([
                  ['a', 'controller.button_a'],
                  ['b', 'controller.button_b'],
                  ['x', 'controller.button_x'],
                  ['y', 'controller.button_y'],
                  ['start', 'controller.button_start'],
                  ['select', 'controller.button_select'],
                  ['leftBumper', 'controller.button_lb'],
                  ['rightBumper', 'controller.button_rb'],
                  ['dpadUp', 'controller.button_du'],
                  ['dpadDown', 'controller.button_dd'],
                  ['dpadLeft', 'controller.button_dl'],
                  ['dpadRight', 'controller.button_dr'],
                ] as const).map(([btn, labelKey]) => (
                  <span
                    key={btn}
                    className={`controller-test-btn ${buttons[btn] ? 'active' : ''}`}
                  >
                    {t(labelKey)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="options-buttons">
            <button className="btn-primary" onClick={closeModal}>{t('common.ok')}</button>
          </div>
        </>
      )}

      {tab === 'about' && (
        <div className="options-about">
          <div className="about-section">
            <h3>{t('options.about_engine')}</h3>
            <div className="about-row">
              <span className="about-label">{t('options.about_version')}</span>
              <span className="about-value">{ENGINE_VERSION}</span>
            </div>
            <div className="about-row">
              <span className="about-label">{t('options.about_tcg_format')}</span>
              <span className="about-value">{manifest?.formatVersion ?? TCG_FORMAT_VERSION}</span>
            </div>
            <div className="about-row">
              <span className="about-label">{t('options.about_build')}</span>
              <span className="about-value">{ENGINE_BUILD}</span>
            </div>
            {TCG_FORMAT_BUILD && (
              <div className="about-row">
                <span className="about-label">{t('options.about_tcg_build')}</span>
                <span className="about-value">{TCG_FORMAT_BUILD}</span>
              </div>
            )}
            {MOD_BASE_BUILD && (
              <div className="about-row">
                <span className="about-label">{t('options.about_mod_base_build')}</span>
                <span className="about-value">{MOD_BASE_BUILD}</span>
              </div>
            )}
          </div>

          <div className="about-section">
            <h3>{t('options.about_mod')}</h3>
            {currentMod ? (
              <>
                {manifest?.name && (
                  <div className="about-row">
                    <span className="about-label">{t('options.about_name')}</span>
                    <span className="about-value">{manifest.name}</span>
                  </div>
                )}
                {manifest?.author && (
                  <div className="about-row">
                    <span className="about-label">{t('options.about_author')}</span>
                    <span className="about-value">{manifest.author}</span>
                  </div>
                )}
                {manifest?.minEngineVersion && (
                  <div className="about-row">
                    <span className="about-label">{t('options.about_min_engine')}</span>
                    <span className="about-value">{manifest.minEngineVersion}</span>
                  </div>
                )}
                <div className="about-row">
                  <span className="about-label">{t('options.about_cards')}</span>
                  <span className="about-value">{currentMod.cardIds.length}</span>
                </div>
                <div className="about-row">
                  <span className="about-label">{t('options.about_opponents')}</span>
                  <span className="about-value">{currentMod.opponentIds.length}</span>
                </div>
                <div className="about-row">
                  <span className="about-label">{t('options.about_loaded')}</span>
                  <span className="about-value">{new Date(currentMod.timestamp).toLocaleString()}</span>
                </div>
              </>
            ) : (
              <p className="about-empty">{t('options.about_no_mod')}</p>
            )}
          </div>

          <div className="options-buttons">
            <button className="btn-primary" onClick={closeModal}>{t('common.ok')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
