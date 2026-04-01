import { useState, useEffect } from 'react';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e: BeforeInstallPromptEvent) => {
  e.preventDefault();
  deferredPrompt = e;
});

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(
    () => deferredPrompt !== null && !isStandalone(),
  );

  useEffect(() => {
    if (isStandalone()) {
      setCanInstall(false);
      return;
    }

    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };

    const onInstalled = () => {
      deferredPrompt = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function triggerInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      setCanInstall(false);
    }
  }

  return { canInstall, triggerInstall };
}
