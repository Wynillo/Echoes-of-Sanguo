// ============================================================
// AETHERIAL CLASH - Screen Controller
// Steuert Gegnerauswahl und Titelscreen-Navigation
// ============================================================
import { RACE_NAME, RACE_ICON, OPPONENT_CONFIGS, RARITY, RARITY_COLOR, RARITY_NAME, ATTR_NAME, CARD_DB } from './cards.js';
import { STARTER_DECKS } from './cards-data.js';
import { Progression } from './progression.js';

// ── Starterdeck-Auswahl ───────────────────────────────────

const RACE_INFO = {
  feuer:   { icon:'🔥', color:'#e05030', style:'Direktschaden & Burn' },
  drache:  { icon:'🐲', color:'#8040c0', style:'Hohe ATK & Unverwundbar' },
  flug:    { icon:'🦅', color:'#4090c0', style:'Ausweichen & Debuffs' },
  stein:   { icon:'🪨', color:'#808060', style:'Hohe DEF & Heilung' },
  pflanze: { icon:'🌿', color:'#40a050', style:'Heilung & Durchhalten' },
  krieger: { icon:'⚔️', color:'#c09030', style:'Kampf & ATK-Stärkung' },
  magier:  { icon:'🔮', color:'#6060c0', style:'Karten ziehen & Kontrolle' },
  elfe:    { icon:'✨', color:'#90c060', style:'Gegner schwächen & Debuffs' },
  daemon:  { icon:'💀', color:'#804090', style:'Hoher Schaden & Risiko' },
  wasser:  { icon:'🌊', color:'#3080b0', style:'Bounce & Kontrolle' },
};

const RACE_FLAVOR = {
  feuer:   'Deine Monster verbrennen den Gegner bei jeder Beschwörung. Aggressiver Direktangriff.',
  drache:  'Mächtige Drachen mit hoher ATK. Viele können nicht als Ziel gewählt werden.',
  flug:    'Flinke Flieger schwächen alle Gegnermonster. Kaum aufzuhalten.',
  stein:   'Massive Verteidigung und starke LP-Heilung. Fast unzerstörbar.',
  pflanze: 'Heilung und Ausdauer. Deine Monster regenerieren sich immer wieder.',
  krieger: 'Stärke deine Monster dauerhaft und dominiere den Kampf.',
  magier:  'Ziehe mehr Karten als dein Gegner und behalte die Kontrolle.',
  elfe:    'Schwäche alle Gegnermonster dauerhaft. Macht starke Gegner hilflos.',
  daemon:  'Risikoreich aber verheerend: Enormer Schaden durch dunkle Magie.',
  wasser:  'Spiele feindliche Monster auf die Hand zurück und kontrolliere das Feld.',
};

let _selectedStarterRace = null;

function showStarterSelection() {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('starter-screen').classList.remove('hidden');
  _selectedStarterRace = null;
  _renderStarterGrid();
}

function _renderStarterGrid() {
  const grid = document.getElementById('starter-race-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const races = Object.keys(RACE_INFO);
  races.forEach(race => {
    const info = RACE_INFO[race];
    const card = document.createElement('div');
    card.className = 'starter-race-card';
    card.style.setProperty('--race-color', info.color);
    card.dataset.race = race;
    card.innerHTML = `
      <div class="starter-race-icon">${info.icon}</div>
      <div class="starter-race-name">${RACE_NAME[race] || race}</div>
      <div class="starter-race-style">${info.style}</div>
    `;
    grid.appendChild(card);
  });
}

function _selectStarterRace(race) {
  _selectedStarterRace = race;
  // Highlight selected
  document.querySelectorAll('.starter-race-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.race === race);
  });
  // Preview
  const info = RACE_INFO[race];
  const nameEl = document.getElementById('starter-preview-name');
  const descEl = document.getElementById('starter-preview-desc');
  if (nameEl) nameEl.textContent = `${info.icon} ${RACE_NAME[race] || race}-Deck`;
  if (descEl) descEl.textContent = RACE_FLAVOR[race];
  const confirmBtn = document.getElementById('btn-starter-confirm');
  if (confirmBtn) confirmBtn.style.display = 'inline-block';
}

