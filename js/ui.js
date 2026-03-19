// ============================================================
// AETHERIAL CLASH - UI & Event Handler
// ============================================================

let game = null;
let _currentDeck = [];
let _deckPanelExpanded = false;
let _lastOpponentConfig = null; // merkt sich den zuletzt gewählten Gegner

// Touch-Gerät erkennen (einmalig beim Laden)
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

// ── Selection state ────────────────────────────────────────
const SEL = {
  mode: null,         // 'hand'|'attack'|'fusion1'|'spell-target'|'grave-target'|'trap-target'
  handIndex: null,
  attackerZone: null,
  fusion1: null,      // { handIndex }
  spellHandIndex: null,
  spellCard: null,
  trapFieldZone: null,
  callback: null
};

function resetSel(){
  Object.assign(SEL, { mode:null, handIndex:null, attackerZone:null, fusion1:null, spellHandIndex:null, spellCard:null, trapFieldZone:null, callback:null });
  document.querySelectorAll('.selected,.targetable').forEach(el => el.classList.remove('selected','targetable'));
  document.getElementById('action-hint').textContent = '';
}

// ── Card Hover Preview ─────────────────────────────────────
let _hoverHideTimer = null;

function showHoverPreview(card, fc, event){
  // Don't show for opponent face-down cards
  if(!card) return;
  clearTimeout(_hoverHideTimer);

  const preview = document.getElementById('card-hover-preview');

  // ─ Card render ─
  const renderEl = document.getElementById('hover-card-render');
  renderEl.innerHTML = '';
  const cardEl = document.createElement('div');
  cardEl.className = `card ${card.type}-card attr-${card.attribute || 'spell'}`;
  cardEl.innerHTML = cardInnerHTML(card, false, false, fc);
  renderEl.appendChild(cardEl);

  // ─ Info ─
  document.getElementById('hover-card-name').textContent = card.name;

  const attrName  = ATTR_NAME[card.attribute] || '';
  const typeName  = { normal:'Normal', effect:'Effekt', fusion:'Fusion', spell:'Zauberkarte', trap:'Fallenkarte' }[card.type] || '';
  const levelStr  = card.level ? ` · Lv ${card.level}` : '';
  document.getElementById('hover-card-meta').textContent = [attrName, typeName].filter(Boolean).join(' · ') + levelStr;

  document.getElementById('hover-card-desc').textContent = card.description || '';

  if(card.atk !== undefined){
    const atkVal = fc ? fc.effectiveATK() : card.atk;
    const defVal = fc ? fc.effectiveDEF() : card.def;
    const bonus  = fc && (fc.permATKBonus || fc.tempATKBonus) ? ' ▲' : '';
    document.getElementById('hover-card-stats').textContent = `ATK ${atkVal}${bonus}  DEF ${defVal}`;
  } else {
    document.getElementById('hover-card-stats').textContent = '';
  }

  // ─ Position ─
  _positionHoverPreview(event.clientX, event.clientY);
  preview.classList.remove('hidden');
  // small rAF so the transition fires after display
  requestAnimationFrame(() => preview.classList.add('visible'));
}

function hideHoverPreview(){
  _hoverHideTimer = setTimeout(() => {
    const preview = document.getElementById('card-hover-preview');
    preview.classList.remove('visible');
    // hide after transition
    setTimeout(() => preview.classList.add('hidden'), 130);
  }, 60);
}

function _positionHoverPreview(mx, my){
  const preview = document.getElementById('card-hover-preview');
  const pw = preview.offsetWidth  || 210;
  const ph = preview.offsetHeight || 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = mx + 18;
  let top  = my - 20;

  if(left + pw > vw - 8) left = mx - pw - 18;
  if(top  + ph > vh - 8) top  = vh - ph - 8;
  if(top < 8)            top  = 8;
  if(left < 8)           left = 8;

  preview.style.left = left + 'px';
  preview.style.top  = top  + 'px';
}

function attachLongPress(el, callback, ms = 500){
  let timer = null, moved = false;
  el.addEventListener('touchstart', e => {
    moved = false;
    timer = setTimeout(() => { if (!moved) { e.preventDefault(); callback(); } }, ms);
  }, { passive: false });
  el.addEventListener('touchmove',   () => { moved = true; clearTimeout(timer); });
  el.addEventListener('touchend',    () => clearTimeout(timer));
  el.addEventListener('touchcancel', () => clearTimeout(timer));
}

function _attachHover(el, card, fc){
  if (IS_TOUCH) return;
  el.addEventListener('mouseenter', e => showHoverPreview(card, fc, e));
  el.addEventListener('mouseleave', hideHoverPreview);
  el.addEventListener('mousemove',  e => _positionHoverPreview(e.clientX, e.clientY));
}

