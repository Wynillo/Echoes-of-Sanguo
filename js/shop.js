// ============================================================
// AETHERIAL CLASH - Shop & Booster System
// ============================================================
import { CARD_DB, RARITY, RARITY_COLOR, RARITY_NAME, RACE_NAME, RACE_ICON, RACE } from './cards.js';
import { Progression } from './progression.js';

const PACK_TYPES = {
  starter: {
    id: 'starter',
    name: 'Starterpack',
    desc: '9 Karten · Eine Rasse · C/U-lastig',
    price: 200,
    icon: '✦',
    color: '#4080a0',
  },
  race: {
    id: 'race',
    name: 'Rassen-Pack',
    desc: '9 Karten · Gewählte Rasse · Standard',
    price: 350,
    icon: '⚔',
    color: '#a06020',
  },
  aether: {
    id: 'aether',
    name: 'Ätherpack',
    desc: '9 Karten · Alle Rassen · Standard',
    price: 500,
    icon: '◈',
    color: '#6040a0',
  },
  rarity: {
    id: 'rarity',
    name: 'Seltenheitspack',
    desc: '9 Karten · Min. Rare · Erhöhte SR/UR-Chance',
    price: 600,
    icon: '★',
    color: '#c0a020',
  },
};

// Slot-Regeln: Slot 1-5 Common, 6-7 Uncommon, 8 Rare, 9 R/SR/UR
function _pickRarity(slot, packType) {
  if (packType === 'rarity') {
    // Seltenheitspack: alle Slots min. Rare, Slot 8-9 SR/UR erhöht
    if (slot <= 7) return RARITY.RARE;
    const r = Math.random();
    if (r < 0.15) return RARITY.ULTRA_RARE;
    if (r < 0.45) return RARITY.SUPER_RARE;
    return RARITY.RARE;
  }
  if (slot <= 5) return RARITY.COMMON;
  if (slot <= 7) return RARITY.UNCOMMON;
  if (slot === 8) return RARITY.RARE;
  // Slot 9
  const r = Math.random();
  if (r < 0.05) return RARITY.ULTRA_RARE;
  if (r < 0.25) return RARITY.SUPER_RARE;
  return RARITY.RARE;
}

function _allCardsByRarity(rarity, race) {
  return Object.values(CARD_DB).filter(c =>
    c.rarity === rarity && (!race || c.race === race)
  );
}

