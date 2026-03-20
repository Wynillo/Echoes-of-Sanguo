import { useState } from 'react';
import { useModal }     from '../contexts/ModalContext.js';
import { Progression }  from '../../progression.js';

export function OptionsModal() {
  const { closeModal } = useModal();
  const saved = Progression.getSettings();

  const [lang,      setLang]      = useState(saved.lang);
  const [volMaster, setVolMaster] = useState(saved.volMaster);
  const [volMusic,  setVolMusic]  = useState(saved.volMusic);
  const [volSfx,    setVolSfx]    = useState(saved.volSfx);

  function apply() {
    Progression.saveSettings({ lang, volMaster, volMusic, volSfx });
  }

  return (
    <div className="modal" id="options-modal">
      <h2>⚙ Optionen</h2>

      <div className="options-row">
        <label>Sprache</label>
        <select value={lang} onChange={e => setLang(e.target.value)}>
          <option value="de">Deutsch</option>
        </select>
      </div>

      <div className="options-row">
        <label>
          Gesamtlautstärke
          <span>{volMaster}%</span>
        </label>
        <input type="range" min="0" max="100" value={volMaster}
          onChange={e => setVolMaster(+e.target.value)} />
      </div>

      <div className="options-row">
        <label>
          Hintergrundmusik
          <span>{volMusic}%</span>
        </label>
        <input type="range" min="0" max="100" value={volMusic}
          onChange={e => setVolMusic(+e.target.value)} />
      </div>

      <div className="options-row">
        <label>
          Soundeffekte
          <span>{volSfx}%</span>
        </label>
        <input type="range" min="0" max="100" value={volSfx}
          onChange={e => setVolSfx(+e.target.value)} />
      </div>

      <div className="options-buttons">
        <button className="btn-cancel"    onClick={closeModal}>Abbrechen</button>
        <button className="btn-secondary" onClick={apply}>Anwenden</button>
        <button className="btn-primary"   onClick={() => { apply(); closeModal(); }}>OK</button>
      </div>
    </div>
  );
}

