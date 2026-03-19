// ============================================================
// AETHERIAL CLASH - Game Engine
// ============================================================
//
// DEBUG LOGGING
// Toggle with:  AetherialClash.debug = true   (in browser console)
// Categories:   PHASE | AI | BATTLE | EFFECT | SUMMON | SPELL | ERROR
// Each category has its own color; errors always show regardless of flag.
//
const AetherialClash = {
  debug: false,

  // ── Log-Puffer (immer aktiv, unabhängig von debug-Flag) ──
  _entries: [],        // { ts, category, msg, data }
  _sessionStart: null, // ISO-Timestamp des Spielstarts

  _colors: {
    PHASE:  '#7ecfff',
    AI:     '#b8ff7e',
    BATTLE: '#ff9f4a',
    EFFECT: '#e07eff',
    SUMMON: '#7effc3',
    SPELL:  '#ffe07e',
    TRAP:   '#ff7eb8',
    GAME:   '#ffffff',
    ERROR:  '#ff4444',
  },

  // Wird von GameEngine.addLog() aufgerufen, um Spielereignisse zu puffern
  gameEvent(msg){
    this._push('GAME', msg);
  },

  log(category, msg, data = undefined){
    this._push(category, msg, data);
    if(!this.debug && category !== 'ERROR') return;
    const color  = this._colors[category] || '#aaa';
    const prefix = `%c[${category}]`;
    const style  = `color:${color};font-weight:bold;font-family:monospace`;
    if(data !== undefined){
      console.log(prefix, style, msg, data);
    } else {
      console.log(prefix, style, msg);
    }
  },

  _push(category, msg, data = undefined){
    const ts = new Date().toISOString();
    const dataStr = data !== undefined
      ? (typeof data === 'object' ? JSON.stringify(data) : String(data))
      : '';
    this._entries.push({ ts, category, msg, dataStr });
  },

  group(label){
    this._push('PHASE', `>>> ${label}`);
    if(!this.debug) return;
    console.group(`%c${label}`, 'color:#ffd700;font-weight:bold;font-family:monospace');
  },

  groupEnd(){
    if(!this.debug) return;
    console.groupEnd();
  },

  // Startet eine neue Session (löscht alten Puffer)
  startSession(){
    this._entries  = [];
    this._sessionStart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this._push('GAME', `=== Session gestartet: ${new Date().toLocaleString('de-DE')} ===`);
  },

  // Baut den Log-Inhalt als Text auf
  _buildLogText(){
    const lines = this._entries.map(e => {
      const base = `[${e.ts}] [${e.category.padEnd(6)}] ${e.msg}`;
      return e.dataStr ? `${base}  ${e.dataStr}` : base;
    });
    return lines.join('\n');
  },

  // Lädt die Log-Datei herunter
  // filename: z.B. "aetherial_clash_2026-03-17_14-30-00.log"
  downloadLog(reason = 'manual'){
    const ts       = this._sessionStart || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `aetherial_clash_${ts}_${reason}.log`;
    const text     = this._buildLogText();
    const blob     = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.info(`[AetherialClash] Log gespeichert: ${filename} (${this._entries.length} Einträge)`);
  },
};

class FieldCard {
  constructor(card, position='atk', faceDown=false) {
    this.card       = card;
    this.position   = position; // 'atk' | 'def'
    this.faceDown   = faceDown;
    this.hasAttacked= false;
    this.summonedThisTurn = true; // summoning sickness
    this.tempATKBonus = 0;
    this.permATKBonus = 0;
    this.permDEFBonus = 0;
    this.phoenixRevived = false;
    // passive flags from effect
    if(card.effect && card.effect.trigger==='passive'){
      this.piercing        = card.effect.piercing        || false;
      this.cannotBeTargeted= card.effect.cannotBeTargeted|| false;
      this.canDirectAttack = card.effect.canDirectAttack || false;
    } else {
      this.piercing = false;
      this.cannotBeTargeted = false;
      this.canDirectAttack  = false;
    }
  }
  effectiveATK() {
    return Math.max(0, this.card.atk + this.tempATKBonus + this.permATKBonus);
  }
  effectiveDEF() {
    return Math.max(0, this.card.def + this.permDEFBonus);
  }
}

// ── FieldSpellTrap ─────────────────────────────────────────
class FieldSpellTrap {
  constructor(card, faceDown=true){
    this.card    = card;
    this.faceDown= faceDown;
    this.used    = false;
  }
}

