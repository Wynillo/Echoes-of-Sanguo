// Entry point — imports trigger module execution in dependency order
import './cards.js';
import './cards-data.js';   // must come after cards.js (extends CARD_DB)
import './mod-api.js';      // exposes window.AetherialClashMod for external mods
import './progression.js';
import './i18n.js';         // must come after progression.js (reads saved language)
import './engine.js';
import './react/index.js';
