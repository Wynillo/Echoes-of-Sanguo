import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';
import { useGame } from '../contexts/GameContext.js';

export function BattleLogModal() {
  const { closeModal } = useModal();
  const { t } = useTranslation();
  const { logEntries } = useGame();

  return (
    <div className="modal" id="battle-log-modal">
      <h2>{t('options.view_log')}</h2>
      <div className="battle-log-entries">
        {logEntries.length === 0
          ? <div className="log-entry log-empty">{t('options.log_empty')}</div>
          : logEntries.map((entry, i) => (
              <div key={i} className="log-entry">{entry}</div>
            ))
        }
      </div>
      <div className="options-buttons">
        <button className="btn-primary" onClick={closeModal}>{t('common.ok')}</button>
      </div>
    </div>
  );
}
