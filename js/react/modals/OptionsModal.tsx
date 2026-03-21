import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useModal }     from '../contexts/ModalContext.js';
import { Progression }  from '../../progression.js';
import { Audio }        from '../../audio.js';
import i18n             from '../../i18n.js';

export function OptionsModal() {
  const { closeModal } = useModal();
  const { t } = useTranslation();
  const saved = Progression.getSettings();

  const [lang,      setLang]      = useState(saved.lang);
  const [volMaster, setVolMaster] = useState(saved.volMaster);
  const [volMusic,  setVolMusic]  = useState(saved.volMusic);
  const [volSfx,    setVolSfx]    = useState(saved.volSfx);

  function apply() {
    i18n.changeLanguage(lang);
    Progression.saveSettings({ lang, volMaster, volMusic, volSfx });
    Audio.setVolumes(volMaster, volMusic, volSfx);
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

      <div className="options-buttons">
        <button className="btn-cancel"    onClick={closeModal}>{t('common.cancel')}</button>
        <button className="btn-secondary" onClick={apply}>{t('common.apply')}</button>
        <button className="btn-primary"   onClick={() => { apply(); closeModal(); }}>{t('common.ok')}</button>
      </div>
    </div>
  );
}

