import { useState, useEffect, lazy, Suspense } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Progression } from '../progression';
import { ScreenProvider, useScreen } from './contexts/ScreenContext';
import { ProgressionProvider } from './contexts/ProgressionContext';
import { CampaignProvider } from './contexts/CampaignContext';
import { ModalProvider } from './contexts/ModalContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { GameProvider } from './contexts/GameContext';
import { GamepadProvider } from './contexts/GamepadContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAudioInit } from './hooks/useAudio';

import PressStartScreen from './screens/PressStartScreen';
import TitleScreen      from './screens/TitleScreen';
import StarterScreen    from './screens/StarterScreen';
import OpponentScreen   from './screens/OpponentScreen';
import SavePointScreen   from './screens/SavePointScreen';
import SaveSlotScreen    from './screens/SaveSlotScreen';

const CampaignScreen   = lazy(() => import('./screens/CampaignScreen'));
const CollectionScreen = lazy(() => import('./screens/CollectionScreen'));
const ShopScreen       = lazy(() => import('./screens/ShopScreen'));
const PackOpeningScreen = lazy(() => import('./screens/PackOpeningScreen'));
const GameScreen       = lazy(() => import('./screens/GameScreen'));
const DeckbuilderScreen = lazy(() => import('./screens/DeckbuilderScreen'));
const DuelResultScreen  = lazy(() => import('./screens/DuelResultScreen'));
const DialogueScreen    = lazy(() => import('./screens/DialogueScreen'));

import { HoverPreview }        from './components/HoverPreview';
import { CardActivationOverlay } from './components/CardActivationOverlay';
import { AnimSkipOverlay }      from './components/AnimSkipOverlay';
import { VFXOverlay }           from './components/VFXOverlay';
import { DamageNumberOverlay }  from './components/DamageNumberOverlay';
import { ControllerToast }      from './components/ControllerToast';
import { ModalOverlay }         from './modals/ModalOverlay';
import { OfflineIndicator }     from './components/OfflineIndicator';

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
    <div role="alert" aria-live="assertive" className="save-error-toast">
      <span aria-hidden="true">⚠</span>
      {t('error.save_failed')}
    </div>
  );
}

function MigrationWarning() {
  const { t } = useTranslation();
  const [show, setShow] = useState(() => Progression.hasMigrationPending());
  if (!show) return null;
  return (
    <div className="migration-overlay">
      <div role="alertdialog" aria-modal="true" aria-label={t('migration.warning_title')} className="migration-dialog">
        <h2>{t('migration.warning_title')}</h2>
        <p>{t('migration.warning_text')}</p>
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
      <ControllerToast />
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
                    <GamepadProvider>
                      <Router />
                    </GamepadProvider>
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
