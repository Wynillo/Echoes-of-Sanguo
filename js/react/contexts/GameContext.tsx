import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import type { GameState, UICallbacks, OpponentConfig, CardData } from '../../types.js';
import { useModal } from './ModalContext.js';
import { useSelection } from './SelectionContext.js';
import { useProgression } from './ProgressionContext.js';
import { useScreen } from './ScreenContext.js';
import { useCampaign } from './CampaignContext.js';
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
  const { loadDeck, refresh } = useProgression();
  const { setScreen, navigateTo } = useScreen();
  const { pendingDuel, setPendingDuel, refreshCampaignProgress } = useCampaign();

  // Stable refs so useMemo(() => uiCallbacks, []) can safely use current values
  const openModalRef      = useRef(openModal);      openModalRef.current      = openModal;
  const resetSelRef       = useRef(resetSel);       resetSelRef.current       = resetSel;
  const setScreenRef      = useRef(setScreen);      setScreenRef.current      = setScreen;
  const navigateToRef     = useRef(navigateTo);     navigateToRef.current     = navigateTo;
  const refreshRef        = useRef(refresh);        refreshRef.current        = refresh;
  const pendingDuelRef    = useRef(pendingDuel);    pendingDuelRef.current    = pendingDuel;
  const setPendingDuelRef = useRef(setPendingDuel); setPendingDuelRef.current = setPendingDuel;
  const refreshCampaignRef = useRef(refreshCampaignProgress); refreshCampaignRef.current = refreshCampaignProgress;
  const lastOppRef        = useRef<OpponentConfig | null>(null);

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
    playFusionAnimation: (owner, handIdx1, handIdx2, resultZone) => {
      return import('../hooks/useFusionAnimation.js').then(m => m.playFusionAnim(owner, handIdx1, handIdx2, resultZone));
    },
    playVFX: (type, owner, zone) => {
      return import('../components/vfxApi.js').then(m => m.playVFXAtZone(type, owner, zone));
    },
    playSfx: (sfxId: string) => {
      Audio.playSfx(sfxId);
    },
    onDraw: (owner, count) => {
      if (owner === 'player') setPendingDraw(prev => prev + count);
    },
    onDuelEnd: (result, opponentId) => {
      Audio.playMusic(result === 'victory' ? 'music_victory' : 'music_defeat');

      // Campaign duel: skip normal result modal, route to dialogue/campaign
      const pending = pendingDuelRef.current;
      if (pending) {
        setPendingDuelRef.current(null);
        import('../../progression.js').then(({ Progression }) => {
          const isComplete = result === 'victory' || !!pending.completeOnLoss;
          if (isComplete) {
            Progression.markNodeComplete(pending.nodeId);
            if (pending.rewards) {
              if (pending.rewards.coins) Progression.addCoins(pending.rewards.coins);
              if (pending.rewards.cards?.length) Progression.addCardsToCollection(pending.rewards.cards);
            }
          }
          // Also record the duel result for win/loss stats
          if (opponentId) {
            Progression.recordDuelResult(opponentId, result === 'victory');
          }
          refreshRef.current();
          refreshCampaignRef.current();
          if (isComplete && pending.postDialogue && pending.postDialogue.length > 0) {
            navigateToRef.current('dialogue', {
              scene: pending.postDialogue as unknown as Record<string, unknown>,
              nextScreen: 'campaign',
            });
          } else {
            navigateToRef.current('campaign');
          }
        });
        return;
      }

      // Standard (non-campaign) duel flow
      let coinsEarned = 0;
      if (opponentId) {
        import('../../cards.js').then(({ OPPONENT_CONFIGS }) => {
          import('../../progression.js').then(({ Progression }) => {
            Progression.recordDuelResult(opponentId, result === 'victory');
            const cfg = OPPONENT_CONFIGS.find((o: any) => o.id === opponentId);
            if (cfg) {
              coinsEarned = result === 'victory' ? cfg.coinsWin : 0;
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