// ── GameEngine ─────────────────────────────────────────────
class GameEngine {
  constructor(uiCallbacks){
    this.ui = uiCallbacks; // { render, log, prompt, showResult, onDuelEnd }
    this.state = null;
    this._trapResolve = null;
    this._currentOpponentId = null;
  }

  // ───────── Init ─────────────────────────────────────────
  /**
   * @param {string[]} playerDeckIds  - Karten-IDs des Spielers
   * @param {object}   opponentConfig - { id, deckIds } aus OPPONENT_CONFIGS
   */
  initGame(playerDeckIds, opponentConfig){
    AetherialClash.startSession();
    const oppDeckIds = (opponentConfig && opponentConfig.deckIds) ? opponentConfig.deckIds : OPPONENT_DECK_IDS;
    this._currentOpponentId = (opponentConfig && opponentConfig.id) ? opponentConfig.id : null;
    this.state = {
      phase: 'main',        // 'draw'|'main'|'battle'|'end'
      turn: 1,
      activePlayer: 'player',
      player: {
        lp: 8000,
        deck: this._shuffle(makeDeck(playerDeckIds || PLAYER_DECK_IDS)),
        hand: [],
        field: { monsters: Array(5).fill(null), spellTraps: Array(5).fill(null) },
        graveyard: [],
        normalSummonUsed: false
      },
      opponent: {
        lp: 8000,
        deck: this._shuffle(makeDeck(oppDeckIds)),
        hand: [],
        field: { monsters: Array(5).fill(null), spellTraps: Array(5).fill(null) },
        graveyard: [],
        normalSummonUsed: false
      },
      log: []
    };
    this.drawCard('player',   5);
    this.drawCard('opponent', 5);
    this.state.phase = 'main';
    this.addLog('=== Duell beginnt! ===');
    this.addLog('Runde 1 - Dein Zug!');
    this.ui.render(this.state);
  }

  getState(){ return this.state; }

  // ───────── Utility ──────────────────────────────────────
  _shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  addLog(msg){
    this.state.log.unshift(msg);
    if(this.state.log.length>30) this.state.log.pop();
    AetherialClash.gameEvent(msg);
    this.ui.log(msg);
  }