// ── Angriffs-Animation ────────────────────────────────────
function spawnImpactBurst(x, y, isDirect){
  const el = document.createElement('div');
  el.className = 'atk-burst' + (isDirect ? ' direct' : '');
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function playAttackAnim(atkOwner, atkZone, defOwner, defZone){
  return new Promise(resolve => {
    const atkContId = atkOwner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
    const atkSlots  = document.querySelectorAll(`#${atkContId} .zone-slot`);
    const atkSlot   = atkSlots[atkZone];
    const atkCard   = atkSlot && atkSlot.querySelector('.card');
    if(!atkCard){ resolve(); return; }

    const isDirect = defZone === null || defZone === undefined;
    let defSlot = null, defCard = null;
    if(!isDirect){
      const defContId = defOwner === 'player' ? 'player-monster-zone' : 'opponent-monster-zone';
      const defSlots  = document.querySelectorAll(`#${defContId} .zone-slot`);
      defSlot = defSlots[defZone];
      defCard = defSlot && defSlot.querySelector('.card');
    }

    const atkRect = atkCard.getBoundingClientRect();
    const atkCX   = atkRect.left + atkRect.width  / 2;
    const atkCY   = atkRect.top  + atkRect.height / 2;

    // Ziel-Mitte bestimmen
    let impX, impY;
    if(defCard){
      const r = defCard.getBoundingClientRect();
      impX = r.left + r.width  / 2;
      impY = r.top  + r.height / 2;
    } else {
      const lpId  = defOwner === 'player' ? 'player-lp' : 'opp-lp';
      const lpEl  = document.getElementById(lpId);
      const lpR   = lpEl ? lpEl.getBoundingClientRect() : null;
      impX = lpR ? lpR.left + lpR.width / 2 : window.innerWidth / 2;
      impY = lpR ? lpR.top  + lpR.height / 2
                 : (defOwner === 'player' ? window.innerHeight - 90 : 70);
    }

    const dx = impX - atkCX;
    const dy = impY - atkCY;

    // Clone als fliegende Karte
    const clone = atkCard.cloneNode(true);
    Object.assign(clone.style, {
      position: 'fixed', margin: '0', padding: '0', boxSizing: 'border-box',
      left: atkRect.left + 'px', top: atkRect.top + 'px',
      width: atkRect.width + 'px', height: atkRect.height + 'px',
      zIndex: '420', pointerEvents: 'none',
      transition: 'none', transform: 'none',
    });
    document.body.appendChild(clone);
    atkCard.style.opacity = '0.25';  // Original dimmen

    // Phase 1 — Aufladen (leicht zurückziehen, 120 ms)
    requestAnimationFrame(() => {
      clone.style.transition = 'transform 0.12s ease-out, filter 0.12s, box-shadow 0.12s';
      clone.style.transform  = `translate(${-dx * 0.14}px, ${-dy * 0.14}px) scale(1.18)`;
      clone.style.filter     = 'brightness(1.5)';
      clone.style.boxShadow  = '0 0 22px rgba(255,200,60,0.9)';

      // Phase 2 — Vorstoß (130 ms später, 160 ms Dauer)
      setTimeout(() => {
        clone.style.transition = 'transform 0.16s cubic-bezier(0.4,0,0.8,1), filter 0.1s';
        clone.style.transform  = `translate(${dx}px, ${dy}px) scale(1.06)`;
        clone.style.filter     = 'brightness(2)';

        // Phase 3 — Impact (nach 170 ms)
        setTimeout(() => {
          spawnImpactBurst(impX, impY, isDirect);
          if(defCard){ defCard.classList.add('atk-hit'); }
          if(defSlot){ defSlot.classList.add('atk-impact'); }

          // Phase 4 — Rückzug & Fade (nach 80 ms)
          setTimeout(() => {
            clone.style.transition = 'transform 0.22s ease-out, opacity 0.22s, filter 0.22s';
            clone.style.transform  = 'translate(0,0) scale(1)';
            clone.style.opacity    = '0';
            clone.style.filter     = 'brightness(1)';

            setTimeout(() => {
              clone.remove();
              atkCard.style.opacity = '';
              if(defCard) defCard.classList.remove('atk-hit');
              if(defSlot) defSlot.classList.remove('atk-impact');
              resolve();
            }, 240);
          }, 80);
        }, 175);
      }, 130);
    });
  });
}

// ── Karten-Aktivierungs-Animation ─────────────────────────
function showCardActivation(card, effectText){
  return new Promise(resolve => {
    const overlay  = document.getElementById('card-activate-overlay');
    const render   = document.getElementById('card-activate-render');
    const textEl   = document.getElementById('card-activate-effect-text');
    const labelEl  = document.getElementById('card-activate-label');

    // Label je Typ
    const labels = { spell:'Zauber aktiviert', trap:'Falle aktiviert',
                     effect:'Effekt ausgelöst', fusion:'Fusion!', normal:'Effekt ausgelöst' };
    labelEl.textContent = (labels[card.type] || 'AKTIVIERT').toUpperCase();

    render.innerHTML = '';
    const cardEl = document.createElement('div');
    cardEl.className = `card big-card ${card.type}-card attr-${card.attribute||'spell'}`;
    cardEl.innerHTML = cardInnerHTML(card, false, false, null);
    render.appendChild(cardEl);

    textEl.textContent = effectText || card.description || '—';

    overlay.classList.remove('hidden','ca-visible','ca-dissolve');
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('ca-visible')));

    setTimeout(() => {
      overlay.classList.remove('ca-visible');
      overlay.classList.add('ca-dissolve');
      setTimeout(() => { overlay.classList.add('hidden'); resolve(); }, 580);
    }, 1600);
  });
}

// ── Karten-Zieh-Tracking ──────────────────────────────────
let _pendingDrawCount = 0;

// ── UI Callbacks (passed to GameEngine) ───────────────────
const uiCallbacks = {
  render(state){ renderAll(state); },
  log(msg){ addLogEntry(msg); },
  prompt(opts){ return showPromptModal(opts); },
  showResult(type){ showResultScreen(type, null); },
  showActivation(card, text){ return showCardActivation(card, text); },
  onDraw(owner, count){ if(owner === 'player') _pendingDrawCount += count; },
  playAttackAnimation(ao, az, dO, dZ){ return playAttackAnim(ao, az, dO, dZ); },
  onDuelEnd(result, opponentId){ handleDuelEnd(result, opponentId); },
};

// ── Render ─────────────────────────────────────────────────
function renderAll(state){
  if(!state) return;
  // Stats
  document.getElementById('player-lp').textContent   = state.player.lp;
  document.getElementById('opp-lp').textContent      = state.opponent.lp;
  document.getElementById('player-deck-count').textContent  = state.player.deck.length;
  document.getElementById('opp-deck-count').textContent     = state.opponent.deck.length;
  document.getElementById('opp-hand-count').textContent     = state.opponent.hand.length;
  document.getElementById('player-grave-count').textContent = state.player.graveyard.length;
  document.getElementById('opp-grave-count').textContent    = state.opponent.graveyard.length;
  document.getElementById('turn-num').textContent           = state.turn;

  const phaseNames = { draw:'Ziehphase', main:'Hauptphase', battle:'Kampfphase', end:'Endphase' };
  document.getElementById('phase-name').textContent = phaseNames[state.phase] || state.phase;

  // LP bar
  const playerPct  = Math.min(100, Math.max(0, state.player.lp / 80));
  const oppPct     = Math.min(100, Math.max(0, state.opponent.lp / 80));
  document.getElementById('player-lp-bar').style.width = playerPct + '%';
  document.getElementById('opp-lp-bar').style.width    = oppPct + '%';
  if(playerPct < 30) document.getElementById('player-lp-bar').style.background = '#cc2222';
  else document.getElementById('player-lp-bar').style.background = '';
  if(oppPct < 30) document.getElementById('opp-lp-bar').style.background = '#cc2222';
  else document.getElementById('opp-lp-bar').style.background = '';

  // Phase buttons
  document.getElementById('btn-main-to-battle').disabled = state.activePlayer !== 'player' || state.phase !== 'main';
  document.getElementById('btn-battle-to-end').disabled  = state.activePlayer !== 'player' || state.phase !== 'battle';
  document.getElementById('btn-end-turn').disabled       = state.activePlayer !== 'player' || state.phase === 'draw';

  // Render fields
  renderMonsterZone('player',   state.player.field.monsters,   state);
  renderMonsterZone('opponent', state.opponent.field.monsters,  state);
  renderSpellTrapZone('player',   state.player.field.spellTraps,   state);
  renderSpellTrapZone('opponent', state.opponent.field.spellTraps,  state);

  // Render hand
  renderHand(state.player.hand, state);
}

