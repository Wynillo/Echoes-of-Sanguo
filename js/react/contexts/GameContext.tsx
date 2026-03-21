import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import type { GameState, UICallbacks, OpponentConfig, CardData } from '../../types.js';
import { useModal } from './ModalContext.js';
import { useSelection } from './SelectionContext.js';
import { useProgression } from './ProgressionContext.js';
import { useScreen } from './ScreenContext.js';
import { Audio } from '../../audio.js';

interface GameCtx {
  gameState:          GameState | null;
  gameRef:            React.MutableRefObject<any>;
  logEntries:         string[];
  pendingDraw:        number;
  lastOpponent:       OpponentConfig | null;
  startGame:          (opponentConfig?: OpponentConfig | null) => void;
  clearPendingDraw:   () => void;
}

const GameContext = createContext<GameCtx>({
  gameState: null, gameRef: { current: null }, logEntries: [],
  pendingDraw: 0, lastOpponent: null,
  startGame: () => {}, clearPendingDraw: () => {},
});

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState,    setGameState]    = useState<GameState | null>(null);
  const [logEntries,   setLogEntries]   = useState<string[]>([]);
  const [pendingDraw,  setPendingDraw]  = useState(0);
  const [lastOpponent, setLastOpponent] = useState<OpponentConfig | null>(null);

  const gameRef = useRef<any>(null);

  const { openModal }     = useModal();
  const { resetSel }      = useSelection();
  const { currentDeck, loadDeck, refresh } = useProgression();
  const { setScreen }     = useScreen();

  // Stable refs so useMemo(() => uiCallbacks, []) can safely use current values
  const openModalRef   = useRef(openModal);   openModalRef.current   = openModal;
  const resetSelRef    = useRef(resetSel);    resetSelRef.current    = resetSel;
  const setScreenRef   = useRef(setScreen);   setScreenRef.current   = setScreen;
  const refreshRef     = useRef(refresh);     refreshRef.current     = refresh;
  const lastOppRef     = useRef<OpponentConfig | null>(null);

  const uiCallbacks = useMemo<UICallbacks>(() => ({
    render: (state) => setGameState({ ...state }),
    log: (msg) => setLogEntries(prev => [msg, ...prev].slice(0, 25)),
    prompt: (opts) => new Promise(resolve => {
      openModalRef.current({ type: 'trap-prompt', opts, resolve });
    }),
    showResult: (type) => {
      /* result shown via onDuelEnd */
    },
    showActivation: (card: CardData, text: string) => {
      return import('../components/cardActivationApi.js').then(m => m.showActivation(card, text));
    },
    playAttackAnimation: (ao, az, dO, dZ) => {
      return import('../hooks/useAttackAnimation.js').then(m => m.playAttackAnim(ao, az, dO, dZ));
    },
    playSfx: (sfxId: string) => {
      Audio.playSfx(sfxId);
    },
    onDraw: (owner, count) => {
      if (owner === 'player') setPendingDraw(prev => prev + count);
    },
    onDuelEnd: (result, opponentId) => {
      Audio.playMusic(result === 'victory' ? 'music_victory' : 'music_defeat');
      let coinsEarned = 0;
      if (opponentId) {
        import('../../cards.js').then(({ OPPONENT_CONFIGS }) => {
          import('../../progression.js').then(({ Progression }) => {
            Progression.recordDuelResult(opponentId, result === 'victory');
            const cfg = OPPONENT_CONFIGS.find((o: any) => o.id === opponentId);
            if (cfg) {
              coinsEarned = result === 'victory' ? cfg.coinsWin : cfg.coinsLoss;
              Progression.addCoins(coinsEarned);
            }
            refreshRef.current();
            openModalRef.current({ type: 'result', resultType: result, coinsEarned });
          });
        });
      } else {
        openModalRef.current({ type: 'result', resultType: result, coinsEarned: 0 });
      }
    },
  }), []); // stable — uses refs internally

  const startGame = useCallback((opponentConfig?: OpponentConfig | null) => {
    const cfg = opponentConfig ?? null;
    setLastOpponent(cfg);
    lastOppRef.current = cfg;
    resetSelRef.current();
    setLogEntries([]);

    Promise.all([
      import('../../engine.js'),
      import('../../cards.js'),
    ]).then(([{ GameEngine }, { PLAYER_DECK_IDS }]) => {
      loadDeck();
      // Read deck from Progression to ensure it's fresh
      import('../../progression.js').then(({ Progression }) => {
        const saved = Progression.getDeck();
        const deck = (saved && saved.length > 0) ? saved : [...PLAYER_DECK_IDS];
        const g = new GameEngine(uiCallbacks);
        gameRef.current = g;
        g.initGame(deck, cfg);
        setScreenRef.current('game');
      });
    });
  }, [uiCallbacks, loadDeck]);

  const clearPendingDraw = useCallback(() => setPendingDraw(0), []);

  return (
    <GameContext.Provider value={{
      gameState, gameRef, logEntries, pendingDraw, lastOpponent,
      startGame, clearPendingDraw,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() { return useContext(GameContext); }
