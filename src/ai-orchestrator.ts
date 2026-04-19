import { EchoesOfSanguo } from './debug-logger.js';
import { GAME_RULES } from './rules.js';
import { CardType, isMonsterType } from './types.js';
import type { AIBehavior, AIGoal, BoardSnapshot, CardData, Owner, Position, TrapTrigger, GameState, PlayerState } from './types.js';
import type { FieldCard } from './field.js';
import { checkFusion, CARD_DB, FUSION_RECIPES } from './cards.js';
import { AI_SCORE, AI_LP_THRESHOLD } from './ai-behaviors.js';
import {
  snapshotBoard,
  computeBoardThreat,
  classifyGoalAlignment,
  evaluateTurnGoal,
} from './ai-threat.js';
// Use import type to avoid circular dependency (engine.ts → ai-orchestrator.ts → engine.ts)
import type { GameEngine } from './engine.js';
import {
  pickSummonCandidate,
  pickSmartSummonCandidate,
  decideSummonPosition,
  planAttacks,
  pickEquipTarget,
  pickDebuffTarget,
  aiCombatValue,
  aiEffectiveATK,
  aiEffectiveDEF,
} from './ai-behaviors.js';

interface TurnContext {
  snap:       BoardSnapshot;
  activeGoal: AIGoal | undefined;
  isWinning:  boolean;
}

export interface AIOrchestratorConfig {
  speed?: number;
  debug?: boolean;
}

export interface AIDependencies {
  drawCard: (owner: Owner, count?: number) => void;
  refillHand: (owner: Owner) => void;
  summonMonster: (owner: Owner, handIndex: number, zone: number, position: Position) => Promise<void>;
  setMonster: (owner: Owner, handIndex: number, zone: number) => Promise<void>;
  attack: (owner: Owner, attackerZone: number, defenderZone: number) => Promise<void>;
  attackDirect: (owner: Owner, attackerZone: number) => Promise<void>;
  activateSpell: (owner: Owner, handIndex: number, targetInfo?: FieldCard | CardData | null) => Promise<void>;
  activateFieldSpell: (owner: Owner, handIndex: number) => Promise<void>;
  setSpellTrap: (owner: Owner, handIndex: number, zone: number) => boolean;
  equipCard: (owner: Owner, handIndex: number, targetOwner: Owner, targetMonsterZone: number) => Promise<void>;
  performFusionChain: (owner: Owner, handIndices: number[]) => Promise<void>;
  fuseHandWithField: (owner: Owner, handIndex: number, fieldZone: number) => Promise<void>;
  checkWin: () => boolean;
  addLog: (msg: string) => void;
  render: (state: GameState) => void;
  removeEquipmentForMonster: (monsterOwner: Owner, monsterZone: number) => void;
  promptPlayerTraps: (trigger: TrapTrigger, ...args: FieldCard[]) => Promise<{ destroySummoned?: boolean } | null>;
  getState: () => GameState;
  getAIBehavior: () => Required<AIBehavior>;
  getOpponentState: () => PlayerState;
  getPlayerState: () => PlayerState;
  delay: (ms: number) => Promise<void>;
  resetMonsterFlags: (owner: Owner) => void;
  returnTempStolenMonsters: (owner: Owner) => void;
  returnSpiritMonsters: (owner: Owner) => void;
  tickTurnCounters: (owner: Owner) => void;
}

function _createDefaultDelay(speed: number): (ms: number) => Promise<void> {
  if (speed === 0) {
    return () => Promise.resolve();
  }
  return (ms: number) => new Promise<void>(r => setTimeout(r, ms));
}

