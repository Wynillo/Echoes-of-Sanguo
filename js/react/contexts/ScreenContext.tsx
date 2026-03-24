import { createContext, useContext, useState } from 'react';
import { gsap } from 'gsap';
import { Audio } from '../../audio.js';

export type Screen =
  | 'press-start'
  | 'title'
  | 'starter'
  | 'opponent'
  | 'game'
  | 'shop'
  | 'pack-opening'
  | 'collection'
  | 'deckbuilder'
  | 'save-point'
  | 'campaign';

interface ScreenCtx {
  screen: Screen;
  setScreen: (s: Screen) => void;
  navigateTo: (s: Screen) => void;
}

const ScreenContext = createContext<ScreenCtx>({ screen: 'press-start', setScreen: () => {}, navigateTo: () => {} });

const SCREEN_MUSIC: Partial<Record<Screen, string>> = {
  title:          'music_title',
  starter:        'music_title',
  opponent:       'music_title',
  campaign:       'music_title',
  game:           'music_battle',
  shop:           'music_shop',
  'pack-opening': 'music_shop',
  collection:     'music_title',
  deckbuilder:    'music_title',
  'save-point':   'music_title',
};

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('press-start');

  function navigateTo(s: Screen) {
    const overlay = document.getElementById('screen-transition-overlay');
    if (!overlay) { setScreen(s); playScreenMusic(s); return; }
    gsap.to(overlay, {
      opacity: 1, duration: 0.18, ease: 'none',
      onComplete() {
        setScreen(s);
        playScreenMusic(s);
        gsap.to(overlay, { opacity: 0, duration: 0.28, delay: 0.05, ease: 'none' });
      },
    });
  }

  function playScreenMusic(s: Screen) {
    const track = SCREEN_MUSIC[s];
    if (track) Audio.playMusic(track);
  }

  return <ScreenContext.Provider value={{ screen, setScreen, navigateTo }}>{children}</ScreenContext.Provider>;
}

export function useScreen() { return useContext(ScreenContext); }
