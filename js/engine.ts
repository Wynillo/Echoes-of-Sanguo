// ============================================================
// ECHOES OF SANGUO - Game Engine
// ============================================================

import { CARD_DB, OPPONENT_DECK_IDS, PLAYER_DECK_IDS, makeDeck, checkFusion, resolveFusionChain } from './cards.js';
import { executeEffectBlock, matchesFilter } from './effect-registry.js';
import { CardType } from './types.js';
import { meetsEquipRequirement } from './types.js';
import type { Owner, Phase, Position, CardData, EffectContext, EffectSignal, GameState, UICallbacks, OpponentConfig, AIBehavior } from './types.js';
// Re-export for backwards compatibility
export { meetsEquipRequirement } from './types.js';

// ── Serialized checkpoint types (for save/restore) ───────
export interface SerializedFieldCardData {
  cardId: string;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  hasFlipped: boolean;
  summonedThisTurn: boolean;
  tempATKBonus: number;
  tempDEFBonus: number;
  permATKBonus: number;
  permDEFBonus: number;
  fieldSpellATKBonus: number;
  fieldSpellDEFBonus: number;
  phoenixRevivalUsed: boolean;
}

export interface SerializedFieldSpellTrapData {
  cardId: string;
  faceDown: boolean;
  used: boolean;
  equippedMonsterZone?: number;
  equippedOwner?: Owner;
}

export interface SerializedPlayerState {
  lp: number;
  deckIds: string[];
  handIds: string[];
  graveyardIds: string[];
  normalSummonUsed: boolean;
  monsters: Array<SerializedFieldCardData | null>;
  spellTraps: Array<SerializedFieldSpellTrapData | null>;
  fieldSpell?: SerializedFieldSpellTrapData | null;
}

