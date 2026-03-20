import { createContext, useContext, useState } from 'react';

export type Screen =
  | 'title'
  | 'starter'
  | 'opponent'
  | 'game'
  | 'shop'
  | 'pack-opening'
  | 'collection'
  | 'deckbuilder';

interface ScreenCtx {
  screen: Screen;
  setScreen: (s: Screen) => void;
}

const ScreenContext = createContext<ScreenCtx>({ screen: 'title', setScreen: () => {} });

export function ScreenProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('title');
  return <ScreenContext.Provider value={{ screen, setScreen }}>{children}</ScreenContext.Provider>;
}

export function useScreen() { return useContext(ScreenContext); }
