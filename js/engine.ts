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
import type { Owner, Phase, Position, CardData, CardEffectBlock, EffectContext, EffectSignal, GameState, PlayerState, UICallbacks, OpponentConfig, VsAttrBonus, AIBehavior } from './types.js';
import { resolveAIBehavior, shouldActivateNormalSpell, pickSummonCandidate, decideSummonPosition } from './ai-behaviors.js';
import { GAME_RULES } from './rules.js';

const ownerLabel = (owner: Owner): string => owner === 'player' ? 'Player' : 'Opponent';

export const EchoesOfSanguo = {
  debug: false,

  // ── Log buffer (always active, independent of debug flag) ──
  _entries: [] as Array<{ ts: string; category: string; msg: string; dataStr: string }>,
  _sessionStart: null as string | null, // ISO timestamp of session start

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
  } as Record<string, string>,

  // Called by GameEngine.addLog() to buffer game events
  gameEvent(msg: string){
    this._push('GAME', msg);
  },

  log(category: string, msg: string, data: unknown = undefined){
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

  _push(category: string, msg: string, data: unknown = undefined){
    const ts = new Date().toISOString();
    const dataStr = data !== undefined
      ? (typeof data === 'object' ? JSON.stringify(data) : String(data))
      : '';
    this._entries.push({ ts, category, msg, dataStr });
  },

  group(label: string){
    this._push('PHASE', `>>> ${label}`);
    if(!this.debug) return;
    console.group(`%c${label}`, 'color:#ffd700;font-weight:bold;font-family:monospace');
  },

  groupEnd(){
    if(!this.debug) return;
    console.groupEnd();
  },

  // Starts a new session (clears old buffer)
  startSession(){
    this._entries  = [];
    this._sessionStart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    this._push('GAME', `=== Session started: ${new Date().toLocaleString()} ===`);
  },

  // Builds log content as text
  _buildLogText(){
    const lines = this._entries.map(e => {
      const base = `[${e.ts}] [${e.category.padEnd(6)}] ${e.msg}`;
      return e.dataStr ? `${base}  ${e.dataStr}` : base;
    });
    return lines.join('\n');
  },

  // Downloads the log file
  // filename: e.g. "echoes_of_sanguo_2026-03-17_14-30-00.log"
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
    console.info(`[EchoesOfSanguo] Log saved: ${filename} (${this._entries.length} entries)`);
  },
};

// ── Hand size constants (from GAME_RULES) ────────────────

export class FieldCard {
  card: CardData;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  summonedThisTurn: boolean;
  tempATKBonus: number;
  tempDEFBonus: number;
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
    this.tempDEFBonus = 0;
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
      this.indestructible  = flags.indestructible;
      this.effectImmune    = flags.effectImmune;
      this.cantBeAttacked  = flags.cantBeAttacked;
    } else {
      this.piercing = false;
      this.cannotBeTargeted = false;
      this.canDirectAttack  = false;
      this.vsAttrBonus     = null;
      this.phoenixRevival  = false;
      this.indestructible  = false;
      this.effectImmune    = false;
      this.cantBeAttacked  = false;
    }
  }
  effectiveATK(): number {
    return Math.max(0, (this.card.atk ?? 0) + this.tempATKBonus + this.permATKBonus);
  }
  effectiveDEF(): number {
    return Math.max(0, (this.card.def ?? 0) + this.tempDEFBonus + this.permDEFBonus);
  }
}

// ── FieldSpellTrap ─────────────────────────────────────────
export class FieldSpellTrap {
  card: CardData;
  faceDown: boolean;
  used: boolean;

  constructor(card: CardData, faceDown=true){
    this.card    = card;
    this.faceDown= faceDown;
    this.used    = false;
  }
}

// ── GameEngine ─────────────────────────────────────────────
export class GameEngine {
  state!: GameState; // initialized in initGame() before any gameplay method is called
  ui: UICallbacks;
  _trapResolve: ((result: boolean) => void) | null;
  _currentOpponentId: number | null;
  _aiBehavior!: Required<AIBehavior>;

  constructor(uiCallbacks: UICallbacks){
    this.ui = uiCallbacks; // { render, log, prompt, showResult, onDuelEnd }
    this._trapResolve = null;
    this._currentOpponentId = null;
  }