export function createEngineDependencies(engine: GameEngine, config?: AIOrchestratorConfig): AIDependencies {
  const speed = config?.speed ?? 1;
  const delay = _createDefaultDelay(speed);
  const state = engine.state;

  return {
    drawCard: (owner, count) => engine.drawCard(owner, count),
    refillHand: (owner) => engine.refillHand(owner),
    summonMonster: (owner, handIndex, zone, position) => engine.summonMonster(owner, handIndex, zone, position).then(() => {}),
    setMonster: (owner, handIndex, zone) => engine.setMonster(owner, handIndex, zone).then(() => {}),
    attack: (owner, attackerZone, defenderZone) => engine.attack(owner, attackerZone, defenderZone).then(() => {}),
    attackDirect: (owner, attackerZone) => engine.attackDirect(owner, attackerZone).then(() => {}),
    activateSpell: (owner, handIndex, targetInfo) => engine.activateSpell(owner, handIndex, targetInfo).then(() => {}),
    activateFieldSpell: (owner, handIndex) => engine.activateFieldSpell(owner, handIndex).then(() => {}),
    setSpellTrap: (owner, handIndex, zone) => engine.setSpellTrap(owner, handIndex, zone),
    equipCard: (owner, handIndex, targetOwner, targetMonsterZone) => engine.equipCard(owner, handIndex, targetOwner, targetMonsterZone).then(() => {}),
    performFusionChain: (owner, handIndices) => engine.performFusionChain(owner, handIndices).then(() => {}),
    fuseHandWithField: (owner, handIndex, fieldZone) => engine.fuseHandWithField(owner, handIndex, fieldZone).then(() => {}),
    checkWin: () => engine.checkWin(),
    addLog: (msg) => engine.addLog(msg),
    render: (s) => engine.ui.render(s),
    removeEquipmentForMonster: (monsterOwner, monsterZone) => engine._removeEquipmentForMonster(monsterOwner, monsterZone),
    promptPlayerTraps: (trigger, ...args: FieldCard[]) => engine._promptPlayerTraps(trigger, ...args) as Promise<{ destroySummoned?: boolean } | null>,
    getState: () => state,
    getAIBehavior: () => engine._aiBehavior,
    getOpponentState: () => state.opponent,
    getPlayerState: () => state.player,
    delay,
    resetMonsterFlags: (owner) => engine._resetMonsterFlags(owner),
    returnTempStolenMonsters: (owner) => engine._returnTempStolenMonsters(owner),
    returnSpiritMonsters: (owner) => engine._returnSpiritMonsters(owner),
    tickTurnCounters: (owner) => engine._tickTurnCounters(owner),
  };
}

function _isPartOfUnfulfilledRecipe(cardId: string, hand: CardData[]): boolean {
  return FUSION_RECIPES.some(recipe => {
    const [m1, m2] = recipe.materials;
    if (m1 !== cardId && m2 !== cardId) return false;
    const partnerNeeded = m1 === cardId ? m2 : m1;
    return !hand.some(c => c.id === partnerNeeded);
  });
}

function _peekDrawForFusion(deps: AIDependencies, maxPeek: number): void {
  const ai = deps.getOpponentState();
  const peeked = ai.deck.slice(0, maxPeek);
  for (let pi = 0; pi < peeked.length; pi++) {
    const peekedCard = peeked[pi];
    for (const handCard of ai.hand) {
      const recipe = checkFusion(peekedCard.id, handCard.id);
      if (recipe) {
        const result = CARD_DB[recipe.result];
        if (result && (result.atk ?? 0) > (handCard.atk ?? 0)) {
          deps.drawCard('opponent', pi + 1);
          EchoesOfSanguo.log('AI', `CHEAT-PEEK: Drew ${peekedCard.name} for fusion → ${result.name}`);
          return;
        }
      }
    }
  }
}

function _assessPlayerComposition(plr: { hand: CardData[] }, knowsHand: boolean) {
  if (!knowsHand) return { spellHeavy: false };
  const spellCount = plr.hand.filter(c => c.type === CardType.Spell || c.type === CardType.Trap).length;
  return { spellHeavy: spellCount >= 2 };
}

export async function aiTurn(deps?: AIDependencies, config?: AIOrchestratorConfig): Promise<void> {
  if (!deps) {
    throw new Error('aiTurn requires AIDependencies. Pass deps from createEngineDependencies(engine).');
  }

  const state = deps.getState();
  const ai = deps.getOpponentState();

  EchoesOfSanguo.group(`=== AI Turn Round ${state.turn} ===`);

  await aiDrawPhase(deps);
  await aiMainPhase(deps);
  await aiPlaceTraps(deps);
  await aiEquipCards(deps);

  if (state.firstTurnNoAttack) {
    state.firstTurnNoAttack = false;
    EchoesOfSanguo.log('PHASE', 'First turn – skipping AI battle phase.');
  } else {
    if (await aiBattlePhase(deps)) return;
  }

  EchoesOfSanguo.log('PHASE', 'End of AI turn – cleanup.');

  deps.resetMonsterFlags('opponent');
  deps.returnTempStolenMonsters('opponent');
  deps.returnSpiritMonsters('opponent');
  deps.tickTurnCounters('opponent');
  while(ai.hand.length > 8) ai.hand.shift();

  state.activePlayer = 'player';
  state.phase = 'main';
  state.turn++;
  state.oneMoveActionUsed = false;
  deps.addLog(`=== Round ${state.turn} - Your turn! ===`);

  EchoesOfSanguo.groupEnd();

  deps.refillHand('player');
  deps.render(state);
  if(deps.checkWin()) return;
}

