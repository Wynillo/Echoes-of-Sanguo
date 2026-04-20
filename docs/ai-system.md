# AI System — Echoes of Sanguo

**Date**: 2026-04-16  
**Group**: G3  
**Dependencies**: G1 (Engine-Core) ✅, G4 (Cards & Field) ✅

---

## Overview

The AI system uses **configurable behavior profiles** for decision-making. The AI analyzes the board state, evaluates options, and executes actions in a fixed sequence.

**Core Components**:
- `AI_BEHAVIOR_REGISTRY` — 5 profiles (default, aggressive, defensive, smart, cheating)
- `aiTurn()` — Main sequence (Draw → Main → Battle → End)
- `ai-threat.ts` — Board snapshot, threat scoring, goal alignment
- Scoring constants for target selection

---

## Architecture

### Layers

```
┌─────────────────────────────────────┐
│    ai-orchestrator.ts               │
│    - aiTurn() main sequence         │
│    - Phase execution                │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    ai-behaviors.ts                  │
│    - Behavior profiles              │
│    - Scoring functions              │
│    - Target selection               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    ai-threat.ts                     │
│    - BoardSnapshot                  │
│    - ThreatScoring                  │
│    - Goal-Alignment                 │
└─────────────────────────────────────┘
```

---

## Behavior Profiles

### 5 AI Profiles

| Profile | Strategy | Summon | Position | Battle | Special |
|---------|---------|--------|----------|--------|---------|
| **default** | Balanced | highestATK | smart | smart | Standard behavior |
| **aggressive** | Swarm Aggro | highestATK | always ATK | always attack | Fusion first, no caution |
| **defensive** | Stall/Drain | highestDEF | always DEF | conservative | Fusion only at 2000+ ATK |
| **smart** | Control | effectFirst | smart | smart | Holds fusion pieces, evaluates board |
| **cheating** | OTK Fusion | highestATK | always ATK | always attack | peekDeck(5), knowsPlayerHand |

### Profiles in Detail

**Default**:
```typescript
{
  fusionFirst: true,
  summonPriority: 'highestATK',
  positionStrategy: 'smart',
  battleStrategy: 'smart'
}
```

**Aggressive**:
```typescript
{
  fusionFirst: true,
  fusionMinATK: 0,  // Fuse anytime
  positionStrategy: 'aggressive',  // Always ATK position
  battleStrategy: 'aggressive',    // Always attack
  goal: { id: 'swarm_aggro', alignmentBonus: 800 }
}
```

**Defensive**:
```typescript
{
  fusionMinATK: 2000,  // Only strong fusions
  positionStrategy: 'defensive',  // Always DEF position
  battleStrategy: 'conservative', // Only safe attacks
  goal: { id: 'stall_drain', alignmentBonus: 700 }
}
```

**Smart**:
```typescript
{
  summonPriority: 'effectFirst',  // Prioritize effect monsters
  positionStrategy: 'smart',      // DEF if monster weaker than opponent maxATK
  battleStrategy: 'smart',        // Evaluate board
  goal: { id: 'control', alignmentBonus: 600 },
  holdFusionPiece: true  // Holds fusion material if advantageous
}
```

**Cheating**:
```typescript
{
  knowsPlayerHand: true,      // Sees player hand
  peekDeckCards: 5,           // Peek top 5 cards of deck
  fusionFirst: true,
  battleStrategy: 'aggressive'
}
```

---

## AI Turn Sequence

### Complete Flow

```
1. Draw Phase
   ├─ refillHand() (to 8 cards)
   └─ [Cheating] peekDeckCards(5) for fusion pieces

2. Main Phase
   ├─ _findSmartFusionChain() → performFusionChain()
   ├─ pickSummonCandidate() → summonMonster()
   │  └─ Player trap check (onOpponentSummon)
   └─ _activateSpells() (in priority order)

3. Trap Phase
   └─ Set traps face-down (prioritized: onAttack > onOpponentSpell)

4. Equip Phase
   ├─ pickEquipTarget() → equip positive buffs
   └─ pickDebuffTarget() → equip debuffs on opponent

5. Battle Phase
   ├─ findLethal() → If lethal, execute
   ├─ planAttacks() → Create attack plan
   └─ Execute attacks (attack / attackDirect)

6. End Phase
   ├─ resetMonsterFlags()
   ├─ returnTempStolenMonsters()
   ├─ returnSpiritMonsters()
   └─ tickTurnCounters()
```

---

## Decision-Making

### Summon Target Selection

**Simple Priority **(`pickSummonCandidate`)
```typescript
switch (behavior.summonPriority) {
  case 'highestATK': return hand.reduce(maxATK);
  case 'highestDEF': return hand.reduce(maxDEF);
  case 'effectFirst': return hand.find(hasEffect) ?? maxATK;
  case 'lowestLevel': return hand.reduce(minLevel);
}
```

