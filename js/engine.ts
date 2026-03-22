// ============================================================
// ECHOES OF SANGUO - Game Engine
// ============================================================
//
// DEBUG LOGGING
// Toggle with:  EchoesOfSanguo.debug = true   (in browser console)
// Categories:   PHASE | AI | BATTLE | EFFECT | SUMMON | SPELL | ERROR
// Each category has its own color; errors always show regardless of flag.
//
import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS, OPPONENT_DECK_IDS, PLAYER_DECK_IDS, makeDeck, checkFusion } from './cards.js';
import { Progression } from './progression.js';
import { executeEffectBlock, extractPassiveFlags } from './effect-registry.js';
import { CardType, Attribute, isMonsterType } from './types.js';
import type { Owner, Phase, Position, CardData, CardEffectBlock, EffectContext, EffectSignal, GameState, PlayerState, UICallbacks, OpponentConfig, VsAttrBonus } from './types.js';

const ownerLabel = (owner: Owner): string => owner === 'player' ? 'Spieler' : 'Gegner';

export const EchoesOfSanguo = {
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

  log(category, msg, data: unknown = undefined){
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

  _push(category, msg, data: unknown = undefined){
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
  // filename: z.B. "echoes_of_sanguo_2026-03-17_14-30-00.log"
  downloadLog(reason = 'manual'){
    const ts       = this._sessionStart || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `echoes_of_sanguo_${ts}_${reason}.log`;
    const text     = this._buildLogText();
    if(typeof document === 'undefined') return; // guard: no DOM in Node/test environment
    const blob     = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.info(`[EchoesOfSanguo] Log gespeichert: ${filename} (${this._entries.length} Einträge)`);
  },
};

// ── Hand size constants ───────────────────────────────────
const HAND_LIMIT_DRAW = 10; // max cards holdable mid-turn (draw cap)
const HAND_LIMIT_END  = 8;  // must discard down to this at end of turn

export class FieldCard {
  card: CardData;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  summonedThisTurn: boolean;
  tempATKBonus: number;
  permATKBonus: number;
  permDEFBonus: number;
  phoenixRevivalUsed: boolean;
  piercing: boolean;
  cannotBeTargeted: boolean;
  canDirectAttack: boolean;
  vsAttrBonus: VsAttrBonus | null;
  phoenixRevival: boolean;

  constructor(card: CardData, position: Position = 'atk', faceDown: boolean = false) {
    this.card       = { // deep-copy effect to prevent shared mutations across FieldCard instances
      ...card,
      effect: card.effect ? { ...card.effect, actions: card.effect.actions.map(a => ({ ...a })) } : undefined,
    };
    this.position   = position; // 'atk' | 'def'
    this.faceDown   = faceDown;
    this.hasAttacked= false;
    this.summonedThisTurn = true; // summoning sickness
    this.tempATKBonus = 0;
    this.permATKBonus = 0;
    this.permDEFBonus = 0;
    this.phoenixRevivalUsed = false;
    // passive flags from effect
    if(card.effect && card.effect.trigger==='passive'){
      const flags = extractPassiveFlags(card.effect);
      this.piercing        = flags.piercing;
      this.cannotBeTargeted= flags.cannotBeTargeted;
      this.canDirectAttack = flags.canDirectAttack;
      this.vsAttrBonus     = flags.vsAttrBonus;
      this.phoenixRevival  = flags.phoenixRevival;
    } else {
      this.piercing = false;
      this.cannotBeTargeted = false;
      this.canDirectAttack  = false;
      this.vsAttrBonus     = null;
      this.phoenixRevival  = false;
    }
  }
  effectiveATK(): number {
    return Math.max(0, (this.card.atk ?? 0) + this.tempATKBonus + this.permATKBonus);
  }
  effectiveDEF(): number {
    return Math.max(0, (this.card.def ?? 0) + this.permDEFBonus);
  }
}

// ── FieldSpellTrap ─────────────────────────────────────────
export class FieldSpellTrap {
  card: any;
  faceDown: boolean;
  used: boolean;

  constructor(card, faceDown=true){
    this.card    = card;
    this.faceDown= faceDown;
    this.used    = false;
  }
}

// ── GameEngine ─────────────────────────────────────────────
export class GameEngine {
  uiCallbacks: UICallbacks;
  state!: GameState; // initialized in initGame() before any gameplay method is called
  ui: any;
  _trapResolve: any;
  _currentOpponentId: any;

  constructor(uiCallbacks: UICallbacks){
    this.ui = uiCallbacks; // { render, log, prompt, showResult, onDuelEnd }
    this._trapResolve = null;
    this._currentOpponentId = null;
  }

  // ───────── Init ─────────────────────────────────────────
  /**
   * @param {string[]} playerDeckIds  - Karten-IDs des Spielers
   * @param {object}   opponentConfig - { id, deckIds } aus OPPONENT_CONFIGS
   */
  initGame(playerDeckIds: string[], opponentConfig: OpponentConfig | null){
    EchoesOfSanguo.startSession();
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
    } as GameState;
    this.drawCard('player',   5);
    this.drawCard('opponent', 5);
    this.state.phase = 'main';
    this.addLog('=== Duell beginnt! ===');
    this.addLog('Runde 1 - Dein Zug!');
    this.ui.render(this.state);
  }

  getState(): GameState { return this.state; }

  // ───────── Utility ──────────────────────────────────────
  _shuffle(arr){
    for(let i=arr.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [arr[i],arr[j]]=[arr[j],arr[i]];
    }
    return arr;
  }

  addLog(msg: string){
    this.state.log.unshift(msg);
    if(this.state.log.length>30) this.state.log.pop();
    EchoesOfSanguo.gameEvent(msg);
    this.ui.log(msg);
  }

  dealDamage(target: Owner, amount: number){
    this.state[target].lp = Math.max(0, this.state[target].lp - amount);
    this.addLog(`${ownerLabel(target)} erhält ${amount} Schaden. (LP: ${this.state[target].lp})`);
    this.ui.playSfx?.('sfx_damage');
    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  gainLP(target: Owner, amount: number){
    this.state[target].lp += amount;
    this.addLog(`${ownerLabel(target)} erhält ${amount} LP. (LP: ${this.state[target].lp})`);
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
    EchoesOfSanguo.downloadLog(logSuffix);
    // onDuelEnd ermöglicht Progressions-Auswertung in ui.js
    if(typeof this.ui.onDuelEnd === 'function'){
      this.ui.onDuelEnd(result, this._currentOpponentId);
    } else {
      this.ui.showResult(result);
    }
  }

  // ───────── Draw ─────────────────────────────────────────
  drawCard(owner: Owner, count = 1){
    const st = this.state[owner];
    let drawn = 0;
    for(let i=0;i<count;i++){
      if(st.deck.length===0){ this.addLog(`${owner==='player'?'Dein':'Gegners'} Deck ist leer!`); break; }
      const card = st.deck.shift()!; // length checked above
      st.hand.push(card);
      drawn++;
    }
    // hand limit (draw cap)
    while(st.hand.length > HAND_LIMIT_DRAW) st.hand.shift();
    if(drawn > 0 && this.ui.onDraw) this.ui.onDraw(owner, drawn);
  }

  // ───────── Summon ────────────────────────────────────────
  summonMonster(owner, handIndex, zone, position: Position = 'atk', faceDown=false){
    const st = this.state[owner];
    if(zone < 0 || zone > 4 || st.field.monsters[zone]){
      this.addLog('Ungültige Zone!'); return false;
    }
    const [card] = st.hand.splice(handIndex, 1);
    const fc = new FieldCard(card, position, faceDown);
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;
    const posStr = faceDown ? 'verdeckt DEF' : position.toUpperCase();
    this.addLog(`${ownerLabel(owner)}: ${card.name} (${posStr}).`);
    this.ui.playSfx?.('sfx_card_play');
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
    this.addLog(`${ownerLabel(owner)}: ${card.name} Spezialbeschwörung!`);
    this.ui.playSfx?.('sfx_card_play');
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
    this.addLog(`${ownerLabel(owner)}: ${c.name} aus dem Friedhof beschworen!`);
    this.ui.playSfx?.('sfx_card_play');
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
    this.addLog(`${ownerLabel(owner)}: Karte verdeckt abgelegt.`);
    this.ui.playSfx?.('sfx_card_play');
    this.ui.render(this.state);
    return true;
  }

  async activateSpell(owner, handIndex, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if(!card || card.type !== CardType.Spell){ this.addLog('Keine Zauberkarte!'); return false; }
    st.hand.splice(handIndex, 1);
    this.addLog(`${ownerLabel(owner)}: ${card.name} aktiviert!`);
    this.ui.playSfx?.('sfx_spell');
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    if(card.effect) try {
      const ctx = this._buildSpellContext(owner, targetInfo);
      executeEffectBlock(card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Fehler in Zauber-Effekt [${card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
    st.graveyard.push(card);
    this.ui.render(this.state);
    return true;
  }

  activateSpellFromField(owner, zone, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Spell) return false;
    fst.faceDown = false;
    this.addLog(`${ownerLabel(owner)}: ${fst.card.name} aktiviert!`);
    if(this.ui.showActivation) this.ui.showActivation(fst.card, fst.card.description);
    if(fst.card.effect) try {
      const ctx = this._buildSpellContext(owner, targetInfo);
      executeEffectBlock(fst.card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Fehler in Zauber-Feldeffekt [${fst.card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    return true;
  }

  activateTrapFromField(owner, zone, ...args){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Trap || fst.used) return null;
    fst.used = true;
    fst.faceDown = false;
    this.addLog(`${ownerLabel(owner)}: Falle ${fst.card.name} aktiviert!`);
    this.ui.playSfx?.('sfx_trap');
    if(this.ui.showActivation) this.ui.showActivation(fst.card, fst.card.description);
    let result: EffectSignal | null = null;
    if(fst.card.effect) try {
      const ctx = this._buildTrapContext(owner, fst.card.trapTrigger, args);
      result = executeEffectBlock(fst.card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Fehler in Fallen-Effekt [${fst.card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
      result = {};
    }
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
    const options: Array<{i1:number, i2:number, card1:CardData, card2:CardData, result:CardData}> = [];
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

    this.addLog(`${ownerLabel(owner)}: FUSION! ${card1.name} + ${card2.name} = ${fusionCard.name}!`);
    this.ui.playSfx?.('sfx_fusion');
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

    // passive: vsAttrBonus (e.g. Heiliger Krieger +500 ATK vs DARK)
    let atkBonus = 0;
    if(attFC.vsAttrBonus && defFC.card.attribute === attFC.vsAttrBonus.attr)
      atkBonus = attFC.vsAttrBonus.atk;

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
    this.ui.playSfx?.('sfx_destroy');

    // phoenixRevival passive: revive once after destruction by opponent in battle
    if(fc.phoenixRevival && !fc.phoenixRevivalUsed && reason === 'battle' && byOwner !== owner){
      fc.phoenixRevivalUsed = true;
      st.graveyard.push(fc.card);
      st.field.monsters[zone] = null;
      // Special summon from grave with -500 ATK
      const revCard = Object.assign({}, fc.card, { atk: fc.card.atk - 500 });
      const newZone = st.field.monsters.findIndex(z => z === null);
      if(newZone !== -1){
        const newFC = new FieldCard(revCard, 'atk');
        newFC.phoenixRevivalUsed = true;
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

  _buildSpellContext(owner: Owner, targetInfo: any): EffectContext {
    const ctx: EffectContext = { engine: this, owner };
    if(targetInfo instanceof FieldCard){
      ctx.targetFC = targetInfo;
    } else if(targetInfo && typeof targetInfo === 'object' && 'id' in targetInfo){
      ctx.targetCard = targetInfo as CardData;
    }
    return ctx;
  }

  _buildTrapContext(owner: Owner, trapTrigger: string | undefined, args: any[]): EffectContext {
    const ctx: EffectContext = { engine: this, owner };
    if(trapTrigger === 'onAttack'){
      ctx.attacker = args[0];
    } else if(trapTrigger === 'onOwnMonsterAttacked'){
      ctx.attacker = args[0];
      ctx.defender = args[1];
    } else if(trapTrigger === 'onOpponentSummon'){
      ctx.summonedFC = args[0];
    }
    return ctx;
  }

  _triggerEffect(fc, owner, trigger, zone){
    const card = fc.card;
    if(!card.effect || card.effect.trigger !== trigger) return;
    EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Trigger: ${trigger}`);
    if(this.ui.showActivation) this.ui.showActivation(card, card.description);
    try {
      const ctx: EffectContext = { engine: this, owner };
      executeEffectBlock(card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Fehler in Effekt [${card.id}] trigger=${trigger}: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
  }

  // ───────── Trap prompts ──────────────────────────────────
  async _promptPlayerTraps(triggerType, ...args){
    // check player's face-down traps
    const traps = this.state.player.field.spellTraps;
    for(let i=0;i<5;i++){
      const fst = traps[i];
      if(fst && fst.card.type === CardType.Trap && fst.faceDown && !fst.used && fst.card.trapTrigger === triggerType){
        // Race UI prompt against an 8-second timeout so the game never hangs
        // if the modal is closed or the promise never resolves.
        const timeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 8000));
        const activate = await Promise.race([this.ui.prompt({
          title: 'Falle aktivieren?',
          cardId: fst.card.id,
          message: `${fst.card.name}: ${fst.card.description}`,
          yes: 'Ja, aktivieren!',
          no:  'Nein, überspringen'
        }), timeout]);
        if(activate){
          return this.activateTrapFromField('player', i, ...args);
        }
      }
    }
    return null;
  }

  // ───────── Phase management ──────────────────────────────
  advancePhase(){
    const phases = ['main','battle','end'];
    const idx = phases.indexOf(this.state.phase);
    if(idx < phases.length - 1){
      this.state.phase = phases[idx+1] as Phase;
      const names = { main:'Hauptphase', battle:'Kampfphase', end:'Endphase' };
      this.addLog(`--- ${names[this.state.phase]} ---`);
      this.ui.render(this.state);
    } else {
      this.endTurn();
    }
  }

  _resetMonsterFlags(owner: Owner){
    this.state[owner].field.monsters.forEach(fc => {
      if(fc){ fc.tempATKBonus = 0; fc.hasAttacked = false; fc.summonedThisTurn = false; }
    });
  }

  endTurn(){
    // Clear only the current player's per-turn flags.
    // The opponent's flags are cleared by _aiTurn at the end of the AI's turn.
    this._resetMonsterFlags('player');

    // reset per-turn summon limit
    this.state.player.normalSummonUsed   = false;
    this.state.opponent.normalSummonUsed = false;

    // discard to end-of-turn hand limit
    const hand = this.state.player.hand;
    while(hand.length > HAND_LIMIT_END){ hand.shift(); }

    // switch player
    this.state.activePlayer = 'opponent';
    this.state.phase = 'draw';
    this.state.turn++;

    this.addLog(`=== Runde ${this.state.turn} - Gegner am Zug ===`);
    this.ui.render(this.state);

    // run AI
    setTimeout(() => {
      this._aiTurn().catch(err => {
        EchoesOfSanguo.log('ERROR', 'AI-Zug abgestürzt:', err);
        console.error('[EchoesOfSanguo] Unbehandelter Fehler in _aiTurn:', err);
        EchoesOfSanguo.downloadLog('ai_crash');
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
    const ai = this.state.opponent;

    EchoesOfSanguo.group(`=== KI-Zug Runde ${this.state.turn} ===`);

    await this._aiDrawPhase();
    await this._aiMainPhase();
    await this._aiPlaceTraps();
    if (await this._aiBattlePhase()) return;

    // End Phase
    EchoesOfSanguo.log('PHASE', 'Endphase – KI räumt auf.');
    this.state.phase = 'end';
    this.ui.render(this.state);
    await this._delay(300);

    this._resetMonsterFlags('opponent');
    while(ai.hand.length > 8) ai.hand.shift();

    this.state.activePlayer = 'player';
    this.state.phase = 'main';
    this.state.turn++;
    this.addLog(`=== Runde ${this.state.turn} - Dein Zug! ===`);

    EchoesOfSanguo.groupEnd();

    this.drawCard('player', 1);
    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  async _aiDrawPhase() {
    const ai = this.state.opponent;
    this.state.phase = 'draw';
    this.ui.render(this.state);
    await this._delay(300);
    this.drawCard('opponent', 1);
    this.addLog('Gegner zieht eine Karte.');
    EchoesOfSanguo.log('PHASE', 'Ziehphase – Hand:', ai.hand.map(c => c.name));
    this.ui.render(this.state);
    await this._delay(400);
  }

  async _aiMainPhase() {
    const ai  = this.state.opponent;
    const plr = this.state.player;

    this.state.phase = 'main';
    this.addLog('--- Gegner Hauptphase ---');
    this.ui.render(this.state);
    await this._delay(400);

    // Try fusion first (max. 1 per turn)
    EchoesOfSanguo.log('AI', 'Hauptphase – prüfe Fusion...');
    if(!ai.normalSummonUsed){
      const opts = this.getAllFusionOptions('opponent');
      if(opts.length > 0){
        const best = opts.sort((a,b) => (b.result.atk ?? 0) - (a.result.atk ?? 0))[0];
        const zone = ai.field.monsters.findIndex(z => z === null);
        if(zone !== -1){
          EchoesOfSanguo.log('AI', `Fusion: ${best.card1.name} + ${best.card2.name} → ${best.result.name} (Zone ${zone})`);
          await this._delay(500);
          this.performFusion('opponent', best.i1, best.i2);
        }
      } else {
        EchoesOfSanguo.log('AI', 'Keine Fusion möglich.');
      }
    }

    // Summon one monster from hand (max. 1 per turn)
    // Prefer highest-ATK monster; set in DEF if weaker than all player monsters.
    EchoesOfSanguo.log('AI', 'Beschwöre Monster aus Hand:', ai.hand.filter(c => c.type === CardType.Monster).map(c=>c.name));
    if(!ai.normalSummonUsed){
      let bestIdx = -1, bestATK = -1;
      for(let i = 0; i < ai.hand.length; i++){
        const card = ai.hand[i];
        if(card.type !== CardType.Monster) continue;
        if((card.atk ?? 0) > bestATK){ bestATK = card.atk ?? 0; bestIdx = i; }
      }
      if(bestIdx !== -1){
        const card = ai.hand[bestIdx];
        const zone = ai.field.monsters.findIndex(z => z === null);
        if(zone === -1){
          EchoesOfSanguo.log('AI', 'Alle Monsterzonen belegt.');
        } else {
          const plrMinVal = plr.field.monsters
            .filter(Boolean)
            .reduce((min, fc) => Math.min(min, fc!.position==='atk' ? fc!.effectiveATK() : fc!.effectiveDEF()), Infinity);
          const summonPos = (plr.field.monsters.some(Boolean) && bestATK < plrMinVal) ? 'def' : 'atk';
          EchoesOfSanguo.log('SUMMON', `Beschwöre ${card.name} (ATK:${bestATK}) in Zone ${zone} als ${summonPos.toUpperCase()}`);
          await this._delay(350);
          this.summonMonster('opponent', bestIdx, zone, summonPos);
          const summonedFC = ai.field.monsters[zone];
          if(summonedFC){
            const trapResult = await this._promptPlayerTraps('onOpponentSummon', summonedFC);
            if(trapResult && trapResult.destroySummoned){
              EchoesOfSanguo.log('TRAP', `Fallenloch zerstört ${summonedFC.card.name}`);
              ai.graveyard.push(summonedFC.card);
              ai.field.monsters[zone] = null;
              this.ui.render(this.state);
            }
          }
        }
      }
    }

    // Activate spells — restart loop after each activation to avoid index issues
    EchoesOfSanguo.log('AI', 'Aktiviere Zauberkarten...');
    let spellActivated = true;
    while(spellActivated){
      spellActivated = false;
      for(let i = 0; i < ai.hand.length; i++){
        const card = ai.hand[i];
        if(card.type !== CardType.Spell) continue;
        let activated = false;
        if(card.spellType === 'normal'){
          const should = (card.id==='S001' && plr.lp>800) || (card.id==='S002' && ai.lp<5000) || card.id==='S005';
          if(should){
            EchoesOfSanguo.log('SPELL', `Aktiviere ${card.name} (normal)`);
            await this._delay(300); await this.activateSpell('opponent', i); activated = true;
          } else {
            EchoesOfSanguo.log('SPELL', `${card.name}: Bedingung nicht erfüllt (plr.lp=${plr.lp}, ai.lp=${ai.lp})`);
          }
        } else if(card.spellType === 'targeted'){
          if(card.target === 'ownDarkMonster'){
            const t = ai.field.monsters.find(m => m && m.card.attribute===Attribute.Dark);
            if(t){
              EchoesOfSanguo.log('SPELL', `Aktiviere ${card.name} → Ziel: ${t.card.name}`);
              await this._delay(300); await this.activateSpell('opponent', i, t); activated = true;
            } else {
              EchoesOfSanguo.log('SPELL', `${card.name}: Kein DUNKEL-Monster auf dem Feld.`);
            }
          } else if(card.target === 'ownMonster'){
            const t = ai.field.monsters.find(m => m !== null);
            if(t){
              EchoesOfSanguo.log('SPELL', `Aktiviere ${card.name} → Ziel: ${t.card.name}`);
              await this._delay(300); await this.activateSpell('opponent', i, t); activated = true;
            }
          }
        } else if(card.spellType === 'fromGrave'){
          const gm = ai.graveyard.find(c => isMonsterType(c.type));
          if(gm && ai.field.monsters.some(z=>z===null)){
            EchoesOfSanguo.log('SPELL', `Aktiviere ${card.name} → Friedhof: ${gm.name}`);
            await this._delay(300); await this.activateSpell('opponent', i, gm); activated = true;
          }
        }
        if(activated){ spellActivated = true; break; }
      }
    }
  }

  async _aiPlaceTraps() {
    const ai = this.state.opponent;
    EchoesOfSanguo.log('AI', 'Lege Fallen ab...');
    const hand = ai.hand;
    for(let i = hand.length - 1; i >= 0; i--){
      const card = hand[i];
      if(card.type !== CardType.Trap) continue;
      const zone = ai.field.spellTraps.findIndex(z => z === null);
      if(zone === -1) break;
      EchoesOfSanguo.log('TRAP', `Lege ${card.name} verdeckt in Zone ${zone}`);
      await this._delay(300);
      this.setSpellTrap('opponent', i, zone);
      // index may have shifted after removal; restart from new end
      i = Math.min(i, ai.hand.length);
    }
  }

  async _aiBattlePhase(): Promise<boolean> {
    const ai  = this.state.opponent;
    const plr = this.state.player;

    this.state.phase = 'battle';
    this.addLog('--- Gegner Kampfphase ---');
    EchoesOfSanguo.log('PHASE', `Kampfphase – KI-Feld: [${ai.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.effectiveATK()})`).join(', ')}]`);
    EchoesOfSanguo.log('PHASE', `Spieler-Feld: [${plr.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.position==='atk'?fc.effectiveATK():fc.effectiveDEF()})`).join(', ')}]`);
    this.ui.render(this.state);
    await this._delay(500);

    const aiMonsters  = ai.field.monsters;
    const plrMonsters = plr.field.monsters;

    for(let az = 0; az < 5; az++){
      const atk = aiMonsters[az];
      if(!atk){ continue; }
      if(atk.position !== 'atk'){ EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} ist im DEF-Modus – überspringen`); continue; }
      if(atk.hasAttacked){       EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} hat bereits angegriffen`);           continue; }
      await this._delay(500);

      // Recalculate each iteration in case earlier attacks destroyed monsters
      const plrHasMonsters = plrMonsters.some(m => m !== null);

      // canDirectAttack monsters bypass the normal "player has monsters" check
      if(!plrHasMonsters || atk.canDirectAttack){
        EchoesOfSanguo.log('BATTLE', `${atk.card.name} → Direktangriff!${atk.canDirectAttack ? ' (canDirectAttack)' : ''}`);
        await this.attackDirect('opponent', az);
        if(this.checkWin()) return true;
      } else {
        // Priority 1: attack the strongest monster we can destroy (maximise board damage)
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
          EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → greift ${plrMonsters[bestTarget]!.card.name}(${bestScore}) an [kann zerstören]`);
          await this.attack('opponent', az, bestTarget);
          if(this.checkWin()) return true;
        } else {
          // Priority 2: only attack DEF-position targets to avoid taking LP damage
          let safeTarget = -1, safeVal = Infinity;
          for(let dz = 0; dz < 5; dz++){
            const def = plrMonsters[dz];
            if(!def || def.position !== 'def') continue;
            const defVal = def.effectiveDEF();
            if(atk.effectiveATK() >= defVal && defVal < safeVal){ safeVal = defVal; safeTarget = dz; }
          }
          if(safeTarget !== -1){
            EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → greift DEF-Monster ${plrMonsters[safeTarget]!.card.name}(DEF:${safeVal}) an [kein LP-Verlust]`);
            await this.attack('opponent', az, safeTarget);
            if(this.checkWin()) return true;
          } else {
            EchoesOfSanguo.log('BATTLE', `${atk.card.name}: kein günstiges Ziel – überspringen (verhindert unnötigen LP-Verlust)`);
          }
        }
      }
    }
    return false;
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