async function aiDrawPhase(deps: AIDependencies): Promise<void> {
  const state = deps.getState();
  const ai = deps.getOpponentState();
  const bh = deps.getAIBehavior();
  state.phase = 'draw';
  deps.render(state);
  await deps.delay(300);
  deps.refillHand('opponent');
  deps.addLog('Opponent draws cards.');
  if (bh.peekDeckCards && bh.peekDeckCards > 0) {
    _peekDrawForFusion(deps, bh.peekDeckCards);
    deps.render(state);
  }
  EchoesOfSanguo.log('PHASE', 'Draw Phase – Hand:', ai.hand.map(c => c.name));
  deps.render(state);
  await deps.delay(400);
}

async function aiMainPhase(deps: AIDependencies): Promise<void> {
  const state = deps.getState();
  const ai  = deps.getOpponentState();
  const plr = deps.getPlayerState();

  state.phase = 'main';
  deps.addLog('--- Opponent Main Phase ---');
  deps.render(state);
  await deps.delay(400);

  const bh = deps.getAIBehavior();
  const snap = snapshotBoard(ai, plr);
  const ctx: TurnContext = {
    snap,
    activeGoal: evaluateTurnGoal(state.turn, bh.goal),
    isWinning:  computeBoardThreat(snap) > 0,
  };

  EchoesOfSanguo.log('AI', 'Main Phase – checking fusion chain...');
  if(!ai.normalSummonUsed && bh.fusionFirst){
    const bestChain = _findSmartFusionChain(ai.hand, bh.fusionMinATK, plr.field.monsters, ctx.activeGoal, ai.field.monsters);
    if(bestChain && bestChain.fieldZone !== undefined){
      const handCard = ai.hand[bestChain.indices[0]];
      EchoesOfSanguo.log('AI', `Field fusion: ${handCard.name} + field zone ${bestChain.fieldZone} → ${bestChain.resultName} (ATK:${bestChain.resultATK})`);
      await deps.delay(500);
      await deps.fuseHandWithField('opponent', bestChain.indices[0], bestChain.fieldZone);
    } else if(bestChain){
      const zone = ai.field.monsters.findIndex(z => z === null);
      if(zone !== -1){
        const names = bestChain.indices.map(i => ai.hand[i].name);
        EchoesOfSanguo.log('AI', `Fusion chain: ${names.join(' + ')} → ${bestChain.resultName} (ATK:${bestChain.resultATK}, Zone ${zone})`);
        await deps.delay(500);
        await deps.performFusionChain('opponent', bestChain.indices);
      } else {
        EchoesOfSanguo.log('AI', 'No free zone for hand fusion chain.');
      }
    } else {
      EchoesOfSanguo.log('AI', 'No fusion chain available.');
    }
  }

  EchoesOfSanguo.log('AI', 'Considering summon:', ai.hand.filter(c => c.type === CardType.Monster).map(c => `${c.name}(${c.atk})`));
  if(!ai.normalSummonUsed){
  let bestIdx = (bh.battleStrategy === 'smart' || bh.positionStrategy === 'smart')
    ? pickSmartSummonCandidate(ai.hand, {
      aiField: ai.field.monsters,
      playerField: plr.field.monsters,
      playerLp: plr.lp,
      aiLp: ai.lp,
    })
    : pickSummonCandidate(ai.hand, bh.summonPriority);

    if (bh.holdFusionPiece && bestIdx !== -1 && ai.field.monsters.some(Boolean)) {
      const candidate = ai.hand[bestIdx];
      if (_isPartOfUnfulfilledRecipe(candidate.id, ai.hand)) {
        EchoesOfSanguo.log('AI', `Holding ${candidate.name} — awaiting fusion partner.`);
        const altHand = ai.hand.filter((_, i) => i !== bestIdx);
        const altRelIdx = pickSummonCandidate(altHand, bh.summonPriority);
        bestIdx = altRelIdx !== -1 ? ai.hand.indexOf(altHand[altRelIdx]) : -1;
      }
    }

    if(bestIdx !== -1){
      const card = ai.hand[bestIdx];
      const cardATK = card.atk ?? 0;
      const cardDEF = card.def ?? 0;
      let zone = ai.field.monsters.findIndex(z => z === null);

      if(zone === -1 && (bh.positionStrategy === 'smart' || bh.battleStrategy === 'smart')){
        const replaceZone = _findWeakestMonsterZone(ai.field.monsters, cardATK);
        if(replaceZone !== -1){
          const weak = ai.field.monsters[replaceZone]!;
          EchoesOfSanguo.log('AI', `Replacing weak ${weak.card.name}(${weak.effectiveATK()}) with ${card.name}(${cardATK})`);
          ai.graveyard.push(weak.card);
          ai.field.monsters[replaceZone] = null;
          deps.removeEquipmentForMonster('opponent', replaceZone);
          zone = replaceZone;
        }
      }

      if(zone === -1){
        EchoesOfSanguo.log('AI', 'All monster zones occupied, no weak monster to replace.');
      } else {
        const plrMaxATK = plr.field.monsters
          .filter(Boolean)
          .reduce((max, fc) => Math.max(max, aiEffectiveATK(fc!)), 0);
        const playerHasMonsters = plr.field.monsters.some(Boolean);
        const summonPos = decideSummonPosition(cardATK, cardDEF, plrMaxATK, playerHasMonsters, bh.positionStrategy);
        EchoesOfSanguo.log('SUMMON', `${summonPos === 'def' ? 'Setting' : 'Summoning'} ${card.name} (ATK:${cardATK}/DEF:${cardDEF}) to zone ${zone} as ${summonPos === 'def' ? 'face-down DEF' : 'ATK'}`);
        await deps.delay(350);
        if (summonPos === 'def') {
          await deps.setMonster('opponent', bestIdx, zone);
        } else {
          await deps.summonMonster('opponent', bestIdx, zone, summonPos);
        }
        const summonedFC = ai.field.monsters[zone];
        if(summonedFC){
          const trapResult = await deps.promptPlayerTraps('onOpponentSummon', summonedFC);
          if(trapResult && trapResult.destroySummoned){
            EchoesOfSanguo.log('TRAP', `Trap hole destroyed ${summonedFC.card.name}`);
            ai.graveyard.push(summonedFC.card);
            ai.field.monsters[zone] = null;
            deps.render(state);
          }
        }
      }
    }
  }

  await _activateSpells(deps, ctx);
}