function renderMonsterZone(owner, monsters, state){
  const container = document.getElementById(`${owner}-monster-zone`);
  const slots = container.querySelectorAll('.zone-slot');
  slots.forEach((slot, i) => {
    slot.innerHTML = '';
    slot.className = 'zone-slot';
    const fc = monsters[i];
    if(fc){
      const el = buildFieldCard(fc, owner, i, state);
      slot.appendChild(el);
    } else {
      slot.classList.add('empty');
    }
  });
}

function renderSpellTrapZone(owner, spellTraps, state){
  const zoneId = owner === 'opponent' ? 'opp-spelltrap-zone' : 'player-spelltrap-zone';
  const container = document.getElementById(zoneId);
  const slots = container.querySelectorAll('.zone-slot');
  slots.forEach((slot, i) => {
    slot.innerHTML = '';
    slot.className = 'zone-slot';
    const fst = spellTraps[i];
    if(fst){
      const el = buildFieldSpellTrap(fst, owner, i, state);
      slot.appendChild(el);
    } else {
      slot.classList.add('empty');
    }
  });
}

function renderHand(hand, state){
  const container = document.getElementById('player-hand');
  container.innerHTML = '';
  const newStart = _pendingDrawCount > 0 ? hand.length - _pendingDrawCount : -1;
  _pendingDrawCount = 0;
  hand.forEach((card, i) => {
    const el = buildHandCard(card, i, state);
    if(i >= newStart && newStart >= 0){
      el.classList.add('newly-drawn');
      el.style.animationDelay = `${(i - newStart) * 80}ms`;
    }
    container.appendChild(el);
  });
  if (IS_TOUCH) {
    const ha = document.getElementById('hand-area');
    ha.scrollLeft = ha.scrollWidth;
  }
}

// ── Card Builders ──────────────────────────────────────────
function buildHandCard(card, index, state){
  const el = document.createElement('div');
  el.className = `card hand-card ${card.type}-card attr-${card.attribute||'spell'}`;
  el.dataset.handIndex = index;
  el.innerHTML = cardInnerHTML(card, false);

  const isPlayerTurn = state.activePlayer === 'player';
  const isMain       = state.phase === 'main';
  const isBattle     = state.phase === 'battle';

  if(isPlayerTurn && (isMain || (isBattle && card.type === TYPE.TRAP))){
    el.classList.add('playable');
    el.addEventListener('click', () => onHandCardClick(card, index, state));
  }
  if(isPlayerTurn && isMain && !state.player.normalSummonUsed && game){
    const opts = game.getAllFusionOptions('player');
    if(opts.some(o => o.i1 === index || o.i2 === index)) el.classList.add('fusionable');
  }
  _attachHover(el, card, null);
  return el;
}

function buildFieldCard(fc, owner, zone, state){
  const el = document.createElement('div');
  const isPlayerOwned = owner === 'player';

  if(fc.faceDown && !isPlayerOwned){
    el.className = 'card field-card face-down';
    el.innerHTML = `<div class="card-back-pattern"><span class="back-label">A</span></div>`;
  } else if(fc.faceDown && isPlayerOwned){
    el.className = `card field-card face-down own-facedown attr-${fc.card.attribute}`;
    el.innerHTML = cardInnerHTML(fc.card, true, fc.position==='def') + `<div class="facedown-overlay">Verdeckt</div>`;
  } else {
    el.className = `card field-card ${fc.card.type}-card attr-${fc.card.attribute} pos-${fc.position}`;
    el.innerHTML = cardInnerHTML(fc.card, false, fc.position==='def', fc);
  }

  if(fc.hasAttacked && owner==='player') el.classList.add('exhausted');
  if(SEL.attackerZone === zone && owner==='player') el.classList.add('selected');

  // click handlers
  if(isPlayerOwned){
    if(state.activePlayer === 'player'){
      if(state.phase === 'main' && !fc.faceDown){
        el.classList.add('interactive');
        el.addEventListener('click', () => onOwnFieldCardClick(fc, zone, state));
      } else if(state.phase === 'battle' && !fc.hasAttacked && fc.position==='atk' && !fc.faceDown && !fc.summonedThisTurn){
        el.classList.add('can-attack');
        el.addEventListener('click', () => onAttackerSelect(zone, state));
      }
    }
  } else {
    // opponent monsters
    if(SEL.mode === 'attack'){
      el.classList.add('targetable');
      el.addEventListener('click', () => onDefenderSelect(zone));
    }
  }

  if (!IS_TOUCH) el.addEventListener('contextmenu', e => { e.preventDefault(); showCardDetail(fc.card, fc); });
  if (IS_TOUCH && (!fc.faceDown || owner === 'player')) attachLongPress(el, () => showCardDetail(fc.card, fc));
  // Hover preview: skip for opponent face-down cards
  if(!fc.faceDown || owner === 'player'){
    _attachHover(el, fc.card, fc);
  }
  return el;
}

function buildFieldSpellTrap(fst, owner, zone, state){
  const el = document.createElement('div');
  if(fst.faceDown && owner === 'opponent'){
    el.className = 'card field-card face-down st-facedown';
    el.innerHTML = `<div class="card-back-pattern"><span class="back-label">A</span></div>`;
  } else if(fst.faceDown && owner === 'player'){
    el.className = `card field-card face-down own-facedown attr-spell`;
    el.innerHTML = `<div class="facedown-overlay">${fst.card.type === TYPE.TRAP ? '⚠ Falle' : '✦ Zauber'}</div>`;
  } else {
    el.className = `card field-card ${fst.card.type}-card attr-spell`;
    el.innerHTML = cardInnerHTML(fst.card, false);
  }

  if(owner === 'player' && fst.faceDown && state.activePlayer === 'player' && state.phase === 'main'){
    el.classList.add('interactive');
    el.addEventListener('click', () => onFieldSpellTrapClick(zone, fst, state));
  }
  if (!IS_TOUCH) el.addEventListener('contextmenu', e => { e.preventDefault(); if(!fst.faceDown || owner==='player') showCardDetail(fst.card); });
  if (IS_TOUCH && (!fst.faceDown || owner === 'player')) attachLongPress(el, () => showCardDetail(fst.card));
  // Hover preview: eigene verdeckte Karten zeigen, Gegner-verdeckte nicht
  if(!fst.faceDown || owner === 'player'){
    _attachHover(el, fst.card, null);
  }
  return el;
}

