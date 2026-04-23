import { CARD_DB, OPPONENT_DECK_IDS, PLAYER_DECK_IDS, makeDeck, checkFusion, resolveFusionChain } from './cards.js';
import { executeEffectBlock, matchesFilter, EffectExecutionError, MAX_EFFECT_STEPS } from './effect-registry.js';
import { CardType } from './types.js';
import { meetsEquipRequirement } from './types.js';
import type { Owner, Phase, Position, CardData, CardEffectBlock, EffectContext, InternalEffectContext, EffectSignal, GameState, UICallbacks, OpponentConfig, AIBehavior, DuelStats } from './types.js';
import { TriggerBus } from './trigger-bus.js';
import { TrapResolver } from './trap-resolver.js';
// Re-export for backwards compatibility
export { meetsEquipRequirement } from './types.js';

export interface SerializedFieldCardData {
  cardId: string;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  hasFlipSummoned: boolean;
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
import { aiTurn, createEngineDependencies } from './ai-orchestrator.js';

// Re-export for backwards compatibility
export { EchoesOfSanguo } from './debug-logger.js';
export { FieldCard, FieldSpellTrap } from './field.js';

export class GameEngine {
  state!: GameState; // initialized in initGame() before any gameplay method is called
  ui: UICallbacks;
  private trapResolver: TrapResolver;
  _trapResolve: ((result: boolean) => void) | null;
  _currentOpponentId: number | null;
  _aiBehavior!: Required<AIBehavior>;
  _stats!: DuelStats;
  _duelEnded = false;
  _chainDepth = 0;
  static MAX_CHAIN_DEPTH = 6;
  /**
   * Maximum timeout for effect execution in milliseconds.
   * Prevents DoS attacks via infinite async loops or long-running effects.
   */
  static MAX_EFFECT_TIMEOUT_MS = 5000;

  constructor(uiCallbacks: UICallbacks){
    this.ui = uiCallbacks;
    this._trapResolve = null;
    this._currentOpponentId = null;
    
    this.trapResolver = new TrapResolver({
      getState: () => this.state,
      getTrapZones: (owner) => this.state[owner].field.spellTraps,
      getMonsterAt: (owner, zone) => this.state[owner].field.monsters[zone],
      promptPlayer: (opts) => this.ui.prompt!(opts),
      activateTrap: (owner, zone, args) => this.activateTrapFromField(owner, zone, ...args),
      showActivation: (card, text) => this.ui.showActivation?.(card, text),
      playSfx: (sfxId) => this.ui.playSfx?.(sfxId),
      addLog: (msg) => this.addLog(msg),
      get owner() { return this.state.activePlayer; }
    });
  }

  _initStats(): void {
    this._stats = {
      turns: 0, monstersPlayed: 0, fusionsPerformed: 0,
      spellsActivated: 0, trapsActivated: 0, cardsDrawn: 0,
      lpRemaining: 0, opponentLpRemaining: 0, deckRemaining: 0, graveyardSize: 0,
      opponentMonstersPlayed: 0, opponentFusionsPerformed: 0,
      opponentSpellsActivated: 0, opponentTrapsActivated: 0,
      opponentDeckRemaining: 0, opponentGraveyardSize: 0,
      endReason: 'lp_zero',
    };
  }

  private _resolveOpponentConfig(
    config: OpponentConfig | null
  ): { deckIds: string[]; behaviorId: string; id: number | null } {
    let oppDeckIds = (config && config.deckIds) ? config.deckIds : OPPONENT_DECK_IDS;
    
    if (oppDeckIds.length > 0 && oppDeckIds.length < GAME_RULES.maxDeckSize) {
      const padded = [...oppDeckIds];
      while (padded.length < GAME_RULES.maxDeckSize) {
        padded.push(oppDeckIds[padded.length % oppDeckIds.length]);
      }
      oppDeckIds = padded;
    }
    
    return {
      deckIds: oppDeckIds,
      behaviorId: config?.behaviorId ?? 'default',
      id: (config && config.id) ? config.id : null,
    };
  }

  private _initializeGameState(
    playerDeckIds: string[],
    opponentDeckIds: string[],
    playerGoesFirst: boolean
  ): GameState {
    return {
      phase: 'main',
      turn: 1,
      activePlayer: playerGoesFirst ? 'player' : 'opponent',
      player: {
        lp: GAME_RULES.STARTING_LP,
        deck: this._shuffle(makeDeck(playerDeckIds || PLAYER_DECK_IDS)),
        hand: [],
        field: { monsters: Array(GAME_RULES.fieldZones).fill(null), spellTraps: Array(GAME_RULES.fieldZones).fill(null), fieldSpell: null },
        graveyard: [],
        normalSummonUsed: false
      },
      opponent: {
        lp: GAME_RULES.STARTING_LP,
        deck: this._shuffle(makeDeck(opponentDeckIds)),
        hand: [],
        field: { monsters: Array(GAME_RULES.fieldZones).fill(null), spellTraps: Array(GAME_RULES.fieldZones).fill(null), fieldSpell: null },
        graveyard: [],
        normalSummonUsed: false
      },
      log: [],
      firstTurnNoAttack: true,
      oneMoveActionUsed: false,
    } as GameState;
  }

  private _performInitialDraws(): void {
    this.drawCard('player', 5);
    this.drawCard('opponent', 5);
    this.addLog('=== Duel begins! ===');
  }

  private _handleAICrash(err: unknown): void {
    EchoesOfSanguo.log('ERROR', 'AI turn crashed:', err);
    this.state.activePlayer = 'player';
    this.state.phase = 'main';
    this.state.turn++;
    this.addLog(`[ERROR] Opponent AI crashed. Your turn (Round ${this.state.turn}).`);
    this.refillHand('player');
    this.ui.render(this.state);
  }

  private _scheduleOpponentTurn(delayMs: number = 600): void {
    setTimeout(() => {
      aiTurn(createEngineDependencies(this)).catch(err => this._handleAICrash(err));
    }, delayMs);
  }

  async initGame(playerDeckIds: string[], opponentConfig: OpponentConfig | null){
    EchoesOfSanguo.startSession();
    this._initStats();
    this._duelEnded = false;

    const resolved = this._resolveOpponentConfig(opponentConfig);
    this._currentOpponentId = resolved.id;
    this._aiBehavior = resolveAIBehavior(resolved.behaviorId);

    const playerGoesFirst = Math.random() < 0.5;
    this.state = this._initializeGameState(playerDeckIds, resolved.deckIds, playerGoesFirst);
    this._performInitialDraws();

    if(this.ui.showCoinToss) await this.ui.showCoinToss(playerGoesFirst);

    if(playerGoesFirst){
      this.state.phase = 'main';
      this.addLog('Round 1 - Your turn!');
      this.ui.render(this.state);
    } else {
      this.addLog('Opponent goes first!');
      this.state.phase = 'draw';
      this.ui.render(this.state);
      this._scheduleOpponentTurn();
    }
  }

  restoreGame(checkpoint: SerializedCheckpoint): void {
    EchoesOfSanguo.startSession();
    this._initStats();
    this._duelEnded = false;
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
          fc.hasFlipSummoned        = m.hasFlipSummoned;
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

    if (this.state.activePlayer === 'opponent') {
      this._scheduleOpponentTurn();
    }
  }

  getState(): GameState { return this.state; }

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