async function _activateSpells(deps: AIDependencies, ctx: TurnContext): Promise<void> {
  const ai  = deps.getOpponentState();
  const plr = deps.getPlayerState();
  const bh  = deps.getAIBehavior();

  EchoesOfSanguo.log('AI', 'Activating spells (smart ordering)...');

  function _spellSortKey(card: CardData): number {
    if (ctx.activeGoal?.id === 'stall_drain') {
      const actions = card.effect?.actions ?? [];
      if (actions.some((a: import('./types.js').EffectDescriptor) => a.type === 'gainLP')) return -1;
    }
    return 0;
  }

  let spellActivated = true;
  while(spellActivated){
    spellActivated = false;
    const handIndices = [...Array(ai.hand.length).keys()]
      .sort((a, b) => _spellSortKey(ai.hand[a]) - _spellSortKey(ai.hand[b]));
    for(const i of handIndices){
      const card = ai.hand[i];
      if(card.type !== CardType.Spell) continue;
      let activated = false;

        const actions = card.effect?.actions ?? [];
        const dealsDamage = actions.some((a: import('./types.js').EffectDescriptor) => a.type === 'dealDamage');
        const heals = actions.some((a: import('./types.js').EffectDescriptor) => a.type === 'gainLP');
        const buffs = actions.some((a: import('./types.js').EffectDescriptor) => {
          const t = a.type as string;
          return t === 'buffAtkAll' || t === 'buffAtkRace' || t === 'buffAtk' || t === 'buffField';
        });
        const destroys = actions.some((a: import('./types.js').EffectDescriptor) => {
          const t = a.type as string;
          return t === 'destroyMonster' || t === 'destroyAll' || t === 'destroySpellTrap';
        });

        let should = false;
        if (dealsDamage) {
          should = true;
        } else if (heals) {
          should = ai.lp < AI_LP_THRESHOLD.DEFENSIVE || ai.lp < plr.lp;
        } else if (buffs) {
          should = ai.field.monsters.some(fc => fc !== null);
        } else if (destroys) {
          should = plr.field.monsters.some(fc => fc !== null);
          if (!should && bh.knowsPlayerHand) {
            const plrHasMonsters = plr.hand.some(c => c.type === CardType.Monster || c.type === CardType.Fusion);
            if (plrHasMonsters) {
              EchoesOfSanguo.log('AI', `CHEAT-INSIGHT: Player hand has monsters — pre-emptively activating ${card.name}`);
              should = true;
            }
          }
        } else {
          should = true;
        }

        if(should){
          EchoesOfSanguo.log('SPELL', `Activating ${card.name} (normal)`);
          await deps.delay(300); await deps.activateSpell('opponent', i); activated = true;
        }
      if(activated){ spellActivated = true; break; }
    }
  }
}

