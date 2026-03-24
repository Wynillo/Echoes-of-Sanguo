// Entry point — loads card data from base.tcg then mounts the app
import './cards.js';           // empty data stores + helpers
import './mod-api.js';         // exposes window.EchoesOfSanguoMod (live references to stores)
import { loadTcgFile } from './tcg-format/tcg-loader.js';

await loadTcgFile(import.meta.env.BASE_URL + 'base.tcg'); // populates CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS
// Note: blob URLs are intentionally kept alive for the session lifetime.
// Call revokeTcgImages() before reloading the TCG file if needed.

await import('./progression.js');
await import('./i18n.js');          // must come after progression.js (reads saved language)
await import('./engine.js');
await import('./react/index.js');
