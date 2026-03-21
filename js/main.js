// Entry point — loads card data from base.ac then mounts the app
import './cards.js';           // empty data stores + helpers
import './mod-api.js';         // exposes window.AetherialClashMod (live references to stores)
import { loadAcFile } from './ac-format/ac-loader.js';

await loadAcFile('/base.ac'); // populates CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, STARTER_DECKS

await import('./progression.js');
await import('./i18n.js');          // must come after progression.js (reads saved language)
await import('./engine.js');
await import('./react/index.js');
