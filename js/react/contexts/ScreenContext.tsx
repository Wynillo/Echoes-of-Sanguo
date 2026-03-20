import { createContext, useContext, useState } from 'react';
import { gsap } from 'gsap';

export type Screen =
  | 'title'
  | 'starter'
  | 'opponent'
  | 'game'
  | 'shop'
  | 'pack-opening'
  | 'collection'
  | 'deckbuilder'
  | 'save-point';

interface ScreenCtx {
  screen: Screen;
  setScreen: (s: Screen) => void;
  navigateTo: (s: Screen) => void;
}

const ScreenContext = createContext<ScreenCtx>({ screen: 'title', setScreen: () => {}, navigateTo: () => {} });

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('title');

  function navigateTo(s: Screen) {
    const overlay = document.getElementById('screen-transition-overlay');
    if (!overlay) { setScreen(s); return; }
    gsap.to(overlay, {
      opacity: 1, duration: 0.18, ease: 'none',
      onComplete() {
        setScreen(s);
        gsap.to(overlay, { opacity: 0, duration: 0.28, delay: 0.05, ease: 'none' });
      },
    });
  }

  return <ScreenContext.Provider value={{ screen, setScreen, navigateTo }}>{children}</ScreenContext.Provider>;
}

export function useScreen() { return useContext(ScreenContext); }
