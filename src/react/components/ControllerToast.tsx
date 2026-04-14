import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function ControllerToast() {
  const { t } = useTranslation();
  const [toast, setToast] = useState<'connected' | 'disconnected' | null>(null);

  useEffect(() => {
    let timer: number;
    const onConnect = (e: GamepadEvent) => {
      setToast('connected');
      timer = window.setTimeout(() => setToast(null), 3000);
    };
    const onDisconnect = () => {
      setToast('disconnected');
      timer = window.setTimeout(() => setToast(null), 3000);
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div
      className="controller-connected-toast"
      style={toast === 'disconnected' ? { borderColor: '#cc4444', background: 'linear-gradient(135deg, #2a1a1a, #5a2d2d)' } : undefined}
      role="status"
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 12h4m4 0h4M9 7v2m6-2v2M5 17l2-3h10l2 3M7 7h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" />
      </svg>
      <span>{toast === 'connected' ? t('controller.connected_toast') : t('controller.disconnected_toast')}</span>
    </div>
  );
}
