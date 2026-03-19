// ============================================================
// AETHERIAL CLASH - UI Shell / Entry Point
// ============================================================
import { OPPONENT_CONFIGS, PLAYER_DECK_IDS } from './cards.js';
import { Progression } from './progression.js';
import { GameEngine, AetherialClash } from './engine.js';

import {
  SEL, resetSel,
  setGame, getGame,
  setCurrentDeck, getCurrentDeck,
  setLastOpponentConfig, getLastOpponentConfig,
} from './ui-state.js';

import { renderAll } from './ui-render.js';

import {
  addLogEntry,
  showPromptModal,
  showResultScreen,
  handleDuelEnd,
  closeActionMenu,
  showCardList,
  showCardDetail,
  showDeckbuilder,
  saveDeck,
  toggleDeckPanel,
  renderDeckbuilder,
  setLoadDeckFn,
  onHandCardClick,
} from './ui-events.js';

import { showCardActivation, playAttackAnim } from './ui-animations.js';
import { incrementPendingDrawCount } from './ui-render.js';

// ── Load deck from localStorage ────────────────────────────
export function loadDeck() {
  try {
    const saved = localStorage.getItem('aetherialClash_deck');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCurrentDeck(parsed);
        return;
      }
    }
  } catch(e) {}
  setCurrentDeck([...PLAYER_DECK_IDS]);
}

// Register loadDeck with the deckbuilder in ui-events.js
setLoadDeckFn(loadDeck);

// ── UI Callbacks (passed to GameEngine) ───────────────────
export const uiCallbacks = {
  render(state){ renderAll(state); },
  log(msg){ addLogEntry(msg); },
  prompt(opts){ return showPromptModal(opts); },
  showResult(type){ showResultScreen(type, null); },
  showActivation(card, text){ return showCardActivation(card, text); },
  onDraw(owner, count){ if(owner === 'player') incrementPendingDrawCount(count); },
  playAttackAnimation(ao, az, dO, dZ){ return playAttackAnim(ao, az, dO, dZ); },
  onDuelEnd(result, opponentId){ handleDuelEnd(result, opponentId); },
};

// ── Start game ─────────────────────────────────────────────
export function startGame(opponentConfig){
  setLastOpponentConfig(opponentConfig || null);
  loadDeck();
  resetSel();
  document.getElementById('log-entries').innerHTML = '';
  const g = new GameEngine(uiCallbacks);
  setGame(g);
  const deck = getCurrentDeck();
  g.initGame(deck.length > 0 ? deck : PLAYER_DECK_IDS, opponentConfig || null);
}