**Smart Summon **(`pickSmartSummonCandidate`)
```typescript
score = 0;
for (const plrMonster of playerField) {
  if (monsterATK > plrMonster.DEF) score += 300;  // Can beat
}
if (monster.hasEffect) score += 400;
if (monsterATK > playerMaxATK) score += 200;  // Survives

// Low LP survival mode
if (aiLP < AI_LP_THRESHOLD.LOW && monsterDEF >= AI_LP_THRESHOLD.DEFENSIVE) {
  score += AI_SCORE.LOW_LP_SURVIVAL;
}

return highest score;
```

### Position Strategy

```typescript
function decideSummonPosition(monsterATK, monsterDEF, playerMaxATK, playerHasMonsters, strategy): Position {
  switch (strategy) {
    case 'aggressive': return 'atk';
    case 'defensive':  return 'def';
    case 'smart':
      // DEF if monster weaker than opponent's strongest
      return monsterATK < playerMaxATK ? 'def' : 'atk';
  }
}
```

### Attack Target Selection

**Lethal Check**:
```typescript
function findLethal(aiMonsters, plrMonsters, playerLP): AttackPlan[] | null {
  // Try all attack combinations
  // If total damage >= playerLP → lethal found
  return lethalPlan ?? null;
}
```

**Attack Scoring **(`aiBattlePickTarget`)
```typescript
score = 0;

// Destroy target
if (atkATK > defDEF) {
  score += AI_SCORE.DESTROY_TARGET;  // +1000
  
  // Destroy effect monster
  if (defender.hasEffect) score += 500;
  
  // Efficient trade (avoid overkill)
  if (atkATK - defDEF < 500) score += 100;
}

// Face-down risk assessment
if (defender.faceDown) {
  if (behavior.battleStrategy === 'conservative') {
    // Skip face-down unless can destroy high-DEF
    if (atkATK < 1500) score -= AI_SCORE.FACEDOWN_RISK;
  } else if (behavior.battleStrategy === 'aggressive') {
    // Probe at 1800+ ATK
    if (atkATK >= AI_SCORE.PROBE_ATK_THRESHOLD) score += AI_SCORE.STRONG_PROBE;
  }
}

return highest score;
```

---

## Scoring Constants

### Key Constants (`AI_SCORE`)

| Constant | Value | Usage |
|----------|-------|-------|
| `EFFECT_CARD_BONUS` | 10000 | Effect monster on summon |
| `DESTROY_TARGET` | 1000 | Attack scoring for destruction |
| `EQUIP_UNLOCK_KILL` | 2000 | Equip if kill possible |
| `REVIVE_BEATS_STRONGEST` | 1000 | Revive if can beat strongest |
| `BUFF_KILL_THRESHOLD` | 1000 | Buff if kill possibleafter |
| `LOW_LP_SURVIVAL` | 300 | DEF monsters at low LP |
| `FACEDOWN_DEF_ESTIMATE` | 1200 | Estimated DEF for face-down |

### LP Thresholds

```typescript
AI_LP_THRESHOLD = {
  LOW: 3000,       // Activate survival mode
  DEFENSIVE: 5000  // Prioritize heals
}
```

---

## Spell Activation

### Intelligent Activation

```typescript
function _activateSpells(deps, ctx) {
  const { hand, aiLP, playerLP } = ctx;
  
  // Priority order:
  // 1. Damage spells (always)
  // 2. Heals (if AI LP < 5000 or AI LP < playerLP)
  // 3. Buffs (if AI has monsters on board)
  // 4. Destroy (if player has monsters)
  
  for (const spell of sortedSpells) {
    if (shouldActivateNormalSpell(spell, behavior, playerLP, aiLP)) {
      await deps.activateSpell('opponent', handIndex);
    }
  }
}
```

### Custom Spell Rules

```typescript
interface AISpellRule {
  when: 'always' | 'opponentLP>N' | 'selfLP<N';
  threshold?: number;
}

// Example: Activate only if opponent LP > 3000
spellRules: {
  'strong_nuke': { when: 'opponentLP>N', threshold: 3000 }
}
```

---

## Equip Targeting

### Positive Equips

```typescript
function pickEquipTarget(ownMonsters, oppMonsters, atkBonus, defBonus, equipCard): number {
  let bestScore = -Infinity;
  let bestZone = -1;
  
  for (const [zone, monster] of ownMonsters.entries()) {
    if (!monster) continue;
    
    // Kill potential after equip
    const newATK = monster.effectiveATK() + atkBonus;
    const beatsAny = oppMonsters.some(opp => opp && newATK > opp.effectiveDEF());
    
    if (beatsAny) score += AI_SCORE.EQUIP_UNLOCK_KILL;  // +2000
    if (monster.hasEffect) score += 500;
    
    if (score > bestScore) {
      bestScore = score;
      bestZone = zone;
    }
  }
  
  return bestZone;
}
```