  private async _safeExecuteEffect(
    block: CardEffectBlock,
    ctx: InternalEffectContext,
    cardId: string,
    label: string,
    options?: { stepCounter?: { value: number }; timeoutMs?: number },
  ): Promise<EffectSignal | null> {
    const timeoutMs = options?.timeoutMs ?? GameEngine.MAX_EFFECT_TIMEOUT_MS;
    const stepCounter = options?.stepCounter ?? { value: 0 };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort('timeout');
    }, timeoutMs);

    try {
      const executionPromise = executeEffectBlock(block, ctx, {
        stepCounter,
        abortSignal: controller.signal,
      });
      
      const result = await Promise.race([
        executionPromise,
        new Promise<EffectSignal>((_resolve, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new EffectExecutionError(
              `Effect execution timeout after ${timeoutMs}ms`,
              'timeout',
              stepCounter.value,
            ));
          });
        }),
      ]);
      
      clearTimeout(timeoutId);
      return result;
    } catch (e) {
      clearTimeout(timeoutId);
      
      if (e instanceof EffectExecutionError) {
        EchoesOfSanguo.log(
          'SECURITY',
          `Effect execution blocked: ${e.reason.toUpperCase()} - ${e.message} [${cardId}] (steps: ${e.stepsExecuted})`,
          '#f44',
        );
        this.addLog(`Effect interrupted: ${e.reason === 'timeout' ? 'timeout' : 'step limit exceeded'}`);
        return null;
      }
      
      EchoesOfSanguo.log('EFFECT', `Error in ${label} [${cardId}]: ${e instanceof Error ? e.message : String(e)}`, '#f44');
      return null;
    }
  }

  dealDamage(target: Owner, amount: number){
    this.state[target].lp = Math.max(0, this.state[target].lp - amount);
    this.addLog(`${ownerLabel(target)} takes ${amount} damage. (LP: ${this.state[target].lp})`);
    this.ui.playSfx?.('sfx_damage');
    this.ui.showDamageNumber?.(amount, target);
    this.ui.render(this.state);
    if(this.checkWin()) return;
  }

  gainLP(target: Owner, amount: number){
    this.state[target].lp = Math.min(this.state[target].lp + amount, GAME_RULES.maxLP);
    this.addLog(`${ownerLabel(target)} gains ${amount} LP. (LP: ${this.state[target].lp})`);
    this.ui.playVFX?.('heal', target);
    this.ui.render(this.state);
  }

  checkWin(){
    if(this._duelEnded) return true;
    if(this.state.player.lp <= 0){
      this.addLog('=== DEFEAT ===');
      this._stats.endReason = 'lp_zero';
      this._endDuel('defeat');
      return true;
    }
    if(this.state.opponent.lp <= 0){
      this.addLog('=== VICTORY ===');
      this._stats.endReason = 'lp_zero';
      this._endDuel('victory');
      return true;
    }
    if(this.state.player.deck.length === 0 && this.state.phase === 'draw'){
      this.addLog('=== DEFEAT (Deck empty) ===');
      this._stats.endReason = 'deck_out';
      this._endDuel('defeat');
      return true;
    }
    if(this.state.opponent.deck.length === 0){
      this.addLog('=== VICTORY (Opponent deck empty) ===');
      this._stats.endReason = 'deck_out';
      this._endDuel('victory');
      return true;
    }
    return false;
  }

  _endDuel(result: 'victory' | 'defeat'){
    if(this._duelEnded) return;
    this._duelEnded = true;
    this._stats.turns = this.state.turn;
    this._stats.lpRemaining = this.state.player.lp;
    this._stats.opponentLpRemaining = this.state.opponent.lp;
    this._stats.deckRemaining = this.state.player.deck.length;
    this._stats.graveyardSize = this.state.player.graveyard.length;
    this._stats.opponentDeckRemaining = this.state.opponent.deck.length;
    this._stats.opponentGraveyardSize = this.state.opponent.graveyard.length;

    // onDuelEnd allows progression evaluation in the UI layer
    if(typeof this.ui.onDuelEnd === 'function'){
      this.ui.onDuelEnd(result, this._currentOpponentId, { ...this._stats });
    } else {
      this.ui.showResult?.(result);
    }
  }

  surrender(): void {
    this.addLog('=== SURRENDER ===');
    this._stats.endReason = 'surrender';
    this._endDuel('defeat');
  }

  drawCard(owner: Owner, count = 1){
    const st = this.state[owner];
    let drawn = 0;
    for(let i=0;i<count;i++){
      if(st.deck.length===0){ this.addLog(`${owner==='player'?'Your':'Opponent\'s'} deck is empty!`); break; }
      const card = st.deck.shift()!; // length checked above
      st.hand.push(card);
      drawn++;
    }
    while(st.hand.length > GAME_RULES.handLimitDraw) st.hand.shift();
    if (owner === 'player') this._stats.cardsDrawn += drawn;
    if(drawn > 0 && this.ui.onDraw) this.ui.onDraw(owner, drawn);
  }

  /** Refill hand up to handRefillSize (Forbidden Memories style) or draw 1. */
  _tickTurnCounters(owner: Owner){
    const tc = this.state[owner].turnCounters;
    if (!tc) return;
    for (let i = tc.length - 1; i >= 0; i--) {
      tc[i].turnsRemaining--;
      if (tc[i].turnsRemaining <= 0) {
        this.addLog(`Turn counter expired: ${tc[i].effect}`);
        tc.splice(i, 1);
      }
    }
  }

  hasPreventAttacks(owner: Owner): boolean {
    const tc = this.state[owner].turnCounters;
    return !!tc && tc.some(c => c.effect === 'preventAttacks');
  }

  refillHand(owner: Owner){
    if(this.state.skipNextDraw === owner){
      this.state.skipNextDraw = undefined;
      this.addLog(`${owner === 'player' ? 'Your' : "Opponent's"} draw phase was skipped!`);
      return;
    }
    if(GAME_RULES.refillHandEnabled){
      const st = this.state[owner];
      const need = GAME_RULES.handRefillSize - st.hand.length;
      if(need > 0) this.drawCard(owner, need);
    } else {
      this.drawCard(owner, GAME_RULES.drawPerTurn);
    }
  }

  async summonMonster(owner: Owner, handIndex: number, zone: number, position: Position = 'atk', faceDown=false){
    const st = this.state[owner];
    if(zone < 0 || zone > 4 || st.field.monsters[zone]){
      this.addLog('Invalid zone!'); return false;
    }
    const [card] = st.hand.splice(handIndex, 1);
    const fc = new FieldCard(card, position, faceDown);
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;
    if (owner === 'player') this._stats.monstersPlayed++; else this._stats.opponentMonstersPlayed++;
    const posStr = faceDown ? 'face-down DEF' : position.toUpperCase();
    this.addLog(`${ownerLabel(owner)}: ${card.name} (${posStr}).`);
    this.ui.playSfx?.('sfx_card_play');
    this._recalcFieldSpellBonuses(fc);
    if (!faceDown) {
      await this._triggerEffect(fc, owner, 'onSummon', zone);
      TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
      if (owner === 'player') {
        const placedFC = this.state[owner].field.monsters[zone];
        if (placedFC) {
          const result = await this._autoActivateOpponentTraps('onOpponentSummon', placedFC);
          if (result?.destroySummoned) {
            this.state[owner].graveyard.push(placedFC.card);
            this.state[owner].field.monsters[zone] = null;
            this._removeEquipmentForMonster(owner, zone);
          }
        }
      }
      await this._checkAnySummonTraps(owner, zone);
    }
    this.ui.render(this.state);
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  setMonster(owner: Owner, handIndex: number, zone: number){
    return this.summonMonster(owner, handIndex, zone, 'def', true);
  }

  async flipSummon(owner: Owner, zone: number){
    const fc = this.state[owner].field.monsters[zone];
    if(!fc || !fc.faceDown){ this.addLog('No face-down monster!'); return false; }
    if(fc.summonedThisTurn){ this.addLog('Cannot flip on the same turn!'); return false; }
    fc.faceDown = false;
    this.addLog(`${fc.card.name} is flipped face-up (Flip Summon)!`);
    await this._triggerFlipSummonEffect(fc, owner, zone);
    TriggerBus.emit('onFlipSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    if (owner === 'player') {
      const placedFC = this.state[owner].field.monsters[zone];
      if (placedFC) {
        const result = await this._autoActivateOpponentTraps('onOpponentSummon', placedFC);
        if (result?.destroySummoned) {
          this.state[owner].graveyard.push(placedFC.card);
          this.state[owner].field.monsters[zone] = null;
          this._removeEquipmentForMonster(owner, zone);
        }
      }
    }
    await this._checkAnySummonTraps(owner, zone);
    this.ui.render(this.state);
    return true;
  }

  async specialSummon(owner: Owner, card: CardData, zone?: number, position: Position = 'atk', faceDown = false){
    const st = this.state[owner];
    if(zone === undefined){
      zone = st.field.monsters.findIndex(z => z === null);
      if(zone === -1){ this.addLog('No free monster zone!'); return false; }
    }
    if(st.field.monsters[zone]){ this.addLog('Zone occupied!'); return false; }
    const fc = new FieldCard(card, position, faceDown);
    fc.summonedThisTurn = false; // special summons can usually attack (or keep true for balance)
    st.field.monsters[zone] = fc;
    if (owner === 'player') this._stats.monstersPlayed++; else this._stats.opponentMonstersPlayed++;
    this.addLog(`${ownerLabel(owner)}: ${card.name} Special Summon!`);
    this.ui.playSfx?.('sfx_card_play');
    this._recalcFieldSpellBonuses(fc);
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    await this._checkAnySummonTraps(owner, zone);
    this.ui.render(this.state);
    return true;
  }

  async specialSummonFromGrave(owner: Owner, card: CardData, fromOwner?: Owner){
    const sourceSt = this.state[fromOwner ?? owner];
    const graveIdx = sourceSt.graveyard.findIndex(c => c.id === card.id);
    if(graveIdx === -1){ this.addLog('Card not in graveyard!'); return false; }
    const st = this.state[owner];
    const zone = st.field.monsters.findIndex(z => z === null);
    if(zone === -1){ this.addLog('No free zone!'); return false; }
    const [c] = sourceSt.graveyard.splice(graveIdx, 1);
    const fc = new FieldCard(c, 'atk');
    fc.summonedThisTurn = false;
    st.field.monsters[zone] = fc;
    if (owner === 'player') this._stats.monstersPlayed++; else this._stats.opponentMonstersPlayed++;
    this.addLog(`${ownerLabel(owner)}: ${c.name} summoned from graveyard!`);
    this.ui.playSfx?.('sfx_card_play');
    this._recalcFieldSpellBonuses(fc);
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    await this._checkAnySummonTraps(owner, zone);
    this.ui.render(this.state);
    return true;
  }

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
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  replaceSpellTrap(owner: Owner, handIndex: number, zone: number) {
    const st = this.state[owner];
    const existing = st.field.spellTraps[zone];
    if (existing) {
      if (existing.card.type === CardType.Equipment && existing.equippedOwner && existing.equippedMonsterZone !== undefined) {
        const mOwner = existing.equippedOwner;
        const mZone = existing.equippedMonsterZone;
        const target = this.state[mOwner].field.monsters[mZone];
        if (target) {
          target.permATKBonus -= (existing.card.atkBonus ?? 0);
          target.permDEFBonus -= (existing.card.defBonus ?? 0);
          target.equippedCards = target.equippedCards.filter(eq => eq.zone !== zone);
        }
      }
      st.graveyard.push(existing.card);
      st.field.spellTraps[zone] = null;
    }
    return this.setSpellTrap(owner, handIndex, zone);
  }

  async activateSpell(owner: Owner, handIndex: number, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if(!card || card.type !== CardType.Spell){ this.addLog('Not a spell card!'); return false; }
    st.hand.splice(handIndex, 1);
    if (owner === 'player') this._stats.spellsActivated++; else this._stats.opponentSpellsActivated++;
    this.addLog(`${ownerLabel(owner)}: ${card.name} activated!`);
    this.ui.playSfx?.('sfx_spell');
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    if (owner === 'opponent') {
      const trapResult = await this._promptPlayerTraps('onOpponentSpell');
      if (trapResult?.cancelEffect) {
        this.addLog(`${card.name}'s effect was negated!`);
        st.graveyard.push(card);
        this.ui.render(this.state);
        return true;
      }
    }
    if (owner === 'player') {
      await this._autoActivateOpponentTraps('onOpponentSpell');
    }
    if(card.effect) {
      const spellOpp = owner === 'player' ? 'opponent' : 'player';
      if (this.state[spellOpp].fieldFlags?.negateSpells) {
        this.addLog(`${card.name}'s effect was negated!`);
      } else {
        const ctx = this._buildSpellContext(owner, targetInfo);
        await this._safeExecuteEffect(card.effect, ctx, card.id, 'spell effect');
      }
    }
    st.graveyard.push(card);
    this.ui.render(this.state);
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  async activateSpellFromField(owner: Owner, zone: number, targetInfo: FieldCard | CardData | null = null){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Spell) return false;
    fst.faceDown = false;
    if (owner === 'player') this._stats.spellsActivated++; else this._stats.opponentSpellsActivated++;
    this.addLog(`${ownerLabel(owner)}: ${fst.card.name} activated!`);
    if(this.ui.showActivation) await this.ui.showActivation(fst.card, fst.card.description);
    if (owner === 'opponent') {
      const trapResult = await this._promptPlayerTraps('onOpponentSpell');
      if (trapResult?.cancelEffect) {
        this.addLog(`${fst.card.name}'s effect was negated!`);
        st.graveyard.push(fst.card);
        st.field.spellTraps[zone] = null;
        this.ui.render(this.state);
        return true;
      }
    }
    if (owner === 'player') {
      await this._autoActivateOpponentTraps('onOpponentSpell');
    }
    if(fst.card.effect) {
      const ctx = this._buildSpellContext(owner, targetInfo);
      await this._safeExecuteEffect(fst.card.effect, ctx, fst.card.id, 'spell field effect');
    }
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  async activateTrapFromField(owner: Owner, zone: number, ...args: FieldCard[]){
    const st = this.state[owner];
    const fst = st.field.spellTraps[zone];
    if(!fst || fst.card.type !== CardType.Trap || fst.used) return null;
    fst.used = true;
    fst.faceDown = false;
    if (owner === 'player') this._stats.trapsActivated++; else this._stats.opponentTrapsActivated++;
    this.addLog(`${ownerLabel(owner)}: Trap ${fst.card.name} activated!`);
    this.ui.playSfx?.('sfx_trap');
    if(this.ui.showActivation) await this.ui.showActivation(fst.card, fst.card.description);

    if (this._chainDepth < GameEngine.MAX_CHAIN_DEPTH) {
      this._chainDepth++;
      const counterOwner = owner === 'player' ? 'opponent' : 'player';
      let counterResult: EffectSignal | null = null;
      if (counterOwner === 'player') {
        counterResult = await this._promptPlayerTraps('onOpponentTrap', ...args);
      } else {
        counterResult = await this._autoActivateOpponentTraps('onOpponentTrap', ...args);
      }
      this._chainDepth--;
      if (counterResult?.cancelEffect) {
        this.addLog(`${fst.card.name} was negated!`);
        st.graveyard.push(fst.card);
        st.field.spellTraps[zone] = null;
        this.ui.render(this.state);
        return {};
      }
    }

    let result: EffectSignal | null = null;
    if(fst.card.effect) {
      const ctx = this._buildTrapContext(owner, fst.card.trapTrigger, args);
      result = await this._safeExecuteEffect(fst.card.effect, ctx, fst.card.id, 'trap effect') ?? {};
    }
    st.graveyard.push(fst.card);
    st.field.spellTraps[zone] = null;
    this.ui.render(this.state);
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return result;
  }

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

    const zone = st.field.spellTraps.findIndex(z => z === null);
    if (zone === -1) { this.addLog('No free spell/trap zone!'); return false; }

    st.hand.splice(handIndex, 1);
    const fst = new FieldSpellTrap(card, false);
    fst.equippedMonsterZone = targetMonsterZone;
    fst.equippedOwner = targetOwner;
    st.field.spellTraps[zone] = fst;

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

    if (card.effect) {
      const ctx: InternalEffectContext = { engine: this, owner, targetFC };
      await this._safeExecuteEffect(card.effect, ctx, card.id, 'equipment effect');
    }

    this.ui.render(this.state);
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  _removeEquipmentForMonster(monsterOwner: Owner, monsterZone: number): void {
    const targetFC = this.state[monsterOwner].field.monsters[monsterZone];
    for (const side of ['player', 'opponent'] as Owner[]) {
      const st = this.state[side];
      for (let z = 0; z < st.field.spellTraps.length; z++) {
        const fst = st.field.spellTraps[z];
        if (!fst || fst.card.type !== CardType.Equipment) continue;
        if (fst.equippedOwner === monsterOwner && fst.equippedMonsterZone === monsterZone) {
          // Reverse bonuses applied by equipCard()
          if (targetFC) {
            targetFC.permATKBonus -= (fst.card.atkBonus ?? 0);
            targetFC.permDEFBonus -= (fst.card.defBonus ?? 0);
            targetFC.equippedCards = targetFC.equippedCards.filter(eq => eq.zone !== z);
          }
          this.addLog(`${fst.card.name} was destroyed (equipped monster left the field).`);
          st.graveyard.push(fst.card);
          st.field.spellTraps[z] = null;
        }
      }
    }
  }

  async activateFieldSpell(owner: Owner, handIndex: number): Promise<boolean> {
    const st = this.state[owner];
    const card = st.hand[handIndex];
    if (!card || card.type !== CardType.Spell || card.spellType !== 'field') {
      this.addLog('Not a field spell card!'); return false;
    }
    st.hand.splice(handIndex, 1);

    if (st.field.fieldSpell) {
      this._removeFieldSpell(owner);
    }

    st.field.fieldSpell = new FieldSpellTrap(card, false);
    if (owner === 'player') this._stats.spellsActivated++; else this._stats.opponentSpellsActivated++;
    this.addLog(`${ownerLabel(owner)}: Field Spell ${card.name} activated!`);
    this.ui.playSfx?.('sfx_spell');
    if (this.ui.showActivation) await this.ui.showActivation(card, card.description);

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

    this._recalcAllFieldSpellBonuses();
  }

  removeEquipmentForMonster(owner: Owner, zone: number): void {
    this._removeEquipmentForMonster(owner, zone);
  }

  removeFieldSpell(owner: Owner): void {
    this._removeFieldSpell(owner);
  }

  removeFromHand(owner: Owner, index: number): CardData {
    const [card] = this.state[owner].hand.splice(index, 1);
    return card;
  }

  removeFromDeck(owner: Owner, index: number): CardData {
    const [card] = this.state[owner].deck.splice(index, 1);
    return card;
  }

  async chainTribute(owner: Owner, card: CardData): Promise<void> {
    const st = this.state[owner];
    const monsters = st.field.monsters;
    const zone = monsters.findIndex(fc => fc?.card.id === card.id);
    if (zone === -1) return;
    st.graveyard.push(card);
    monsters[zone] = null;
    this._removeEquipmentForMonster(owner, zone);
    this.addLog(`${card.name} was tributed as cost.`);
    await this._triggerSentToGrave(card, owner);
  }

  _recalcAllFieldSpellBonuses(): void {
    for (const side of ['player', 'opponent'] as Owner[]) {
      for (const fc of this.state[side].field.monsters) {
        if (!fc) continue;
        this._recalcFieldSpellBonuses(fc);
      }
    }
  }

  _recalcFieldSpellBonuses(fc: FieldCard): void {
    let atkBuff = 0;
    let defBuff = 0;
    for (const side of ['player', 'opponent'] as Owner[]) {
      const fs = this.state[side].field.fieldSpell;
      if (!fs?.card.effect) continue;
      for (const action of fs.card.effect.actions) {
        if (action.type === 'buffField') {
          if (!action.filter || matchesFilter(fc.card, action.filter)) {
            atkBuff += action.value ?? 0;
            defBuff += action.value ?? 0;
          }
        }
      }
    }
    fc.fieldSpellATKBonus = atkBuff;
    fc.fieldSpellDEFBonus = defBuff;
  }

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

    if (owner === 'player') this._stats.fusionsPerformed++; else this._stats.opponentFusionsPerformed++;
    this.addLog(`${ownerLabel(owner)}: FUSION! ${card1.name} + ${card2.name} = ${fusionCardData.name}!`);
    this.ui.playSfx?.('sfx_fusion');

    // Play merge animation before removing cards from hand
    await this.ui.playFusionAnimation?.(owner, handIdx1, handIdx2, zone);

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
    TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
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

    if (handIndices.length === 1) {
      const zone = st.field.monsters.findIndex(z => z === null);
      if (zone === -1) { this.addLog('No free zone!'); return false; }
      return this.summonMonster(owner, handIndices[0], zone, 'atk');
    }

    const zone = st.field.monsters.findIndex(z => z === null);
    if (zone === -1) { this.addLog('No free zone for fusion monster!'); return false; }

    if (!handIndices.every(i => i >= 0 && i < hand.length)) {
      this.addLog('Invalid hand index for fusion!'); return false;
    }

    const cardIds = handIndices.map(i => hand[i].id);
    const chain = resolveFusionChain(cardIds);

    const finalCard = CARD_DB[chain.finalCardId];
    if (!finalCard) { this.addLog('Fusion chain failed!'); return false; }

    const cardNames = handIndices.map(i => hand[i].name);
    if (owner === 'player') this._stats.fusionsPerformed++; else this._stats.opponentFusionsPerformed++;
    this.addLog(`${ownerLabel(owner)}: FUSION! ${cardNames.join(' + ')} = ${finalCard.name}!`);
    this.ui.playSfx?.('sfx_fusion');

    if (this.ui.playFusionChainAnimation) {
      await this.ui.playFusionChainAnimation(owner, handIndices, zone);
    } else if (this.ui.playFusionAnimation && handIndices.length >= 2) {
      await this.ui.playFusionAnimation(owner, handIndices[0], handIndices[1], zone);
    }

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

    const resultCard = Object.assign({}, finalCard);
    const fc = new FieldCard(resultCard, 'atk');
    fc.summonedThisTurn = false; // fusion result can attack immediately
    st.field.monsters[zone] = fc;
    st.normalSummonUsed = true;
    this._recalcFieldSpellBonuses(fc);

    this.ui.render(this.state);
    await this._triggerEffect(fc, owner, 'onSummon', zone);
    TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  async fuseHandWithField(owner: Owner, handIndex: number, fieldZone: number): Promise<boolean> {
    const st = this.state[owner];
    const handCard = st.hand[handIndex];
    const fieldFC = st.field.monsters[fieldZone];
    if (!handCard || !fieldFC) { this.addLog('Invalid fusion targets!'); return false; }

    const recipe = checkFusion(handCard.id, fieldFC.card.id);
    if (!recipe) { this.addLog('No fusion possible!'); return false; }

    const fusionCardData = CARD_DB[recipe.result];
    if (!fusionCardData) { this.addLog('Fusion result card not found!'); return false; }

    if (owner === 'player') this._stats.fusionsPerformed++; else this._stats.opponentFusionsPerformed++;
    this.addLog(`${ownerLabel(owner)}: FUSION! ${handCard.name} + ${fieldFC.card.name} = ${fusionCardData.name}!`);
    this.ui.playSfx?.('sfx_fusion');

    const [removed] = st.hand.splice(handIndex, 1);
    st.graveyard.push(removed);
    st.graveyard.push(fieldFC.card);
    this._removeEquipmentForMonster(owner, fieldZone);

    const fc = new FieldCard(Object.assign({}, fusionCardData), 'atk');
    fc.summonedThisTurn = false;
    st.field.monsters[fieldZone] = fc;
    st.normalSummonUsed = true;

    this._recalcFieldSpellBonuses(fc);
    this.ui.render(this.state);
    await this._triggerEffect(fc, owner, 'onSummon', fieldZone);
    TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone: fieldZone });
    if (owner === this.state.activePlayer) this._triggerOneMoveAdvance();
    return true;
  }

  private _processTrapResult(
    trapResult: EffectSignal | null,
    attackerOwner: Owner,
    attackerZone: number,
    attFC: any
  ): { destroy: boolean, reflect: boolean, cancel: boolean } {
    if (trapResult?.destroyAttacker) {
      this._destroyMonsterBySignal(attackerOwner, attackerZone, attFC);
      attFC.hasAttacked = true;
      return { destroy: true, reflect: false, cancel: false };
    }
    if (trapResult?.reflectDamage) {
      this.dealDamage(attackerOwner, attFC.effectiveATK());
      attFC.hasAttacked = true;
      return { destroy: false, reflect: true, cancel: false };
    }
    if (trapResult && trapResult.cancelAttack) {
      attFC.hasAttacked = true;
      return { destroy: false, reflect: false, cancel: true };
    }
    return { destroy: false, reflect: false, cancel: false };
  }

  private _validateAttack(
    attackerOwner: Owner,
    attackerZone: number,
    defenderZone: number
  ): { attFC: any, defFC: any, valid: boolean } {
    const atkSt = this.state[attackerOwner];
    const defOwn = attackerOwner === 'player' ? 'opponent' : 'player';
    const defSt = this.state[defOwn];

    const attFC = atkSt.field.monsters[attackerZone];
    if (!attFC) {
      this.addLog('No attacking monster!');
      return { attFC: null, defFC: null, valid: false };
    }
    if (attFC.hasAttacked) {
      this.addLog(`${attFC.card.name} has already attacked!`);
      return { attFC, defFC: null, valid: false };
    }
    if (attFC.faceDown) {
      attFC.faceDown = false;
      attFC.position = 'atk';
      this.addLog(`${attFC.card.name} is revealed (attack)!`);
      this._triggerFlipSummonEffect(attFC, attackerOwner, attackerZone);
      TriggerBus.emit('onFlipSummon', { engine: this, owner: attackerOwner, card: attFC.card, fieldCard: attFC, zone: attackerZone });
    }
    if (attFC.position !== 'atk') {
      this.addLog('Monster must be in attack position!');
      return { attFC, defFC: null, valid: false };
    }

    const defFC = defSt.field.monsters[defenderZone];
    if (defFC && defFC.cantBeAttacked) {
      this.addLog(`${defFC.card.name} cannot be attacked!`);
      return { attFC, defFC, valid: false };
    }

    return { attFC, defFC, valid: true };
  }

  private async _handleTrapPhase(
    attackerOwner: Owner,
    attackerZone: number,
    attFC: any,
    defFC: any
  ): Promise<{ cancelled: boolean, destroyed: boolean, battleReady: boolean }> {
    const atkSt = this.state[attackerOwner];
    const isOpponentAttacking = attackerOwner === 'opponent';

    const trapFn = isOpponentAttacking
      ? () => this._promptPlayerTraps('onAttack', attFC)
      : () => this._autoActivateOpponentTraps('onAttack', attFC);
    const trapResult = await trapFn();
    const result = this._processTrapResult(trapResult, attackerOwner, attackerZone, attFC);

    if (result.destroy || result.reflect) {
      this.ui.render(this.state);
      return { cancelled: false, destroyed: true, battleReady: false };
    }
    if (result.cancel) {
      this.ui.render(this.state);
      return { cancelled: true, destroyed: false, battleReady: false };
    }

    if (this._duelEnded || !atkSt.field.monsters[attackerZone]) {
      this.ui.render(this.state);
      return { cancelled: false, destroyed: false, battleReady: false };
    }

    if (defFC) {
      const trapFn2 = isOpponentAttacking
        ? () => this._promptPlayerTraps('onOwnMonsterAttacked', attFC, defFC)
        : () => this._autoActivateOpponentTraps('onOwnMonsterAttacked', attFC, defFC);
      const trapResult2 = await trapFn2();
      const result2 = this._processTrapResult(trapResult2, attackerOwner, attackerZone, attFC);

      if (result2.destroy || result2.reflect) {
        this.ui.render(this.state);
        return { cancelled: false, destroyed: true, battleReady: false };
      }
      if (result2.cancel) {
        this.ui.render(this.state);
        return { cancelled: true, destroyed: false, battleReady: false };
      }

      if (this._duelEnded || !atkSt.field.monsters[attackerZone]) {
        this.ui.render(this.state);
        return { cancelled: false, destroyed: false, battleReady: false };
      }
    }

    if (!atkSt.field.monsters[attackerZone]) {
      this.ui.render(this.state);
      return { cancelled: false, destroyed: false, battleReady: false };
    }

    attFC.hasAttacked = true;

    return { cancelled: false, destroyed: false, battleReady: true };
  }

  private async _executeBattlePhase(
    attackerOwner: Owner,
    attackerZone: number,
    defenderZone: number,
    attFC: any,
    defFC: any
  ): Promise<void> {
    const defOwn = attackerOwner === 'player' ? 'opponent' : 'player';

    if (!defFC) {
      this.addLog(`${attFC.card.name} attacks directly!`);
      if (this.state[defOwn].battleProtection) {
        this.addLog('Battle damage prevented!');
      } else {
        if (this.ui.playAttackAnimation) {
          await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, null);
        }
        this.dealDamage(defOwn, attFC.effectiveATK());
        if (this._duelEnded) return;
        await this._triggerEffect(attFC, attackerOwner, 'onDealBattleDamage', null);
      }
    } else {
      if (this.ui.playAttackAnimation) {
        await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, defenderZone);
      }
      await this._resolveBattle(attackerOwner, attackerZone, defOwn, defenderZone, attFC, defFC);
    }

    if (!this._duelEnded) {
      this.ui.render(this.state);
    }
  }

  async attack(attackerOwner: Owner, attackerZone: number, defenderZone: number) {
    if (this.hasPreventAttacks(attackerOwner)) {
      this.addLog('Attacks are prevented!');
      return;
    }

    const validation = this._validateAttack(attackerOwner, attackerZone, defenderZone);
    if (!validation.valid || !validation.attFC) return;
    const { attFC, defFC } = validation;

    const trapPhase = await this._handleTrapPhase(attackerOwner, attackerZone, attFC, defFC);
    if (!trapPhase.battleReady) return;

    await this._executeBattlePhase(attackerOwner, attackerZone, defenderZone, attFC, defFC);

    if (!this._duelEnded) {
      this.ui.render(this.state);
    }
  }

  async attackDirect(attackerOwner: Owner, attackerZone: number){
    if(this.hasPreventAttacks(attackerOwner)){ this.addLog('Attacks are prevented!'); return; }
    const defOwn  = attackerOwner === 'player' ? 'opponent' : 'player';
    const defMons = this.state[defOwn].field.monsters;
    const attFC   = this.state[attackerOwner].field.monsters[attackerZone];
    if(!attFC) return;
    if(!attFC.canDirectAttack && defMons.some(m => m !== null)){
      this.addLog('Opponent has monsters on the field!'); return;
    }
    if(attFC.hasAttacked) return;
    if(attFC.faceDown){
      attFC.faceDown = false;
      attFC.position = 'atk';
      this.addLog(`${attFC.card.name} is flipped face-up (Attack)!`);
      await this._triggerFlipSummonEffect(attFC, attackerOwner, attackerZone);
      TriggerBus.emit('onFlipSummon', { engine: this, owner: attackerOwner, card: attFC.card, fieldCard: attFC, zone: attackerZone });
    }
    if(attFC.position !== 'atk') return;

    if(attackerOwner === 'opponent'){
      const trapResult = await this._promptPlayerTraps('onAttack', attFC);
      if(trapResult?.destroyAttacker){ this._destroyMonsterBySignal(attackerOwner, attackerZone, attFC); attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(trapResult?.reflectDamage){ this.dealDamage(attackerOwner, attFC.effectiveATK()); attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(trapResult && trapResult.cancelAttack){ attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(this._duelEnded || !this.state[attackerOwner].field.monsters[attackerZone]){ this.ui.render(this.state); return; }
    }

    if(attackerOwner === 'player'){
      const oppTrap = await this._autoActivateOpponentTraps('onAttack', attFC);
      if(oppTrap?.destroyAttacker){ this._destroyMonsterBySignal(attackerOwner, attackerZone, attFC); attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(oppTrap?.reflectDamage){ this.dealDamage(attackerOwner, attFC.effectiveATK()); attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(oppTrap?.cancelAttack){ attFC.hasAttacked = true; this.ui.render(this.state); return; }
      if(this._duelEnded || !this.state[attackerOwner].field.monsters[attackerZone]){ this.ui.render(this.state); return; }
    }

    if(!this.state[attackerOwner].field.monsters[attackerZone]){ this.ui.render(this.state); return; }
    attFC.hasAttacked = true;
    this.addLog(`${attFC.card.name} greift direkt an!`);
    if(this.ui.playAttackAnimation) await this.ui.playAttackAnimation(attackerOwner, attackerZone, defOwn, null);
    this.dealDamage(defOwn, attFC.effectiveATK());
    if(this._duelEnded) return;
    await this._triggerEffect(attFC, attackerOwner, 'onDealBattleDamage', null);
    if(this._duelEnded) return;
    this.ui.render(this.state);
  }


  private async _handleFlipReveal(defFC: FieldCard, defOwner: Owner, defZone: number): Promise<boolean> {
    if (defFC.faceDown) {
      defFC.faceDown = false;
      this.addLog(`${defFC.card.name} is revealed!`);
      await this._triggerFlipSummonEffect(defFC, defOwner, defZone);
      TriggerBus.emit('onFlipSummon', { engine: this, owner: defOwner, card: defFC.card, fieldCard: defFC, zone: defZone });
      await this._triggerEffect(defFC, defOwner, 'onSummon', defZone);
      TriggerBus.emit('onSummon', { engine: this, owner: defOwner, card: defFC.card, fieldCard: defFC, zone: defZone });
      if (defOwner === 'player') {
        const placedFC = this.state[defOwner].field.monsters[defZone];
        if (placedFC) {
          const result = await this._autoActivateOpponentTraps('onOpponentSummon', placedFC);
          if (result?.destroySummoned) {
            this.state[defOwner].graveyard.push(placedFC.card);
            this.state[defOwner].field.monsters[defZone] = null;
            this._removeEquipmentForMonster(defOwner, defZone);
            this.ui.render(this.state);
            return false;
          }
        }
      }
      await this._checkAnySummonTraps(defOwner, defZone);
      this.ui.render(this.state);
    }
    return true;
  }

  async _resolveBattle(atkOwner: Owner, atkZone: number, defOwner: Owner, defZone: number, attFC: FieldCard, defFC: FieldCard){
    const shouldContinue = await this._handleFlipReveal(defFC, defOwner, defZone);
    if (!shouldContinue) return;

    const { effATK, defVal, modeStr } = this._calculateCombatValues(attFC, defFC, atkVal);

    this.addLog(`${attFC.card.name} (ATK ${effATK}) vs ${defFC.card.name} (${modeStr} ${defVal})`);

    if(this.state[defOwner].battleProtection){
      this.addLog('Battle damage and destruction prevented!');
      return;
    }

    if(defFC.position === 'atk'){
      await this._resolveAttackVsAttack(attFC, defFC, atkOwner, defOwner, atkZone, defZone, effATK, defVal);
      if(this._duelEnded) return;
    } else {
      await this._resolveAttackVsDefense(attFC, defFC, atkOwner, defOwner, defZone, effATK, defVal);
      if(this._duelEnded) return;
    }
  }

  private async _resolveAttackVsAttack(attFC: FieldCard, defFC: FieldCard, atkOwner: Owner, defOwner: Owner, atkZone: number, defZone: number, effATK: number, defVal: number): Promise<void> {
    if(effATK > defVal){
      const dmg = effATK - defVal;
      this.addLog(`${defFC.card.name} destroyed! Opponent: -${dmg} LP`);
      await this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
      this.dealDamage(defOwner, dmg);
      if(this._duelEnded) return;
      await this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
      TriggerBus.emit('onDestroyByBattle', { engine: this, owner: atkOwner, card: attFC.card, fieldCard: attFC });
      await this._triggerEffect(attFC, atkOwner, 'onDealBattleDamage', null);
    } else if(effATK === defVal){
      this.addLog('Tie! Both monsters destroyed!');
      await this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
      await this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
    } else {
      const dmg = defVal - effATK;
      this.addLog(`${attFC.card.name} destroyed! Player: -${dmg} LP`);
      await this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
      this.dealDamage(atkOwner, dmg);
      if(this._duelEnded) return;
      await this._triggerEffect(attFC, atkOwner, 'onDestroyByBattle', null);
      TriggerBus.emit('onDestroyByBattle', { engine: this, owner: atkOwner, card: attFC.card, fieldCard: attFC });
      await this._triggerEffect(defFC, defOwner, 'onDestroyByBattle', null);
      TriggerBus.emit('onDestroyByBattle', { engine: this, owner: defOwner, card: defFC.card, fieldCard: defFC });
    }
  }

  private async _resolveAttackVsDefense(attFC: FieldCard, defFC: FieldCard, atkOwner: Owner, defOwner: Owner, defZone: number, effATK: number, defVal: number): Promise<void>{
    if(effATK > defVal){
      this.addLog(`${defFC.card.name} (DEF) destroyed!`);
      await this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
      if(attFC.piercing){
        const pierceDmg = effATK - defVal;
        this.addLog(`Piercing attack! -${pierceDmg} LP`);
        this.dealDamage(defOwner, pierceDmg);
        if(this._duelEnded) return;
        await this._triggerEffect(attFC, atkOwner, 'onDealBattleDamage', null);
      }
    } else if(effATK === defVal){
      this.addLog('Monster held its ground!');
    } else {
      this.addLog('Attack blocked! No damage.');
    }
  }

  private _calculateCombatValues(attFC: FieldCard, defFC: FieldCard, atkVal: number): { effATK: number, defVal: number, modeStr: string }{
    const defVal = defFC.combatValue();
    const modeStr= defFC.position === 'atk' ? 'ATK' : 'DEF';

    let atkBonus = 0;
    if(attFC.vsAttrBonus && defFC.card.attribute === attFC.vsAttrBonus.attr)
      atkBonus = attFC.vsAttrBonus.atk;

    const effATK = atkVal + atkBonus;

    return { effATK, defVal, modeStr };
  }

  async _destroyMonster(owner: Owner, zone: number, reason: string, byOwner: Owner){
    const st  = this.state[owner];
    const fc  = st.field.monsters[zone];
    if(!fc) return;
    if(fc.indestructible && reason === 'battle'){
      this.addLog(`${fc.card.name} is indestructible!`);
      return;
    }
    this.ui.playSfx?.('sfx_destroy');

    // Shadow Reaper / onDestroyByBattle for defender
    if(reason === 'battle' && byOwner !== owner){
      await this._triggerEffect(fc, owner, 'onDestroyByOpponent', zone);
      TriggerBus.emit('onDestroyByOpponent', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
    }

    st.graveyard.push(fc.card);
    st.field.monsters[zone] = null;
    this._removeEquipmentForMonster(owner, zone);
    this.ui.render(this.state);

    await this._triggerSentToGrave(fc.card, owner);
    this._recalcFieldFlags();

    if (fc.phoenixRevival && !fc.phoenixRevivalUsed) {
      this.addLog(`${fc.card.name} rises from the graveyard!`);
      const revived = await this.specialSummonFromGrave(owner, fc.card);
      if (revived) {
        const revivedFC = st.field.monsters.find(m => m !== null && m.card.id === fc.card.id);
        if (revivedFC) revivedFC.phoenixRevivalUsed = true;
      }
    }
  }

  async _destroyMonsterBySignal(owner: Owner, zone: number, fc: FieldCard): Promise<void> {
    const st = this.state[owner];
    this.addLog(`${fc.card.name} was destroyed by trap!`);
    this.ui.playSfx?.('sfx_destroy');
    st.graveyard.push(fc.card);
    st.field.monsters[zone] = null;
    this._removeEquipmentForMonster(owner, zone);
    await this._triggerSentToGrave(fc.card, owner);
    this._recalcFieldFlags();
  }

  _buildSpellContext(owner: Owner, targetInfo: FieldCard | CardData | null): InternalEffectContext {
    const ctx: InternalEffectContext = { engine: this, owner };
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

  _buildTrapContext(owner: Owner, trapTrigger: string | undefined, args: FieldCard[]): InternalEffectContext {
    const ctx: InternalEffectContext = { engine: this, owner };
    if(trapTrigger === 'onAttack'){
      ctx.attacker = args[0];
    } else if(trapTrigger === 'onOwnMonsterAttacked'){
      ctx.attacker = args[0];
      ctx.defender = args[1];
    } else if(trapTrigger === 'onOpponentSummon' || trapTrigger === 'onAnySummon'){
      ctx.summonedFC = args[0];
    } else if(trapTrigger === 'onOpponentTrap'){
      ctx.attacker = args[0];
    }
    return ctx;
  }

  async _triggerEffect(fc: FieldCard, owner: Owner, trigger: string, zone: number | null){
    const card = fc.card;
    const oppSide = owner === 'player' ? 'opponent' : 'player';
    if (trigger !== 'passive' && this.state[oppSide].fieldFlags?.negateMonsterEffects) {
      return;
    }
    const blocks = this._getEffectBlocks(card, trigger);
    for (const block of blocks) {
      EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Trigger: ${trigger}`);
      if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
      const ctx: InternalEffectContext = { engine: this, owner };
      await this._safeExecuteEffect(block, ctx, card.id, `effect trigger=${trigger}`);
    }
  }

  _getEffectBlocks(card: CardData, trigger: string): CardEffectBlock[] {
    const blocks: CardEffectBlock[] = [];
    if (card.effects) {
      for (const b of card.effects) {
        if (b.trigger === trigger) blocks.push(b);
      }
    } else if (card.effect && card.effect.trigger === trigger) {
      blocks.push(card.effect);
    }
    return blocks;
  }

  async _checkAnySummonTraps(summonerOwner: Owner, zone: number): Promise<void> {
    const fc = this.state[summonerOwner].field.monsters[zone];
    if (!fc) return;
    const trapResult = summonerOwner === 'player'
      ? await this._autoActivateOpponentTraps('onAnySummon', fc)
      : await this._promptPlayerTraps('onAnySummon', fc);
    if (trapResult?.destroySummoned || trapResult?.destroyAttacker) {
      this.state[summonerOwner].graveyard.push(fc.card);
      this.state[summonerOwner].field.monsters[zone] = null;
      this._removeEquipmentForMonster(summonerOwner, zone);
    }
  }

  async _triggerSentToGrave(card: CardData, owner: Owner): Promise<void> {
    const blocks = this._getEffectBlocks(card, 'onSentToGrave');
    for (const block of blocks) {
      EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Trigger: onSentToGrave`);
      if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
      const ctx: InternalEffectContext = { engine: this, owner };
      await this._safeExecuteEffect(block, ctx, card.id, 'onSentToGrave');
    }
  }

  async _triggerFlipSummonEffect(fc: FieldCard, owner: Owner, zone: number){
    if(fc.hasFlipSummoned) return;
    fc.hasFlipSummoned = true;
    const card = fc.card;
    const blocks = [...this._getEffectBlocks(card, 'onFlipSummon'), ...this._getEffectBlocks(card, 'onFlip')];
    if (blocks.length === 0) return;
    EchoesOfSanguo.log('EFFECT', `${card.name} (${owner}) – Flip Effect`);
    if(this.ui.showActivation) await this.ui.showActivation(card, card.description);
    const ctx: InternalEffectContext = { engine: this, owner };
    for (const block of blocks) {
      await this._safeExecuteEffect(block, ctx, card.id, 'flip effect');
    }
  }

  async _promptPlayerTraps(triggerType: string, ...args: FieldCard[]){
    return this.trapResolver.checkTrapActivation(triggerType, args, true);
  }

  async _autoActivateOpponentTraps(triggerType: string, ...args: FieldCard[]): Promise<EffectSignal | null> {
    return this.trapResolver.checkTrapActivation(triggerType, args, false);
  }

  _hasPlayableCard(owner: Owner): boolean {
    const st = this.state[owner];
    for (const card of st.hand) {
      if (card.type === CardType.Monster || card.type === CardType.Fusion) {
        if (!st.normalSummonUsed && st.field.monsters.some(z => z === null)) return true;
      }
      if (card.type === CardType.Spell) return true;
      if (card.type === CardType.Trap) return true;
      if (card.type === CardType.Equipment) return true;
    }
    for (const fst of st.field.spellTraps) {
      if (fst && fst.faceDown && (fst.card.type === CardType.Spell || fst.card.type === CardType.Trap)) return true;
    }
    return false;
  }

  _triggerOneMoveAdvance(): void {
    if (!GAME_RULES.oneMoveEnabled) return;
    if (this.state.oneMoveActionUsed) return;
    this.state.oneMoveActionUsed = true;
    this.advancePhase();
  }

  _canAdvanceToPhase(nextPhase: Phase): boolean {
    if (nextPhase === 'battle' && this.state.firstTurnNoAttack) {
      this.state.firstTurnNoAttack = false;
      return false;
    }
    
    if (nextPhase === 'battle' && GAME_RULES.oneMoveEnabled && 
        !this.state.oneMoveActionUsed && 
        !this._hasPlayableCard(this.state.activePlayer)) {
      this.state.oneMoveActionUsed = true;
    }
    
    return true;
  }

  _announcePhase(phase: Phase): void {
    const names: Partial<Record<Phase, string>> = { 
      main: 'Main Phase', 
      battle: 'Battle Phase' 
    };
    this.addLog(`--- ${names[phase] ?? phase} ---`);
    this.ui.render(this.state);
  }

  _advanceToNextPhase(): boolean {
    const phases = ['main', 'battle'] as Phase[];
    const idx = phases.indexOf(this.state.phase);
    
    if (idx >= phases.length - 1) {
      return false;
    }
    
    const nextPhase = phases[idx + 1] as Phase;
    
    if (!this._canAdvanceToPhase(nextPhase)) {
      return false;
    }
    
    this.state.phase = nextPhase;
    this._announcePhase(nextPhase);
    return true;
  }

  _resetSummonFlags(): void {
    this.state[this.state.activePlayer].normalSummonUsed = false;
    const opp = this.state.activePlayer === 'player' ? 'opponent' : 'player';
    this.state[opp].normalSummonUsed = false;
  }

  _enforceHandLimit(owner: Owner): void {
    const hand = this.state[owner].hand;
    while (hand.length > GAME_RULES.handLimitEnd) {
      hand.shift();
    }
  }

  _cleanupEndOfTurn(activePlayer: Owner): void {
    this._resetMonsterFlags(activePlayer);
    this._returnTempStolenMonsters(activePlayer);
    this._returnSpiritMonsters(activePlayer);
    this._tickTurnCounters(activePlayer);
    this._resetSummonFlags();
    this._enforceHandLimit(activePlayer);
  }

  advancePhase() {
    if (!this._advanceToNextPhase()) {
      this._cleanupEndOfTurn(this.state.activePlayer);
      this.endTurn();
    }
  }

  _resetMonsterFlags(owner: Owner){
    this.state[owner].field.monsters.forEach(fc => {
      if(fc){ fc.tempATKBonus = 0; fc.tempDEFBonus = 0; fc.hasAttacked = false; fc.summonedThisTurn = false; }
    });
    this.state[owner].battleProtection = false;
  }

  _recalcFieldFlags(){
    for (const side of ['player', 'opponent'] as Owner[]) {
      const flags = { negateTraps: false, negateSpells: false, negateMonsterEffects: false };
      const st = this.state[side];
      for (const fc of st.field.monsters) {
        if (!fc) continue;
        const blocks = fc.card.effects ?? (fc.card.effect ? [fc.card.effect] : []);
        for (const b of blocks) {
          if (b.trigger !== 'passive') continue;
          for (const a of b.actions) {
            if (a.type === 'passive_negateTraps') flags.negateTraps = true;
            if (a.type === 'passive_negateSpells') flags.negateSpells = true;
            if (a.type === 'passive_negateMonsterEffects') flags.negateMonsterEffects = true;
          }
        }
      }
      for (const fst of st.field.spellTraps) {
        if (!fst || fst.faceDown) continue;
        const blocks = fst.card.effects ?? (fst.card.effect ? [fst.card.effect] : []);
        for (const b of blocks) {
          for (const a of b.actions) {
            if (a.type === 'passive_negateTraps') flags.negateTraps = true;
            if (a.type === 'passive_negateSpells') flags.negateSpells = true;
            if (a.type === 'passive_negateMonsterEffects') flags.negateMonsterEffects = true;
          }
        }
      }
      st.fieldFlags = flags;
    }
  }

  _returnTempStolenMonsters(owner: Owner){
    const st = this.state[owner];
    const opp = owner === 'player' ? 'opponent' : 'player' as Owner;
    for(let i = 0; i < st.field.monsters.length; i++){
      const fc = st.field.monsters[i];
      if(fc && fc.originalOwner && fc.originalOwner !== owner){
        const oppSt = this.state[opp];
        const freeZone = oppSt.field.monsters.findIndex(z => z === null);
        if(freeZone !== -1){
          fc.originalOwner = undefined;
          fc.hasAttacked = true;
          oppSt.field.monsters[freeZone] = fc;
        } else {
          oppSt.graveyard.push(fc.card);
        }
        st.field.monsters[i] = null;
        this._removeEquipmentForMonster(owner, i);
        this.addLog(`${fc.card.name} returns to its owner.`);
      }
    }
  }

  _returnSpiritMonsters(owner: Owner){
    const st = this.state[owner];
    for(let i = 0; i < st.field.monsters.length; i++){
      const fc = st.field.monsters[i];
      if(fc && fc.card.spirit){
        st.hand.push(fc.card);
        st.field.monsters[i] = null;
        this._removeEquipmentForMonster(owner, i);
        this.addLog(`${fc.card.name} returns to hand (Spirit).`);
      }
    }
  }

  endTurn(){
    this._resetMonsterFlags('player');
    this._returnTempStolenMonsters('player');
    this._returnSpiritMonsters('player');
    this._tickTurnCounters('player');

    this.state.player.normalSummonUsed   = false;
    this.state.opponent.normalSummonUsed = false;

    const hand = this.state.player.hand;
    while(hand.length > GAME_RULES.handLimitEnd){ hand.shift(); }

    this.state.activePlayer = 'opponent';
    this.state.phase = 'draw';
    this.state.turn++;

    this.addLog(`=== Round ${this.state.turn} - Opponent's turn ===`);
    this.ui.render(this.state);

    setTimeout(() => {
      aiTurn(createEngineDependencies(this)).catch(err => {
        EchoesOfSanguo.log('ERROR', 'AI turn crashed:', err);
        EchoesOfSanguo.downloadLog('ai_crash');
        this.state.activePlayer = 'player';
        this.state.phase = 'main';
        this.state.turn++;
        this.state.oneMoveActionUsed = false;
        this.addLog(`[ERROR] Opponent AI crashed. Your turn (Round ${this.state.turn}).`);
        this.refillHand('player');
        this.ui.render(this.state);
      });
    }, 600);
  }

  changePosition(owner: Owner, zone: number){
    const fc = this.state[owner].field.monsters[zone];
    if(!fc || fc.summonedThisTurn){ this.addLog('Cannot change position!'); return; }
    fc.position = fc.position === 'atk' ? 'def' : 'atk';
    // position change is free and unlimited — does not consume an action
    this.addLog(`${fc.card.name} switches to ${fc.position === 'atk' ? 'attack' : 'defense'} position.`);
    this.ui.render(this.state);
  }
}