async function aiPlaceTraps(deps: AIDependencies): Promise<void> {
  const ai  = deps.getOpponentState();
  const bh  = deps.getAIBehavior();
  const plr = deps.getPlayerState();
  EchoesOfSanguo.log('AI', 'Placing traps...');

  const { spellHeavy } = _assessPlayerComposition(plr, bh.knowsPlayerHand);

  const trapPriority: Record<string, number> = spellHeavy
    ? { onOpponentSpell: 0, onAttack: 1, onOwnMonsterAttacked: 2, onOpponentSummon: 3, manual: 4 }
    : { onAttack: 0, onOwnMonsterAttacked: 1, onOpponentSummon: 2, onOpponentSpell: 3, manual: 4 };

  const trapsInHand = ai.hand
    .map((card, idx) => ({ card, idx }))
    .filter(({ card }) => card.type === CardType.Trap)
    .sort((a, b) =>
      (trapPriority[a.card.trapTrigger ?? 'manual'] ?? 4)
      - (trapPriority[b.card.trapTrigger ?? 'manual'] ?? 4)
    );

  let placed = 0;
  for (const { idx } of trapsInHand) {
    const zone = ai.field.spellTraps.findIndex(z => z === null);
    if (zone === -1) break;
    const handIdxAfterRemovals = idx - placed;
    if (handIdxAfterRemovals < 0 || handIdxAfterRemovals >= ai.hand.length) continue;
    EchoesOfSanguo.log('TRAP', `Placing ${ai.hand[handIdxAfterRemovals].name} face-down in zone ${zone}${spellHeavy && ai.hand[handIdxAfterRemovals].trapTrigger === 'onOpponentSpell' ? ' (countering player spells)' : ''}`);
    await deps.delay(300);
    deps.setSpellTrap('opponent', handIdxAfterRemovals, zone);
    placed++;
  }
}

async function aiEquipCards(deps: AIDependencies): Promise<void> {
  const ai  = deps.getOpponentState();
  const plr = deps.getPlayerState();
  const bh  = deps.getAIBehavior();
  EchoesOfSanguo.log('AI', 'Equipping cards (smart targeting)...');

  let equipped = true;
  while (equipped) {
    equipped = false;
    for (let i = 0; i < ai.hand.length; i++) {
      const card = ai.hand[i];
      if (card.type !== CardType.Equipment) continue;

      const atkB = card.atkBonus ?? 0;
      const defB = card.defBonus ?? 0;
      const isPositive = atkB > 0 || defB > 0;
      const isNegative = atkB < 0 || defB < 0;

      if (isPositive) {
        const targetZone = pickEquipTarget(ai.field.monsters, plr.field.monsters, atkB, defB, card);

        if (targetZone !== -1) {
          const fc = ai.field.monsters[targetZone]!;
          EchoesOfSanguo.log('EQUIP', `Equipping ${card.name} (+${atkB}ATK/+${defB}DEF) to ${fc.card.name} (zone ${targetZone})`);
          await deps.delay(300);
          await deps.equipCard('opponent', i, 'opponent', targetZone);
          equipped = true; break;
        }
      } else if (isNegative) {
        const targetZone = pickDebuffTarget(plr.field.monsters, atkB, card);

        if (targetZone !== -1) {
          const fc = plr.field.monsters[targetZone]!;
          EchoesOfSanguo.log('EQUIP', `Debuffing ${fc.card.name} with ${card.name} (${atkB}ATK/${defB}DEF) at zone ${targetZone}`);
          await deps.delay(300);
          await deps.equipCard('opponent', i, 'player', targetZone);
          equipped = true; break;
        }
      }
    }
  }
}