  dealDamage(target, amount){
    this.state[target].lp = Math.max(0, this.state[target].lp - amount);
    this.addLog(`${target==='player'?'Spieler':'Gegner'} erhält ${amount} Schaden. (LP: ${this.state[target].lp})`);
    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  gainLP(target, amount){
    this.state[target].lp += amount;
    this.addLog(`${target==='player'?'Spieler':'Gegner'} erhält ${amount} LP. (LP: ${this.state[target].lp})`);
    this.ui.render(this.state);
  }

  checkWin(){
    if(this.state.player.lp <= 0){
      this.addLog('=== NIEDERLAGE ===');
      this._endDuel('defeat');
      return true;
    }
    if(this.state.opponent.lp <= 0){
      this.addLog('=== SIEG ===');
      this._endDuel('victory');
      return true;
    }
    if(this.state.player.deck.length === 0 && this.state.phase === 'draw'){
      this.addLog('=== NIEDERLAGE (Deck leer) ===');
      this._endDuel('defeat');
      return true;
    }
    if(this.state.opponent.deck.length === 0){
      this.addLog('=== SIEG (Gegner-Deck leer) ===');
      this._endDuel('victory');
      return true;
    }
    return false;
  }

  _endDuel(result){
    const logSuffix = result === 'victory' ? 'sieg' : 'niederlage';
    AetherialClash.downloadLog(logSuffix);
    // onDuelEnd ermöglicht Progressions-Auswertung in ui.js
    if(typeof this.ui.onDuelEnd === 'function'){
      this.ui.onDuelEnd(result, this._currentOpponentId);
    } else {
      this.ui.showResult(result);
    }
  }

  // ───────── Draw ─────────────────────────────────────────
  drawCard(owner, count=1){
    const st = this.state[owner];
    let drawn = 0;
    for(let i=0;i<count;i++){
      if(st.deck.length===0){ this.addLog(`${owner==='player'?'Dein':'Gegners'} Deck ist leer!`); break; }
      const card = st.deck.shift();
      st.hand.push(card);
      drawn++;
    }
    // hand limit 10
    while(st.hand.length > 10) st.hand.shift();
    if(drawn > 0 && this.ui.onDraw) this.ui.onDraw(owner, drawn);
  }

  // ───────── Summon ────────────────────────────────────────
  summonMonster(owner, handIndex, zone, position='atk', faceDown=false){
    const st = this.state[owner];
    if(zone < 0 || zone > 4 || st.field.monsters[zone]){
      this.addLog('Ungültige Zone!'); return false;
    }
    const [card] = st.hand.splice(handIndex, 1);
    const fc = new FieldCard(card, position, faceDown);
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;
    const posStr = faceDown ? 'verdeckt DEF' : position.toUpperCase();
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: ${card.name} (${posStr}).`);
    // trigger onSummon effect only if face-up
    if(!faceDown) this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  setMonster(owner, handIndex, zone){
    return this.summonMonster(owner, handIndex, zone, 'def', true);
  }

  specialSummon(owner, card, zone){
    const st = this.state[owner];
    if(zone === undefined){
      zone = st.field.monsters.findIndex(z => z === null);
      if(zone === -1){ this.addLog('Kein freier Monsterplatz!'); return false; }
    }
    if(st.field.monsters[zone]){ this.addLog('Zone belegt!'); return false; }
    const fc = new FieldCard(card, 'atk');
    fc.summonedThisTurn = false; // special summons can usually attack (or keep true for balance)
    st.field.monsters[zone] = fc;
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: ${card.name} Spezialbeschwörung!`);
    this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  specialSummonFromGrave(owner, card){
    const st = this.state[owner];
    const graveIdx = st.graveyard.findIndex(c => c.id === card.id);
    if(graveIdx === -1){ this.addLog('Karte nicht im Friedhof!'); return false; }
    const zone = st.field.monsters.findIndex(z => z === null);
    if(zone === -1){ this.addLog('Kein freier Platz!'); return false; }
    const [c] = st.graveyard.splice(graveIdx, 1);
    const fc = new FieldCard(c, 'atk');
    fc.summonedThisTurn = false;
    st.field.monsters[zone] = fc;
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: ${c.name} aus dem Friedhof beschworen!`);
    this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  // ───────── Spell / Trap ──────────────────────────────────
  setSpellTrap(owner, handIndex, zone){
    const st = this.state[owner];
    if(zone < 0 || zone > 4 || st.field.spellTraps[zone]){
      this.addLog('Ungültige Zauberkarten-Zone!'); return false;
    }
    const [card] = st.hand.splice(handIndex, 1);
    st.field.spellTraps[zone] = new FieldSpellTrap(card, true);
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: Karte verdeckt abgelegt.`);
    this.ui.render(this.state);
    return true;
  }

