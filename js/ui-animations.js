// ============================================================
// AETHERIAL CLASH - Animations & Visual Effects
// ============================================================
import { gsap } from 'gsap';
import { IS_TOUCH } from './ui-state.js';

// cardInnerHTML is needed for showHoverPreview and showCardActivation.
// It lives in ui-render.js but that would create a circular dependency
// (ui-render imports ui-animations for _attachHover).
// Solution: import cardInnerHTML from ui-render.js — ui-render does NOT import
// anything back from ui-animations that would cause a cycle at module init time;
// JS ES modules handle circular references via live bindings, so this is safe.
// We use a late-binding import trick via a setter instead.
let _cardInnerHTML = null;
export function setCardInnerHTMLFn(fn) { _cardInnerHTML = fn; }

import { ATTR_NAME } from './cards.js';

// ── Card Hover Preview ─────────────────────────────────────
let _hoverTween = null;
let _hoverReady = false;

function _initHover() {
  if (_hoverReady) return;
  const preview = document.getElementById('card-hover-preview');
  if (!preview) return;
  gsap.set(preview, { y: 4, opacity: 0 });
  _hoverReady = true;
}

export function showHoverPreview(card, fc, event){
  if(!card) return;
  _initHover();

  const preview = document.getElementById('card-hover-preview');

  // ─ Card render ─
  const renderEl = document.getElementById('hover-card-render');
  renderEl.innerHTML = '';
  const cardEl = document.createElement('div');
  cardEl.className = `card ${card.type}-card attr-${card.attribute || 'spell'}`;
  cardEl.innerHTML = _cardInnerHTML ? _cardInnerHTML(card, false, false, fc) : '';
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

  if(_hoverTween) _hoverTween.kill();
  _hoverTween = gsap.to(preview, { duration: 0.12, ease: 'power1.out', opacity: 1, y: 0 });
}

export function hideHoverPreview(){
  const preview = document.getElementById('card-hover-preview');
  if(!preview) return;
  if(_hoverTween) _hoverTween.kill();
  _hoverTween = gsap.to(preview, {
    duration: 0.13,
    delay: 0.06,
    ease: 'power1.in',
    opacity: 0,
    y: 4,
    onComplete() { preview.classList.add('hidden'); },
  });
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

export function attachLongPress(el, callback, ms = 500){
  let timer = null, moved = false;
  el.addEventListener('touchstart', e => {
    moved = false;
    timer = setTimeout(() => { if (!moved) { e.preventDefault(); callback(); } }, ms);
  }, { passive: false });
  el.addEventListener('touchmove',   () => { moved = true; clearTimeout(timer); });
  el.addEventListener('touchend',    () => clearTimeout(timer));
  el.addEventListener('touchcancel', () => clearTimeout(timer));
}

export function _attachHover(el, card, fc){
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

export function playAttackAnim(atkOwner, atkZone, defOwner, defZone){
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

    const clone = atkCard.cloneNode(true);
    Object.assign(clone.style, {
      position: 'fixed', margin: '0', padding: '0', boxSizing: 'border-box',
      left: atkRect.left + 'px', top: atkRect.top + 'px',
      width: atkRect.width + 'px', height: atkRect.height + 'px',
      zIndex: '420', pointerEvents: 'none',
    });
    document.body.appendChild(clone);
    atkCard.style.opacity = '0.25';

    const tl = gsap.timeline({
      onComplete() {
        clone.remove();
        atkCard.style.opacity = '';
        if(defCard) defCard.classList.remove('atk-hit');
        if(defSlot) defSlot.classList.remove('atk-impact');
        resolve();
      },
    });

    // Windup: pull back slightly, brighten
    tl.to(clone, {
      duration: 0.12,
      ease: 'power2.out',
      x: -dx * 0.14,
      y: -dy * 0.14,
      scale: 1.18,
      boxShadow: '0 0 22px rgba(255,200,60,0.9)',
      onStart() { clone.style.filter = 'brightness(1.5)'; },
    });

    // Lunge: fly to target
    tl.to(clone, {
      duration: 0.16,
      ease: 'power2.in',
      x: dx,
      y: dy,
      scale: 1.06,
    });

    // Impact: fire effects when card arrives at target
    tl.call(() => {
      clone.style.filter = 'brightness(2)';
      spawnImpactBurst(impX, impY, isDirect);
      if(defCard) defCard.classList.add('atk-hit');
      if(defSlot) defSlot.classList.add('atk-impact');
    });

    // Return: snap back and fade out
    tl.to(clone, {
      duration: 0.22,
      delay: 0.08,
      ease: 'power2.out',
      x: 0,
      y: 0,
      scale: 1,
      opacity: 0,
      boxShadow: 'none',
      onStart() { clone.style.filter = 'brightness(1)'; },
    });
  });
}

// ── Karten-Aktivierungs-Animation ─────────────────────────
export function showCardActivation(card, effectText){
  return new Promise(resolve => {
    const overlay  = document.getElementById('card-activate-overlay');
    const bg       = document.getElementById('card-activate-bg');
    const content  = document.getElementById('card-activate-content');
    const render   = document.getElementById('card-activate-render');
    const textEl   = document.getElementById('card-activate-effect-text');
    const labelEl  = document.getElementById('card-activate-label');

    const labels = { spell:'Zauber aktiviert', trap:'Falle aktiviert',
                     effect:'Effekt ausgelöst', fusion:'Fusion!', normal:'Effekt ausgelöst' };
    labelEl.textContent = (labels[card.type] || 'AKTIVIERT').toUpperCase();

    render.innerHTML = '';
    const cardEl = document.createElement('div');
    cardEl.className = `card big-card ${card.type}-card attr-${card.attribute||'spell'}`;
    cardEl.innerHTML = _cardInnerHTML ? _cardInnerHTML(card, false, false, null) : '';
    render.appendChild(cardEl);

    textEl.textContent = effectText || card.description || '—';

    overlay.classList.remove('hidden', 'ca-visible', 'ca-dissolve');
    gsap.set(bg,      { backgroundColor: 'rgba(0,0,0,0)' });
    gsap.set(content, { y: 50, scale: 0.75, opacity: 0 });

    const tl = gsap.timeline({
      onComplete() { overlay.classList.add('hidden'); resolve(); },
    });

    // Fade in bg + spring content in simultaneously
    tl.to(bg,      { duration: 0.3,  ease: 'none', backgroundColor: 'rgba(0,0,10,0.72)' }, 0);
    tl.to(content, { duration: 0.38, ease: 'back.out(1.7)', y: 0, scale: 1, opacity: 1 }, 0);

    // Hold
    tl.to({}, { duration: 1.6 });

    // Dissolve out
    tl.to(content, { duration: 0.55, ease: 'power2.in', y: -30, scale: 1.18, opacity: 0 });
    tl.to(bg,      { duration: 0.5,  ease: 'power2.in', backgroundColor: 'rgba(0,0,0,0)' }, '<');
  });
}
