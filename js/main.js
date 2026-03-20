// Entry point — imports trigger module execution in dependency order
import './cards.js';
import './cards-data.js';   // must come after cards.js (extends CARD_DB)
import './mod-api.js';      // exposes window.AetherialClashMod for external mods
import './progression.js';
import './engine.js';
import './react/index.js';