function cardInnerHTML(card, dimmed=false, rotated=false, fc=null){
  const levelStars = card.level ? '★'.repeat(Math.min(card.level, 12)) : '';
  const attrSym = ATTR_SYMBOL[card.attribute] || '✦';
  const typeLabel = { normal:'Normal', effect:'Effekt', fusion:'Fusion', spell:'Zauber', trap:'Falle' }[card.type] || '';
  const effATK = fc ? fc.effectiveATK() : (card.atk || 0);
  const effDEF = fc ? fc.effectiveDEF() : (card.def || 0);
  const statChanged = fc && (fc.permATKBonus || fc.tempATKBonus) ? ' stat-boosted' : '';

  let statsHTML = '';
  if(card.atk !== undefined){
    statsHTML = `<div class="card-stats${statChanged}">` +
      `<div class="stat-row"><span class="stat-label atk-label">ATK</span><span class="stat-val">${effATK}</span></div>` +
      `<div class="stat-row"><span class="stat-label def-label">DEF</span><span class="stat-val">${effDEF}</span></div>` +
      `</div>`;
  } else {
    statsHTML = `<div class="card-stats no-stats"><span class="type-badge-big">${typeLabel}</span></div>`;
  }
  // Race badge (4-char abbreviation, colored)
  const raceAbbr = { feuer:'Feue', drache:'Drag', flug:'Flug', stein:'Stei', pflanze:'Pflz',
    krieger:'Krie', magier:'Magi', elfe:'Elfe', daemon:'Dämo', wasser:'Wass' };
  const raceColors = { feuer:'#e05030', drache:'#8040c0', flug:'#4090c0', stein:'#808060',
    pflanze:'#40a050', krieger:'#c09030', magier:'#6060c0', elfe:'#90c060', daemon:'#804090', wasser:'#3080b0' };
  const raceBadge = card.race
    ? `<span class="card-race-badge" style="background:${raceColors[card.race]||'#444'}">${raceAbbr[card.race]||card.race.slice(0,4)}</span>`
    : '';
  // Rarity pip
  const rarityPip = card.rarity
    ? `<span class="card-rarity-pip" style="background:${RARITY_COLOR[card.rarity]||'#aaa'}" title="${RARITY_NAME[card.rarity]||''}"></span>`
    : '';

  return `
    <div class="card-header">
      <span class="card-name-short">${card.name}</span>
      ${raceBadge}
      <span class="card-attr">${rarityPip}${attrSym}</span>
    </div>
    <div class="card-art">
      <div class="art-attr-symbol">${attrSym}</div>
      <div class="type-badge">${typeLabel}</div>
    </div>
    <div class="card-level">${levelStars}</div>
    ${statsHTML}
  `;
}

// ── Event Handlers ─────────────────────────────────────────
function onHandCardClick(card, index, state){
  if(!game) return;
  if(SEL.mode === 'fusion1'){
    // second fusion card selected
    if(index === SEL.fusion1.handIndex){ resetSel(); return; }
    const firstCard = state.player.hand[SEL.fusion1.handIndex];
    if(!firstCard){ showMsg('Fusionskarte nicht mehr in der Hand!'); resetSel(); return; }
    const recipe = checkFusion(card.id, firstCard.id);
    if(recipe){
      const zone = state.player.field.monsters.findIndex(z => z === null);
      if(zone === -1){ showMsg('Kein freier Monsterplatz!'); resetSel(); return; }
      game.performFusion('player', SEL.fusion1.handIndex, index);
      resetSel();
    } else {
      showMsg('Keine Fusion mit diesen Karten möglich!');
      resetSel();
    }
    return;
  }
  showCardActionMenu(card, index, state);
}

function showCardActionMenu(card, index, state){
  const menu = document.getElementById('card-action-menu');
  const title = document.getElementById('action-menu-title');
  const btns  = document.getElementById('action-buttons');
  title.textContent = card.name;
  btns.innerHTML = '';

  const isMonster = [TYPE.NORMAL, TYPE.EFFECT, TYPE.FUSION].includes(card.type);
  const isSpell   = card.type === TYPE.SPELL;
  const isTrap    = card.type === TYPE.TRAP;
  const phase     = state.phase;

  if(isMonster && phase === 'main'){
    const freeZone = state.player.field.monsters.findIndex(z => z === null);
    if(state.player.normalSummonUsed){
      addMenuBtn(btns, '⛔ Monster bereits gespielt', null, true);
    } else {
      if(freeZone !== -1){
        addMenuBtn(btns, '⚔ Beschwören (ATK)', () => {
          game.summonMonster('player', index, freeZone, 'atk');
          closeActionMenu();
        });
        addMenuBtn(btns, '🛡 Als Verteidigung setzen', () => {
          game.summonMonster('player', index, freeZone, 'def');
          closeActionMenu();
        });
      }
    }
    // check if this card can fuse
    const fusionOpts = game.getAllFusionOptions('player').filter(o => o.i1===index||o.i2===index);
    if(fusionOpts.length > 0 && !state.player.normalSummonUsed){
      addMenuBtn(btns, '✨ Fusion wählen', () => {
        SEL.mode   = 'fusion1';
        SEL.fusion1= { handIndex: index };
        document.querySelectorAll('.hand-card').forEach((el,i) => {
          if(i !== index) el.classList.add('targetable');
        });
        document.getElementById('action-hint').textContent = 'Wähle die zweite Fusionskarte aus der Hand.';
        closeActionMenu();
      });
    }
  }
  if(isSpell && phase === 'main'){
    addMenuBtn(btns, '✦ Aktivieren', () => {
      if(card.spellType === 'targeted' || card.spellType === 'fromGrave'){
        startSpellTargeting(card, index, state);
      } else {
        game.activateSpell('player', index);
      }
      closeActionMenu();
    });
    addMenuBtn(btns, '🔽 Setzen', () => {
      const zone = state.player.field.spellTraps.findIndex(z => z === null);
      if(zone === -1){ showMsg('Kein freier Zauberkarten-Slot!'); }
      else game.setSpellTrap('player', index, zone);
      closeActionMenu();
    });
  }
  if(isTrap && (phase === 'main' || phase === 'battle')){
    if(phase === 'main'){
      addMenuBtn(btns, '🔽 Fallen setzen', () => {
        const zone = state.player.field.spellTraps.findIndex(z => z === null);
        if(zone === -1){ showMsg('Kein freier Zauberkarten-Slot!'); }
        else game.setSpellTrap('player', index, zone);
        closeActionMenu();
      });
    }
    if(phase === 'battle' && card.trapTrigger === 'manual'){
      addMenuBtn(btns, '⚠ Falle aktivieren', () => {
        startTrapTargeting(card, index, state);
        closeActionMenu();
      });
    }
  }

  addMenuBtn(btns, '🔍 Ansehen', () => {
    document.getElementById('card-action-menu').classList.add('hidden');
    showCardDetail(card);
  });

  // Show menu
  document.getElementById('modal-overlay').classList.remove('hidden');
  menu.classList.remove('hidden');
}

