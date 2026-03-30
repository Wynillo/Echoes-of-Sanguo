import { EchoesOfSanguo } from './debug-logger.js';
import { GAME_RULES } from './rules.js';
import { CardType, Attribute, isMonsterType } from './types.js';
import type { AIBehavior, AIGoal, BoardSnapshot, CardData } from './types.js';
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
  pickBestGraveyardMonster,
  pickSpellBuffTarget,
  aiCombatValue,
  aiEffectiveATK,
  aiEffectiveDEF,
  type AttackPlan,
} from './ai-behaviors.js';

interface TurnContext {
  snap:       BoardSnapshot;
  activeGoal: AIGoal | undefined;
  isWinning:  boolean;
}

function _delay(ms: number){ return new Promise<void>(r => setTimeout(r, ms)); }

function _isPartOfUnfulfilledRecipe(cardId: string, hand: CardData[]): boolean {
  return FUSION_RECIPES.some(recipe => {
    const [m1, m2] = recipe.materials;
    if (m1 !== cardId && m2 !== cardId) return false;
    const partnerNeeded = m1 === cardId ? m2 : m1;
    return !hand.some(c => c.id === partnerNeeded);
  });
}

function _peekDrawForFusion(engine: GameEngine, maxPeek: number): void {
  const ai = engine.state.opponent;
  const peeked = ai.deck.slice(0, maxPeek);
  for (let pi = 0; pi < peeked.length; pi++) {
    const peekedCard = peeked[pi];
    for (const handCard of ai.hand) {
      const recipe = checkFusion(peekedCard.id, handCard.id);
      if (recipe) {
        const result = CARD_DB[recipe.result];
        if (result && (result.atk ?? 0) > (handCard.atk ?? 0)) {
          engine.drawCard('opponent', pi + 1);
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

export async function aiTurn(engine: GameEngine): Promise<void> {
  const ai = engine.state.opponent;

  EchoesOfSanguo.group(`=== AI Turn Round ${engine.state.turn} ===`);

  await aiDrawPhase(engine);
  await aiMainPhase(engine);
  await aiPlaceTraps(engine);
  await aiEquipCards(engine);

  // First turn: skip battle phase entirely (FM-style rule)
  if (engine.state.firstTurnNoAttack) {
    engine.state.firstTurnNoAttack = false;
    EchoesOfSanguo.log('PHASE', 'First turn – skipping AI battle phase.');
  } else {
    if (await aiBattlePhase(engine)) return;
  }

  EchoesOfSanguo.log('PHASE', 'End Phase – AI cleanup.');
  engine.state.phase = 'end';
  engine.ui.render(engine.state);
  await _delay(300);

  engine._resetMonsterFlags('opponent');
  while(ai.hand.length > 8) ai.hand.shift();

  engine.state.activePlayer = 'player';
  engine.state.phase = 'main';
  engine.state.turn++;
  engine.addLog(`=== Round ${engine.state.turn} - Your turn! ===`);

  EchoesOfSanguo.groupEnd();

  engine.refillHand('player');
  engine.ui.render(engine.state);
  if(engine.checkWin()) return;
}

async function aiDrawPhase(engine: GameEngine): Promise<void> {
  const ai = engine.state.opponent;
  const bh = engine._aiBehavior;
  engine.state.phase = 'draw';
  engine.ui.render(engine.state);
  await _delay(300);
  engine.refillHand('opponent');
  engine.addLog('Opponent draws cards.');
  if (bh.peekDeckCards && bh.peekDeckCards > 0) {
    _peekDrawForFusion(engine, bh.peekDeckCards);
    engine.ui.render(engine.state);
  }
  EchoesOfSanguo.log('PHASE', 'Draw Phase – Hand:', ai.hand.map(c => c.name));
  engine.ui.render(engine.state);
  await _delay(400);
}

async function aiMainPhase(engine: GameEngine): Promise<void> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;

  engine.state.phase = 'main';
  engine.addLog('--- Opponent Main Phase ---');
  engine.ui.render(engine.state);
  await _delay(400);

  const bh = engine._aiBehavior;
  const snap = snapshotBoard(ai, plr);
  const ctx: TurnContext = {
    snap,
    activeGoal: evaluateTurnGoal(engine.state.turn, bh.goal),
    isWinning:  computeBoardThreat(snap) > 0,
  };

  await _activateFieldSpells(engine);

  // Try fusion chain (FM-style: greedy 2-card + extend, including hand+field fusions)
  EchoesOfSanguo.log('AI', 'Main Phase – checking fusion chain...');
  if(!ai.normalSummonUsed && bh.fusionFirst){
    const bestChain = _findSmartFusionChain(ai.hand, bh.fusionMinATK, plr.field.monsters, ctx.activeGoal, ai.field.monsters);
    if(bestChain && bestChain.fieldZone !== undefined){
      const handCard = ai.hand[bestChain.indices[0]];
      EchoesOfSanguo.log('AI', `Field fusion: ${handCard.name} + field zone ${bestChain.fieldZone} → ${bestChain.resultName} (ATK:${bestChain.resultATK})`);
      await _delay(500);
      await engine.fuseHandWithField('opponent', bestChain.indices[0], bestChain.fieldZone);
    } else if(bestChain){
      const zone = ai.field.monsters.findIndex(z => z === null);
      if(zone !== -1){
        const names = bestChain.indices.map(i => ai.hand[i].name);
        EchoesOfSanguo.log('AI', `Fusion chain: ${names.join(' + ')} → ${bestChain.resultName} (ATK:${bestChain.resultATK}, Zone ${zone})`);
        await _delay(500);
        await engine.performFusionChain('opponent', bestChain.indices);
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
          playerLP: plr.lp,
          aiLP: ai.lp,
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
          engine._removeEquipmentForMonster('opponent', replaceZone);
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
        await _delay(350);
        if (summonPos === 'def') {
          await engine.setMonster('opponent', bestIdx, zone);
        } else {
          await engine.summonMonster('opponent', bestIdx, zone, summonPos);
        }
        const summonedFC = ai.field.monsters[zone];
        if(summonedFC){
          const trapResult = await engine._promptPlayerTraps('onOpponentSummon', summonedFC);
          if(trapResult && trapResult.destroySummoned){
            EchoesOfSanguo.log('TRAP', `Trap hole destroyed ${summonedFC.card.name}`);
            ai.graveyard.push(summonedFC.card);
            ai.field.monsters[zone] = null;
            engine.ui.render(engine.state);
          }
        }
      }
    }
  }

  // Activate spells — smart ordering: buffs and damage spells
  await _activateSpells(engine, ctx);
}

async function _activateFieldSpells(engine: GameEngine): Promise<void> {
  const ai = engine.state.opponent;
  // Activate field spells early so summons benefit from buffs
  for (let i = 0; i < ai.hand.length; i++) {
    const card = ai.hand[i];
    if (card.type === CardType.Spell && card.spellType === 'field' && !ai.field.fieldSpell) {
      EchoesOfSanguo.log('SPELL', `Activating ${card.name} (field spell – pre-summon)`);
      await _delay(300);
      await engine.activateFieldSpell('opponent', i);
      break; // Only one field spell
    }
  }
}

async function _activateSpells(engine: GameEngine, ctx: TurnContext): Promise<void> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;
  const bh  = engine._aiBehavior;

  EchoesOfSanguo.log('AI', 'Activating spells (smart ordering)...');

  // stall_drain: prioritize heal spells by putting them first in evaluation order
  function _spellSortKey(card: CardData): number {
    if (ctx.activeGoal?.id === 'stall_drain') {
      const actions = card.effect?.actions ?? [];
      if (actions.some(a => a.type === 'gainLP')) return -1; // heal first
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

      if(card.spellType === 'normal'){
        const actions = card.effect?.actions ?? [];
        const dealsDamage = actions.some(a => a.type === 'dealDamage');
        const heals = actions.some(a => a.type === 'gainLP');
        const buffs = actions.some(a => {
          const t = a.type as string;
          return t === 'buffAtkAll' || t === 'buffAtkRace' || t === 'buffAtk' || t === 'buffField';
        });
        const destroys = actions.some(a => {
          const t = a.type as string;
          return t === 'destroyMonster' || t === 'destroyAll' || t === 'destroySpellTrap';
        });

        let should = false;
        if (dealsDamage) {
          // Always use damage spells — chip damage adds up
          should = true;
        } else if (heals) {
          // Heal when below 60% LP or losing
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
          await _delay(300); await engine.activateSpell('opponent', i); activated = true;
        }
      } else if(card.spellType === 'targeted'){
        if(card.target === 'ownDarkMonster'){
          const t = ai.field.monsters.find(m => m && m.card.attribute===Attribute.Dark);
          if(t){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${t.card.name}`);
            await _delay(300); await engine.activateSpell('opponent', i, t); activated = true;
          }
        } else if(card.target === 'ownMonster'){
          const target = pickSpellBuffTarget(ai.field.monsters, plr.field.monsters);
          if(target){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${target.card.name} (smart pick)`);
            await _delay(300); await engine.activateSpell('opponent', i, target); activated = true;
          }
        }
      } else if(card.spellType === 'field'){
        if(!ai.field.fieldSpell){
          EchoesOfSanguo.log('SPELL', `Activating ${card.name} (field spell)`);
          await _delay(300); await engine.activateFieldSpell('opponent', i); activated = true;
        }
      } else if(card.spellType === 'fromGrave'){
        const bestGM = pickBestGraveyardMonster(ai.graveyard, plr.field.monsters);
        if(bestGM && ai.field.monsters.some(z => z === null)){
          EchoesOfSanguo.log('SPELL', `Activating ${card.name} → reviving ${bestGM.name} (smart pick, ATK:${bestGM.atk})`);
          await _delay(300); await engine.activateSpell('opponent', i, bestGM); activated = true;
        }
      }
      if(activated){ spellActivated = true; break; }
    }
  }
}

async function aiPlaceTraps(engine: GameEngine): Promise<void> {
  const ai  = engine.state.opponent;
  const bh  = engine._aiBehavior;
  const plr = engine.state.player;
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
    await _delay(300);
    engine.setSpellTrap('opponent', handIdxAfterRemovals, zone);
    placed++;
  }
}

async function aiEquipCards(engine: GameEngine): Promise<void> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;
  const bh  = engine._aiBehavior;
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
          await _delay(300);
          await engine.equipCard('opponent', i, 'opponent', targetZone);
          equipped = true; break;
        }
      } else if (isNegative) {
        const targetZone = pickDebuffTarget(plr.field.monsters, atkB, card);

        if (targetZone !== -1) {
          const fc = plr.field.monsters[targetZone]!;
          EchoesOfSanguo.log('EQUIP', `Debuffing ${fc.card.name} with ${card.name} (${atkB}ATK/${defB}DEF) at zone ${targetZone}`);
          await _delay(300);
          await engine.equipCard('opponent', i, 'player', targetZone);
          equipped = true; break;
        }
      }
    }
  }
}