async function aiBattlePhase(deps: AIDependencies): Promise<boolean> {
  const state = deps.getState();
  const ai  = deps.getOpponentState();
  const plr = deps.getPlayerState();
  const bh  = deps.getAIBehavior();

  state.phase = 'battle';
  deps.addLog('--- Opponent Battle Phase ---');
  EchoesOfSanguo.log('PHASE', `Battle Phase – AI field: [${ai.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(ATK:${fc.effectiveATK()})`).join(', ')}]`);
  EchoesOfSanguo.log('PHASE', `Player field: [${plr.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.position==='atk'?'ATK:'+fc.effectiveATK():'DEF:'+fc.effectiveDEF()})`).join(', ')}] LP:${plr.lp}`);
  deps.render(state);
  await deps.delay(500);

  const activeGoal = evaluateTurnGoal(state.turn, bh.goal);
  if (activeGoal?.id === 'stall_drain') {
    const snap = snapshotBoard(ai, plr);
    const isWinning = computeBoardThreat(snap) > 0;
    const totalATK = ai.field.monsters
      .filter((fc): fc is FieldCard => fc !== null && fc.position === 'atk' && !fc.hasAttacked)
      .reduce((sum, fc) => sum + fc.effectiveATK(), 0);
    const canKill = totalATK > plr.lp || plr.field.monsters.every(fc => fc === null);
    if (isWinning && !canKill) {
      EchoesOfSanguo.log('AI', 'stall_drain: winning + no lethal – skipping battle phase.');
      return false;
    }
  }

  if (bh.peekPlayerDeck && bh.peekPlayerDeck > 0 && plr.deck.length > 0) {
    const nextDraw = plr.deck[0];
    EchoesOfSanguo.log('AI', `CHEAT-PEEK: Player draws ${nextDraw.name} next turn (ATK:${nextDraw.atk ?? '?'})`);
  }

  const attackPlan = planAttacks(ai.field.monsters, plr.field.monsters, plr.lp, bh);

  if (attackPlan.length > 0) {
    EchoesOfSanguo.log('AI', `Attack plan: ${attackPlan.length} attacks planned`);
  }

  for (const plan of attackPlan) {
    const atk = ai.field.monsters[plan.attackerZone];
    if (!atk) continue;
    if (atk.hasAttacked) continue;
    if (atk.position !== 'atk') continue;

    await deps.delay(500);

    if (plan.targetZone === -1) {
      const plrHasMonsters = plr.field.monsters.some(m => m !== null);
      if (!plrHasMonsters || atk.canDirectAttack) {
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → Direct attack!${atk.canDirectAttack ? ' (canDirectAttack)' : ''}`);
        await deps.attackDirect('opponent', plan.attackerZone);
        if (deps.checkWin()) return true;
      } else {
        const fallbackTarget = _findBestAvailableTarget(atk, plr.field.monsters, bh);
        if (fallbackTarget !== -1) {
          const def = plr.field.monsters[fallbackTarget]!;
          EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${def.card.name} (fallback target)`);
          await deps.attack('opponent', plan.attackerZone, fallbackTarget);
          if (deps.checkWin()) return true;
        }
      }
    } else {
      const def = plr.field.monsters[plan.targetZone];
      if (def) {
        const defVal = def.combatValue();
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${def.card.name}(${def.position==='atk'?'ATK':'DEF'}:${defVal})`);
        await deps.attack('opponent', plan.attackerZone, plan.targetZone);
        if (deps.checkWin()) return true;
      } else {
        const plrHasMonsters = plr.field.monsters.some(m => m !== null);
        if (!plrHasMonsters) {
          EchoesOfSanguo.log('BATTLE', `${atk.card.name} → target destroyed, going direct!`);
          await deps.attackDirect('opponent', plan.attackerZone);
          if (deps.checkWin()) return true;
        } else {
          const altTarget = _findBestAvailableTarget(atk, plr.field.monsters, bh);
          if (altTarget !== -1) {
            const altDef = plr.field.monsters[altTarget]!;
            EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${altDef.card.name} (retarget)`);
            await deps.attack('opponent', plan.attackerZone, altTarget);
            if (deps.checkWin()) return true;
          }
        }
      }
    }
  }
  return false;
}