function _pickCard(rarity, race) {
  let pool = _allCardsByRarity(rarity, race);
  if (!pool.length) {
    // Fallback: relax rarity by one step
    const fallbacks = {
      [RARITY.ULTRA_RARE]: RARITY.SUPER_RARE,
      [RARITY.SUPER_RARE]: RARITY.RARE,
      [RARITY.RARE]:       RARITY.UNCOMMON,
      [RARITY.UNCOMMON]:   RARITY.COMMON,
    };
    pool = _allCardsByRarity(fallbacks[rarity] || RARITY.COMMON, race);
  }
  if (!pool.length) pool = Object.values(CARD_DB);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Opens a pack and returns array of 9 card objects.
 * @param {string} packType  - 'starter'|'race'|'aether'|'rarity'
 * @param {string} [race]    - Required when packType === 'race'; optional for starter
 */
function openPack(packType, race) {
  const cards = [];
  // For starter/race packs, use the given/player's race
  const targetRace = (packType === 'race') ? race
    : (packType === 'starter') ? (Progression.getStarterRace() || race || null)
    : null; // aether/rarity = all races

  for (let slot = 1; slot <= 9; slot++) {
    const rarity = _pickRarity(slot, packType);
    const card   = _pickCard(rarity, targetRace);
    cards.push(card);
  }
  return cards;
}

// ── Shop Screen ───────────────────────────────────────────

let _currentPackRace = null;
let _lastOpenedCards = [];

function showShop() {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('shop-screen').classList.remove('hidden');
  _renderShopPacks();
  _updateShopCoinDisplay();
}

function hideShop() {
  document.getElementById('shop-screen').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  if (typeof _updateCoinDisplay === 'function') _updateCoinDisplay();
}

function _updateShopCoinDisplay() {
  const el = document.getElementById('shop-coin-display');
  if (el) el.textContent = Progression.getCoins().toLocaleString('de-DE');
}

function _renderShopPacks() {
  const grid = document.getElementById('shop-pack-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const coins = Progression.getCoins();

  Object.values(PACK_TYPES).forEach(pt => {
    const affordable = coins >= pt.price;
    const tile = document.createElement('div');
    tile.className = `shop-pack-tile${affordable ? '' : ' shop-pack-disabled'}`;
    tile.style.setProperty('--pack-color', pt.color);
    tile.innerHTML = `
      <div class="shop-pack-icon">${pt.icon}</div>
      <div class="shop-pack-name">${pt.name}</div>
      <div class="shop-pack-desc">${pt.desc}</div>
      <div class="shop-pack-price">◈ ${pt.price.toLocaleString('de-DE')}</div>
      ${pt.id === 'race' ? '<div class="shop-race-select-wrap"><select id="shop-race-select" class="shop-race-select"></select></div>' : ''}
      <button class="btn-buy-pack" data-pack="${pt.id}" ${affordable ? '' : 'disabled'}>Pack kaufen</button>
    `;
    if (pt.id === 'race') {
      const sel = tile.querySelector('#shop-race-select');
      if (sel) {
        Object.entries(RACE_NAME).forEach(([k, v]) => {
          const opt = document.createElement('option');
          opt.value = k;
          opt.textContent = `${RACE_ICON[k] || ''} ${v}`;
          sel.appendChild(opt);
        });
        // Default to player's starter race
        const sr = Progression.getStarterRace();
        if (sr) sel.value = sr;
      }
    }
    grid.appendChild(tile);
  });

  // Listeners live on the grid via delegation — see DOMContentLoaded below.
}

function _buyPack(packType, race) {
  const pt = PACK_TYPES[packType];
  if (!pt) return;
  if (!Progression.spendCoins(pt.price)) {
    // Not enough coins
    const msg = document.getElementById('shop-msg');
    if (msg) { msg.textContent = 'Nicht genug Äther-Münzen!'; setTimeout(()=>msg.textContent='', 2000); }
    return;
  }
  const cards = openPack(packType, race);
  _lastOpenedCards = cards;
  // Snapshot BEFORE adding — used by _showPackOpening to determine which cards are truly new
  const preOpenCollection = Progression.getCollection();
  Progression.addCardsToCollection(cards.map(c => c.id));
  _showPackOpening(cards, preOpenCollection);
}

// ── Pack Opening Screen ───────────────────────────────────

function _showPackOpening(cards, preOpenCollection) {
  document.getElementById('shop-screen').classList.add('hidden');
  const screen = document.getElementById('pack-opening-screen');
  screen.classList.remove('hidden');
  _renderPackCards(cards, preOpenCollection);
}

function _renderPackCards(cards, preOpenCollection) {
  const grid = document.getElementById('pack-card-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Build a set of IDs the player owned BEFORE this pack was opened.
  // Comparing against the pre-open snapshot correctly marks first-ever
  // acquisitions as new — even when the same card appears twice in one pack.
  const ownedBefore = new Set();
  if (preOpenCollection) {
    preOpenCollection.forEach(e => { if (e.count > 0) ownedBefore.add(e.id); });
  }

  cards.forEach((card, i) => {
    const isNew = !ownedBefore.has(card.id);
    const rarity = card.rarity || RARITY.COMMON;
    const rarColor = RARITY_COLOR[rarity] || '#aaa';

    const wrapper = document.createElement('div');
    wrapper.className = 'pack-card-wrapper';
    wrapper.style.animationDelay = `${i * 0.08}s`;

    const inner = document.createElement('div');
    inner.className = `pack-card-inner card ${card.type}-card attr-${card.attribute || 'spell'}`;
    inner.style.setProperty('--rarity-color', rarColor);

    inner.innerHTML = `
      ${isNew ? '<div class="pack-new-badge">NEU!</div>' : ''}
      <div class="pack-rarity-bar" style="background:${rarColor}"></div>
      <div class="card-header">
        <span class="card-name">${card.name}</span>
        <span class="card-level">${card.level ? '★'.repeat(Math.min(card.level,5)) : ''}</span>
      </div>
      <div class="card-body">
        <div class="card-type-line">${card.type === 'normal' ? 'Normal' : card.type === 'effect' ? 'Effekt' : card.type === 'fusion' ? 'Fusion' : card.type === 'spell' ? 'Zauber' : 'Falle'} · ${RACE_NAME[card.race] || ''}</div>
        <div class="card-desc">${card.description || ''}</div>
      </div>
      ${card.atk !== undefined ? `<div class="card-footer"><span>ATK ${card.atk}</span><span>DEF ${card.def}</span></div>` : ''}
    `;
    wrapper.appendChild(inner);
    grid.appendChild(wrapper);
  });
}

// ── Initialization ────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Delegated listener for pack-buy buttons — attached once so re-renders don't stack listeners.
  const packGrid = document.getElementById('shop-pack-grid');
  if (packGrid) {
    packGrid.addEventListener('click', e => {
      const btn = e.target.closest('.btn-buy-pack');
      if (!btn || btn.disabled) return;
      const pt = btn.dataset.pack;
      let race = null;
      if (pt === 'race') {
        const sel = packGrid.querySelector('#shop-race-select');
        race = sel ? sel.value : null;
      }
      _buyPack(pt, race);
    });
  }

  // Shop-Button im Titel
  const shopBtn = document.getElementById('btn-shop');
  if (shopBtn) shopBtn.addEventListener('click', showShop);

  // Zurück vom Shop
  const shopBack = document.getElementById('btn-shop-back');
  if (shopBack) shopBack.addEventListener('click', hideShop);

  // Pack-Opening zurück
  const packBack = document.getElementById('btn-pack-back');
  if (packBack) {
    packBack.addEventListener('click', () => {
      document.getElementById('pack-opening-screen').classList.add('hidden');
      showShop();
    });
  }

  // Zum Hauptmenü von Pack-Opening
  const packHome = document.getElementById('btn-pack-home');
  if (packHome) {
    packHome.addEventListener('click', () => {
      document.getElementById('pack-opening-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
      if (typeof _updateCoinDisplay === 'function') _updateCoinDisplay();
    });
  }
});