  async activateSpell(owner, handIndex, targetInfo=null){
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if(!card || card.type !== TYPE.SPELL){ this.addLog('Keine Zauberkarte!'); return false; }
    st.hand.splice(handIndex, 1);
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: ${card.name} aktiviert!`);
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    if(card.effect) card.effect.apply(this, owner, targetInfo);
    st.graveyard.push(card);
    this.ui.render(this.state);
    return true;
  }

  activateSpellFromField(owner, zone, targetInfo=null){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== TYPE.SPELL) return false;
    fst.faceDown = false;
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: ${fst.card.name} aktiviert!`);
    if(this.ui.showActivation) this.ui.showActivation(fst.card, fst.card.description);
    if(fst.card.effect) fst.card.effect.apply(this, owner, targetInfo);
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    return true;
  }

  activateTrapFromField(owner, zone, ...args){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== TYPE.TRAP || fst.used) return null;
    fst.used = true;
    fst.faceDown = false;
    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: Falle ${fst.card.name} aktiviert!`);
    if(this.ui.showActivation) this.ui.showActivation(fst.card, fst.card.description);
    let result = null;
    if(fst.card.effect) result = fst.card.effect.apply(this, owner, ...args) || {};
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    return result;
  }

  // ───────── Fusion ────────────────────────────────────────
  canFuse(owner){
    const hand = this.state[owner].hand;
    for(let i=0;i<hand.length;i++){
      for(let j=i+1;j<hand.length;j++){
        if(checkFusion(hand[i].id, hand[j].id)) return true;
      }
    }
    return false;
  }

  getAllFusionOptions(owner){
    const hand = this.state[owner].hand;
    const options = [];
    for(let i=0;i<hand.length;i++){
      for(let j=i+1;j<hand.length;j++){
        const recipe = checkFusion(hand[i].id, hand[j].id);
        if(recipe){
          options.push({ i1:i, i2:j, card1:hand[i], card2:hand[j], result:CARD_DB[recipe.result] });
        }
      }
    }
    return options;
  }

  performFusion(owner, handIdx1, handIdx2){
    const st = this.state[owner];
    const hand = st.hand;
    // indices might shift, work with sorted desc
    const [hi, lo] = handIdx1 > handIdx2 ? [handIdx1, handIdx2] : [handIdx2, handIdx1];
    const card1 = hand[hi];
    const card2 = hand[lo];
    const recipe = checkFusion(card1.id, card2.id);
    if(!recipe){ this.addLog('Keine Fusion möglich!'); return false; }

    const zone = st.field.monsters.findIndex(z => z === null);
    if(zone === -1){ this.addLog('Kein freier Monsterplatz für Fusion!'); return false; }

    // remove materials
    hand.splice(hi, 1);
    hand.splice(lo, 1);
    st.graveyard.push(card1);
    st.graveyard.push(card2);

    const fusionCard = Object.assign({}, CARD_DB[recipe.result]);
    const fc = new FieldCard(fusionCard, 'atk');
    fc.summonedThisTurn = false; // fusion monsters can attack immediately
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;

    this.addLog(`${owner==='player'?'Spieler':'Gegner'}: FUSION! ${card1.name} + ${card2.name} = ${fusionCard.name}!`);
    this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  // ───────── Battle ────────────────────────────────────────
  async attack(attackerOwner, attackerZone, defenderZone){
    const atkSt  = this.state[attackerOwner];
    const defOwn = attackerOwner === 'player' ? 'opponent' : 'player';
    const defSt  = this.state[defOwn];

    const attFC = atkSt.field.monsters[attackerZone];
    if(!attFC){ this.addLog('Kein angreifendes Monster!'); return; }
    if(attFC.hasAttacked){ this.addLog(`${attFC.card.name} hat bereits angegriffen!`); return; }
    if(attFC.position !== 'atk'){ this.addLog('Monster muss im Angriffsmodus sein!'); return; }

    const defFC = defSt.field.monsters[defenderZone];

    // Check player traps if attacker is opponent
    if(attackerOwner === 'opponent'){
      const trapResult = await this._promptPlayerTraps('onAttack', attFC);
      if(trapResult && trapResult.cancelAttack){ attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(defFC){
        const trapResult2 = await this._promptPlayerTraps('onOwnMonsterAttacked', attFC, defFC);
        if(trapResult2 && trapResult2.cancelAttack){ attFC.hasAttacked = true; this.ui.render(this.state); return; }
      }
    }

    attFC.hasAttacked = true;

    if(!defFC){
      // direct attack
      this.addLog(`${attFC.card.name} greift direkt an!`);
      if(this.ui.playAttackAnimation) await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, null);
      this.dealDamage(defOwn, attFC.effectiveATK());
    } else {
      if(this.ui.playAttackAnimation) await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, defenderZone);
      await this._resolveBattle(attackerOwner, attackerZone, defOwn, defenderZone, attFC, defFC);
    }
    this.ui.render(this.state);
  }

  async attackDirect(attackerOwner, attackerZone){
    const defOwn  = attackerOwner === 'player' ? 'opponent' : 'player';
    const defMons = this.state[defOwn].field.monsters;
    const attFC   = this.state[attackerOwner].field.monsters[attackerZone];
    if(!attFC) return;
    if(!attFC.canDirectAttack && defMons.some(m => m !== null)){
      this.addLog('Gegner hat Monster auf dem Spielfeld!'); return;
    }
    if(attFC.hasAttacked) return;
    if(attFC.position !== 'atk') return;

    if(attackerOwner === 'opponent'){
      const trapResult = await this._promptPlayerTraps('onAttack', attFC);
      if(trapResult && trapResult.cancelAttack){ attFC.hasAttacked = true; this.ui.render(this.state); return; }
    }

    attFC.hasAttacked = true;
    this.addLog(`${attFC.card.name} greift direkt an!`);
    if(this.ui.playAttackAnimation) await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, null);
    this.dealDamage(defOwn, attFC.effectiveATK());
    this.ui.render(this.state);
  }

  async _resolveBattle(atkOwner, atkZone, defOwner, defZone, attFC, defFC){
    const atkVal = attFC.effectiveATK();

    if(defFC.faceDown){
      defFC.faceDown = false;
      this.addLog(`${defFC.card.name} wird aufgedeckt!`);
      // flip effect if any – simplified
    }

    const defVal = defFC.position === 'atk' ? defFC.effectiveATK() : defFC.effectiveDEF();
    const modeStr= defFC.position === 'atk' ? 'ATK' : 'DEF';

    // passive: Heiliger Krieger vs dark
    let atkBonus = 0;
    if(attFC.card.effect && attFC.card.effect.trigger==='passive' && defFC.card.attribute===ATTR.DARK && attFC.card.id==='M024')
      atkBonus = 500;

    const effATK = atkVal + atkBonus;

    this.addLog(`${attFC.card.name} (ATK ${effATK}) vs ${defFC.card.name} (${modeStr} ${defVal})`);

    if(defFC.position === 'atk'){
      if(effATK > defVal){
        const dmg = effATK - defVal;
        this.addLog(`${defFC.card.name} zerstört! Gegner: -${dmg} LP`);
        this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
        this.dealDamage(defOwner, dmg);
        // attacker effect: onDestroyByBattle
        this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
      } else if(effATK === defVal){
        this.addLog('Unentschieden! Beide Monster zerstört!');
        this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
        this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
      } else {
        const dmg = defVal - effATK;
        this.addLog(`${attFC.card.name} zerstört! Spieler: -${dmg} LP`);
        this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
        this.dealDamage(atkOwner, dmg);
        this._triggerEffect(defFC, defOwner, 'onDestroyByBattle', null);
      }
    } else {
      // defender in DEF mode
      if(effATK > defVal){
        this.addLog(`${defFC.card.name} (DEF) zerstört!`);
        this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
        if(attFC.piercing){
          const pierceDmg = effATK - defVal;
          this.addLog(`Durchbohrender Angriff! -${pierceDmg} LP`);
          this.dealDamage(defOwner, pierceDmg);
        }
      } else if(effATK === defVal){
        this.addLog('Monster in Abwehr hält stand!');
      } else {
        this.addLog('Angriff abgewehrt! Kein Schaden.');
      }
    }
  }

  _destroyMonster(owner, zone, reason, byOwner){
    const st  = this.state[owner];
    const fc  = st.field.monsters[zone];
    if(!fc) return;

    // Flammenphönix revival
    if(fc.card.id === 'M022' && !fc.phoenixRevived && reason === 'battle' && byOwner !== owner){
      fc.phoenixRevived = true;
      st.graveyard.push(fc.card);
      st.field.monsters[zone] = null;
      // Special summon from grave with -500 ATK
      const revCard = Object.assign({}, fc.card, { atk: fc.card.atk - 500 });
      const newZone = st.field.monsters.findIndex(z => z === null);
      if(newZone !== -1){
        const newFC = new FieldCard(revCard, 'atk');
        newFC.phoenixRevived = true;
        newFC.summonedThisTurn = false;
        st.field.monsters[newZone] = newFC;
        this.addLog(`${fc.card.name} steigt aus dem Friedhof auf! (ATK: ${revCard.atk})`);
        this.ui.render(this.state);
        return;
      }
    }

    // Shadow Reaper / onDestroyByBattle for defender
    if(reason === 'battle' && byOwner !== owner){
      this._triggerEffect(fc, owner, 'onDestroyByOpponent', zone);
    }

    st.graveyard.push(fc.card);
    st.field.monsters[zone] = null;
    this.ui.render(this.state);
  }

  _triggerEffect(fc, owner, trigger, zone){
    const card = fc.card;
    if(!card.effect || card.effect.trigger !== trigger) return;
    if(typeof card.effect.apply === 'function'){
      AetherialClash.log('EFFECT', `${card.name} (${owner}) – Trigger: ${trigger}`);
      if(this.ui.showActivation) this.ui.showActivation(card, card.description);
      card.effect.apply(this, owner, null);
    }
  }

  // ───────── Trap prompts ──────────────────────────────────
  async _promptPlayerTraps(triggerType, ...args){
    // check player's face-down traps
    const traps = this.state.player.field.spellTraps;
    for(let i=0;i<5;i++){
      const fst = traps[i];
      if(fst && fst.card.type === TYPE.TRAP && fst.faceDown && !fst.used && fst.card.trapTrigger === triggerType){
        // ask player
        const activate = await this.ui.prompt({
          title: 'Falle aktivieren?',
          cardId: fst.card.id,
          message: `${fst.card.name}: ${fst.card.description}`,
          yes: 'Ja, aktivieren!',
          no:  'Nein, überspringen'
        });
        if(activate){
          return this.activateTrapFromField('player', i, ...args);
        }
      }
    }
    return null;
  }

  _checkOpponentTrap(triggerType, fc){
    // simplified: AI doesn't interactively trigger traps; they are activated by AI logic
  }

  // ───────── Phase management ──────────────────────────────
  advancePhase(){
    const phases = ['main','battle','end'];
    const idx = phases.indexOf(this.state.phase);
    if(idx < phases.length - 1){
      this.state.phase = phases[idx+1];
      const names = { main:'Hauptphase', battle:'Kampfphase', end:'Endphase' };
      this.addLog(`--- ${names[this.state.phase]} ---`);
      this.ui.render(this.state);
    } else {
      this.endTurn();
    }
  }

  endTurn(){
    // clear temp buffs
    ['player','opponent'].forEach(own => {
      this.state[own].field.monsters.forEach(fc => {
        if(fc) { fc.tempATKBonus = 0; fc.hasAttacked = false; fc.summonedThisTurn = false; }
      });
    });

    // reset per-turn summon limit
    this.state.player.normalSummonUsed   = false;
    this.state.opponent.normalSummonUsed = false;

    // discard to hand limit
    const hand = this.state.player.hand;
    while(hand.length > 8){ hand.shift(); }

    // switch player
    this.state.activePlayer = 'opponent';
    this.state.phase = 'draw';
    this.state.turn++;

    this.addLog(`=== Runde ${this.state.turn} - Gegner am Zug ===`);
    this.ui.render(this.state);

    // run AI
    setTimeout(() => {
      this._aiTurn().catch(err => {
        AetherialClash.log('ERROR', 'AI-Zug abgestürzt:', err);
        console.error('[AetherialClash] Unbehandelter Fehler in _aiTurn:', err);
        AetherialClash.downloadLog('ai_crash');
        // Recover: switch back to player so game isn't frozen
        this.state.activePlayer = 'player';
        this.state.phase = 'main';
        this.state.turn++;
        this.addLog(`[FEHLER] Gegner-KI abgestürzt. Dein Zug (Runde ${this.state.turn}).`);
        this.drawCard('player', 1);
        this.ui.render(this.state);
      });
    }, 600);
  }

  // ───────── AI ────────────────────────────────────────────
  async _aiTurn(){
    const ai  = this.state.opponent;
    const plr = this.state.player;

    AetherialClash.group(`=== KI-Zug Runde ${this.state.turn} ===`);

    // Draw
    this.state.phase = 'draw';
    this.ui.render(this.state);
    await this._delay(300);
    this.drawCard('opponent', 1);
    this.addLog('Gegner zieht eine Karte.');
    AetherialClash.log('PHASE', 'Ziehphase – Hand:', ai.hand.map(c => c.name));
    this.ui.render(this.state);
    await this._delay(400);

    // Main Phase
    this.state.phase = 'main';
    this.addLog('--- Gegner Hauptphase ---');
    this.ui.render(this.state);
    await this._delay(400);

    // Try fusion first (max. 1 pro Runde)
    AetherialClash.log('AI', 'Hauptphase – prüfe Fusion...');
    if(!ai.normalSummonUsed){
      const opts = this.getAllFusionOptions('opponent');
      if(opts.length > 0){
        const best = opts.sort((a,b) => b.result.atk - a.result.atk)[0];
        const zone = ai.field.monsters.findIndex(z => z === null);
        if(zone !== -1){
          AetherialClash.log('AI', `Fusion: ${best.card1.name} + ${best.card2.name} → ${best.result.name} (Zone ${zone})`);
          await this._delay(500);
          this.performFusion('opponent', best.i1, best.i2);
        }
      } else {
        AetherialClash.log('AI', 'Keine Fusion möglich.');
      }
    }

    // Summon one monster from hand (max. 1 pro Runde)
    AetherialClash.log('AI', 'Beschwöre Monster aus Hand:', ai.hand.filter(c => c.type===TYPE.NORMAL||c.type===TYPE.EFFECT).map(c=>c.name));
    if(!ai.normalSummonUsed){
      for(let i = ai.hand.length-1; i >= 0; i--){
        const card = ai.hand[i];
        if(card.type !== TYPE.NORMAL && card.type !== TYPE.EFFECT) continue;
        const zone = ai.field.monsters.findIndex(z => z === null);
        if(zone === -1){ AetherialClash.log('AI', 'Alle Monsterzonen belegt.'); break; }
        AetherialClash.log('SUMMON', `Beschwöre ${card.name} (ATK:${card.atk}) in Zone ${zone}`);
        await this._delay(350);
        this.summonMonster('opponent', i, zone, 'atk');
        // Check player trap hole
        const summonedFC = ai.field.monsters[zone];
        if(summonedFC){
          const trapResult = await this._promptPlayerTraps('onOpponentSummon', summonedFC);
          if(trapResult && trapResult.destroySummoned){
            AetherialClash.log('TRAP', `Fallenloch zerstört ${summonedFC.card.name}`);
            ai.graveyard.push(ai.field.monsters[zone].card);
            ai.field.monsters[zone] = null;
            this.ui.render(this.state);
          }
        }
        break; // nur 1 Monster pro Runde
      }
    }

    // Activate spells - restart loop after each activation to avoid index issues
    AetherialClash.log('AI', 'Aktiviere Zauberkarten...');
    let spellActivated = true;
    while(spellActivated){
      spellActivated = false;
      for(let i = 0; i < ai.hand.length; i++){
        const card = ai.hand[i];
        if(card.type !== TYPE.SPELL) continue;
        let activated = false;
        if(card.spellType === 'normal'){
          const should = (card.id==='S001' && plr.lp>800) || (card.id==='S002' && ai.lp<5000) || card.id==='S005';
          if(should){
            AetherialClash.log('SPELL', `Aktiviere ${card.name} (normal)`);
            await this._delay(300); await this.activateSpell('opponent', i); activated = true;
          } else {
            AetherialClash.log('SPELL', `${card.name}: Bedingung nicht erfüllt (plr.lp=${plr.lp}, ai.lp=${ai.lp})`);
          }
        } else if(card.spellType === 'targeted'){
          if(card.target === 'ownDarkMonster'){
            const t = ai.field.monsters.find(m => m && m.card.attribute===ATTR.DARK);
            if(t){
              AetherialClash.log('SPELL', `Aktiviere ${card.name} → Ziel: ${t.card.name}`);
              await this._delay(300); await this.activateSpell('opponent', i, t); activated = true;
            } else {
              AetherialClash.log('SPELL', `${card.name}: Kein DUNKEL-Monster auf dem Feld.`);
            }
          } else if(card.target === 'ownMonster'){
            const t = ai.field.monsters.find(m => m !== null);
            if(t){
              AetherialClash.log('SPELL', `Aktiviere ${card.name} → Ziel: ${t.card.name}`);
              await this._delay(300); await this.activateSpell('opponent', i, t); activated = true;
            }
          }
        } else if(card.spellType === 'fromGrave'){
          const gm = ai.graveyard.find(c => c.type!==TYPE.SPELL && c.type!==TYPE.TRAP);
          if(gm && ai.field.monsters.some(z=>z===null)){
            AetherialClash.log('SPELL', `Aktiviere ${card.name} → Friedhof: ${gm.name}`);
            await this._delay(300); await this.activateSpell('opponent', i, gm); activated = true;
          }
        }
        if(activated){ spellActivated = true; break; }
      }
    }

    // Set traps
    AetherialClash.log('AI', 'Lege Fallen ab...');
    const hand = ai.hand;
    for(let i = hand.length - 1; i >= 0; i--){
      const card = hand[i];
      if(card.type !== TYPE.TRAP) continue;
      const zone = ai.field.spellTraps.findIndex(z => z === null);
      if(zone === -1) break;
      AetherialClash.log('TRAP', `Lege ${card.name} verdeckt in Zone ${zone}`);
      await this._delay(300);
      this.setSpellTrap('opponent', i, zone);
      // index may have shifted after removal; restart from new end
      i = Math.min(i, ai.hand.length);
    }

    // Battle Phase
    this.state.phase = 'battle';
    this.addLog('--- Gegner Kampfphase ---');
    AetherialClash.log('PHASE', `Kampfphase – KI-Feld: [${ai.field.monsters.filter(Boolean).map(fc=>`${fc.card.name}(${fc.effectiveATK()})`).join(', ')}]`);
    AetherialClash.log('PHASE', `Spieler-Feld: [${plr.field.monsters.filter(Boolean).map(fc=>`${fc.card.name}(${fc.position==='atk'?fc.effectiveATK():fc.effectiveDEF()})`).join(', ')}]`);
    this.ui.render(this.state);
    await this._delay(500);

    const aiMonsters  = ai.field.monsters;
    const plrMonsters = plr.field.monsters;

    for(let az = 0; az < 5; az++){
      const atk = aiMonsters[az];
      if(!atk){ continue; }
      if(atk.position !== 'atk'){ AetherialClash.log('AI', `Zone ${az}: ${atk.card.name} ist im DEF-Modus – überspringen`); continue; }
      if(atk.hasAttacked){       AetherialClash.log('AI', `Zone ${az}: ${atk.card.name} hat bereits angegriffen`);           continue; }
      await this._delay(500);

      // Recalculate each iteration in case earlier attacks destroyed monsters
      const plrHasMonsters = plrMonsters.some(m => m !== null);

      if(!plrHasMonsters){
        AetherialClash.log('BATTLE', `${atk.card.name} → Direktangriff!`);
        await this.attackDirect('opponent', az);
        if(this.checkWin()) return;
      } else {
        // Prefer attacking the strongest monster we can destroy
        let bestTarget = -1;
        let bestScore  = -Infinity;
        for(let dz = 0; dz < 5; dz++){
          const def = plrMonsters[dz];
          if(!def) continue;
          const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
          if(atk.effectiveATK() > defVal){
            if(defVal > bestScore){ bestScore = defVal; bestTarget = dz; }
          }
        }
        if(bestTarget !== -1){
          AetherialClash.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → greift ${plrMonsters[bestTarget].card.name}(${bestScore}) an [kann zerstören]`);
          await this.attack('opponent', az, bestTarget);
          if(this.checkWin()) return;
        } else {
          // Always attack the weakest available monster (aggressive AI, no random pass)
          let weakTarget = -1, weakVal = Infinity;
          for(let dz = 0; dz < 5; dz++){
            const def = plrMonsters[dz];
            if(!def) continue;
            const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
            if(defVal < weakVal){ weakVal = defVal; weakTarget = dz; }
          }
          if(weakTarget !== -1){
            AetherialClash.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → greift ${plrMonsters[weakTarget].card.name}(${weakVal}) an [aggressiv, wird verlieren]`);
            await this.attack('opponent', az, weakTarget);
            if(this.checkWin()) return;
          } else {
            AetherialClash.log('BATTLE', `${atk.card.name}: kein Ziel gefunden – überspringen`);
          }
        }
      }
    }

    // AI End Phase
    AetherialClash.log('PHASE', 'Endphase – KI räumt auf.');
    this.state.phase = 'end';
    this.ui.render(this.state);
    await this._delay(300);

    // clear ai temp buffs
    ai.field.monsters.forEach(fc => { if(fc) { fc.tempATKBonus = 0; fc.hasAttacked = false; fc.summonedThisTurn = false; }});
    while(ai.hand.length > 8) ai.hand.shift();

    // switch back to player
    this.state.activePlayer = 'player';
    this.state.phase = 'main';
    this.state.turn++;
    this.addLog(`=== Runde ${this.state.turn} - Dein Zug! ===`);

    AetherialClash.groupEnd(); // close group opened at start of _aiTurn

    // Player draw
    this.drawCard('player', 1);

    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  _delay(ms){ return new Promise(r => setTimeout(r, ms)); }

  // ───────── Position change ───────────────────────────────
  changePosition(owner, zone){
    const fc = this.state[owner].field.monsters[zone];
    if(!fc || fc.summonedThisTurn){ this.addLog('Kann Position nicht ändern!'); return; }
    fc.position = fc.position === 'atk' ? 'def' : 'atk';
    fc.hasAttacked = true; // cant attack after changing
    this.addLog(`${fc.card.name} wechselt in den ${fc.position === 'atk' ? 'Angriffs' : 'Verteidigungs'}modus.`);
    this.ui.render(this.state);
  }
}
