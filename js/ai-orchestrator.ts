// ============================================================
// ECHOES OF SANGUO — AI Turn Orchestrator
// ============================================================
//
// Coordinates the full AI turn sequence (draw → main → traps → battle).
// All strategic decisions are delegated to ai-behaviors.ts.
// Engine methods are called via the passed GameEngine instance.
//

import { EchoesOfSanguo } from './debug-logger.js';
import { GAME_RULES } from './rules.js';
import { CardType, Attribute, isMonsterType } from './types.js';
import type { AIBehavior, CardData } from './types.js';
import type { FieldCard } from './field.js';
import { checkFusion, CARD_DB } from './cards.js';
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
  type AttackPlan,
} from './ai-behaviors.js';

function _delay(ms: number){ return new Promise<void>(r => setTimeout(r, ms)); }

// ── Main AI turn entry point ─────────────────────────────────

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

  // End Phase
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

// ── Draw Phase ───────────────────────────────────────────────

async function aiDrawPhase(engine: GameEngine): Promise<void> {
  const ai = engine.state.opponent;
  engine.state.phase = 'draw';
  engine.ui.render(engine.state);
  await _delay(300);
  engine.refillHand('opponent');
  engine.addLog('Opponent draws cards.');
  EchoesOfSanguo.log('PHASE', 'Draw Phase – Hand:', ai.hand.map(c => c.name));
  engine.ui.render(engine.state);
  await _delay(400);
}

// ── Main Phase ───────────────────────────────────────────────