function startSpellTargeting(card, handIndex, state){
  if(card.spellType === 'targeted' && card.target === 'ownMonster'){
    const targets = [];
    state.player.field.monsters.forEach((fc, i) => { if(fc) targets.push({ fc, zone:i }); });
    if(targets.length === 0){ showMsg('Kein Monster auf dem Feld!'); return; }
    if(targets.length === 1){
      game.activateSpell('player', handIndex, targets[0].fc);
    } else {
      document.getElementById('action-hint').textContent = 'Wähle ein eigenes Monster als Ziel.';
      SEL.mode = 'spell-target';
      SEL.spellHandIndex = handIndex;
      SEL.spellCard = card;
      document.querySelectorAll('#player-monster-zone .zone-slot').forEach((slot, i) => {
        if(state.player.field.monsters[i]){
          slot.classList.add('targetable');
          slot.addEventListener('click', () => {
            game.activateSpell('player', SEL.spellHandIndex, state.player.field.monsters[i]);
            resetSel();
          }, { once: true });
        }
      });
    }
  } else if(card.spellType === 'targeted' && card.target === 'ownDarkMonster'){
    const targets = [];
    state.player.field.monsters.forEach((fc, i) => { if(fc && fc.card.attribute===ATTR.DARK) targets.push({ fc, zone:i }); });
    if(targets.length === 0){ showMsg('Kein DUNKEL-Monster auf dem Feld!'); return; }
    game.activateSpell('player', handIndex, targets[0].fc);
  } else if(card.spellType === 'fromGrave'){
    const monsters = state.player.graveyard.filter(c => [TYPE.NORMAL,TYPE.EFFECT,TYPE.FUSION].includes(c.type));
    if(monsters.length === 0){ showMsg('Keine Monster im Friedhof!'); return; }
    // show selection
    showGraveSelection(monsters, (chosen) => {
      game.activateSpell('player', handIndex, chosen);
    });
  }
}

function startTrapTargeting(card, handIndex, state){
  if(card.target === 'oppMonster'){
    document.getElementById('action-hint').textContent = 'Wähle ein Monster des Gegners als Ziel.';
    SEL.mode = 'trap-target';
    document.querySelectorAll('#opponent-monster-zone .zone-slot').forEach((slot, i) => {
      const fc = state.opponent.field.monsters[i];
      if(fc){
        slot.classList.add('targetable');
        slot.addEventListener('click', () => {
          game.activateSpell('player', handIndex, fc);
          resetSel();
        }, { once: true });
      }
    });
  }
}

function onOwnFieldCardClick(fc, zone, state){
  if(!game || state.activePlayer !== 'player' || state.phase !== 'main') return;
  // Show options
  const menu = document.getElementById('card-action-menu');
  const title = document.getElementById('action-menu-title');
  const btns  = document.getElementById('action-buttons');
  title.textContent = fc.card.name;
  btns.innerHTML = '';
  addMenuBtn(btns, '🔄 Position wechseln', () => { game.changePosition('player', zone); closeActionMenu(); });
  addMenuBtn(btns, '🔍 Ansehen', () => {
    document.getElementById('card-action-menu').classList.add('hidden');
    showCardDetail(fc.card, fc);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
  menu.classList.remove('hidden');
}

function onFieldSpellTrapClick(zone, fst, state){
  if(!game || state.activePlayer !== 'player' || state.phase !== 'main') return;
  if(!fst.faceDown) return;
  // Activate face-down spell from field
  if(fst.card.type === TYPE.SPELL){
    if(fst.card.spellType === 'targeted' || fst.card.spellType === 'fromGrave'){
      startSpellTargeting(fst.card, -1, state); // -1 means from field
      // actually activate from field
    } else {
      game.activateSpellFromField('player', zone);
    }
  }
}

function onAttackerSelect(zone, state){
  if(!game || state.activePlayer !== 'player' || state.phase !== 'battle') return;
  const fc = state.player.field.monsters[zone];
  if(!fc || fc.hasAttacked || fc.position !== 'atk' || fc.summonedThisTurn) return;

  resetSel();
  SEL.mode = 'attack';
  SEL.attackerZone = zone;

  const oppHasMonsters = state.opponent.field.monsters.some(m => m !== null);
  if(!oppHasMonsters || fc.canDirectAttack){
    document.getElementById('action-hint').textContent =
      fc.canDirectAttack && oppHasMonsters
        ? `${fc.card.name} kann direkt angreifen!`
        : `${fc.card.name} bereit! Klicke "Direkt Angreifen".`;
    document.getElementById('btn-direct-attack').classList.remove('hidden');
    if(oppHasMonsters){
      // canDirectAttack: Gegner-Monster bleiben auch als Ziel wählbar
      document.querySelectorAll('#opponent-monster-zone .zone-slot').forEach((slot, i) => {
        if(state.opponent.field.monsters[i]) slot.classList.add('targetable');
      });
    }
  } else {
    document.getElementById('action-hint').textContent = `${fc.card.name} ausgewählt. Wähle ein Ziel.`;
    document.getElementById('btn-direct-attack').classList.add('hidden');
    // highlight opponent monsters
    document.querySelectorAll('#opponent-monster-zone .zone-slot').forEach((slot, i) => {
      if(state.opponent.field.monsters[i]){
        slot.classList.add('targetable');
      }
    });
  }

  // re-render to show selected state
  renderAll(state);
  document.querySelectorAll('#opponent-monster-zone .zone-slot').forEach((slot, i) => {
    if(state.opponent.field.monsters[i]){
      slot.classList.add('targetable');
    }
  });
}

function onDefenderSelect(zone){
  if(!game || SEL.mode !== 'attack') return;
  game.attack('player', SEL.attackerZone, zone);
  resetSel();
  document.getElementById('btn-direct-attack').classList.add('hidden');
}

function addMenuBtn(container, label, handler, disabled=false){
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className   = 'menu-action-btn';
  if(disabled){ btn.disabled = true; btn.style.opacity = '0.45'; btn.style.cursor = 'default'; }
  else { btn.addEventListener('click', handler); }
  container.appendChild(btn);
}

function closeActionMenu(){
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('card-action-menu').classList.add('hidden');
}

// ── Graveyard Selection ─────────────────────────────────────
function showGraveSelection(cards, callback){
  const modal = document.getElementById('grave-select-modal');
  const list  = document.getElementById('grave-select-list');
  list.innerHTML = '';
  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = `card hand-card ${card.type}-card attr-${card.attribute||'spell'}`;
    el.innerHTML = cardInnerHTML(card);
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      document.getElementById('modal-overlay').classList.add('hidden');
      modal.classList.add('hidden');
      callback(card);
    });
    list.appendChild(el);
  });
  document.getElementById('modal-overlay').classList.remove('hidden');
  modal.classList.remove('hidden');
}

