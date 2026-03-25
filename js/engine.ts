// ============================================================
// ECHOES OF SANGUO - Game Engine
// ============================================================

import { CARD_DB, OPPONENT_DECK_IDS, PLAYER_DECK_IDS, makeDeck, checkFusion } from './cards.js';
import { executeEffectBlock } from './effect-registry.js';
import { CardType } from './types.js';
import type { Owner, Phase, Position, CardData, EffectContext, EffectSignal, GameState, UICallbacks, OpponentConfig, AIBehavior } from './types.js';
import { resolveAIBehavior } from './ai-behaviors.js';
import { GAME_RULES } from './rules.js';
import { EchoesOfSanguo, ownerLabel } from './debug-logger.js';
import { FieldCard, FieldSpellTrap } from './field.js';
import { aiTurn } from './ai-orchestrator.js';

// Re-export for backwards compatibility
export { EchoesOfSanguo } from './debug-logger.js';
export { FieldCard, FieldSpellTrap } from './field.js';

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
    this.ui.playVFX?.('damage', target);
    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  gainLP(target: Owner, amount: number){
    this.state[target].lp += amount;
    this.addLog(`${ownerLabel(target)} gains ${amount} LP. (LP: ${this.state[target].lp})`);
    this.ui.playVFX?.('heal', target);
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

  surrender(): void {
    this.addLog('=== SURRENDER ===');
    this._endDuel('defeat');
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
  async summonMonster(owner: Owner, handIndex: number, zone: number, position: Position = 'atk', faceDown=false){
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
    // trigger onSummon effect for every summon method
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  setMonster(owner: Owner, handIndex: number, zone: number){
    return this.summonMonster(owner, handIndex, zone, 'def', true);
  }

  async flipSummon(owner: Owner, zone: number){
    const fc = this.state[owner].field.monsters[zone];
    if(!fc || !fc.faceDown){ this.addLog('Kein verdecktes Monster!'); return false; }
    if(fc.summonedThisTurn){ this.addLog('Kann nicht im selben Zug geflippt werden!'); return false; }
    fc.faceDown = false;
    this.addLog(`${fc.card.name} wird aufgedeckt (Flip-Beschwörung)!`);
    await this._triggerFlipEffect(fc, owner, zone);
    this.ui.render(this.state);
    return true;
  }

  async specialSummon(owner: Owner, card: CardData, zone?: number){
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
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    this.ui.render(this.state);
    return true;
  }

  async specialSummonFromGrave(owner: Owner, card: CardData){
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
    await this._triggerEffect(fc, owner, 'onSummon', zone);
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

  async activateSpellFromField(owner: Owner, zone: number, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Spell) return false;
    fst.faceDown = false;
    this.addLog(`${ownerLabel(owner)}: ${fst.card.name} activated!`);
    if(this.ui.showActivation) await this.ui.showActivation(fst.card, fst.card.description);
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

  async activateTrapFromField(owner: Owner, zone: number, ...args: FieldCard[]){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Trap || fst.used) return null;
    fst.used = true;
    fst.faceDown = false;
    this.addLog(`${ownerLabel(owner)}: Trap ${fst.card.name} activated!`);
    this.ui.playSfx?.('sfx_trap');
    if(this.ui.showActivation) await this.ui.showActivation(fst.card, fst.card.description);
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

  async performFusion(owner: Owner, handIdx1: number, handIdx2: number){
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
    await this._triggerEffect(fc, owner, 'onSummon', zone);
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
    // auto-flip face-down attacker
    if(attFC.faceDown){
      attFC.faceDown = false;
      attFC.position = 'atk';
      this.addLog(`${attFC.card.name} is revealed (attack)!`);
      await this._triggerFlipEffect(attFC, attackerOwner, attackerZone);
    }
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
    // auto-flip face-down attacker
    if(attFC.faceDown){
      attFC.faceDown = false;
      attFC.position = 'atk';
      this.addLog(`${attFC.card.name} wird aufgedeckt (Angriff)!`);
      await this._triggerFlipEffect(attFC, attackerOwner, attackerZone);
    }
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
      await this._triggerFlipEffect(defFC, defOwner, defZone);
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
        await this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
        this.dealDamage(defOwner, dmg);
        // attacker effect: onDestroyByBattle
        await this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
      } else if(effATK === defVal){
        this.addLog('Tie! Both monsters destroyed!');
        await this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
        await this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
      } else {
        const dmg = defVal - effATK;
        this.addLog(`${attFC.card.name} destroyed! Player: -${dmg} LP`);
        await this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
        this.dealDamage(atkOwner, dmg);
        await this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
        await this._triggerEffect(defFC, defOwner, 'onDestroyByBattle', null);
      }
    } else {
      // defender in DEF mode
      if(effATK > defVal){
        this.addLog(`${defFC.card.name} (DEF) destroyed!`);
        await this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
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

  async _destroyMonster(owner: Owner, zone: number, reason: string, byOwner: Owner){
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
      await this._triggerEffect(fc, owner, 'onDestroyByOpponent', zone);
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

  async _triggerEffect(fc: FieldCard, owner: Owner, trigger: string, zone: number | null){
    const card = fc.card;
    if(!card.effect || card.effect.trigger !== trigger) return;
    EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Trigger: ${trigger}`);
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    try {
      const ctx: EffectContext = { engine: this, owner };
      executeEffectBlock(card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Error in effect [${card.id}] trigger=${trigger}: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
  }

  async _triggerFlipEffect(fc: FieldCard, owner: Owner, zone: number){
    if(fc.hasFlipped) return;
    fc.hasFlipped = true;
    const card = fc.card;
    if(!card.effect || card.effect.trigger !== 'onFlip') return;
    EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Flip-Effekt`);
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    try {
      const ctx: EffectContext = { engine: this, owner };
      executeEffectBlock(card.effect, ctx);
    } catch(e) {
      EchoesOfSanguo.log('EFFECT', `Fehler in Flip-Effekt [${card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }
  }

  // ───────── Trap prompts ──────────────────────────────────
  async _promptPlayerTraps(triggerType: string, ...args: FieldCard[]){
    // check player's face-down traps
    const traps = this.state.player.field.spellTraps;
    for(let i=0;i<5;i++){
      const fst = traps[i];
      if(fst && fst.card.type === CardType.Trap && fst.faceDown && !fst.used && fst.card.trapTrigger === triggerType){
        const promptFn = this.ui.prompt;
        if (!promptFn) continue;

        // Build battle context so the UI can show who attacks what
        const battleContext: import('./types.js').BattleContext = { triggerType };
        if (args[0]) {
          battleContext.attackerName   = args[0].card.name;
          battleContext.attackerAtk    = args[0].effectiveATK();
          battleContext.attackerCardId = args[0].card.id;
        }
        if (args[1]) {
          battleContext.defenderName   = args[1].card.name;
          battleContext.defenderDef    = args[1].effectiveDEF();
          battleContext.defenderAtk    = args[1].effectiveATK();
          battleContext.defenderPos    = args[1].position;
          battleContext.defenderCardId = args[1].card.id;
        }

        const activate = await promptFn({
          title: 'Activate trap?',
          cardId: fst.card.id,
          message: `${fst.card.name}: ${fst.card.description}`,
          yes: 'Yes, activate!',
          no:  'No, skip',
          battleContext,
        });
        if(activate){
          return await this.activateTrapFromField('player', i, ...args);
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
      aiTurn(this).catch(err => {
        EchoesOfSanguo.log('ERROR', 'AI turn crashed:', err);
        console.error('[EchoesOfSanguo] Unhandled error in aiTurn:', err);
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