function _findBestAvailableTarget(atk: FieldCard, plrMonsters: Array<FieldCard | null>, behavior: Required<AIBehavior>): number {
  return aiBattlePickTarget(atk, plrMonsters, behavior);
}

export function aiBattlePickTarget(atk: FieldCard, plrMonsters: Array<FieldCard | null>, behavior: Required<AIBehavior>): number {
  const strategy = behavior.battleStrategy;

  if (strategy === 'aggressive') {
    let bestTarget = -1, bestScore = -Infinity;
    for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
      const def = plrMonsters[dz];
      if (!def || def.cantBeAttacked) continue;
      const defVal = aiCombatValue(def);
      if (atk.effectiveATK() > defVal) {
        // Prefer destroying effect monsters and high-ATK threats
        let score = defVal;
        if (def.card.effect) score += 500;
        if (score > bestScore) { bestScore = score; bestTarget = dz; }
      }
    }
    if (bestTarget !== -1) return bestTarget;
    // aggressive: attack even unfavorably — pick weakest target to minimize damage
    let weakest = -1, weakVal = Infinity;
    for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
      const def = plrMonsters[dz];
      if (!def || def.cantBeAttacked) continue;
      const defVal = aiCombatValue(def);
      if (defVal < weakVal) { weakVal = defVal; weakest = dz; }
    }
    return weakest;
  }

  let bestTarget = -1, bestScore = -Infinity;
  for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
    const def = plrMonsters[dz];
    if (!def || def.cantBeAttacked) continue;
    const defVal = aiCombatValue(def);
    if (atk.effectiveATK() > defVal) {
      let score = defVal;
      // Prioritize effect monsters — they're dangerous
      if (def.card.effect) score += 500;
      // Prioritize ATK-mode monsters (deal LP damage)
      if (def.position === 'atk') score += 200;
      // Bonus for indestructible check
      if (def.indestructible) score = -Infinity;
      if (score > bestScore) { bestScore = score; bestTarget = dz; }
    }
  }
  if (bestTarget !== -1) return bestTarget;

  if (strategy === 'conservative') return -1;

  // smart: also attack DEF-position targets safely, prefer face-down (reveal them)
  let safeTarget = -1, safeScore = -Infinity;
  for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
    const def = plrMonsters[dz];
    if (!def || def.cantBeAttacked || def.position !== 'def') continue;
    const defVal = aiEffectiveDEF(def);
    if (atk.effectiveATK() >= defVal) {
      let score = 1000 - defVal; // prefer weaker DEF (easier kill)
      // Face-down monsters are worth revealing
      if (def.faceDown && atk.effectiveATK() >= AI_SCORE.PROBE_ATK_THRESHOLD) score += AI_SCORE.LOW_LP_SURVIVAL;
      if (score > safeScore) { safeScore = score; safeTarget = dz; }
    }
  }
  return safeTarget;
}

