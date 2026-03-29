// Entry point — loads card data from base.tcg then mounts the app
import './cards.js';           // empty data stores + helpers
import './mod-api.js';         // exposes window.EchoesOfSanguoMod (live references to stores)
import { loadAndApplyTcg } from './tcg-bridge.js';

const loadingBar = document.getElementById('loading-bar');
try {
  await loadAndApplyTcg(import.meta.env.BASE_URL + 'base.tcg', {
    onProgress: (pct) => {
      if (loadingBar) (loadingBar as HTMLElement).style.width = pct + '%';
    },
  }); // populates CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS
  // Note: blob URLs are intentionally kept alive for the session lifetime.
  // Call revokeTcgImages() before reloading the TCG file if needed.
} catch (e) {
  console.error('[main] Failed to load base.tcg:', e);
  document.body.innerHTML =
    '<div style="font-family:monospace;color:#ff6060;padding:2rem;background:#0a0a1a;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem">' +
    '<p style="font-size:1.2rem">Failed to load card data.</p>' +
    '<p style="color:#888;font-size:0.9rem">Please refresh the page or check your connection.</p>' +
    '</div>';
  throw e;
}

await import('./progression.js');
await import('./i18n.js');          // must come after progression.js (reads saved language)
await import('./engine.js');

// Fade out loading screen and wait for fonts before mounting React
const loadingScreen = document.querySelector('.loading-screen') as HTMLElement | null;
if (loadingScreen) {
  loadingScreen.style.transition = 'opacity 0.3s ease';
  loadingScreen.style.opacity = '0';
  await new Promise(r => setTimeout(r, 300));
}
await document.fonts.ready;
await import('./react/index.js');
