import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
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
  | 'save-slots'
  | 'campaign'
  | 'dialogue'
  | 'duel-result';

interface ScreenCtx {
  screen: Screen;
  screenData: Record<string, unknown> | null;
  setScreen: (s: Screen) => void;
  navigateTo: (s: Screen, data?: Record<string, unknown>) => void;
  navigateBack: () => void;
}

const ScreenContext = createContext<ScreenCtx>({ screen: 'press-start', screenData: null, setScreen: () => {}, navigateTo: () => {}, navigateBack: () => {} });

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
  'save-slots':   'music_title',
  // duel-result music is set explicitly by GameContext before navigating
};

/** Fallback back-navigation map when history stack is empty */
const BACK_MAP: Partial<Record<Screen, Screen>> = {
  shop:           'save-point',
  collection:     'save-point',
  deckbuilder:    'save-point',
  opponent:       'save-point',
  campaign:       'save-point',
  'pack-opening': 'shop',
  'save-point':   'title',
};

/** Screens where back navigation should be blocked */
const NO_BACK: Set<Screen> = new Set(['press-start', 'title', 'game', 'starter', 'save-slots']);

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('press-start');
  const [screenData, setScreenData] = useState<Record<string, unknown> | null>(null);
  const transitionRef = useRef<gsap.core.Tween | null>(null);
  const historyRef = useRef<Screen[]>([]);
  // Flag to suppress pushState during popstate-driven navigation
  const isPopNavRef = useRef(false);
  const screenRef = useRef<Screen>(screen);
  screenRef.current = screen;

  function doTransition(s: Screen, data?: Record<string, unknown>) {
    const overlay = document.getElementById('screen-transition-overlay');
    if (!overlay) { setScreenData(data ?? null); setScreen(s); playScreenMusic(s); return; }
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

  function navigateTo(s: Screen, data?: Record<string, unknown>) {
    // Push current screen onto history stack
    historyRef.current.push(screenRef.current);
    if (!isPopNavRef.current) {
      try { window.history.pushState({ screen: s }, ''); } catch { /* ignored */ }
    }
    doTransition(s, data);
  }

  const navigateBack = useCallback(() => {
    if (NO_BACK.has(screenRef.current)) return;
    const prev = historyRef.current.pop() ?? BACK_MAP[screenRef.current];
    if (!prev) return;
    if (!isPopNavRef.current) {
      try { window.history.back(); } catch { /* ignored */ }
      // The actual navigation will happen via the popstate handler
      // But we set a flag so the popstate handler knows to use this prev
    }
    doTransition(prev);
  }, []);

  function playScreenMusic(s: Screen) {
    const track = SCREEN_MUSIC[s];
    if (track) Audio.playMusic(track);
  }

  // Initial music + history state
  useEffect(() => {
    playScreenMusic(screen);
    try { window.history.replaceState({ screen }, ''); } catch { /* ignored */ }
  }, []);

  // Listen for browser/mobile back button
  useEffect(() => {
    function handlePopstate() {
      if (NO_BACK.has(screenRef.current)) {
        // Re-push to prevent leaving the app
        try { window.history.pushState({ screen: screenRef.current }, ''); } catch { /* ignored */ }
        return;
      }
      const prev = historyRef.current.pop() ?? BACK_MAP[screenRef.current];
      if (!prev) {
        try { window.history.pushState({ screen: screenRef.current }, ''); } catch { /* ignored */ }
        return;
      }
      isPopNavRef.current = true;
      doTransition(prev);
      isPopNavRef.current = false;
    }
    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, []);

  return <ScreenContext.Provider value={{ screen, screenData, setScreen, navigateTo, navigateBack }}>{children}</ScreenContext.Provider>;
}

export function useScreen() { return useContext(ScreenContext); }