function _findSmartFusionChain(
  hand: CardData[],
  minATK: number,
  plrMonsters: Array<FieldCard | null>,
  goal?: AIGoal,
  aiMonsters?: Array<FieldCard | null>,
): { indices: number[]; resultName: string; resultATK: number; fieldZone?: number } | null {
  const plrMaxATK = plrMonsters
    .filter((fc): fc is FieldCard => fc !== null)
    .reduce((max, fc) => Math.max(max, aiEffectiveATK(fc)), 0);

  let bestChain: number[] | null = null;
  let bestScore = -Infinity;
  let bestName = '';
  let bestATK = 0;
  let bestFieldZone: number | undefined;

  // Hand-only fusion chains
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const recipe = checkFusion(hand[i].id, hand[j].id);
      if (!recipe) continue;
      const resultCard = CARD_DB[recipe.result];
      if (!resultCard) continue;

      let chain = [i, j];
      let currentId = recipe.result;
      let currentATK = resultCard.atk ?? 0;

      const used = new Set(chain);
      let improved = true;
      while (improved) {
        improved = false;
        let bestExtIdx = -1;
        let bestExtATK = currentATK;
        let bestExtId = currentId;

        for (let k = 0; k < hand.length; k++) {
          if (used.has(k)) continue;
          const extRecipe = checkFusion(currentId, hand[k].id);
          if (!extRecipe) continue;
          const extCard = CARD_DB[extRecipe.result];
          if (!extCard) continue;
          const extATK = extCard.atk ?? 0;
          if (extATK > bestExtATK) {
            bestExtATK = extATK;
            bestExtIdx = k;
            bestExtId = extRecipe.result;
          }
        }

        if (bestExtIdx !== -1) {
          chain = [...chain, bestExtIdx];
          used.add(bestExtIdx);
          currentId = bestExtId;
          currentATK = bestExtATK;
          improved = true;
        }
      }

      let score = currentATK;
      if (currentATK > plrMaxATK && plrMaxATK > 0) score += AI_SCORE.EQUIP_UNLOCK_KILL;
      const fusionCard = CARD_DB[currentId];
      if (fusionCard?.effect) score += 500;
      score += classifyGoalAlignment('fusion', goal);
      const chainPenalty = goal?.id === 'fusion_otk' ? 50 : 100;
      score -= (chain.length - 2) * chainPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestChain = chain;
        bestName = CARD_DB[currentId]?.name ?? '?';
        bestATK = currentATK;
        bestFieldZone = undefined;
      }
    }
  }

  // Hand + field monster fusions
  if (aiMonsters) {
    for (let i = 0; i < hand.length; i++) {
      if (!isMonsterType(hand[i].type)) continue;
      for (let z = 0; z < aiMonsters.length; z++) {
        const fieldFC = aiMonsters[z];
        if (!fieldFC) continue;
        const recipe = checkFusion(hand[i].id, fieldFC.card.id);
        if (!recipe) continue;
        const resultCard = CARD_DB[recipe.result];
        if (!resultCard) continue;
        const resultATK = resultCard.atk ?? 0;
        const fieldATK = fieldFC.effectiveATK();
        if (resultATK <= fieldATK) continue;

        let score = resultATK;
        score -= fieldATK;
        if (resultATK > plrMaxATK && plrMaxATK > 0) score += AI_SCORE.EQUIP_UNLOCK_KILL;
        if (resultCard.effect) score += 500;
        score += classifyGoalAlignment('fusion', goal);

        if (score > bestScore) {
          bestScore = score;
          bestChain = [i];
          bestName = resultCard.name ?? '?';
          bestATK = resultATK;
          bestFieldZone = z;
        }
      }
    }
  }

  if (!bestChain || bestATK < minATK) return null;
  return { indices: bestChain, resultName: bestName, resultATK: bestATK, fieldZone: bestFieldZone };
}

function _findWeakestMonsterZone(monsters: Array<FieldCard | null>, replacementATK: number): number {
  let weakestZone = -1;
  let weakestATK = Infinity;

  for (let z = 0; z < monsters.length; z++) {
    const fc = monsters[z];
    if (!fc) continue;
    const atk = fc.effectiveATK();
    // Only replace if the new monster is significantly stronger (at least 500 ATK more)
    if (atk < weakestATK && replacementATK >= atk + 500) {
      weakestATK = atk;
      weakestZone = z;
    }
  }
  return weakestZone;
}

function _findStrongestMonsterZone(monsters: Array<FieldCard | null>): number {
  let bestZone = -1;
  let bestATK = -1;

  for (let z = 0; z < monsters.length; z++) {
    const fc = monsters[z];
    if (!fc || fc.faceDown) continue;
    if (fc.effectiveATK() > bestATK) {
      bestATK = fc.effectiveATK();
      bestZone = z;
    }
  }
  return bestZone;
}
