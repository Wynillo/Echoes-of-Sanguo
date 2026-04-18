// Entry point — loads card data from base.tcg then mounts the app
import './cards.js';           // empty data stores + helpers
import './mod-api.js';         // exposes window.EchoesOfSanguoMod (live references to stores)
import { reloadTcgLocale } from './tcg-bridge.js';
import { loadCachedOrBundled } from './tcg-update.js';

const loadingBar = document.getElementById('loading-bar');
try {
  await loadCachedOrBundled(import.meta.env.BASE_URL + 'base.tcg', {
    onProgress: (pct) => {
      if (loadingBar) (loadingBar as HTMLElement).style.width = pct + '%';
    },
  }); // populates CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS
  // Note: blob URLs are intentionally kept alive for the session lifetime.
  // Call revokeTcgImages() before reloading the TCG file if needed.
} catch (e) {
  console.error('[main] Failed to load base.tcg:', e);
  const container = document.createElement('div');
  container.style.cssText = 'font-family:monospace;color:#ff6060;padding:2rem;background:#0a0a1a;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:1rem';

  const title = document.createElement('p');
  title.textContent = 'Failed to load card data.';
  title.style.fontSize = '1.2rem';

  const message = document.createElement('p');
  message.textContent = 'Please check your internet connection and try again.';
  message.style.cssText = 'color:#888;font-size:0.9rem';

  const button = document.createElement('button');
  button.textContent = 'Retry';
  button.style.cssText = 'margin-top:1rem;padding:0.6rem 1.5rem;border-radius:0.4rem;background:#1a2a4a;color:#c8a84b;border:1px solid #c8a84b;cursor:pointer;font-size:0.9rem;font-family:monospace';
  button.addEventListener('click', () => location.reload());

  container.appendChild(title);
  container.appendChild(message);
  container.appendChild(button);
  document.body.appendChild(container);

  throw e;
}

await import('./progression.js');
await import('./i18n.js');          // must come after progression.js (reads saved language)
const { default: i18n } = await import('i18next');
await reloadTcgLocale(i18n.language);
await import('./engine.js');

// Fade out loading screen and wait for fonts before mounting React
const loadingScreen = document.querySelector('.loading-screen') as HTMLElement | null;
if (loadingScreen) {
  loadingScreen.style.transition = 'opacity 0.3s ease';
  loadingScreen.style.opacity = '0';
  await new Promise(r => setTimeout(r, 300));
}
await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]);
await import('./react/index.js');