  // ───────── Init ─────────────────────────────────────────
  /**
   * @param {string[]} playerDeckIds  - Player card IDs
   * @param {object}   opponentConfig - { id, deckIds } from OPPONENT_CONFIGS
   */
  initGame(playerDeckIds: string[], opponentConfig: OpponentConfig | null){
    EchoesOfSanguo.startSession();
    const oppDeckIds = (opponentConfig && opponentConfig.deckIds) ? opponentConfig.deckIds : OPPONENT_DECK_IDS;
    this._currentOpponentId = (opponentConfig && opponentConfig.id) ? opponentConfig.id : null;
    this._aiBehavior = resolveAIBehavior(opponentConfig?.behaviorId);
    this.state = {
      phase: 'main',        // 'draw'|'main'|'battle'|'end'
      turn: 1,
      activePlayer: 'player',
      player: {
        lp: GAME_RULES.startingLP,
        deck: this._shuffle(makeDeck(playerDeckIds || PLAYER_DECK_IDS)),
        hand: [],
        field: { monsters: Array(GAME_RULES.fieldZones).fill(null), spellTraps: Array(GAME_RULES.fieldZones).fill(null) },
        graveyard: [],
        normalSummonUsed: false
      },
      opponent: {
        lp: GAME_RULES.startingLP,
        deck: this._shuffle(makeDeck(oppDeckIds)),
        hand: [],
        field: { monsters: Array(GAME_RULES.fieldZones).fill(null), spellTraps: Array(GAME_RULES.fieldZones).fill(null) },
        graveyard: [],
        normalSummonUsed: false
      },
      log: []
    } as GameState;
    this.drawCard('player',   5);
    this.drawCard('opponent', 5);
    this.state.phase = 'main';
    this.addLog('=== Duel begins! ===');
    this.addLog('Round 1 - Your turn!');
    this.ui.render(this.state);
  }

  getState(): GameState { return this.state; }