async function aiMainPhase(engine: GameEngine): Promise<void> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;

  engine.state.phase = 'main';
  engine.addLog('--- Opponent Main Phase ---');
  engine.ui.render(engine.state);
  await _delay(400);

  const bh = engine._aiBehavior;

  // Activate field spell first (benefits subsequent summons)
  await _activateFieldSpells(engine);

  // Try fusion chain (FM-style: greedy 2-card + extend)
  EchoesOfSanguo.log('AI', 'Main Phase – checking fusion chain...');
  if(!ai.normalSummonUsed && bh.fusionFirst){
    const bestChain = _findSmartFusionChain(ai.hand, bh.fusionMinATK, plr.field.monsters);
    const zone = ai.field.monsters.findIndex(z => z === null);
    if(bestChain && zone !== -1){
      const names = bestChain.indices.map(i => ai.hand[i].name);
      EchoesOfSanguo.log('AI', `Fusion chain: ${names.join(' + ')} → ${bestChain.resultName} (ATK:${bestChain.resultATK}, Zone ${zone})`);
      await _delay(500);
      await engine.performFusionChain('opponent', bestChain.indices);
    } else {
      EchoesOfSanguo.log('AI', 'No fusion chain available.');
    }
  }

  // Summon one monster from hand (max. 1 per turn)
  EchoesOfSanguo.log('AI', 'Considering summon:', ai.hand.filter(c => c.type === CardType.Monster).map(c => `${c.name}(${c.atk})`));
  if(!ai.normalSummonUsed){
    // Use smart summoning for 'smart' behavior, basic for others
    const bestIdx = (bh.battleStrategy === 'smart' || bh.positionStrategy === 'smart')
      ? pickSmartSummonCandidate(ai.hand, {
          aiField: ai.field.monsters,
          playerField: plr.field.monsters,
          playerLP: plr.lp,
          aiLP: ai.lp,
        })
      : pickSummonCandidate(ai.hand, bh.summonPriority);

    if(bestIdx !== -1){
      const card = ai.hand[bestIdx];
      const cardATK = card.atk ?? 0;
      const cardDEF = card.def ?? 0;
      let zone = ai.field.monsters.findIndex(z => z === null);

      // Smart: if all zones full, consider replacing weakest monster with a stronger one
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
          .reduce((max, fc) => Math.max(max, fc!.effectiveATK()), 0);
        const playerHasMonsters = plr.field.monsters.some(Boolean);
        const summonPos = decideSummonPosition(cardATK, cardDEF, plrMaxATK, playerHasMonsters, bh.positionStrategy);
        EchoesOfSanguo.log('SUMMON', `Summoning ${card.name} (ATK:${cardATK}/DEF:${cardDEF}) to zone ${zone} as ${summonPos.toUpperCase()}`);
        await _delay(350);
        await engine.summonMonster('opponent', bestIdx, zone, summonPos);
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
  await _activateSpells(engine);
}

// ── Smart Spell Activation ──────────────────────────────────

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

async function _activateSpells(engine: GameEngine): Promise<void> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;
  const bh  = engine._aiBehavior;

  EchoesOfSanguo.log('AI', 'Activating spells (smart ordering)...');
  let spellActivated = true;
  while(spellActivated){
    spellActivated = false;
    for(let i = 0; i < ai.hand.length; i++){
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
          should = ai.lp < 5000 || ai.lp < plr.lp;
        } else if (buffs) {
          // Use buffs when we have monsters on the field
          should = ai.field.monsters.some(fc => fc !== null);
        } else if (destroys) {
          // Use destruction when opponent has monsters
          should = plr.field.monsters.some(fc => fc !== null);
        } else {
          should = true; // Generic spells: always use
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
          // Smart: pick the best target, not just the first one
          const target = pickSpellBuffTarget(ai.field.monsters, plr.field.monsters);
          if(target){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${target.card.name} (smart pick)`);
            await _delay(300); await engine.activateSpell('opponent', i, target); activated = true;
          }
        }
      } else if(card.spellType === 'field'){
        // Already handled in _activateFieldSpells, but handle if we got a new one
        if(!ai.field.fieldSpell){
          EchoesOfSanguo.log('SPELL', `Activating ${card.name} (field spell)`);
          await _delay(300); await engine.activateFieldSpell('opponent', i); activated = true;
        }
      } else if(card.spellType === 'fromGrave'){
        // Smart: pick the best monster from graveyard, not just any
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

// ── Trap Placement ───────────────────────────────────────────

async function aiPlaceTraps(engine: GameEngine): Promise<void> {
  const ai = engine.state.opponent;
  EchoesOfSanguo.log('AI', 'Placing traps...');
  const hand = ai.hand;
  for(let i = hand.length - 1; i >= 0; i--){
    const card = hand[i];
    if(card.type !== CardType.Trap) continue;
    const zone = ai.field.spellTraps.findIndex(z => z === null);
    if(zone === -1) break;
    EchoesOfSanguo.log('TRAP', `Placing ${card.name} face-down in zone ${zone}`);
    await _delay(300);
    engine.setSpellTrap('opponent', i, zone);
  }
}

// ── Equipment (Smart) ───────────────────────────────────────

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
        // Smart: equip to the monster that benefits most (respects equipRequirement)
        const targetZone = pickEquipTarget(ai.field.monsters, plr.field.monsters, atkB, defB, card);

        if (targetZone !== -1) {
          const fc = ai.field.monsters[targetZone]!;
          EchoesOfSanguo.log('EQUIP', `Equipping ${card.name} (+${atkB}ATK/+${defB}DEF) to ${fc.card.name} (zone ${targetZone})`);
          await _delay(300);
          await engine.equipCard('opponent', i, 'opponent', targetZone);
          equipped = true; break;
        }
      } else if (isNegative) {
        // Smart: debuff the biggest threat (respects equipRequirement)
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

// ── Battle Phase (Smart) ────────────────────────────────────

async function aiBattlePhase(engine: GameEngine): Promise<boolean> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;

  engine.state.phase = 'battle';
  engine.addLog('--- Opponent Battle Phase ---');
  EchoesOfSanguo.log('PHASE', `Battle Phase – AI field: [${ai.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(ATK:${fc.effectiveATK()})`).join(', ')}]`);
  EchoesOfSanguo.log('PHASE', `Player field: [${plr.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.position==='atk'?'ATK:'+fc.effectiveATK():'DEF:'+fc.effectiveDEF()})`).join(', ')}] LP:${plr.lp}`);
  engine.ui.render(engine.state);
  await _delay(500);

  // Use the smart attack planner to determine optimal attack sequence
  const attackPlan = planAttacks(ai.field.monsters, plr.field.monsters, plr.lp, engine._aiBehavior);

  if (attackPlan.length > 0) {
    EchoesOfSanguo.log('AI', `Attack plan: ${attackPlan.length} attacks planned`);
  }

  for (const plan of attackPlan) {
    const atk = ai.field.monsters[plan.attackerZone];
    if (!atk) continue; // Monster may have been destroyed by a trap
    if (atk.hasAttacked) continue;
    if (atk.position !== 'atk') continue;

    await _delay(500);

    if (plan.targetZone === -1) {
      // Direct attack
      const plrHasMonsters = plr.field.monsters.some(m => m !== null);
      if (!plrHasMonsters || atk.canDirectAttack) {
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → Direct attack!${atk.canDirectAttack ? ' (canDirectAttack)' : ''}`);
        await engine.attackDirect('opponent', plan.attackerZone);
        if (engine.checkWin()) return true;
      } else {
        // Plan said direct but player now has monsters — find a target instead
        const fallbackTarget = _findBestAvailableTarget(atk, plr.field.monsters, engine._aiBehavior);
        if (fallbackTarget !== -1) {
          const def = plr.field.monsters[fallbackTarget]!;
          EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${def.card.name} (fallback target)`);
          await engine.attack('opponent', plan.attackerZone, fallbackTarget);
          if (engine.checkWin()) return true;
        }
      }
    } else {
      // Targeted attack
      const def = plr.field.monsters[plan.targetZone];
      if (def) {
        const defVal = def.combatValue();
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → ${def.card.name}(${def.position==='atk'?'ATK':'DEF'}:${defVal})`);
        await engine.attack('opponent', plan.attackerZone, plan.targetZone);
        if (engine.checkWin()) return true;
      } else {
        // Target already destroyed — go direct if possible
        const plrHasMonsters = plr.field.monsters.some(m => m !== null);
        if (!plrHasMonsters) {
          EchoesOfSanguo.log('BATTLE', `${atk.card.name} → target destroyed, going direct!`);
          await engine.attackDirect('opponent', plan.attackerZone);
          if (engine.checkWin()) return true;
        } else {
          // Find another valid target
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

// ── Battle Target Picking (kept for fallback/retarget) ──────

/** Pick the best available attack target. Returns zone index or -1. */
function _findBestAvailableTarget(atk: FieldCard, plrMonsters: Array<FieldCard | null>, behavior: Required<AIBehavior>): number {
  return aiBattlePickTarget(atk, plrMonsters, behavior);
}

/** Pick the best attack target based on the active battle strategy. Returns zone index or -1. */
export function aiBattlePickTarget(atk: FieldCard, plrMonsters: Array<FieldCard | null>, behavior: Required<AIBehavior>): number {
  const strategy = behavior.battleStrategy;

  if (strategy === 'aggressive') {
    // Attack anything — prefer highest-value target we can destroy, then any target at all
    let bestTarget = -1, bestScore = -Infinity;
    for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
      const def = plrMonsters[dz];
      if (!def || def.cantBeAttacked) continue;
      const defVal = def.combatValue();
      if (atk.effectiveATK() > defVal) {
        // Prefer destroying effect monsters and high-ATK threats
        let score = defVal;
        if (def.card.effect) score += 500;
        if (score > bestScore) { bestScore = score; bestTarget = dz; }
      }
    }
    if (bestTarget !== -1) return bestTarget;
    // Aggressive: attack even unfavorably — pick weakest target to minimize damage
    let weakest = -1, weakVal = Infinity;
    for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
      const def = plrMonsters[dz];
      if (!def || def.cantBeAttacked) continue;
      const defVal = def.combatValue();
      if (defVal < weakVal) { weakVal = defVal; weakest = dz; }
    }
    return weakest;
  }

  // 'smart' and 'conservative': destroy strongest possible, considering threat level
  let bestTarget = -1, bestScore = -Infinity;
  for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
    const def = plrMonsters[dz];
    if (!def || def.cantBeAttacked) continue;
    const defVal = def.combatValue();
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

  // 'smart': also attack DEF-position targets safely, prefer face-down (reveal them)
  let safeTarget = -1, safeScore = -Infinity;
  for (let dz = 0; dz < GAME_RULES.fieldZones; dz++) {
    const def = plrMonsters[dz];
    if (!def || def.cantBeAttacked || def.position !== 'def') continue;
    const defVal = def.effectiveDEF();
    if (atk.effectiveATK() >= defVal) {
      let score = 1000 - defVal; // prefer weaker DEF (easier kill)
      // Face-down monsters are worth revealing
      if (def.faceDown && atk.effectiveATK() >= 1500) score += 300;
      if (score > safeScore) { safeScore = score; safeTarget = dz; }
    }
  }
  return safeTarget;
}

// ── AI Fusion Chain (board-aware) ───────────────────────────

function _findSmartFusionChain(
  hand: CardData[],
  minATK: number,
  plrMonsters: Array<FieldCard | null>,
): { indices: number[]; resultName: string; resultATK: number } | null {
  // Calculate player's strongest monster to know what we need to beat
  const plrMaxATK = plrMonsters
    .filter((fc): fc is FieldCard => fc !== null)
    .reduce((max, fc) => Math.max(max, fc.effectiveATK()), 0);

  let bestChain: number[] | null = null;
  let bestScore = -Infinity;
  let bestName = '';
  let bestATK = 0;

  // Try all 2-card starting pairs
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const recipe = checkFusion(hand[i].id, hand[j].id);
      if (!recipe) continue;
      const resultCard = CARD_DB[recipe.result];
      if (!resultCard) continue;

      let chain = [i, j];
      let currentId = recipe.result;
      let currentATK = resultCard.atk ?? 0;

      // Greedily try to extend with remaining hand cards
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

      // Score the fusion result considering board state
      let score = currentATK;

      // Big bonus if the fusion can beat the player's strongest monster
      if (currentATK > plrMaxATK && plrMaxATK > 0) score += 2000;

      // Bonus for effect on the fusion result
      const fusionCard = CARD_DB[currentId];
      if (fusionCard?.effect) score += 500;

      // Slight penalty for using too many cards (card advantage)
      score -= (chain.length - 2) * 100;

      if (score > bestScore) {
        bestScore = score;
        bestChain = chain;
        bestName = CARD_DB[currentId]?.name ?? '?';
        bestATK = currentATK;
      }
    }
  }

  if (!bestChain || bestATK < minATK) return null;
  return { indices: bestChain, resultName: bestName, resultATK: bestATK };
}

// ── Helper: Find weakest monster zone for replacement ───────

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

// ── Helper: Find strongest monster zone ─────────────────────

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
