import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';
import type { GameState, UICallbacks, OpponentConfig, CardData } from '../../types.js';
import type { GameEngine as GameEngineType } from '../../engine.js';
import { useModal } from './ModalContext.js';
import { useSelection } from './SelectionContext.js';
import { useProgression } from './ProgressionContext.js';
import { useScreen } from './ScreenContext.js';
import { useCampaign } from './CampaignContext.js';
import { Audio } from '../../audio.js';
import { OPPONENT_CONFIGS } from '../../cards.js';

interface GameCtx {
  gameState:          GameState | null;
  gameRef:            React.MutableRefObject<GameEngineType | null>;
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

  const gameRef = useRef<GameEngineType | null>(null);

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
  const startGameRef      = useRef<(cfg?: OpponentConfig | null) => void>(() => {});

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
    playFusionChainAnimation: (owner, handIndices, resultZone) => {
      return import('../hooks/useFusionAnimation.js').then(m => m.playFusionChainAnim(owner, handIndices, resultZone));
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
    showCoinToss: (playerGoesFirst: boolean) => {
      return new Promise<void>(resolve => {
        openModalRef.current({ type: 'coin-toss', playerGoesFirst, resolve });
      });
    },
    onDuelEnd: (result, opponentId) => {
      Audio.playMusic(result === 'victory' ? 'music_victory' : 'music_defeat');

      // Campaign duel
      const pending = pendingDuelRef.current;
      if (pending) {
        // --- Gauntlet: back-to-back duels ---
        const gauntlet = pending.gauntletOpponents;
        const gIdx = pending.gauntletIndex ?? 0;

        if (gauntlet && gauntlet.length > 0) {
          import('../../progression.js').then(({ Progression }) => {
            // Record individual duel result
            if (opponentId) Progression.recordDuelResult(opponentId, result === 'victory');

            if (result === 'victory' && gIdx + 1 < gauntlet.length) {
              // More opponents remain — show transition, then start next duel
              const nextOppId = gauntlet[gIdx + 1];
              const nextCfg = (OPPONENT_CONFIGS as OpponentConfig[]).find(c => c.id === nextOppId);
              const nextName = nextCfg?.name ?? `Opponent #${nextOppId}`;

              // Update pending duel to advance gauntlet index
              const nextPending = { ...pending, gauntletIndex: gIdx + 1 };
              setPendingDuelRef.current(nextPending);

              openModalRef.current({
                type: 'gauntlet-transition',
                duelIndex: gIdx + 1,
                totalDuels: gauntlet.length,
                nextOpponentName: nextName,
                resolve: () => {
                  openModalRef.current(null); // close modal
                  startGameRef.current(nextCfg ?? null);
                },
              });
            } else if (result === 'victory') {
              // Final gauntlet duel won — complete node, give rewards
              setPendingDuelRef.current(null);
              Progression.markNodeComplete(pending.nodeId);
              if (pending.rewards) {
                if (pending.rewards.coins) Progression.addCoins(pending.rewards.coins);
                if (pending.rewards.cards?.length) Progression.addCardsToCollection(pending.rewards.cards);
              }
              refreshRef.current();
              refreshCampaignRef.current();
              if (pending.postDialogue && pending.postDialogue.length > 0) {
                navigateToRef.current('dialogue', {
                  scene: pending.postDialogue as unknown as Record<string, unknown>,
                  nextScreen: 'campaign',
                });
              } else {
                navigateToRef.current('campaign');
              }
            } else {
              // Defeat in gauntlet — entire gauntlet fails
              setPendingDuelRef.current(null);
              refreshRef.current();
              refreshCampaignRef.current();
              openModalRef.current({ type: 'result', resultType: result, coinsEarned: 0 });
            }
          });
          return;
        }

        // --- Standard campaign duel (non-gauntlet) ---
        setPendingDuelRef.current(null);
        Promise.all([
          import('../../progression.js'),
          import('../../campaign-store.js'),
        ]).then(([{ Progression }, { getNode }]) => {
          const isComplete = result === 'victory' || !!pending.completeOnLoss;
          if (isComplete) {
            if (getNode(pending.nodeId)) {
              Progression.markNodeComplete(pending.nodeId);
            } else {
              console.warn(`[GameContext] Campaign node "${pending.nodeId}" not found — skipping markNodeComplete.`);
            }
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
          } else if (isComplete) {
            navigateToRef.current('campaign');
          } else {
            // Defeat in campaign: show result modal so the player sees the defeat screen
            openModalRef.current({ type: 'result', resultType: result, coinsEarned: 0 });
          }
        }).catch(e => console.error('[GameContext] Failed to apply campaign duel result:', e));
        return;
      }

      // Standard (non-campaign) duel flow
      let coinsEarned = 0;
      if (opponentId) {
        import('../../cards.js').then(({ OPPONENT_CONFIGS }) =>
          import('../../progression.js').then(({ Progression }) => {
            Progression.recordDuelResult(opponentId, result === 'victory');
            const cfg = OPPONENT_CONFIGS.find((o: any) => o.id === opponentId);
            if (cfg) {
              coinsEarned = result === 'victory' ? cfg.coinsWin : 0;
              Progression.addCoins(coinsEarned);
            }
            refreshRef.current();
            openModalRef.current({ type: 'result', resultType: result, coinsEarned });
          })
        ).catch(e => console.error('[GameContext] Failed to apply standard duel result:', e));
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
    ]).then(([{ GameEngine }, { PLAYER_DECK_IDS, CARD_DB }]) => {
      loadDeck();
      // Read deck from Progression to ensure it's fresh
      import('../../progression.js').then(({ Progression }) => {
        const saved = Progression.getDeck();
        const rawIds = (saved && saved.length > 0) ? saved : [...PLAYER_DECK_IDS];
        // Strip stale or invalid card IDs so makeDeck() never crashes
        const deck = rawIds.filter(id => {
          if (!CARD_DB[id]) { console.warn(`[startGame] Removed unknown card ID "${id}" from deck.`); return false; }
          return true;
        });
        const g = new GameEngine(uiCallbacks);
        gameRef.current = g;
        g.initGame(deck, cfg).then(() => {
          setScreenRef.current('game');
        });
      });
    });
  }, [uiCallbacks, loadDeck]);
  startGameRef.current = startGame;

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
