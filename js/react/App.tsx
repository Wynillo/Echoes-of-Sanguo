import { lazy, Suspense } from 'react';
import { ScreenProvider, useScreen } from './contexts/ScreenContext.js';
import { ProgressionProvider } from './contexts/ProgressionContext.js';
import { ModalProvider } from './contexts/ModalContext.js';
import { SelectionProvider } from './contexts/SelectionContext.js';
import { GameProvider } from './contexts/GameContext.js';

import TitleScreen      from './screens/TitleScreen.js';
import StarterScreen    from './screens/StarterScreen.js';
import OpponentScreen   from './screens/OpponentScreen.js';
import CollectionScreen from './screens/CollectionScreen.js';
import ShopScreen       from './screens/ShopScreen.js';
import PackOpeningScreen from './screens/PackOpeningScreen.js';
import GameScreen       from './screens/GameScreen.js';
import DeckbuilderScreen from './screens/DeckbuilderScreen.js';

import { HoverPreview }        from './components/HoverPreview.js';
import { CardActivationOverlay } from './components/CardActivationOverlay.js';
import { ModalOverlay }         from './modals/ModalOverlay.js';

function Router() {
  const { screen } = useScreen();
  return (
    <>
      {screen === 'title'        && <TitleScreen />}
      {screen === 'starter'      && <StarterScreen />}
      {screen === 'opponent'     && <OpponentScreen />}
      {screen === 'collection'   && <CollectionScreen />}
      {screen === 'shop'         && <ShopScreen />}
      {screen === 'pack-opening' && <PackOpeningScreen />}
      {screen === 'game'         && <GameScreen />}
      {screen === 'deckbuilder'  && <DeckbuilderScreen />}
      <HoverPreview />
      <CardActivationOverlay />
      <ModalOverlay />
    </>
  );
}

export default function App() {
  return (
    <ScreenProvider>
      <ProgressionProvider>
        <ModalProvider>
          <SelectionProvider>
            <GameProvider>
              <Router />
            </GameProvider>
          </SelectionProvider>
        </ModalProvider>
      </ProgressionProvider>
    </ScreenProvider>
  );
}
