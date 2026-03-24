import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n.js';
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
import CampaignScreen   from './screens/CampaignScreen.js';
import CollectionScreen from './screens/CollectionScreen.js';
import ShopScreen       from './screens/ShopScreen.js';
import PackOpeningScreen from './screens/PackOpeningScreen.js';
import GameScreen       from './screens/GameScreen.js';
import DeckbuilderScreen  from './screens/DeckbuilderScreen.js';
import SavePointScreen   from './screens/SavePointScreen.js';

import { HoverPreview }        from './components/HoverPreview.js';
import { CardActivationOverlay } from './components/CardActivationOverlay.js';
import { ModalOverlay }         from './modals/ModalOverlay.js';

function Router() {
  const { screen, setScreen } = useScreen();
  useAudioInit();
  return (
    <>
      {screen === 'press-start'  && <PressStartScreen />}
      {screen === 'title'        && <TitleScreen />}
      {screen === 'starter'      && <StarterScreen />}
      {screen === 'opponent'     && <OpponentScreen />}
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
      {screen === 'save-point'   && <SavePointScreen />}
      <HoverPreview />
      <CardActivationOverlay />
      <ModalOverlay />
      <div id="screen-transition-overlay" style={{ position: 'fixed', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none', zIndex: 9999 }} />
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