  // ───────── Utility ──────────────────────────────────────
  _shuffle<T>(arr: T[]): T[] {
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
    this.addLog(`${ownerLabel(target)} takes ${amount} damage. (LP: ${this.state[target].lp})`);
    this.ui.playSfx?.('sfx_damage');
    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  gainLP(target: Owner, amount: number){
    this.state[target].lp += amount;
    this.addLog(`${ownerLabel(target)} gains ${amount} LP. (LP: ${this.state[target].lp})`);
    this.ui.render(this.state);
  }

  checkWin(){
    if(this.state.player.lp <= 0){
      this.addLog('=== DEFEAT ===');
      this._endDuel('defeat');
      return true;
    }
    if(this.state.opponent.lp <= 0){
      this.addLog('=== VICTORY ===');
      this._endDuel('victory');
      return true;
    }
    if(this.state.player.deck.length === 0 && this.state.phase === 'draw'){
      this.addLog('=== DEFEAT (Deck empty) ===');
      this._endDuel('defeat');
      return true;
    }
    if(this.state.opponent.deck.length === 0){
      this.addLog('=== VICTORY (Opponent deck empty) ===');
      this._endDuel('victory');
      return true;
    }
    return false;
  }

  _endDuel(result: 'victory' | 'defeat'){
    const logSuffix = result === 'victory' ? 'victory' : 'defeat';
    EchoesOfSanguo.downloadLog(logSuffix);
    // onDuelEnd allows progression evaluation in the UI layer
    if(typeof this.ui.onDuelEnd === 'function'){
      this.ui.onDuelEnd(result, this._currentOpponentId);
    } else {
      this.ui.showResult?.(result);
    }
  }

  // ───────── Draw ─────────────────────────────────────────
  drawCard(owner: Owner, count = 1){
    const st = this.state[owner];
    let drawn = 0;
    for(let i=0;i<count;i++){
      if(st.deck.length===0){ this.addLog(`${owner==='player'?'Your':'Opponent\'s'} deck is empty!`); break; }
      const card = st.deck.shift()!; // length checked above
      st.hand.push(card);
      drawn++;
    }
    // hand limit (draw cap)
    while(st.hand.length > GAME_RULES.handLimitDraw) st.hand.shift();
    if(drawn > 0 && this.ui.onDraw) this.ui.onDraw(owner, drawn);
  }

  // ───────── Summon ────────────────────────────────────────
  summonMonster(owner: Owner, handIndex: number, zone: number, position: Position = 'atk', faceDown=false){
    const st = this.state[owner];
    if(zone < 0 || zone > 4 || st.field.monsters[zone]){
      this.addLog('Invalid zone!'); return false;
    }
    const [card] = st.hand.splice(handIndex, 1);
    const fc = new FieldCard(card, position, faceDown);
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;
    const posStr = faceDown ? 'face-down DEF' : position.toUpperCase();
    this.addLog(`${ownerLabel(owner)}: ${card.name} (${posStr}).`);
    this.ui.playSfx?.('sfx_card_play');
    // trigger onSummon effect only if face-up
    if(!faceDown) this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  setMonster(owner: Owner, handIndex: number, zone: number){
    return this.summonMonster(owner, handIndex, zone, 'def', true);
  }

  specialSummon(owner: Owner, card: CardData, zone?: number){
    const st = this.state[owner];
    if(zone === undefined){
      zone = st.field.monsters.findIndex(z => z === null);
      if(zone === -1){ this.addLog('No free monster zone!'); return false; }
    }
    if(st.field.monsters[zone]){ this.addLog('Zone occupied!'); return false; }
    const fc = new FieldCard(card, 'atk');
    fc.summonedThisTurn = false; // special summons can usually attack (or keep true for balance)
    st.field.monsters[zone] = fc;
    this.addLog(`${ownerLabel(owner)}: ${card.name} Special Summon!`);
    this.ui.playSfx?.('sfx_card_play');
    this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  specialSummonFromGrave(owner: Owner, card: CardData){
    const st = this.state[owner];
    const graveIdx = st.graveyard.findIndex(c => c.id === card.id);
    if(graveIdx === -1){ this.addLog('Card not in graveyard!'); return false; }
    const zone = st.field.monsters.findIndex(z => z === null);
    if(zone === -1){ this.addLog('No free zone!'); return false; }
    const [c] = st.graveyard.splice(graveIdx, 1);
    const fc = new FieldCard(c, 'atk');
    fc.summonedThisTurn = false;
    st.field.monsters[zone] = fc;
    this.addLog(`${ownerLabel(owner)}: ${c.name} summoned from graveyard!`);
    this.ui.playSfx?.('sfx_card_play');
    this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  // ───────── Spell / Trap ──────────────────────────────────
  setSpellTrap(owner: Owner, handIndex: number, zone: number){
    const st = this.state[owner];
    if(zone < 0 || zone > 4 || st.field.spellTraps[zone]){
      this.addLog('Invalid spell/trap zone!'); return false;
    }
    const [card] = st.hand.splice(handIndex, 1);
    st.field.spellTraps[zone] = new FieldSpellTrap(card, true);
    this.addLog(`${ownerLabel(owner)}: Card placed face-down.`);
    this.ui.playSfx?.('sfx_card_play');
    this.ui.render(this.state);
    return true;
  }

  async activateSpell(owner: Owner, handIndex: number, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if(!card || card.type !== CardType.Spell){ this.addLog('Not a spell card!'); return false; }
    st.hand.splice(handIndex, 1);
    this.addLog(`${ownerLabel(owner)}: ${card.name} activated!`);
    this.ui.playSfx?.('sfx_spell');
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    if(card.effect) try {
      const ctx = this._buildSpellContext(owner, targetInfo);
      executeEffectBlock(card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Error in spell effect [${card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
    st.graveyard.push(card);
    this.ui.render(this.state);
    return true;
  }

  activateSpellFromField(owner: Owner, zone: number, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Spell) return false;
    fst.faceDown = false;
    this.addLog(`${ownerLabel(owner)}: ${fst.card.name} activated!`);
    if(this.ui.showActivation) this.ui.showActivation(fst.card, fst.card.description);
    if(fst.card.effect) try {
      const ctx = this._buildSpellContext(owner, targetInfo);
      executeEffectBlock(fst.card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Error in spell field effect [${fst.card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    return true;
  }

  activateTrapFromField(owner: Owner, zone: number, ...args: FieldCard[]){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Trap || fst.used) return null;
    fst.used = true;
    fst.faceDown = false;
    this.addLog(`${ownerLabel(owner)}: Trap ${fst.card.name} activated!`);
    this.ui.playSfx?.('sfx_trap');
    if(this.ui.showActivation) this.ui.showActivation(fst.card, fst.card.description);
    let result: EffectSignal | null = null;
    if(fst.card.effect) try {
      const ctx = this._buildTrapContext(owner, fst.card.trapTrigger, args);
      result = executeEffectBlock(fst.card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Error in trap effect [${fst.card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
      result = {};
    }
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    return result;
  }

  // ───────── Fusion ────────────────────────────────────────
  canFuse(owner: Owner){
    const hand = this.state[owner].hand;
    for(let i=0;i<hand.length;i++){
      for(let j=i+1;j<hand.length;j++){
        if(checkFusion(hand[i].id, hand[j].id)) return true;
      }
    }
    return false;
  }

  getAllFusionOptions(owner: Owner){
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

  performFusion(owner: Owner, handIdx1: number, handIdx2: number){
    const st = this.state[owner];
    const hand = st.hand;
    // indices might shift, work with sorted desc
    const [hi, lo] = handIdx1 > handIdx2 ? [handIdx1, handIdx2] : [handIdx2, handIdx1];
    const card1 = hand[hi];
    const card2 = hand[lo];
    const recipe = checkFusion(card1.id, card2.id);
    if(!recipe){ this.addLog('No fusion possible!'); return false; }

    const zone = st.field.monsters.findIndex(z => z === null);
    if(zone === -1){ this.addLog('No free zone for fusion monster!'); return false; }

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
  async attack(attackerOwner: Owner, attackerZone: number, defenderZone: number){
    const atkSt  = this.state[attackerOwner];
    const defOwn = attackerOwner === 'player' ? 'opponent' : 'player';
    const defSt  = this.state[defOwn];

    const attFC = atkSt.field.monsters[attackerZone];
    if(!attFC){ this.addLog('No attacking monster!'); return; }
    if(attFC.hasAttacked){ this.addLog(`${attFC.card.name} has already attacked!`); return; }
    if(attFC.position !== 'atk'){ this.addLog('Monster must be in attack position!'); return; }

    const defFC = defSt.field.monsters[defenderZone];
    // cantBeAttacked: this monster cannot be selected as attack target
    if(defFC && defFC.cantBeAttacked){
      this.addLog(`${defFC.card.name} cannot be attacked!`); return;
    }

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
      this.addLog(`${attFC.card.name} attacks directly!`);
      if(this.ui.playAttackAnimation) await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, null);
      this.dealDamage(defOwn, attFC.effectiveATK());
    } else {
      if(this.ui.playAttackAnimation) await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, defenderZone);
      await this._resolveBattle(attackerOwner, attackerZone, defOwn, defenderZone, attFC, defFC);
    }
    this.ui.render(this.state);
  }

  async attackDirect(attackerOwner: Owner, attackerZone: number){
    const defOwn  = attackerOwner === 'player' ? 'opponent' : 'player';
    const defMons = this.state[defOwn].field.monsters;
    const attFC   = this.state[attackerOwner].field.monsters[attackerZone];
    if(!attFC) return;
    if(!attFC.canDirectAttack && defMons.some(m => m !== null)){
      this.addLog('Opponent has monsters on the field!'); return;
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

  async _resolveBattle(atkOwner: Owner, atkZone: number, defOwner: Owner, defZone: number, attFC: FieldCard, defFC: FieldCard){
    const atkVal = attFC.effectiveATK();

    if(defFC.faceDown){
      defFC.faceDown = false;
      this.addLog(`${defFC.card.name} is revealed!`);
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
        this.addLog(`${defFC.card.name} destroyed! Opponent: -${dmg} LP`);
        this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
        this.dealDamage(defOwner, dmg);
        // attacker effect: onDestroyByBattle
        this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
      } else if(effATK === defVal){
        this.addLog('Tie! Both monsters destroyed!');
        this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
        this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
      } else {
        const dmg = defVal - effATK;
        this.addLog(`${attFC.card.name} destroyed! Player: -${dmg} LP`);
        this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
        this.dealDamage(atkOwner, dmg);
        this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
        this._triggerEffect(defFC, defOwner, 'onDestroyByBattle', null);
      }
    } else {
      // defender in DEF mode
      if(effATK > defVal){
        this.addLog(`${defFC.card.name} (DEF) destroyed!`);
        this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
        if(attFC.piercing){
          const pierceDmg = effATK - defVal;
          this.addLog(`Piercing attack! -${pierceDmg} LP`);
          this.dealDamage(defOwner, pierceDmg);
        }
      } else if(effATK === defVal){
        this.addLog('Monster held its ground!');
      } else {
        this.addLog('Attack blocked! No damage.');
      }
    }
  }

  _destroyMonster(owner: Owner, zone: number, reason: string, byOwner: Owner){
    const st  = this.state[owner];
    const fc  = st.field.monsters[zone];
    if(!fc) return;
    // Indestructible: cannot be destroyed by battle
    if(fc.indestructible && reason === 'battle'){
      this.addLog(`${fc.card.name} is indestructible!`);
      return;
    }
    this.ui.playSfx?.('sfx_destroy');

    // Shadow Reaper / onDestroyByBattle for defender
    if(reason === 'battle' && byOwner !== owner){
      this._triggerEffect(fc, owner, 'onDestroyByOpponent', zone);
    }

    st.graveyard.push(fc.card);
    st.field.monsters[zone] = null;
    this.ui.render(this.state);
  }

  _buildSpellContext(owner: Owner, targetInfo: FieldCard | CardData | null): EffectContext {
    const ctx: EffectContext = { engine: this, owner };
    if(targetInfo instanceof FieldCard){
      ctx.targetFC = targetInfo;
    } else if(targetInfo && typeof targetInfo === 'object' && 'id' in targetInfo){
      ctx.targetCard = targetInfo as CardData;
    }
    return ctx;
  }

  _buildTrapContext(owner: Owner, trapTrigger: string | undefined, args: FieldCard[]): EffectContext {
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

  _triggerEffect(fc: FieldCard, owner: Owner, trigger: string, zone: number | null){
    const card = fc.card;
    if(!card.effect || card.effect.trigger !== trigger) return;
    EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Trigger: ${trigger}`);
    if(this.ui.showActivation) this.ui.showActivation(card, card.description);
    try {
      const ctx: EffectContext = { engine: this, owner };
      executeEffectBlock(card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Error in effect [${card.id}] trigger=${trigger}: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
  }

  // ───────── Trap prompts ──────────────────────────────────
  async _promptPlayerTraps(triggerType: string, ...args: FieldCard[]){
    // check player's face-down traps
    const traps = this.state.player.field.spellTraps;
    for(let i=0;i<5;i++){
      const fst = traps[i];
      if(fst && fst.card.type === CardType.Trap && fst.faceDown && !fst.used && fst.card.trapTrigger === triggerType){
        // Race UI prompt against an 8-second timeout so the game never hangs
        // if the modal is closed or the promise never resolves.
        const timeout = new Promise<boolean>(resolve => setTimeout(() => resolve(false), 8000));
        const promptFn = this.ui.prompt;
        if (!promptFn) continue;
        const activate = await Promise.race([promptFn({
          title: 'Activate trap?',
          cardId: fst.card.id,
          message: `${fst.card.name}: ${fst.card.description}`,
          yes: 'Yes, activate!',
          no:  'No, skip'
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
      const names: Partial<Record<Phase, string>> = { main:'Main Phase', battle:'Battle Phase', end:'End Phase' };
      this.addLog(`--- ${names[this.state.phase] ?? this.state.phase} ---`);
      this.ui.render(this.state);
    } else {
      this.endTurn();
    }
  }

  _resetMonsterFlags(owner: Owner){
    this.state[owner].field.monsters.forEach(fc => {
      if(fc){ fc.tempATKBonus = 0; fc.tempDEFBonus = 0; fc.hasAttacked = false; fc.summonedThisTurn = false; }
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
    while(hand.length > GAME_RULES.handLimitEnd){ hand.shift(); }

    // switch player
    this.state.activePlayer = 'opponent';
    this.state.phase = 'draw';
    this.state.turn++;

    this.addLog(`=== Round ${this.state.turn} - Opponent's turn ===`);
    this.ui.render(this.state);

    // run AI
    setTimeout(() => {
      this._aiTurn().catch(err => {
        EchoesOfSanguo.log('ERROR', 'AI turn crashed:', err);
        console.error('[EchoesOfSanguo] Unhandled error in _aiTurn:', err);
        EchoesOfSanguo.downloadLog('ai_crash');
        // Recover: switch back to player so game isn't frozen
        this.state.activePlayer = 'player';
        this.state.phase = 'main';
        this.state.turn++;
        this.addLog(`[ERROR] Opponent AI crashed. Your turn (Round ${this.state.turn}).`);
        this.drawCard('player', 1);
        this.ui.render(this.state);
      });
    }, 600);
  }

  // ───────── AI ────────────────────────────────────────────
  async _aiTurn(){
    const ai = this.state.opponent;

    EchoesOfSanguo.group(`=== AI Turn Round ${this.state.turn} ===`);

    await this._aiDrawPhase();
    await this._aiMainPhase();
    await this._aiPlaceTraps();
    if (await this._aiBattlePhase()) return;

    // End Phase
    EchoesOfSanguo.log('PHASE', 'End Phase – AI cleanup.');
    this.state.phase = 'end';
    this.ui.render(this.state);
    await this._delay(300);

    this._resetMonsterFlags('opponent');
    while(ai.hand.length > 8) ai.hand.shift();

    this.state.activePlayer = 'player';
    this.state.phase = 'main';
    this.state.turn++;
    this.addLog(`=== Round ${this.state.turn} - Your turn! ===`);

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
    this.addLog('Opponent draws a card.');
    EchoesOfSanguo.log('PHASE', 'Draw Phase – Hand:', ai.hand.map(c => c.name));
    this.ui.render(this.state);
    await this._delay(400);
  }

  async _aiMainPhase() {
    const ai  = this.state.opponent;
    const plr = this.state.player;

    this.state.phase = 'main';
    this.addLog('--- Opponent Main Phase ---');
    this.ui.render(this.state);
    await this._delay(400);

    // Try fusion first (max. 1 per turn)
    const bh = this._aiBehavior;
    EchoesOfSanguo.log('AI', 'Main Phase – checking fusion...');
    if(!ai.normalSummonUsed && bh.fusionFirst){
      const opts = this.getAllFusionOptions('opponent');
      if(opts.length > 0){
        const best = opts.sort((a,b) => (b.result.atk ?? 0) - (a.result.atk ?? 0))[0];
        const bestATKValue = best.result.atk ?? 0;
        const zone = ai.field.monsters.findIndex(z => z === null);
        if(zone !== -1 && bestATKValue >= bh.fusionMinATK){
          EchoesOfSanguo.log('AI', `Fusion: ${best.card1.name} + ${best.card2.name} → ${best.result.name} (Zone ${zone})`);
          await this._delay(500);
          this.performFusion('opponent', best.i1, best.i2);
        }
      } else {
        EchoesOfSanguo.log('AI', 'No fusion available.');
      }
    }

    // Summon one monster from hand (max. 1 per turn)
    EchoesOfSanguo.log('AI', 'Summoning monster from hand:', ai.hand.filter(c => c.type === CardType.Monster).map(c=>c.name));
    if(!ai.normalSummonUsed){
      const bestIdx = pickSummonCandidate(ai.hand, bh.summonPriority);
      if(bestIdx !== -1){
        const card = ai.hand[bestIdx];
        const cardATK = card.atk ?? 0;
        const zone = ai.field.monsters.findIndex(z => z === null);
        if(zone === -1){
          EchoesOfSanguo.log('AI', 'All monster zones occupied.');
        } else {
          const plrMinVal = plr.field.monsters
            .filter(Boolean)
            .reduce((min, fc) => Math.min(min, fc!.position==='atk' ? fc!.effectiveATK() : fc!.effectiveDEF()), Infinity);
          const playerHasMonsters = plr.field.monsters.some(Boolean);
          const summonPos = decideSummonPosition(cardATK, plrMinVal, playerHasMonsters, bh.positionStrategy);
          EchoesOfSanguo.log('SUMMON', `Summoning ${card.name} (ATK:${cardATK}) to zone ${zone} as ${summonPos.toUpperCase()}`);
          await this._delay(350);
          this.summonMonster('opponent', bestIdx, zone, summonPos);
          const summonedFC = ai.field.monsters[zone];
          if(summonedFC){
            const trapResult = await this._promptPlayerTraps('onOpponentSummon', summonedFC);
            if(trapResult && trapResult.destroySummoned){
              EchoesOfSanguo.log('TRAP', `Trap hole destroyed ${summonedFC.card.name}`);
              ai.graveyard.push(summonedFC.card);
              ai.field.monsters[zone] = null;
              this.ui.render(this.state);
            }
          }
        }
      }
    }

    // Activate spells — restart loop after each activation to avoid index issues
    EchoesOfSanguo.log('AI', 'Activating spells...');
    let spellActivated = true;
    while(spellActivated){
      spellActivated = false;
      for(let i = 0; i < ai.hand.length; i++){
        const card = ai.hand[i];
        if(card.type !== CardType.Spell) continue;
        let activated = false;
        if(card.spellType === 'normal'){
          const actions = card.effect?.actions ?? [];
          const dealsDamage = actions.some((a: any) => a.type === 'dealDamage');
          const heals = actions.some((a: any) => a.type === 'gainLP');
          const should = dealsDamage ? plr.lp > 800 : heals ? ai.lp < 7000 : true;
          if(should){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} (normal)`);
            await this._delay(300); await this.activateSpell('opponent', i); activated = true;
          } else {
            EchoesOfSanguo.log('SPELL', `${card.name}: Condition not met (plr.lp=${plr.lp}, ai.lp=${ai.lp})`);
          }
        } else if(card.spellType === 'targeted'){
          if(card.target === 'ownDarkMonster'){
            const t = ai.field.monsters.find(m => m && m.card.attribute===Attribute.Dark);
            if(t){
              EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${t.card.name}`);
              await this._delay(300); await this.activateSpell('opponent', i, t); activated = true;
            } else {
              EchoesOfSanguo.log('SPELL', `${card.name}: No DARK monster on the field.`);
            }
          } else if(card.target === 'ownMonster'){
            const t = ai.field.monsters.find(m => m !== null);
            if(t){
              EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${t.card.name}`);
              await this._delay(300); await this.activateSpell('opponent', i, t); activated = true;
            }
          }
        } else if(card.spellType === 'fromGrave'){
          const gm = ai.graveyard.find(c => isMonsterType(c.type));
          if(gm && ai.field.monsters.some(z=>z===null)){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} → graveyard: ${gm.name}`);
            await this._delay(300); await this.activateSpell('opponent', i, gm); activated = true;
          }
        }
        if(activated){ spellActivated = true; break; }
      }
    }
  }

  async _aiPlaceTraps() {
    const ai = this.state.opponent;
    EchoesOfSanguo.log('AI', 'Placing traps...');
    const hand = ai.hand;
    for(let i = hand.length - 1; i >= 0; i--){
      const card = hand[i];
      if(card.type !== CardType.Trap) continue;
      const zone = ai.field.spellTraps.findIndex(z => z === null);
      if(zone === -1) break;
      EchoesOfSanguo.log('TRAP', `Placing ${card.name} face-down in zone ${zone}`);
      await this._delay(300);
      this.setSpellTrap('opponent', i, zone);
    }
  }

  async _aiBattlePhase(): Promise<boolean> {
    const ai  = this.state.opponent;
    const plr = this.state.player;

    this.state.phase = 'battle';
    this.addLog('--- Opponent Battle Phase ---');
    EchoesOfSanguo.log('PHASE', `Battle Phase – AI field: [${ai.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.effectiveATK()})`).join(', ')}]`);
    EchoesOfSanguo.log('PHASE', `Player field: [${plr.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.position==='atk'?fc.effectiveATK():fc.effectiveDEF()})`).join(', ')}]`);
    this.ui.render(this.state);
    await this._delay(500);

    const aiMonsters  = ai.field.monsters;
    const plrMonsters = plr.field.monsters;

    for(let az = 0; az < 5; az++){
      const atk = aiMonsters[az];
      if(!atk){ continue; }
      if(atk.position !== 'atk'){ EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} is in DEF mode – skipping`); continue; }
      if(atk.hasAttacked){       EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} has already attacked`);      continue; }
      await this._delay(500);

      // Recalculate each iteration in case earlier attacks destroyed monsters
      const plrHasMonsters = plrMonsters.some(m => m !== null);

      // canDirectAttack monsters bypass the normal "player has monsters" check
      if(!plrHasMonsters || atk.canDirectAttack){
        EchoesOfSanguo.log('BATTLE', `${atk.card.name} → Direct attack!${atk.canDirectAttack ? ' (canDirectAttack)' : ''}`);
        await this.attackDirect('opponent', az);
        if(this.checkWin()) return true;
      } else {
        const battleTarget = this._aiBattlePickTarget(atk, plrMonsters);
        if(battleTarget !== -1){
          const def = plrMonsters[battleTarget]!;
          const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
          EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → attacks ${def.card.name}(${defVal})`);
          await this.attack('opponent', az, battleTarget);
          if(this.checkWin()) return true;
        } else {
          EchoesOfSanguo.log('BATTLE', `${atk.card.name}: no favorable target – skipping`);
        }
      }
    }
    return false;
  }

  _delay(ms: number){ return new Promise<void>(r => setTimeout(r, ms)); }

  /** Pick the best attack target based on the active battle strategy. Returns zone index or -1. */
  _aiBattlePickTarget(atk: FieldCard, plrMonsters: Array<FieldCard | null>): number {
    const strategy = this._aiBehavior.battleStrategy;

    if (strategy === 'aggressive') {
      // Attack anything — prefer highest-value target we can destroy, then any target at all
      let bestTarget = -1, bestScore = -Infinity;
      for (let dz = 0; dz < 5; dz++) {
        const def = plrMonsters[dz];
        if (!def) continue;
        const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
        if (atk.effectiveATK() > defVal) {
          if (defVal > bestScore) { bestScore = defVal; bestTarget = dz; }
        }
      }
      if (bestTarget !== -1) return bestTarget;
      // Aggressive: attack even unfavorably — pick weakest target to minimize damage
      let weakest = -1, weakVal = Infinity;
      for (let dz = 0; dz < 5; dz++) {
        const def = plrMonsters[dz];
        if (!def) continue;
        const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
        if (defVal < weakVal) { weakVal = defVal; weakest = dz; }
      }
      return weakest;
    }

    // 'smart' and 'conservative' both start with: destroy strongest possible
    let bestTarget = -1, bestScore = -Infinity;
    for (let dz = 0; dz < 5; dz++) {
      const def = plrMonsters[dz];
      if (!def) continue;
      const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
      if (atk.effectiveATK() > defVal) {
        if (defVal > bestScore) { bestScore = defVal; bestTarget = dz; }
      }
    }
    if (bestTarget !== -1) return bestTarget;

    if (strategy === 'conservative') {
      // Only guaranteed destroys — nothing else
      return -1;
    }

    // 'smart': also attack DEF-position targets safely (no LP loss)
    let safeTarget = -1, safeVal = Infinity;
    for (let dz = 0; dz < 5; dz++) {
      const def = plrMonsters[dz];
      if (!def || def.position !== 'def') continue;
      const defVal = def.effectiveDEF();
      if (atk.effectiveATK() >= defVal && defVal < safeVal) { safeVal = defVal; safeTarget = dz; }
    }
    return safeTarget;
  }

  // ───────── Position change ───────────────────────────────
  changePosition(owner: Owner, zone: number){
    const fc = this.state[owner].field.monsters[zone];
    if(!fc || fc.summonedThisTurn){ this.addLog('Cannot change position!'); return; }
    fc.position = fc.position === 'atk' ? 'def' : 'atk';
    fc.hasAttacked = true; // cant attack after changing
    this.addLog(`${fc.card.name} switches to ${fc.position === 'atk' ? 'attack' : 'defense'} position.`);
    this.ui.render(this.state);
  }
}
