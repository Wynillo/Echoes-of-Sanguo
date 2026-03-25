// ============================================================
// ECHOES OF SANGUO — AI Turn Orchestrator
// ============================================================
//
// Coordinates the full AI turn sequence (draw → main → traps → battle).
// All strategic decisions are delegated to ai-behaviors.ts.
// Engine methods are called via the passed GameEngine instance.
//

import { EchoesOfSanguo } from './debug-logger.js';
import { CardType, Attribute, isMonsterType } from './types.js';
import type { AIBehavior } from './types.js';
import type { FieldCard } from './field.js';
// Use import type to avoid circular dependency (engine.ts → ai-orchestrator.ts → engine.ts)
import type { GameEngine } from './engine.js';
import { pickSummonCandidate, decideSummonPosition } from './ai-behaviors.js';

function _delay(ms: number){ return new Promise<void>(r => setTimeout(r, ms)); }

// ── Main AI turn entry point ─────────────────────────────────

export async function aiTurn(engine: GameEngine): Promise<void> {
  const ai = engine.state.opponent;

  EchoesOfSanguo.group(`=== AI Turn Round ${engine.state.turn} ===`);

  await aiDrawPhase(engine);
  await aiMainPhase(engine);
  await aiPlaceTraps(engine);

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

  // Try fusion first (max. 1 per turn)
  const bh = engine._aiBehavior;
  EchoesOfSanguo.log('AI', 'Main Phase – checking fusion...');
  if(!ai.normalSummonUsed && bh.fusionFirst){
    const opts = engine.getAllFusionOptions('opponent');
    if(opts.length > 0){
      const best = opts.sort((a,b) => (b.result.atk ?? 0) - (a.result.atk ?? 0))[0];
      const bestATKValue = best.result.atk ?? 0;
      const zone = ai.field.monsters.findIndex(z => z === null);
      if(zone !== -1 && bestATKValue >= bh.fusionMinATK){
        EchoesOfSanguo.log('AI', `Fusion: ${best.card1.name} + ${best.card2.name} → ${best.result.name} (Zone ${zone})`);
        await _delay(500);
        await engine.performFusion('opponent', best.i1, best.i2);
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
          await _delay(300); await engine.activateSpell('opponent', i); activated = true;
        } else {
          EchoesOfSanguo.log('SPELL', `${card.name}: Condition not met (plr.lp=${plr.lp}, ai.lp=${ai.lp})`);
        }
      } else if(card.spellType === 'targeted'){
        if(card.target === 'ownDarkMonster'){
          const t = ai.field.monsters.find(m => m && m.card.attribute===Attribute.Dark);
          if(t){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${t.card.name}`);
            await _delay(300); await engine.activateSpell('opponent', i, t); activated = true;
          } else {
            EchoesOfSanguo.log('SPELL', `${card.name}: No DARK monster on the field.`);
          }
        } else if(card.target === 'ownMonster'){
          const t = ai.field.monsters.find(m => m !== null);
          if(t){
            EchoesOfSanguo.log('SPELL', `Activating ${card.name} → target: ${t.card.name}`);
            await _delay(300); await engine.activateSpell('opponent', i, t); activated = true;
          }
        }
      } else if(card.spellType === 'fromGrave'){
        const gm = ai.graveyard.find(c => isMonsterType(c.type));
        if(gm && ai.field.monsters.some(z=>z===null)){
          EchoesOfSanguo.log('SPELL', `Activating ${card.name} → graveyard: ${gm.name}`);
          await _delay(300); await engine.activateSpell('opponent', i, gm); activated = true;
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

// ── Battle Phase ─────────────────────────────────────────────

async function aiBattlePhase(engine: GameEngine): Promise<boolean> {
  const ai  = engine.state.opponent;
  const plr = engine.state.player;

  engine.state.phase = 'battle';
  engine.addLog('--- Opponent Battle Phase ---');
  EchoesOfSanguo.log('PHASE', `Battle Phase – AI field: [${ai.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.effectiveATK()})`).join(', ')}]`);
  EchoesOfSanguo.log('PHASE', `Player field: [${plr.field.monsters.filter((fc): fc is FieldCard => fc !== null).map(fc=>`${fc.card.name}(${fc.position==='atk'?fc.effectiveATK():fc.effectiveDEF()})`).join(', ')}]`);
  engine.ui.render(engine.state);
  await _delay(500);

  const aiMonsters  = ai.field.monsters;
  const plrMonsters = plr.field.monsters;

  for(let az = 0; az < 5; az++){
    const atk = aiMonsters[az];
    if(!atk){ continue; }
    if(atk.position !== 'atk'){ EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} is in DEF mode – skipping`); continue; }
    if(atk.hasAttacked){       EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} has already attacked`);      continue; }
    if(atk.summonedThisTurn){  EchoesOfSanguo.log('AI', `Zone ${az}: ${atk.card.name} was just summoned – skipping`); continue; }
    await _delay(500);

    // Recalculate each iteration in case earlier attacks destroyed monsters
    const plrHasMonsters = plrMonsters.some(m => m !== null);

    // canDirectAttack monsters bypass the normal "player has monsters" check
    if(!plrHasMonsters || atk.canDirectAttack){
      EchoesOfSanguo.log('BATTLE', `${atk.card.name} → Direct attack!${atk.canDirectAttack ? ' (canDirectAttack)' : ''}`);
      await engine.attackDirect('opponent', az);
      if(engine.checkWin()) return true;
    } else {
      const battleTarget = aiBattlePickTarget(atk, plrMonsters, engine._aiBehavior);
      if(battleTarget !== -1){
        const def = plrMonsters[battleTarget]!;
        const defVal = def.position === 'atk' ? def.effectiveATK() : def.effectiveDEF();
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}(${atk.effectiveATK()}) → attacks ${def.card.name}(${defVal})`);
        await engine.attack('opponent', az, battleTarget);
        if(engine.checkWin()) return true;
      } else {
        EchoesOfSanguo.log('BATTLE', `${atk.card.name}: no favorable target – skipping`);
      }
    }
  }
  return false;
}

// ── Battle Target Picking ────────────────────────────────────

/** Pick the best attack target based on the active battle strategy. Returns zone index or -1. */
export function aiBattlePickTarget(atk: FieldCard, plrMonsters: Array<FieldCard | null>, behavior: Required<AIBehavior>): number {
  const strategy = behavior.battleStrategy;

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