// ── Prompt Modal (for trap activation) ────────────────────
function showPromptModal(opts){
  return new Promise(resolve => {
    const modal  = document.getElementById('trap-prompt-modal');
    const title  = document.getElementById('trap-prompt-title');
    const cardEl = document.getElementById('trap-prompt-card');
    const msg    = document.getElementById('trap-prompt-msg');
    const btnYes = document.getElementById('trap-prompt-yes');
    const btnNo  = document.getElementById('trap-prompt-no');

    title.textContent   = opts.title;
    msg.textContent     = opts.message;
    btnYes.textContent  = opts.yes;
    btnNo.textContent   = opts.no;

    const card = CARD_DB[opts.cardId];
    if(card){
      cardEl.innerHTML = '';
      const el = document.createElement('div');
      el.className = `card ${card.type}-card attr-${card.attribute||'spell'}`;
      el.innerHTML = cardInnerHTML(card);
      cardEl.appendChild(el);
    }

    document.getElementById('modal-overlay').classList.remove('hidden');
    modal.classList.remove('hidden');

    const cleanup = () => {
      document.getElementById('modal-overlay').classList.add('hidden');
      modal.classList.add('hidden');
    };
    btnYes.onclick = () => { cleanup(); resolve(true);  };
    btnNo.onclick  = () => { cleanup(); resolve(false); };
  });
}

// ── Card Detail ────────────────────────────────────────────
function showCardDetail(card, fc=null){
  const modal = document.getElementById('card-detail-modal');
  document.getElementById('detail-card-name').textContent = card.name;
  document.getElementById('detail-card-type').textContent =
    `${ATTR_NAME[card.attribute]||''} · ${({normal:'Normal',effect:'Effekt',fusion:'Fusion',spell:'Zauberkarte',trap:'Fallenkarte'}[card.type]||'')}` +
    (card.level ? ` · Stufe ${card.level}` : '');
  document.getElementById('detail-card-desc').textContent = card.description || '';
  let statsText = '';
  if(card.atk !== undefined){
    statsText = `ATK: ${fc ? fc.effectiveATK() : card.atk}  DEF: ${fc ? fc.effectiveDEF() : card.def}`;
    if(fc && (fc.permATKBonus || fc.tempATKBonus)) statsText += ` (+Bonus)`;
  }
  document.getElementById('detail-card-stats').textContent = statsText;

  const cardEl = document.getElementById('detail-card-render');
  cardEl.className = `card big-card ${card.type}-card attr-${card.attribute||'spell'}`;
  cardEl.innerHTML = cardInnerHTML(card, false, false, fc);

  document.getElementById('modal-overlay').classList.remove('hidden');
  modal.classList.remove('hidden');
}

// ── Duel End (Progression-Hook) ────────────────────────────
function handleDuelEnd(result, opponentId){
  const isVictory = result === 'victory';
  let coinsEarned = 0;

  if(opponentId && typeof Progression !== 'undefined'){
    Progression.recordDuelResult(opponentId, isVictory);
    const cfg = (typeof OPPONENT_CONFIGS !== 'undefined')
      ? OPPONENT_CONFIGS.find(o => o.id === opponentId)
      : null;
    if(cfg){
      coinsEarned = isVictory ? cfg.coinsWin : cfg.coinsLoss;
      Progression.addCoins(coinsEarned);
    }
  }

  showResultScreen(result, coinsEarned);
}

