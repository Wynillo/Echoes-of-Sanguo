import { useTranslation } from 'react-i18next';
import { useModal } from '../contexts/ModalContext.js';
import { useGame } from '../contexts/GameContext.js';

export function BattleLogModal() {
  const { closeModal } = useModal();
  const { t } = useTranslation();
  const { logEntries } = useGame();

  const handleDownload = () => {
    const text = logEntries.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `battle-log-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

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
        <button
          className="btn-secondary"
          onClick={handleDownload}
          disabled={logEntries.length === 0}
        >
          {t('options.download_log')}
        </button>
        <button className="btn-primary" onClick={closeModal}>{t('common.ok')}</button>
      </div>
    </div>
  );
}
