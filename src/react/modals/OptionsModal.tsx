import { useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';
import { useGame } from '../contexts/GameContext.js';
import { Progression } from '../../progression.js';
import { Audio } from '../../audio.js';
import { usePwaInstall } from '../hooks/usePwaInstall.js';
import i18n from '../../i18n.js';
import { reloadTcgLocale, getCurrentManifest, getLoadedMods } from '../../tcg-bridge.js';
import { ENGINE_VERSION, TCG_FORMAT_VERSION, ENGINE_BUILD, TCG_FORMAT_BUILD, MOD_BASE_BUILD } from '../../version.js';

type Tab = 'settings' | 'about';

export function OptionsModal() {
  const { closeModal, openModal } = useModal();
  const { t } = useTranslation();
  const { gameState, gameRef } = useGame();
  const saved = Progression.getSettings();

  const [tab, setTab] = useState<Tab>('settings');
  const [lang, setLang] = useState(saved.lang);
  const [volMaster, setVolMaster] = useState(saved.volMaster);
  const [volMusic, setVolMusic] = useState(saved.volMusic);
  const [volSfx, setVolSfx] = useState(saved.volSfx);
  const [muted, setMuted] = useState(saved.volMaster === 0);
  const [preMuteVol, setPreMuteVol] = useState(saved.volMaster || 50);
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
    Progression.saveSettings({ lang, volMaster, volMusic, volSfx });
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
                setPreMuteVol(volMaster || 50);
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
            <input type="range" min="0" max="100" value={volMaster}
              onChange={e => { const v = +e.target.value; setVolMaster(v); setMuted(v === 0); Audio.setVolumes(v, volMusic, volSfx); }} />
          </div>

          <div className="options-row">
            <label>
              {t('options.vol_music')}
              <span>{volMusic}%</span>
            </label>
            <input type="range" min="0" max="100" value={volMusic}
              onChange={e => { const v = +e.target.value; setVolMusic(v); Audio.setVolumes(volMaster, v, volSfx); }} />
          </div>

          <div className="options-row">
            <label>
              {t('options.vol_sfx')}
              <span>{volSfx}%</span>
            </label>
            <input type="range" min="0" max="100" value={volSfx}
              onChange={e => { const v = +e.target.value; setVolSfx(v); Audio.setVolumes(volMaster, volMusic, v); }} />
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