async function aiBattlePhase(engine: GameEngine): Promise<boolean> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;
  const bh  = engine._aiBehavior;

  engine.state.phase = 'battle';
  engine.addLog('--- Opponent Battle Phase ---');
  EchoesOfSanguo.log('PHASE', `Battle Phase – AI field: [${ai.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(ATK:${fc.effectiveATK()})`).join(', ')}]`);
  EchoesOfSanguo.log('PHASE', `Player field: [${plr.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.position==='atk'?'ATK:'+fc.effectiveATK():'DEF:'+fc.effectiveDEF()})`).join(', ')}] LP:${plr.lp}`);
  engine.ui.render(engine.state);
  await _delay(500);

  // stall_drain: skip battle entirely unless lethal is available
  const activeGoal = evaluateTurnGoal(engine.state.turn, bh.goal);
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

  // Use the smart attack planner to determine optimal attack sequence
  const attackPlan = planAttacks(ai.field.monsters, plr.field.monsters, plr.lp, bh);

  if (attackPlan.length > 0) {
    EchoesOfSanguo.log('AI', `Attack plan: ${attackPlan.length} attacks planned`);
  }

  for (const plan of attackPlan) {
    const atk = ai.field.monsters[plan.attackerZone];
    if (!atk) continue; // may have been destroyed by a trap
    if (atk.hasAttacked) continue;
    if (atk.position !== 'atk') continue;

    await _delay(500);

    if (plan.targetZone === -1) {
      const plrHasMonsters = plr.field.monsters.some(m => m !== null);
      if (!plrHasMonsters || atk.canDirectAttack) {
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → Direct attack!${atk.canDirectAttack ? ' (canDirectAttack)' : ''}`);
        await engine.attackDirect('opponent', plan.attackerZone);
        if (engine.checkWin()) return true;
      } else {
        // plan said direct but player now has monsters — find a target instead
        const fallbackTarget = _findBestAvailableTarget(atk, plr.field.monsters, engine._aiBehavior);
        if (fallbackTarget !== -1) {
          const def = plr.field.monsters[fallbackTarget]!;
          EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${def.card.name} (fallback target)`);
          await engine.attack('opponent', plan.attackerZone, fallbackTarget);
          if (engine.checkWin()) return true;
        }
      }
    } else {
      const def = plr.field.monsters[plan.targetZone];
      if (def) {
        const defVal = def.combatValue();
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${def.card.name}(${def.position==='atk'?'ATK':'DEF'}:${defVal})`);
        await engine.attack('opponent', plan.attackerZone, plan.targetZone);
        if (engine.checkWin()) return true;
      } else {
        // target already destroyed — go direct if possible
        const plrHasMonsters = plr.field.monsters.some(m => m !== null);
        if (!plrHasMonsters) {
          EchoesOfSanguo.log('BATTLE', `${atk.card.name} → target destroyed, going direct!`);
          await engine.attackDirect('opponent', plan.attackerZone);
          if (engine.checkWin()) return true;
        } else {
          const altTarget = _findBestAvailableTarget(atk, plr.field.monsters, engine._aiBehavior);
          if (altTarget !== -1) {
            const altDef = plr.field.monsters[altTarget]!;
            EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${altDef.card.name} (retarget)`);
            await engine.attack('opponent', plan.attackerZone, altTarget);
            if (engine.checkWin()) return true;
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