function _confirmStarterDeck() {
  if (!_selectedStarterRace) return;
  const race = _selectedStarterRace;
  const deckIds = STARTER_DECKS && STARTER_DECKS[race];
  if (!deckIds) { console.error('STARTER_DECKS not loaded for', race); return; }
  Progression.markStarterChosen(race);
  Progression.addCardsToCollection(deckIds);
  Progression.saveDeck(deckIds);
  document.getElementById('starter-screen').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  _updateCoinDisplay();
}

// ── Gegnerauswahl-Screen ─────────────────────────────────

function showOpponentSelect(){
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  const screen = document.getElementById('opponent-screen');
  screen.classList.remove('hidden');
  _renderOpponentGrid();
  _updateCoinDisplay();
}

function hideOpponentSelect(){
  document.getElementById('opponent-screen').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
}

function _updateCoinDisplay(){
  const el = document.getElementById('title-coin-display');
  if(el && typeof Progression !== 'undefined'){
    el.textContent = Progression.getCoins().toLocaleString('de-DE');
  }
}

function _renderOpponentGrid(){
  const grid = document.getElementById('opp-portrait-grid');
  if(!grid) return;
  grid.innerHTML = '';

  const opponents = (typeof Progression !== 'undefined')
    ? Progression.getOpponents()
    : {};

  OPPONENT_CONFIGS.forEach(cfg => {
    const oppData = opponents[cfg.id] || { unlocked: cfg.id === 1, wins: 0, losses: 0 };
    const isUnlocked = oppData.unlocked;

    const tile = document.createElement('div');
    tile.className = `opp-portrait-tile${isUnlocked ? '' : ' locked'}`;
    tile.dataset.oppId = cfg.id;

    // Farbakzent je nach Rasse
    const raceColors = {
      feuer:'#e05030', drache:'#8040c0', flug:'#4090c0',
      stein:'#808060', pflanze:'#40a050', krieger:'#c09030',
      magier:'#6060c0', elfe:'#90c060', daemon:'#503060', wasser:'#3080b0',
    };
    const accentColor = raceColors[cfg.race] || '#888';

    tile.innerHTML = `
      <div class="opp-portrait-frame" style="border-color:${accentColor}">
        <div class="opp-portrait-art" style="background:linear-gradient(135deg,${accentColor}44,#111830)">
          <div class="opp-portrait-symbol">${_raceSymbol(cfg.race)}</div>
        </div>
        ${!isUnlocked ? '<div class="opp-locked-overlay">🔒</div>' : ''}
      </div>
      <div class="opp-portrait-name">${isUnlocked ? cfg.name : '???'}</div>
      ${isUnlocked ? `<div class="opp-portrait-record">${oppData.wins}W / ${oppData.losses}L</div>` : ''}
    `;

    grid.appendChild(tile);
  });
}

function _raceSymbol(race){
  const symbols = {
    feuer:'♨', drache:'⚡', flug:'🜁', stein:'⬡',
    pflanze:'✿', krieger:'⚔', magier:'✦', elfe:'☽',
    daemon:'☠', wasser:'≋',
  };
  return symbols[race] || '?';
}

function _showOppInfo(cfg){
  const nameEl = document.getElementById('opp-info-name');
  const recEl  = document.getElementById('opp-info-record');
  if(nameEl) nameEl.textContent = `${cfg.name} – ${cfg.title}`;
  if(recEl)  recEl.textContent  = cfg.flavor;
}

function _clearOppInfo(){
  const nameEl = document.getElementById('opp-info-name');
  const recEl  = document.getElementById('opp-info-record');
  if(nameEl) nameEl.textContent = '—';
  if(recEl)  recEl.textContent  = '';
}

function _selectOpponent(cfg){
  // Direktstart ohne Confirmation für flüssige UX
  if(typeof startDuelVsOpponent === 'function'){
    startDuelVsOpponent(cfg.id);
  }
}

// ── Sammlungs-Screen ─────────────────────────────────────

function showCollection() {
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('collection-screen').classList.remove('hidden');
  _renderCollection();
}

function hideCollection() {
  document.getElementById('collection-screen').classList.add('hidden');
  document.getElementById('title-screen').classList.remove('hidden');
  if (typeof _updateCoinDisplay === 'function') _updateCoinDisplay();
}

let _collFilter = 'all';
let _collRarityFilter = 'all';