// ── Result Screen ──────────────────────────────────────────
function showResultScreen(type, coinsEarned){
  const modal = document.getElementById('result-modal');
  const title = document.getElementById('result-title');
  const msg   = document.getElementById('result-msg');
  const coinsEl = document.getElementById('result-coins');

  if(type === 'victory'){
    title.textContent = 'Sieg!';
    title.style.color = '#ffd700';
    msg.textContent   = 'Du hast den Gegner besiegt! Die Macht der Aetherial liegt in deinen Händen.';
  } else {
    title.textContent = 'Niederlage';
    title.style.color = '#cc4444';
    msg.textContent   = 'Du wurdest besiegt. Doch jeder Krieger kann aus einer Niederlage lernen...';
  }

  if(coinsEl){
    if(coinsEarned && coinsEarned > 0){
      coinsEl.textContent = `+${coinsEarned} Äther-Münzen`;
      coinsEl.classList.remove('hidden');
    } else {
      coinsEl.classList.add('hidden');
    }
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  modal.classList.remove('hidden');
}

// ── Battle Log ────────────────────────────────────────────
function addLogEntry(msg){
  const log = document.getElementById('log-entries');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.textContent = msg;
  log.insertBefore(entry, log.firstChild);
  while(log.children.length > 25) log.removeChild(log.lastChild);
}

function showMsg(msg){
  document.getElementById('action-hint').textContent = msg;
  setTimeout(() => { document.getElementById('action-hint').textContent = ''; }, 3000);
}

// ── Card List ──────────────────────────────────────────────
function showCardList(){
  const modal   = document.getElementById('cardlist-modal');
  const content = document.getElementById('cardlist-content');
  content.innerHTML = '';

  const groups = {
    'Normale Monster':   Object.values(CARD_DB).filter(c => c.type===TYPE.NORMAL),
    'Effekt-Monster':    Object.values(CARD_DB).filter(c => c.type===TYPE.EFFECT),
    'Fusion-Monster':    Object.values(CARD_DB).filter(c => c.type===TYPE.FUSION),
    'Zauberkarten':      Object.values(CARD_DB).filter(c => c.type===TYPE.SPELL),
    'Fallenkarten':      Object.values(CARD_DB).filter(c => c.type===TYPE.TRAP),
  };

  for(const [groupName, cards] of Object.entries(groups)){
    if(cards.length === 0) continue;
    const h = document.createElement('h3');
    h.textContent = groupName;
    h.className = 'cardlist-group-title';
    content.appendChild(h);
    const row = document.createElement('div');
    row.className = 'cardlist-row';
    cards.forEach(card => {
      const el = document.createElement('div');
      el.className = `card hand-card ${card.type}-card attr-${card.attribute||'spell'}`;
      el.innerHTML = cardInnerHTML(card);
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => showCardDetail(card));
      row.appendChild(el);
    });
    content.appendChild(row);

    // Show fusion recipes
    if(groupName === 'Fusion-Monster'){
      const recipeDiv = document.createElement('div');
      recipeDiv.className = 'fusion-recipes';
      FUSION_RECIPES.forEach(r => {
        const c1 = CARD_DB[r.materials[0]], c2 = CARD_DB[r.materials[1]], cr = CARD_DB[r.result];
        const li = document.createElement('div');
        li.className = 'recipe-line';
        li.textContent = `${c1.name} + ${c2.name} → ${cr.name}`;
        recipeDiv.appendChild(li);
      });
      content.appendChild(recipeDiv);
    }
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
  modal.classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Progression initialisieren
  if(typeof Progression !== 'undefined') Progression.init();

  // Erstes Mal: Starterdeck-Auswahl anzeigen
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
      // Fallback falls screens.js noch nicht geladen
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('game-screen').classList.remove('hidden');
      startGame();
    }
  });
  document.getElementById('btn-card-list-title').addEventListener('click', () => {
    // show card list from title
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
    if(game){ resetSel(); game.advancePhase(); }
  });
  document.getElementById('btn-battle-to-end').addEventListener('click', () => {
    if(game) game.advancePhase();
    resetSel();
    document.getElementById('btn-direct-attack').classList.add('hidden');
  });
  document.getElementById('btn-end-turn').addEventListener('click', () => {
    if(game) game.endTurn();
    resetSel();
    document.getElementById('btn-direct-attack').classList.add('hidden');
  });
  document.getElementById('btn-direct-attack').addEventListener('click', () => {
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
    startGame(_lastOpponentConfig); // gleichen Gegner nochmal
  });
  document.getElementById('btn-back-title').addEventListener('click', () => {
    document.getElementById('result-modal').classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    _updateCoinDisplay();
  });

  // Card list from game
  document.getElementById('btn-card-list-game').addEventListener('click', showCardList);

  // Manual log download
  document.getElementById('btn-download-log').addEventListener('click', () => {
    AetherialClash.downloadLog('manuell');
  });

  // Graveyard click
  document.getElementById('player-grave').addEventListener('click', () => {
    if(!game) return;
    const grave = game.getState().player.graveyard;
    if(grave.length > 0) showCardDetail(grave[grave.length-1]);
  });
  document.getElementById('opp-grave').addEventListener('click', () => {
    if(!game) return;
    const grave = game.getState().opponent.graveyard;
    if(grave.length > 0) showCardDetail(grave[grave.length-1]);
  });
});

// ── Deckbuilder ────────────────────────────────────────────
function loadDeck() {
  try {
    const saved = localStorage.getItem('aetherialClash_deck');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _currentDeck = parsed;
        return;
      }
    }
  } catch(e) {}
  _currentDeck = [...PLAYER_DECK_IDS];
}

function saveDeck() {
  if (_currentDeck.length !== 40) return;
  localStorage.setItem('aetherialClash_deck', JSON.stringify(_currentDeck));
  const toast = document.getElementById('db-save-toast');
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

function _flyCardClone(srcEl, targetPanelId, cardInner, onDone) {
  const srcRect = srcEl.getBoundingClientRect();
  const dst     = document.getElementById(targetPanelId).getBoundingClientRect();
  const dstX    = dst.left + dst.width  / 2;
  const dstY    = dst.top  + dst.height / 2;

  const clone = document.createElement('div');
  clone.className = 'db-fly-clone';
  clone.style.left   = srcRect.left   + 'px';
  clone.style.top    = srcRect.top    + 'px';
  clone.style.width  = srcRect.width  + 'px';
  clone.style.height = srcRect.height + 'px';
  clone.innerHTML = cardInner;
  document.body.appendChild(clone);

  const dx = dstX - srcRect.left - srcRect.width  / 2;
  const dy = dstY - srcRect.top  - srcRect.height / 2;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    clone.style.transform = `translate(${dx}px,${dy}px) scale(0.12)`;
    clone.style.opacity   = '0';
  }));

  clone.addEventListener('transitionend', () => { clone.remove(); onDone(); }, { once: true });
}

function _bumpCount(type) {
  const cnt = document.getElementById('db-count');
  cnt.classList.remove('db-count-bump-add', 'db-count-bump-remove');
  void cnt.offsetWidth;
  cnt.classList.add(type === 'add' ? 'db-count-bump-add' : 'db-count-bump-remove');
}

function addCardToDeck(id, el) {
  if (_currentDeck.length >= 40) return;
  const copies = _currentDeck.filter(c => c === id).length;
  if (copies >= 3) return;
  _currentDeck.push(id);
  if (el) {
    el.classList.add('db-src-flash-add');
    _bumpCount('add');
    const cardEl = el.querySelector('.card');
    _flyCardClone(el, 'db-deck-panel', cardEl ? cardEl.innerHTML : '', renderDeckbuilder);
  } else {
    renderDeckbuilder();
  }
}

