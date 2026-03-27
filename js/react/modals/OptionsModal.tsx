import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal }     from '../contexts/ModalContext.js';
import { useGame }      from '../contexts/GameContext.js';
import { Progression }  from '../../progression.js';
import { Audio }        from '../../audio.js';
import { GAME_RULES }   from '../../rules.js';
import i18n             from '../../i18n.js';

export function OptionsModal() {
  const { closeModal, openModal } = useModal();
  const { t } = useTranslation();
  const { gameState, gameRef } = useGame();
  const saved = Progression.getSettings();

  const [lang,        setLang]        = useState(saved.lang);
  const [volMaster,   setVolMaster]   = useState(saved.volMaster);
  const [volMusic,    setVolMusic]    = useState(saved.volMusic);
  const [volSfx,      setVolSfx]      = useState(saved.volSfx);
  const [refillHand,  setRefillHand]  = useState(saved.refillHand);
  const [showConfirm, setShowConfirm] = useState(false);

  function apply() {
    i18n.changeLanguage(lang);
    Progression.saveSettings({ lang, volMaster, volMusic, volSfx, refillHand });
    Audio.setVolumes(volMaster, volMusic, volSfx);
    GAME_RULES.refillHandEnabled = refillHand;
  }

  function handleSurrender() {
    apply();
    gameRef.current?.surrender();
    closeModal();
  }

  return (
    <div className="modal" id="options-modal">
      <h2>{t('options.title')}</h2>

      <div className="options-row">
        <label>{t('options.lang')}</label>
        <select value={lang} onChange={e => setLang(e.target.value)}>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="options-row">
        <label>
          {t('options.vol_master')}
          <span>{volMaster}%</span>
        </label>
        <input type="range" min="0" max="100" value={volMaster}
          onChange={e => { const v = +e.target.value; setVolMaster(v); Audio.setVolumes(v, volMusic, volSfx); }} />
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

      <div className="options-row">
        <label>{t('options.refill_hand')}</label>
        <select value={refillHand ? 'refill' : 'draw1'} onChange={e => setRefillHand(e.target.value === 'refill')}>
          <option value="refill">{t('options.refill_hand_on')}</option>
          <option value="draw1">{t('options.refill_hand_off')}</option>
        </select>
      </div>

      <div className="options-buttons">
        <button className="btn-cancel"    onClick={closeModal}>{t('common.cancel')}</button>
        <button className="btn-secondary" onClick={apply}>{t('common.apply')}</button>
        <button className="btn-primary"   onClick={() => { apply(); closeModal(); }}>{t('common.ok')}</button>
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
    </div>
  );
}