function _renderCollection() {
  const grid = document.getElementById('collection-grid');
  if (!grid) return;

  const collection = Progression.getCollection();
  const countMap = {};
  collection.forEach(e => { countMap[e.id] = e.count; });

  const totalCards = Object.keys(CARD_DB).length;
  const ownedCount = Object.keys(countMap).length;
  const countEl = document.getElementById('collection-count');
  if (countEl) countEl.textContent = `${ownedCount} / ${totalCards} Karten`;

  grid.innerHTML = '';

  let allCards = Object.values(CARD_DB);
  if (_collFilter !== 'all') allCards = allCards.filter(c => c.race === _collFilter);
  if (_collRarityFilter !== 'all') allCards = allCards.filter(c => c.rarity === _collRarityFilter);

  allCards.forEach(card => {
    const owned = countMap[card.id] || 0;
    const rarColor = RARITY_COLOR[card.rarity] || '#aaa';

    const tile = document.createElement('div');
    tile.className = `coll-card${owned ? '' : ' coll-unowned'}`;

    tile.innerHTML = `
      <div class="coll-rarity-bar" style="background:${rarColor}"></div>
      ${owned > 1 ? `<div class="coll-card-count">×${owned}</div>` : ''}
      ${owned ? `
        <div class="coll-card-name">${card.name}</div>
        <div class="coll-card-meta">${RACE_NAME[card.race] || ''} · ${RARITY_NAME[card.rarity] || ''}</div>
        ${card.atk !== undefined ? `<div class="coll-card-meta">ATK ${card.atk} / DEF ${card.def}</div>` : ''}
      ` : `
        <div class="coll-unknown-label">???</div>
        <div class="coll-card-meta" style="text-align:center;opacity:0.4">${RACE_NAME[card.race] || ''}</div>
      `}
    `;
    grid.appendChild(tile);
  });
}

// ── Initialization ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Delegated listener for starter race grid — one handler for all race cards.
  const starterGrid = document.getElementById('starter-race-grid');
  if (starterGrid) {
    starterGrid.addEventListener('click', e => {
      const card = e.target.closest('.starter-race-card');
      if (card) _selectStarterRace(card.dataset.race);
    });
  }

  // Delegated listeners for opponent grid — click to select, hover for info panel.
  const oppGrid = document.getElementById('opp-portrait-grid');
  if (oppGrid) {
    oppGrid.addEventListener('click', e => {
      const tile = e.target.closest('.opp-portrait-tile:not(.locked)');
      if (!tile) return;
      const cfg = OPPONENT_CONFIGS.find(c => c.id === parseInt(tile.dataset.oppId, 10));
      if (cfg) _selectOpponent(cfg);
    });
    oppGrid.addEventListener('mouseover', e => {
      const tile = e.target.closest('.opp-portrait-tile:not(.locked)');
      if (tile) {
        const cfg = OPPONENT_CONFIGS.find(c => c.id === parseInt(tile.dataset.oppId, 10));
        if (cfg) _showOppInfo(cfg);
      }
    });
    oppGrid.addEventListener('mouseout', e => {
      const tile = e.target.closest('.opp-portrait-tile');
      if (tile && !tile.contains(e.relatedTarget)) _clearOppInfo();
    });
  }

  // Starterdeck-Bestätigungs-Button
  const confirmBtn = document.getElementById('btn-starter-confirm');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', _confirmStarterDeck);
  }

  // Sammlungs-Button
  const collBtn = document.getElementById('btn-collection');
  if (collBtn) collBtn.addEventListener('click', showCollection);

  const collBackBtn = document.getElementById('btn-collection-back');
  if (collBackBtn) collBackBtn.addEventListener('click', hideCollection);

  document.querySelectorAll('.coll-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.coll-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _collFilter = btn.dataset.filter;
      _renderCollection();
    });
  });

  const rarFilter = document.getElementById('coll-rarity-filter');
  if (rarFilter) {
    rarFilter.addEventListener('change', () => {
      _collRarityFilter = rarFilter.value;
      _renderCollection();
    });
  }

  // Zurück-Button im Gegnerauswahl-Screen
  const backBtn = document.getElementById('btn-opp-back');
  if(backBtn){
    backBtn.addEventListener('click', hideOpponentSelect);
  }

  // "Gegner wählen" Button im Ergebnis-Screen
  const chooseOppBtn = document.getElementById('btn-choose-opponent');
  if(chooseOppBtn){
    chooseOppBtn.addEventListener('click', () => {
      document.getElementById('result-modal').classList.add('hidden');
      document.getElementById('modal-overlay').classList.add('hidden');
      document.getElementById('game-screen').classList.add('hidden');
      showOpponentSelect();
    });
  }
});