export interface SerializedCheckpoint {
  phase: Phase;
  turn: number;
  activePlayer: Owner;
  firstTurnNoAttack?: boolean;
  log: string[];
  player: SerializedPlayerState;
  opponent: SerializedPlayerState;
  opponentId: number | null;
  opponentBehaviorId?: string;
}
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
  async initGame(playerDeckIds: string[], opponentConfig: OpponentConfig | null){
    EchoesOfSanguo.startSession();
    const oppDeckIds = (opponentConfig && opponentConfig.deckIds) ? opponentConfig.deckIds : OPPONENT_DECK_IDS;
    this._currentOpponentId = (opponentConfig && opponentConfig.id) ? opponentConfig.id : null;
    this._aiBehavior = resolveAIBehavior(opponentConfig?.behaviorId);

    // Coin toss: determine who goes first
    const playerGoesFirst = Math.random() < 0.5;

    this.state = {
      phase: 'main',        // 'draw'|'main'|'battle'|'end'
      turn: 1,
      activePlayer: playerGoesFirst ? 'player' : 'opponent',
      player: {
        lp: GAME_RULES.startingLP,
        deck: this._shuffle(makeDeck(playerDeckIds || PLAYER_DECK_IDS)),
        hand: [],
        field: { monsters: Array(GAME_RULES.fieldZones).fill(null), spellTraps: Array(GAME_RULES.fieldZones).fill(null), fieldSpell: null },
        graveyard: [],
        normalSummonUsed: false
      },
      opponent: {
        lp: GAME_RULES.startingLP,
        deck: this._shuffle(makeDeck(oppDeckIds)),
        hand: [],
        field: { monsters: Array(GAME_RULES.fieldZones).fill(null), spellTraps: Array(GAME_RULES.fieldZones).fill(null), fieldSpell: null },
        graveyard: [],
        normalSummonUsed: false
      },
      log: [],
      firstTurnNoAttack: true,
    } as GameState;
    this.drawCard('player',   5);
    this.drawCard('opponent', 5);
    this.addLog('=== Duel begins! ===');

    // Show coin toss result
    if(this.ui.showCoinToss) await this.ui.showCoinToss(playerGoesFirst);

    if(playerGoesFirst){
      this.state.phase = 'main';
      this.addLog('Round 1 - Your turn!');
      this.ui.render(this.state);
    } else {
      this.addLog('Opponent goes first!');
      this.state.phase = 'draw';
      this.ui.render(this.state);
      // Run AI turn
      setTimeout(() => {
        aiTurn(this).catch(err => {
          EchoesOfSanguo.log('ERROR', 'AI turn crashed:', err);
          this.state.activePlayer = 'player';
          this.state.phase = 'main';
          this.state.turn++;
          this.addLog(`[ERROR] Opponent AI crashed. Your turn (Round ${this.state.turn}).`);
          this.refillHand('player');
          this.ui.render(this.state);
        });
      }, 600);
    }
  }

  /**
   * Restore a saved game state (for duel checkpoint resume).
   * Reconstructs CardData from CARD_DB and FieldCard/FieldSpellTrap instances.
   */
  restoreGame(checkpoint: SerializedCheckpoint): void {
    EchoesOfSanguo.startSession();
    this._currentOpponentId = checkpoint.opponentId;
    this._aiBehavior = resolveAIBehavior(checkpoint.opponentBehaviorId);

    const restorePlayerState = (s: SerializedPlayerState) => ({
      lp: s.lp,
      deck: s.deckIds.map(id => ({ ...CARD_DB[id] })),
      hand: s.handIds.map(id => ({ ...CARD_DB[id] })),
      graveyard: s.graveyardIds.map(id => ({ ...CARD_DB[id] })),
      normalSummonUsed: s.normalSummonUsed,
      field: {
        monsters: s.monsters.map(m => {
          if (!m) return null;
          const fc = new FieldCard(CARD_DB[m.cardId], m.position, m.faceDown);
          fc.hasAttacked       = m.hasAttacked;
          fc.hasFlipped        = m.hasFlipped;
          fc.summonedThisTurn  = m.summonedThisTurn;
          fc.tempATKBonus      = m.tempATKBonus;
          fc.tempDEFBonus      = m.tempDEFBonus;
          fc.permATKBonus      = m.permATKBonus;
          fc.permDEFBonus      = m.permDEFBonus;
          fc.fieldSpellATKBonus = m.fieldSpellATKBonus ?? 0;
          fc.fieldSpellDEFBonus = m.fieldSpellDEFBonus ?? 0;
          fc.phoenixRevivalUsed = m.phoenixRevivalUsed;
          return fc;
        }),
        spellTraps: s.spellTraps.map(st => {
          if (!st) return null;
          const fst = new FieldSpellTrap(CARD_DB[st.cardId], st.faceDown);
          fst.used = st.used;
          if (st.equippedMonsterZone !== undefined) fst.equippedMonsterZone = st.equippedMonsterZone;
          if (st.equippedOwner !== undefined) fst.equippedOwner = st.equippedOwner;
          return fst;
        }),
        fieldSpell: s.fieldSpell ? new FieldSpellTrap(CARD_DB[s.fieldSpell.cardId], s.fieldSpell.faceDown) : null,
      },
    });

    this.state = {
      phase: checkpoint.phase,
      turn: checkpoint.turn,
      activePlayer: checkpoint.activePlayer,
      firstTurnNoAttack: checkpoint.firstTurnNoAttack,
      player: restorePlayerState(checkpoint.player),
      opponent: restorePlayerState(checkpoint.opponent),
      log: checkpoint.log,
    } as GameState;

    // Rebuild equippedCards references on FieldCards from spell/trap zones
    for (const side of ['player', 'opponent'] as Owner[]) {
      for (const fst of this.state[side].field.spellTraps) {
        if (!fst || fst.card.type !== CardType.Equipment || fst.equippedOwner === undefined || fst.equippedMonsterZone === undefined) continue;
        const targetFC = this.state[fst.equippedOwner].field.monsters[fst.equippedMonsterZone];
        if (targetFC) {
          const stZone = this.state[side].field.spellTraps.indexOf(fst);
          targetFC.equippedCards.push({ zone: stZone, card: fst.card });
        }
      }
    }

    this.addLog('--- Duel resumed ---');
    this.ui.render(this.state);

    // If it was the opponent's turn, resume AI
    if (this.state.activePlayer === 'opponent') {
      setTimeout(() => {
        aiTurn(this).catch(err => {
          EchoesOfSanguo.log('ERROR', 'AI turn crashed:', err);
          this.state.activePlayer = 'player';
          this.state.phase = 'main';
          this.state.turn++;
          this.addLog(`[ERROR] Opponent AI crashed. Your turn (Round ${this.state.turn}).`);
          this.refillHand('player');
          this.ui.render(this.state);
        });
      }, 600);
    }
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
    this.state[target].lp = Math.min(this.state[target].lp + amount, 99999);
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

  /** Refill hand up to handRefillSize (Forbidden Memories style) or draw 1. */
  refillHand(owner: Owner){
    if(GAME_RULES.refillHandEnabled){
      const st = this.state[owner];
      const need = GAME_RULES.handRefillSize - st.hand.length;
      if(need > 0) this.drawCard(owner, need);
    } else {
      this.drawCard(owner, GAME_RULES.drawPerTurn);
    }
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
    this._recalcFieldSpellBonuses(fc);
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
    this._recalcFieldSpellBonuses(fc);
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
    this._recalcFieldSpellBonuses(fc);
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

  // ───────── Equipment ──────────────────────────────────────

  async equipCard(owner: Owner, handIndex: number, targetOwner: Owner, targetMonsterZone: number): Promise<boolean> {
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if (!card || card.type !== CardType.Equipment) { this.addLog('Not an equipment card!'); return false; }

    const targetSt = this.state[targetOwner];
    const targetFC = targetSt.field.monsters[targetMonsterZone];
    if (!targetFC || targetFC.faceDown) { this.addLog('No valid target monster!'); return false; }

    if (!meetsEquipRequirement(card, targetFC.card)) {
      this.addLog(`${card.name} cannot be equipped to ${targetFC.card.name}!`);
      return false;
    }

    // Find empty spell/trap zone on the equipment owner's side
    const zone = st.field.spellTraps.findIndex(z => z === null);
    if (zone === -1) { this.addLog('No free spell/trap zone!'); return false; }

    st.hand.splice(handIndex, 1);
    const fst = new FieldSpellTrap(card, false);
    fst.equippedMonsterZone = targetMonsterZone;
    fst.equippedOwner = targetOwner;
    st.field.spellTraps[zone] = fst;

    // Apply bonuses
    const atkB = card.atkBonus ?? 0;
    const defB = card.defBonus ?? 0;
    targetFC.permATKBonus += atkB;
    targetFC.permDEFBonus += defB;
    targetFC.equippedCards.push({ zone, card });

    const bonusParts: string[] = [];
    if (atkB !== 0) bonusParts.push(`ATK ${atkB >= 0 ? '+' : ''}${atkB}`);
    if (defB !== 0) bonusParts.push(`DEF ${defB >= 0 ? '+' : ''}${defB}`);
    this.addLog(`${ownerLabel(owner)}: ${card.name} equipped to ${targetFC.card.name}! (${bonusParts.join(', ')})`);
    this.ui.playSfx?.('sfx_spell');
    if (this.ui.showActivation) await this.ui.showActivation(card, card.description);

    // Execute effect block if present
    if (card.effect) try {
      const ctx: EffectContext = { engine: this, owner, targetFC };
      executeEffectBlock(card.effect, ctx);
    } catch (e) {
      EchoesOfSanguo.log('EFFECT', `Error in equipment effect [${card.id}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
    }

    this.ui.render(this.state);
    return true;
  }

  /** Remove all equipment attached to a monster at the given zone/owner, sending them to graveyard. */
  _removeEquipmentForMonster(monsterOwner: Owner, monsterZone: number): void {
    // Equipment can be owned by either player — scan both sides
    for (const side of ['player', 'opponent'] as Owner[]) {
      const st = this.state[side];
      for (let z = 0; z < st.field.spellTraps.length; z++) {
        const fst = st.field.spellTraps[z];
        if (!fst || fst.card.type !== CardType.Equipment) continue;
        if (fst.equippedOwner === monsterOwner && fst.equippedMonsterZone === monsterZone) {
          this.addLog(`${fst.card.name} was destroyed (equipped monster left the field).`);
          st.graveyard.push(fst.card);
          st.field.spellTraps[z] = null;
        }
      }
    }
  }

  // ───────── Field Spell ──────────────────────────────────

  async activateFieldSpell(owner: Owner, handIndex: number): Promise<boolean> {
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if (!card || card.type !== CardType.Spell || card.spellType !== 'field') {
      this.addLog('Not a field spell card!'); return false;
    }
    st.hand.splice(handIndex, 1);

    // Destroy existing field spell if any
    if (st.field.fieldSpell) {
      this._removeFieldSpell(owner);
    }

    st.field.fieldSpell = new FieldSpellTrap(card, false);
    this.addLog(`${ownerLabel(owner)}: Field Spell ${card.name} activated!`);
    this.ui.playSfx?.('sfx_spell');
    if (this.ui.showActivation) await this.ui.showActivation(card, card.description);

    // Apply continuous buffs/debuffs to all monsters on both sides
    this._recalcAllFieldSpellBonuses();
    this.ui.render(this.state);
    return true;
  }

  _removeFieldSpell(owner: Owner): void {
    const st = this.state[owner];
    const fs = st.field.fieldSpell;
    if (!fs) return;

    st.graveyard.push(fs.card);
    st.field.fieldSpell = null;
    this.addLog(`${fs.card.name} was destroyed.`);

    // Recalculate field spell bonuses for all monsters (both sides)
    this._recalcAllFieldSpellBonuses();
  }

  /** Recalculate field spell bonuses for ALL monsters on both sides. */
  _recalcAllFieldSpellBonuses(): void {
    for (const side of ['player', 'opponent'] as Owner[]) {
      for (const fc of this.state[side].field.monsters) {
        if (!fc) continue;
        this._recalcFieldSpellBonuses(fc);
      }
    }
  }

  /** Recalculate field spell bonuses for a single monster from both players' field spells. */
  _recalcFieldSpellBonuses(fc: FieldCard): void {
    let atkBuff = 0;
    let defBuff = 0;
    for (const side of ['player', 'opponent'] as Owner[]) {
      const fs = this.state[side].field.fieldSpell;
      if (!fs?.card.effect) continue;
      for (const action of fs.card.effect.actions) {
        if (action.type === 'buffField') {
          const filter = (action as any).filter;
          if (!filter || matchesFilter(fc.card, filter)) {
            atkBuff += (action as any).value ?? 0;
            defBuff += (action as any).value ?? 0;
          }
        }
      }
    }
    fc.fieldSpellATKBonus = atkBuff;
    fc.fieldSpellDEFBonus = defBuff;
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

    const fusionCardData = CARD_DB[recipe.result];
    if (!fusionCardData) { this.addLog('Fusion result card not found!'); return false; }

    this.addLog(`${ownerLabel(owner)}: FUSION! ${card1.name} + ${card2.name} = ${fusionCardData.name}!`);
    this.ui.playSfx?.('sfx_fusion');

    // Play merge animation before removing cards from hand
    await this.ui.playFusionAnimation?.(owner, handIdx1, handIdx2, zone);

    // remove materials
    hand.splice(hi, 1);
    hand.splice(lo, 1);
    st.graveyard.push(card1);
    st.graveyard.push(card2);

    const fusionCard = Object.assign({}, fusionCardData);
    const fc = new FieldCard(fusionCard, 'atk');
    fc.summonedThisTurn = false; // fusion monsters can attack immediately
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;

    this.ui.render(this.state);
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    return true;
  }

  /**
   * FM-style multi-card fusion chain.
   * If 1 card: normal summon in ATK position.
   * If 2+ cards: resolve chain, place final result on field.
   */
  async performFusionChain(owner: Owner, handIndices: number[]): Promise<boolean> {
    const st = this.state[owner];
    const hand = st.hand;

    if (handIndices.length === 0) return false;

    // Single card = normal summon shortcut
    if (handIndices.length === 1) {
      const zone = st.field.monsters.findIndex(z => z === null);
      if (zone === -1) { this.addLog('No free zone!'); return false; }
      return this.summonMonster(owner, handIndices[0], zone, 'atk');
    }

    const zone = st.field.monsters.findIndex(z => z === null);
    if (zone === -1) { this.addLog('No free zone for fusion monster!'); return false; }

    // Validate all indices are in bounds
    if (!handIndices.every(i => i >= 0 && i < hand.length)) {
      this.addLog('Invalid hand index for fusion!'); return false;
    }

    // Resolve chain using FM rules
    const cardIds = handIndices.map(i => hand[i].id);
    const chain = resolveFusionChain(cardIds);

    const finalCard = CARD_DB[chain.finalCardId];
    if (!finalCard) { this.addLog('Fusion chain failed!'); return false; }

    // Build log message showing the chain
    const cardNames = handIndices.map(i => hand[i].name);
    this.addLog(`${ownerLabel(owner)}: FUSION! ${cardNames.join(' + ')} = ${finalCard.name}!`);
    this.ui.playSfx?.('sfx_fusion');

    // Play animation
    if (this.ui.playFusionChainAnimation) {
      await this.ui.playFusionChainAnimation(owner, handIndices, zone);
    } else if (this.ui.playFusionAnimation && handIndices.length >= 2) {
      await this.ui.playFusionAnimation(owner, handIndices[0], handIndices[1], zone);
    }

    // Collect the actual CardData objects before removing from hand
    const removedCards = handIndices.map(i => hand[i]);

    // Remove cards from hand in descending index order to avoid shift issues
    const sortedDesc = [...handIndices].sort((a, b) => b - a);
    for (const idx of sortedDesc) {
      hand.splice(idx, 1);
    }

    // Send consumed cards to graveyard (all original cards except: if the final result
    // is one of the original hand cards, don't graveyard it — it stays as the result)
    for (const card of removedCards) {
      if (chain.consumedIds.includes(card.id)) {
        st.graveyard.push(card);
      } else {
        // This is the surviving card from fallback rules — also goes to graveyard
        // since we replace it with the CARD_DB version on the field
        st.graveyard.push(card);
      }
    }

    // Place final result on field
    const resultCard = Object.assign({}, finalCard);
    const fc = new FieldCard(resultCard, 'atk');
    fc.summonedThisTurn = false; // fusion result can attack immediately
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;
    this._recalcFieldSpellBonuses(fc);

    this.ui.render(this.state);
    await this._triggerEffect(fc, owner, 'onSummon', zone);
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
    this._removeEquipmentForMonster(owner, zone);
    this.ui.render(this.state);
  }

  _buildSpellContext(owner: Owner, targetInfo: FieldCard | CardData | null): EffectContext {
    const ctx: EffectContext = { engine: this, owner };
    if(targetInfo instanceof FieldCard){
      if(targetInfo.cannotBeTargeted){
        EchoesOfSanguo.log('EFFECT', `${targetInfo.card.name} cannot be targeted by effects – target ignored.`, '#fa0');
        this.addLog(`${targetInfo.card.name} cannot be targeted by effects!`);
      } else {
        ctx.targetFC = targetInfo;
      }
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
    for(let i=0;i<traps.length;i++){
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
      let nextPhase = phases[idx+1] as Phase;
      // First turn: skip battle phase entirely (FM-style)
      if(nextPhase === 'battle' && this.state.firstTurnNoAttack){
        this.state.firstTurnNoAttack = false;
        nextPhase = 'end';
      }
      this.state.phase = nextPhase;
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
        this.refillHand('player');
        this.ui.render(this.state);
      });
    }, 600);
  }

  // ───────── Position change ───────────────────────────────
  changePosition(owner: Owner, zone: number){
    const fc = this.state[owner].field.monsters[zone];
    if(!fc || fc.summonedThisTurn){ this.addLog('Cannot change position!'); return; }
    fc.position = fc.position === 'atk' ? 'def' : 'atk';
    // position change is free and unlimited — does not consume an action
    this.addLog(`${fc.card.name} switches to ${fc.position === 'atk' ? 'attack' : 'defense'} position.`);
    this.ui.render(this.state);
  }
}
