import { useState, useEffect, lazy, Suspense } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../i18n.js';
import { Progression } from '../progression.js';
import { ScreenProvider, useScreen } from './contexts/ScreenContext.js';
import { ProgressionProvider } from './contexts/ProgressionContext.js';
import { CampaignProvider } from './contexts/CampaignContext.js';
import { ModalProvider } from './contexts/ModalContext.js';
import { SelectionProvider } from './contexts/SelectionContext.js';
import { GameProvider } from './contexts/GameContext.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { useAudioInit } from './hooks/useAudio.js';

import PressStartScreen from './screens/PressStartScreen.js';
import TitleScreen      from './screens/TitleScreen.js';
import StarterScreen    from './screens/StarterScreen.js';
import OpponentScreen   from './screens/OpponentScreen.js';
import SavePointScreen   from './screens/SavePointScreen.js';
import SaveSlotScreen    from './screens/SaveSlotScreen.js';

const CampaignScreen   = lazy(() => import('./screens/CampaignScreen.js'));
const CollectionScreen = lazy(() => import('./screens/CollectionScreen.js'));
const ShopScreen       = lazy(() => import('./screens/ShopScreen.js'));
const PackOpeningScreen = lazy(() => import('./screens/PackOpeningScreen.js'));
const GameScreen       = lazy(() => import('./screens/GameScreen.js'));
const DeckbuilderScreen = lazy(() => import('./screens/DeckbuilderScreen.js'));
const DuelResultScreen  = lazy(() => import('./screens/DuelResultScreen.js'));
const DialogueScreen    = lazy(() => import('./screens/DialogueScreen.js'));

import { HoverPreview }        from './components/HoverPreview.js';
import { CardActivationOverlay } from './components/CardActivationOverlay.js';
import { AnimSkipOverlay }      from './components/AnimSkipOverlay.js';
import { VFXOverlay }           from './components/VFXOverlay.js';
import { DamageNumberOverlay }  from './components/DamageNumberOverlay.js';
import { ModalOverlay }         from './modals/ModalOverlay.js';
import { OfflineIndicator }     from './components/OfflineIndicator.js';

function SaveErrorToast() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    function onError() { setVisible(true); setTimeout(() => setVisible(false), 4000); }
    window.addEventListener('eos:save-error', onError);
    return () => window.removeEventListener('eos:save-error', onError);
  }, []);
  if (!visible) return null;
  return (
    <div role="alert" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#501414', color: '#ff8888', padding: '10px 20px', borderRadius: 4, zIndex: 10000, fontFamily: 'monospace', fontSize: '0.875rem', border: '1px solid #802020' }}>
      {t('error.save_failed')}
    </div>
  );
}

function MigrationWarning() {
  const { t } = useTranslation();
  const [show, setShow] = useState(() => Progression.hasMigrationPending());
  if (!show) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', zIndex: 10001 }}>
      <div role="alertdialog" aria-modal="true" aria-label={t('migration.warning_title')} style={{ background: '#0e1c14', border: '2px solid #2a7848', padding: '2rem', maxWidth: '28rem', textAlign: 'center', fontFamily: 'monospace', color: '#d0e8d8' }}>
        <h2 style={{ color: '#c8a848', marginBottom: '1rem' }}>{t('migration.warning_title')}</h2>
        <p style={{ fontSize: '0.875rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>{t('migration.warning_text')}</p>
        <button className="btn-primary" onClick={() => { Progression.clearMigrationPending(); setShow(false); }}>
          {t('migration.dismiss')}
        </button>
      </div>
    </div>
  );
}

function Router() {
  const { screen, setScreen } = useScreen();
  useAudioInit();
  return (
    <>
      {screen === 'press-start'  && <PressStartScreen />}
      {screen === 'title'        && <TitleScreen />}
      {screen === 'starter'      && <StarterScreen />}
      {screen === 'opponent'     && <OpponentScreen />}
      <Suspense fallback={null}>
        {screen === 'campaign'     && <CampaignScreen />}
        {screen === 'collection'   && <CollectionScreen />}
        {screen === 'shop'         && <ShopScreen />}
        {screen === 'pack-opening' && <PackOpeningScreen />}
        {screen === 'game'         && (
          <ErrorBoundary onReset={() => setScreen('title')}>
            <GameScreen />
          </ErrorBoundary>
        )}
        {screen === 'deckbuilder'  && <DeckbuilderScreen />}
        {screen === 'duel-result'   && <DuelResultScreen />}
        {screen === 'dialogue'      && <DialogueScreen />}
      </Suspense>
      {screen === 'save-point'   && <SavePointScreen />}
      {screen === 'save-slots'   && <SaveSlotScreen />}
      <HoverPreview />
      <CardActivationOverlay />
      <AnimSkipOverlay />
      <VFXOverlay />
      <DamageNumberOverlay />
      <ModalOverlay />
      <SaveErrorToast />
      <OfflineIndicator />
      <MigrationWarning />
      <div id="screen-transition-overlay" style={{ position: 'fixed', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none', zIndex: 9999, transition: 'opacity 200ms ease' }} />
    </>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <ScreenProvider>
          <ProgressionProvider>
            <CampaignProvider>
              <ModalProvider>
                <SelectionProvider>
                  <GameProvider>
                    <Router />
                  </GameProvider>
                </SelectionProvider>
              </ModalProvider>
            </CampaignProvider>
          </ProgressionProvider>
        </ScreenProvider>
      </ErrorBoundary>
    </I18nextProvider>
  );
}
