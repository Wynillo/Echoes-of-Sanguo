import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function OfflineIndicator() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 8,
        right: 8,
        background: '#1a1a2e',
        color: '#8899aa',
        padding: '4px 12px',
        borderRadius: 4,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        border: '1px solid #334',
        zIndex: 10000,
        letterSpacing: '1px',
        textTransform: 'uppercase',
      }}
    >
      {t('status.offline')}
    </div>
  );
}