// Wird aus screens.js nach Gegnerauswahl aufgerufen
export function startDuelVsOpponent(opponentId){
  const cfg = OPPONENT_CONFIGS.find(o => o.id === opponentId);
  if(!cfg) return;
  document.getElementById('opponent-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  startGame(cfg);
}

// Expose globally so screens.js (non-module) can call it
window.startDuelVsOpponent = startDuelVsOpponent;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if(typeof Progression !== 'undefined') Progression.init();

  if(typeof Progression !== 'undefined' && Progression.isFirstLaunch()) {
    if(typeof showStarterSelection === 'function') {
      showStarterSelection();
    }
  }

  // Title screen
  document.getElementById('btn-start').addEventListener('click', () => {
    if(typeof showOpponentSelect === 'function'){
      showOpponentSelect();
    } else {
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      startGame();
    }
  });
  document.getElementById('btn-card-list-title').addEventListener('click', () => {
    showCardList();
  });
  document.getElementById('btn-deckbuilder').addEventListener('click', showDeckbuilder);
  document.getElementById('btn-db-back').addEventListener('click', () => {
    document.getElementById('deckbuilder-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    if(typeof _updateCoinDisplay === 'function') _updateCoinDisplay();
  });
  document.getElementById('btn-db-save').addEventListener('click', saveDeck);
  document.getElementById('db-panel-title-btn').addEventListener('click', toggleDeckPanel);
  document.querySelectorAll('.db-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.db-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDeckbuilder();
    });
  });

  // Phase buttons
  document.getElementById('btn-main-to-battle').addEventListener('click', () => {
    const game = getGame();
    if(game){ resetSel(); game.advancePhase(); }
  });
  document.getElementById('btn-battle-to-end').addEventListener('click', () => {
    const game = getGame();
    if(game) game.advancePhase();
    resetSel();
    document.getElementById('btn-direct-attack').classList.add('hidden');
  });
  document.getElementById('btn-end-turn').addEventListener('click', () => {
    const game = getGame();
    if(game) game.endTurn();
    resetSel();
    document.getElementById('btn-direct-attack').classList.add('hidden');
  });
  document.getElementById('btn-direct-attack').addEventListener('click', () => {
    const game = getGame();
    if(game && SEL.mode === 'attack'){
      game.attackDirect('player', SEL.attackerZone);
      resetSel();
      document.getElementById('btn-direct-attack').classList.add('hidden');
    }
  });

  // Cancel / close buttons
  document.getElementById('btn-cancel-action').addEventListener('click', closeActionMenu);
  document.getElementById('btn-close-detail').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('card-detail-modal').classList.add('hidden');
  });
  document.getElementById('btn-close-cardlist').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('cardlist-modal').classList.add('hidden');
  });
  document.getElementById('btn-close-grave').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('grave-select-modal').classList.add('hidden');
  });

  // Result screen
  document.getElementById('btn-play-again').addEventListener('click', () => {
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    startGame(getLastOpponentConfig());
  });
  document.getElementById('btn-back-title').addEventListener('click', () => {
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    if(typeof _updateCoinDisplay === 'function') _updateCoinDisplay();
  });

  // Card list from game
  document.getElementById('btn-card-list-game').addEventListener('click', showCardList);

  // Manual log download
  document.getElementById('btn-download-log').addEventListener('click', () => {
    AetherialClash.downloadLog('manuell');
  });

  // Graveyard click
  document.getElementById('player-grave').addEventListener('click', () => {
    const game = getGame();
    if(!game) return;
    const grave = game.getState().player.graveyard;
    if(grave.length > 0) showCardDetail(grave[grave.length-1]);
  });
  document.getElementById('opp-grave').addEventListener('click', () => {
    const game = getGame();
    if(!game) return;
    const grave = game.getState().opponent.graveyard;
    if(grave.length > 0) showCardDetail(grave[grave.length-1]);
  });

  // ── Keyboard shortcuts ────────────────────────────────────
  // Escape  — cancel selection / close modal
  // 1-5     — play hand card by position
  // B       — advance to Battle phase
  // E       — advance to End phase
  // T       — End turn
  document.addEventListener('keydown', (ev) => {
    // Escape: close any open modal first; if none, cancel selection
    if(ev.key === 'Escape'){
      const overlay = document.getElementById('modal-overlay');
      if(!overlay.classList.contains('hidden')){
        closeActionMenu();
        ['card-detail-modal','grave-select-modal','cardlist-modal','trap-prompt-modal'].forEach(id => {
          document.getElementById(id)?.classList.add('hidden');
        });
        overlay.classList.add('hidden');
      } else {
        resetSel();
      }
      return;
    }

    // All remaining shortcuts require an active player turn
    const game = getGame();
    if(!game) return;
    const state = game.getState();
    if(!state || state.activePlayer !== 'player') return;
    // Don't fire shortcuts when the user is typing in an input
    if(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;

    // 1-5: play hand card by index
    if(ev.key >= '1' && ev.key <= '5'){
      const idx = parseInt(ev.key) - 1;
      if(idx < state.player.hand.length){
        onHandCardClick(state.player.hand[idx], idx, state);
      }
      return;
    }

    const key = ev.key.toLowerCase();

    // B: main → battle phase
    if(key === 'b'){
      const btn = document.getElementById('btn-main-to-battle');
      if(btn && !btn.disabled){ game.advancePhase(); resetSel(); }
      return;
    }
    // E: battle → end phase
    if(key === 'e'){
      const btn = document.getElementById('btn-battle-to-end');
      if(btn && !btn.disabled){ game.advancePhase(); resetSel(); document.getElementById('btn-direct-attack').classList.add('hidden'); }
      return;
    }
    // T: end turn
    if(key === 't'){
      game.endTurn();
      resetSel();
      document.getElementById('btn-direct-attack').classList.add('hidden');
      return;
    }
  });
});

// ── Global Error Handlers ──────────────────────────────────
window.addEventListener('unhandledrejection', event => {
  AetherialClash.log('ERROR', 'Unbehandelter Promise-Fehler:', event.reason);
  console.error('[AetherialClash] Unhandled rejection:', event.reason);
  AetherialClash.downloadLog('unhandled_rejection');
});

window.addEventListener('error', event => {
  AetherialClash.log('ERROR', `JS-Fehler: ${event.message}`, { file: event.filename, line: event.lineno, col: event.colno });
  console.error('[AetherialClash] JS Error:', event.message, `(${event.filename}:${event.lineno})`);
  AetherialClash.downloadLog('js_error');
});