function removeCardFromDeck(id, el) {
  const idx = _currentDeck.lastIndexOf(id);
  if (idx !== -1) {
    _currentDeck.splice(idx, 1);
    if (el) {
      el.classList.add('db-src-flash-remove');
      _bumpCount('remove');
      const cardEl = el.querySelector('.card');
      _flyCardClone(el, 'db-collection-panel', cardEl ? cardEl.innerHTML : '', renderDeckbuilder);
    } else {
      renderDeckbuilder();
    }
  }
}

function toggleDeckPanel() {
  _deckPanelExpanded = !_deckPanelExpanded;
  document.getElementById('db-deck-panel')
    .classList.toggle('db-expanded', _deckPanelExpanded);
  document.getElementById('db-body')
    .classList.toggle('db-panel-expanded', _deckPanelExpanded);
  renderDeckbuilder();
}

function showDeckbuilder() {
  loadDeck();
  document.getElementById('title-screen').classList.add('hidden');
  document.getElementById('deckbuilder-screen').classList.remove('hidden');
  renderDeckbuilder();
}

function renderDeckbuilder() {
  const deckFull = _currentDeck.length === 40;
  document.getElementById('db-count').textContent = `${_currentDeck.length}/40 Karten`;
  const saveBtn = document.getElementById('btn-db-save');
  saveBtn.disabled = !deckFull;
  saveBtn.style.opacity = deckFull ? '1' : '0.4';
  saveBtn.style.cursor  = deckFull ? 'pointer' : 'not-allowed';

  const copyMap = {};
  _currentDeck.forEach(id => { copyMap[id] = (copyMap[id] || 0) + 1; });

  const activeFilter = (document.querySelector('.db-filter-btn.active') || {}).dataset
    ? document.querySelector('.db-filter-btn.active').dataset.filter
    : 'all';

  // --- Collection panel ---
  const grid = document.getElementById('db-collection-grid');
  grid.innerHTML = '';

  // Filter to owned cards only if progression is active
  const collection = (typeof Progression !== 'undefined' && Progression.isFirstLaunch !== undefined && !Progression.isFirstLaunch())
    ? Progression.getCollection()
    : null;
  const ownedIds = collection ? new Set(collection.map(e => e.id)) : null;

  const deckableCards = Object.values(CARD_DB).filter(c =>
    c.type !== TYPE.FUSION && (!ownedIds || ownedIds.has(c.id))
  );

  deckableCards
    .filter(c => activeFilter === 'all' || c.type === activeFilter)
    .forEach(card => {
      const copies   = copyMap[card.id] || 0;
      const atMax    = copies >= 3;
      const deckFull = _currentDeck.length >= 40;

      const wrap = document.createElement('div');
      wrap.className = 'db-card-wrap' + (atMax || deckFull ? ' db-card-dimmed' : '');

      const el = document.createElement('div');
      el.className = `card ${card.type}-card attr-${card.attribute || 'spell'}`;
      el.innerHTML = cardInnerHTML(card, false, false, null);
      wrap.appendChild(el);

      if (copies > 0) {
        const badge = document.createElement('div');
        badge.className = 'db-copy-badge';
        badge.textContent = `${copies}/3`;
        wrap.appendChild(badge);
      }

      if (!atMax && !deckFull) {
        wrap.addEventListener('click', () => addCardToDeck(card.id, wrap));
      }

      _attachHover(el, card, null);
      grid.appendChild(wrap);
    });

  // --- Deck panel ---
  const list = document.getElementById('db-deck-list');
  list.innerHTML = '';

  const seen = new Set();
  const orderedIds = [];
  _currentDeck.forEach(id => { if (!seen.has(id)) { seen.add(id); orderedIds.push(id); } });

  if (_deckPanelExpanded) {
    list.classList.add('db-deck-expanded');

    orderedIds.forEach(id => {
      const card  = CARD_DB[id];
      const count = copyMap[id] || 0;

      const wrap = document.createElement('div');
      wrap.className = 'db-deck-card-wrap';

      const el = document.createElement('div');
      el.className = `card ${card.type}-card attr-${card.attribute || 'spell'}`;
      el.innerHTML = cardInnerHTML(card, false, false, null);
      wrap.appendChild(el);

      const badge = document.createElement('div');
      badge.className = 'db-copy-badge';
      badge.textContent = `×${count}`;
      wrap.appendChild(badge);

      const rmOverlay = document.createElement('div');
      rmOverlay.className = 'db-deck-rm-overlay';
      rmOverlay.textContent = '✕';
      wrap.appendChild(rmOverlay);

      wrap.addEventListener('click', () => removeCardFromDeck(id, wrap));
      _attachHover(el, card, null);
      list.appendChild(wrap);
    });

  } else {
    list.classList.remove('db-deck-expanded');

    orderedIds.forEach(id => {
      const card  = CARD_DB[id];
      const count = copyMap[id] || 0;

      const row = document.createElement('div');
      row.className = 'db-deck-row';

      const mini = document.createElement('div');
      mini.className = `card db-deck-row-mini ${card.type}-card attr-${card.attribute || 'spell'}`;
      mini.innerHTML = cardInnerHTML(card, false, false, null);
      row.appendChild(mini);

      const name = document.createElement('span');
      name.className = 'db-deck-row-name';
      name.textContent = card.name;
      row.appendChild(name);

      const cnt = document.createElement('span');
      cnt.className = 'db-deck-row-count';
      cnt.textContent = `×${count}`;
      row.appendChild(cnt);

      const rm = document.createElement('span');
      rm.className = 'db-deck-row-rm';
      rm.textContent = '✕';
      rm.title = 'Entfernen';
      row.appendChild(rm);

      row.addEventListener('click', () => removeCardFromDeck(id, row));
      _attachHover(mini, card, null);
      list.appendChild(row);
    });
  }
}

function startGame(opponentConfig){
  _lastOpponentConfig = opponentConfig || null;
  loadDeck();
  resetSel();
  document.getElementById('log-entries').innerHTML = '';
  game = new GameEngine(uiCallbacks);
  game.initGame(_currentDeck.length > 0 ? _currentDeck : PLAYER_DECK_IDS, opponentConfig || null);
}

// Wird aus screens.js nach Gegnerauswahl aufgerufen
function startDuelVsOpponent(opponentId){
  const cfg = OPPONENT_CONFIGS.find(o => o.id === opponentId);
  if(!cfg) return;
  document.getElementById('opponent-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  startGame(cfg);
}

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
