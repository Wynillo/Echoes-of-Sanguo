import { createContext, useContext, useState, useRef, useEffect } from 'react';
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
  | 'campaign'
  | 'dialogue'
  | 'defeated';

interface ScreenCtx {
  screen: Screen;
  screenData: Record<string, unknown> | null;
  setScreen: (s: Screen) => void;
  navigateTo: (s: Screen, data?: Record<string, unknown>) => void;
}

const ScreenContext = createContext<ScreenCtx>({ screen: 'press-start', screenData: null, setScreen: () => {}, navigateTo: () => {} });

const SCREEN_MUSIC: Partial<Record<Screen, string>> = {
  'press-start':  'music_title',
  title:          'music_title',
  starter:        'music_title',
  opponent:       'music_title',
  campaign:       'music_title',
  game:           'music_battle',
  shop:           'music_shop',
  'pack-opening': 'music_shop',
  collection:     'music_shop',
  deckbuilder:    'music_shop',
  'save-point':   'music_shop',
  defeated:       'music_defeat',
};

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('press-start');
  const [screenData, setScreenData] = useState<Record<string, unknown> | null>(null);
  // Track the active transition tween to kill it on rapid re-navigation
  const transitionRef = useRef<gsap.core.Tween | null>(null);

  function navigateTo(s: Screen, data?: Record<string, unknown>) {
    const overlay = document.getElementById('screen-transition-overlay');
    if (!overlay) { setScreenData(data ?? null); setScreen(s); playScreenMusic(s); return; }
    // Kill any in-flight transition to prevent stacking
    if (transitionRef.current) { transitionRef.current.kill(); gsap.set(overlay, { opacity: 0 }); }
    transitionRef.current = gsap.to(overlay, {
      opacity: 1, duration: 0.18, ease: 'none',
      onComplete() {
        setScreenData(data ?? null);
        setScreen(s);
        playScreenMusic(s);
        transitionRef.current = gsap.to(overlay, { opacity: 0, duration: 0.28, delay: 0.05, ease: 'none' });
      },
    });
  }

  function playScreenMusic(s: Screen) {
    const track = SCREEN_MUSIC[s];
    if (track) Audio.playMusic(track);
  }

  // Start music for the initial screen once audio context is ready
  useEffect(() => {
    playScreenMusic(screen);
  }, []);

  return <ScreenContext.Provider value={{ screen, screenData, setScreen, navigateTo }}>{children}</ScreenContext.Provider>;
}

export function useScreen() { return useContext(ScreenContext); }