### Debuff Equips

```typescript
function pickDebuffTarget(oppMonsters, atkDebuff): number {
  // Target highest ATK effect monster
  return oppMonsters
    .filter(Boolean)
    .sort((a, b) => {
      if (b.hasEffect && !a.hasEffect) return 1;
      return (b?.effectiveATK() ?? 0) - (a?.effectiveATK() ?? 0);
    })[0]?.zone ?? -1;
}
```

---

## Threat Assessment (ai-threat.ts)

### Board Snapshot

```typescript
interface BoardSnapshot {
  aiLP: number;
  plrLP: number;
  aiMonsterPower: number;      // Sum aiMonster.effectiveATK()
  plrMonsterPower: number;     // Sum plrMonster.effectiveATK()
  aiHandSize: number;
  plrHandSize: number;
}
```

### Threat Scoring

```typescript
function computeBoardThreat(snap: BoardSnapshot, behavior: AIBehavior): number {
  const lpRatio = (snap.aiLP - snap.plrLP) / 8000;  // -1 to +1
  const boardDiff = snap.aiMonsterPower - snap.plrMonsterPower;
  const handDiff = snap.aiHandSize - snap.plrHandSize;
  
  threat = 0;
  threat += lpRatio * AI_SCORE.THREAT_LP_WEIGHT;        // 0.4
  threat += boardDiff * AI_SCORE.THREAT_BOARD_WEIGHT;   // 1.2
  threat += handDiff * AI_SCORE.THREAT_HAND_WEIGHT;     // 150
  
  return threat;
}
```

### Goal Alignment

```typescript
function classifyGoalAlignment(goal: AIGoal, threat: number): 'aligned' | 'neutral' | 'misaligned' {
  if (goal.id === 'fusion_otk' && threat > 0.5) return 'aligned';
  if (goal.id === 'stall_drain' && threat < -0.5) return 'aligned';
  if (goal.id === 'swarm_aggro' && snap.aiHandSize >= 5) return 'aligned';
  
  return 'neutral';
}
```

---

## Fusion Decision

### Smart Fusion Chain

```typescript
function _findSmartFusionChain(hand, minATK, plrMonsters, goal, aiMonsters): number[] | null {
  // Try all 2-card combinations
  for (const [i, j] of combinations(hand, 2)) {
    const recipe = checkFusion(hand[i].id, hand[j].id);
    if (!recipe) continue;
    
    const result = CARD_DB[recipe.result];
    if (result.atk < minATK) continue;
    
    // Score fusion result
    score = 0;
    score += result.atk;
    
    // Beats player max monster
    if (result.atk > plrMaxATK) score += 1000;
    
    // Has effect
    if (result.effect) score += 500;
    
    // Goal alignment
    score += goal.alignmentBonus;
    
    // Chain length penalty
    score -= (chainLength - 2) * 50;
    
    if (score > bestScore) {
      bestScore = score;
      bestChain = [i, j];
    }
  }
  
  return bestChain;
}
```

---

## Dependencies

| File | Responsibility |
|------|----------------|
| `src/ai-behaviors.ts` | Behavior profiles, scoring, target selection |
| `src/ai-orchestrator.ts` | aiTurn() sequence, phase execution |
| `src/ai-threat.ts` | BoardSnapshot, ThreatScoring, Goal-Alignment |
| `src/cards.ts` | checkFusion(), CARD_DB |

---

## Notes / Gotchas

### 1. Summoning Sickness is Respected

AI **cannot** attack with monsters summoned this turn (except Fusion Monsters).

```typescript
// Battle phase
for (const monster of aiMonsters) {
  if (monster.summonedThisTurn) continue;  // Cannot attack
  // ...
}
```

### 2. Cheating AI Has Full Info

```typescript
if (behavior.knowsPlayerHand) {
  // Sees all player cards
  playerHand.forEach(card => console.log(card.name));
}

if (behavior.peekDeckCards) {
  // Peek top N
  const top5 = deck.slice(0, behavior.peekDeckCards);
}
```

### 3. Face-Down Risk

Conservative AI avoids attacks against face-down monsters:
```typescript
if (defender.faceDown && strategy === 'conservative') {
  if (atkATK < 1500) skipAttack();  // Too risky
}
```

### 4. Goal-Switching

Some profiles switch goals after N turns:
```typescript
{
  id: 'stall_drain',
  alignmentBonus : 700,
  switchTurn: 8  // Switch to different goal after turn 8
}
```

---

## References

- **Engine-Core** → `docs/engine-core.md` (G1)
- **Effect System** → `docs/effect-system.md` (G2)
- **Cards & Field** → `docs/cards-field.md` (G4)

---

**Status**: ✅ Complete
