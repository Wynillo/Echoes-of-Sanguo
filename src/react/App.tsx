import { useState, useEffect, lazy, Suspense } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../i18n.js';
import { Progression } from '../progression.js';
import { ANIMATION_TIMING } from '../constants.js';
import { ScreenProvider, useScreen } from './contexts/ScreenContext.js';
import { ProgressionProvider } from './contexts/ProgressionContext.js';
import { CampaignProvider } from './contexts/CampaignContext.js';
import { ModalProvider } from './contexts/ModalContext.js';
import { SelectionProvider } from './contexts/SelectionContext.js';
import { GameProvider } from './contexts/GameContext.js';
import { GamepadProvider } from './contexts/GamepadContext.js';
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
import { ControllerToast }      from './components/ControllerToast.js';
import { ModalOverlay }         from './modals/ModalOverlay.js';
import { OfflineIndicator }     from './components/OfflineIndicator.js';

function SaveErrorToast() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    function onError() { setVisible(true); setTimeout(() => setVisible(false), ANIMATION_TIMING.ERROR_BANNER_MS); }
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
