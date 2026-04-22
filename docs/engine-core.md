# Engine-Core — Echoes of Sanguo

**Date:** 2026-04-16  
**Group:** G1  
**Dependencies:** G4 (Cards & Field) ✅, G2 (Effect System) ✅

---

## Overview

The engine is the **heart** of the game — pure TypeScript logic without React dependencies. It manages the complete game state, phases, summoning, battle, fusion, and win conditions.

**Core Principle:** Engine communicates with UI exclusively via `UICallbacks` interface.

---

## Architecture

### Layers

```
┌─────────────────────────────────────┐
│         UI (React)                  │
│  - GameScreen, Components, Modals   │
│  - Calls engine methods             │
└─────────────────┬───────────────────┘
                  │ UICallbacks Interface
                  │ (render, log, prompt, showResult, ...)
┌─────────────────▼───────────────────┐
│       Engine (TypeScript)           │
│  - GameEngine                       │
│  - EFFECT_REGISTRY                  │
│  - TriggerBus                       │
└─────────────────────────────────────┘
```

### Engine Layer Files

| File | Lines | Responsibility |
|------|-------|----------------|
| `src/engine.ts` | ~1218 | GameEngine: phases, summoning, battle, fusion |
| `src/field.ts` | 104 | FieldCard, FieldSpellTrap classes |
| `src/rules.ts` | 28 | GAME_RULES constants |
| `src/effect-registry.ts` | 982 | 60+ effect actions |
| `src/trigger-bus.ts` | 35 | Event emitter |
| `src/cards.ts` | 277 | CARD_DB, fusion logic |
| `src/types.ts` | 405 | All interfaces |
| `src/debug-logger.ts` | 101 | Debug logging |

---

## GameState

### Structure

```typescript
interface GameState {
  phase:        Phase;              // 'draw' | 'main' | 'battle'
  turn:         number;             // Current turn (start: 1)
  activePlayer: Owner;              // 'player' | 'opponent'
  player:       PlayerState;
  opponent:     PlayerState;
  log:          string[];           // Battle log (newest first)
  firstTurnNoAttack?: boolean;      // First player can't attack turn 1
  skipNextDraw?: Owner;             // Skip Draw Phase
  oneMoveActionUsed?: boolean;      // OneMove rule used
}
```

### PlayerState

```typescript
interface PlayerState {
  lp:               number;         // Life points (start: 8000)
  deck:             CardData[];     // Face-down deck
  hand:             CardData[];     // Hand cards
  field: {
    monsters:   Array<FieldCard | null>;      // 5 zones
    spellTraps: Array<FieldSpellTrap | null>; // 5 zones
    fieldSpell: FieldSpellTrap | null;        // Field spell
  };
  graveyard:        CardData[];     // Graveyard
  normalSummonUsed: boolean;        // Normal summon used (FM: false)
  battleProtection?: boolean;       // Protection from battle damage
  turnCounters?: TurnCounter[];     // Turn-based effects
  fieldFlags?: {
    negateTraps?: boolean;
    negateSpells?: boolean;
    negateMonsterEffects?: boolean;
  };
}
```

### GAME_RULES (Constants)

```typescript
const GAME_RULES = {
  startingLP:        8000,
  maxLP:             99999,
  handLimitDraw:     10,
  handLimitEnd:      8,
  fieldZones:        5,
  maxDeckSize:       40,
  maxCardCopies:     3,
  drawPerTurn:       1,
  handRefillSize:    5,
  refillHandEnabled: true,    // FM-style: refill to 5 at start of turn
  craftingEnabled:   false,
  oneMoveEnabled:    false,
};
```

---

## GameEngine — Methods

### Lifecycle

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(ui: UICallbacks)` | Initializes engine with UI callbacks |
| `initGame` | `(playerDeckIds, opponentConfig) => Promise<void>` | Starts new duel |
| `restoreGame` | `(checkpoint: SerializedCheckpoint) => void` | Loads savegame |

### Draw Phase

```typescript
drawCard(owner: Owner, count?: number): void
// Draws 1-7 cards (default: 1)

refillHand(owner: Owner): void
// FM-style: Refills hand to 5 (if refillHandEnabled)

_tickTurnCounters(owner: Owner): void
// Decrements turn-based counters
```

### Summoning

```typescript
// Normal summon (once per turn)
summonMonster(owner, handIndex, zone, position, faceDown): Promise<void>

// Set (face-down in DEF)
setMonster(owner, handIndex, zone): Promise<void>

// Flip summon
flipSummon(owner, zone): Promise<void>

// Special summon (from hand, unlimited)
specialSummon(owner, card, zone, position, faceDown): Promise<boolean>

// Special summon from graveyard
specialSummonFromGrave(owner, card, fromOwner): Promise<boolean>
```

### Spells / Traps

```typescript
// Set spell/trap face-down
setSpellTrap(owner, handIndex, zone): Promise<void>

// Replace (exchange)
replaceSpellTrap(owner, handIndex, zone): Promise<void>

// Activate from hand
activateSpell(owner, handIndex, targetInfo): Promise<boolean>

// Activate from field
activateSpellFromField(owner, zone, targetInfo): Promise<boolean>

// Activate trap (with chain support)
activateTrapFromField(owner, zone, ...args): Promise<boolean>

// Equip
equipCard(owner, handIndex, targetOwner, targetMonsterZone): Promise<boolean>

// Field spell
activateFieldSpell(owner, handIndex): Promise<boolean>
```

### Battle

```typescript
// Attack monster
attack(attackerOwner, attackerZone, defenderZone): Promise<void>

// Direct attack
attackDirect(attackerOwner, attackerZone): Promise<void>

// Internal resolution
_resolveBattle(attacker, defender, isDirect): Promise<void>
```

### Fusion

```typescript
// Check if fusion is possible
canFuse(owner: Owner): boolean

// List all fusions
getAllFusionOptions(owner: Owner): Array<{combo: string[], result: string}>

// 2-card fusion
performFusion(owner, handIdx1, handIdx2): Promise<boolean>

// Multi-card chain
performFusionChain(owner, handIndices: number[]): Promise<boolean>

// Hand + field fusion
fuseHandWithField(owner, handIndex, fieldZone): Promise<boolean>
```

### Utility

```typescript
dealDamage(target: Owner, amount: number): void
gainLP(target: Owner, amount: number): void
checkWin(): 'victory' | 'defeat' | null
_endDuel(result: 'victory' | 'defeat'): void
surrender(): void

addLog(msg: string): void
removeFromHand(owner: Owner, index: number): CardData
removeFromDeck(owner: Owner, index: number): CardData
chainTribute(owner: Owner, card: CardData): Promise<void>

_removeEquipmentForMonster(owner: Owner, zone: number): void
_removeFieldSpell(owner: Owner): void
_recalcAllFieldSpellBonuses(): void
_recalcFieldSpellBonuses(fc: FieldCard): void

hasPreventAttacks(owner: Owner): boolean
_triggerOneMoveAdvance(): void  // OneMove rule
```

---

## Turn Sequence (Phases)

### Complete Turn Cycle

```
1. Draw Phase
   ├─ Refill hand (to 5 cards)
   ├─ Draw card (1 per turn)
   └─ Tick turn counters

2. Main Phase
   ├─ Fusion (unlimited)
   ├─ Normal summon (1 per turn, FM: unlimited)
   ├─ Special summon (unlimited)
   ├─ Set Spell/Trap
   ├─ Activate spell
   └─ Equip cards

3. Battle Phase
   ├─ Attack with eligible monsters
   ├─ Direct attack (if no opponent monsters)
   └─ Battle resolution

4. End Phase
   ├─ Reset monster flags (hasAttacked, temp bonuses)
   ├─ Return stolen monsters
   ├─ Increment turn counter
   └─ Switch active player
```

### First Turn Special Rule

```typescript
// engine.ts:136-139
if (this.state.turn === 1 && this.state.firstTurnNoAttack) {
  this.addLog(this._(`ui.firstTurnNoAttackWarning`));
  // Player can't attack on turn 1
}
```

**Config:** `firstTurnNoAttack` is set at game start.

---

## Battle Resolution

### Damage Calculation

```typescript
// _resolveBattle() logic

// Attack Position vs Attack Position
if (defPos === 'atk') {
  const atkDiff = atkATK - defATK;
  if (atkDiff > 0) {
    // Defender destroyed
    this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
    // Piercing damage? No (both ATK position)
  } else if (atkDiff < 0) {
    // Attacker destroyed
    this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
    // Battle damage to attacker owner
    this.dealDamage(atkOwner, Math.abs(atkDiff));
  } else {
    // Both destroyed (tie)
    this._destroyMonster(defOwner, defZone, 'battle', null);
    this._destroyMonster(atkOwner, atkZone, 'battle', null);
  }
}

// Attack Position vs Defense Position
else { // defPos === 'def'
  if (atkATK > defDEF) {
    // Defender destroyed (no battle damage in DEF position)
    this._destroyMonster(defOwner, defZone, 'battle', atkOwner);
    // Piercing damage
    if (attackerFC.piercing) {
      this.dealDamage(defOwner, atkATK - defDEF);
    }
  } else if (atkATK < defDEF) {
    // Attacker destroyed
    this._destroyMonster(atkOwner, atkZone, 'battle', defOwner);
    // Battle damage to attacker owner
    this.dealDamage(atkOwner, defDEF - atkATK);
  }
  // If equal: nothing happens
}
```

### Direct Attack

```typescript
async attackDirect(attackerOwner: Owner, attackerZone: number) {
  const attackerFC = state[attackerOwner].field.monsters[attackerZone];
  
  if (!attackerFC.canDirectAttack) {
    throw new Error('Cannot attack directly');
  }
  
  // Full ATK damage
  const damage = attackerFC.effectiveATK();
  this.dealDamage(getOpponent(attackerOwner), damage);
  
  attackerFC.hasAttacked = true;
  await this._triggerEffect(attackerFC, attackerOwner, 'onDealBattleDamage', attackerZone);
}
```

---

## Fusion System

### 2-Card Fusion

```typescript
async performFusion(owner: Owner, handIdx1: number, handIdx2: number): Promise<boolean> {
  const hand = state[owner].hand;
  const card1 = hand[handIdx1];
  const card2 = hand[handIdx2];
  
  const recipe = checkFusion(card1.id, card2.id);
  if (!recipe) {
    this.addLog('Cannot fuse these cards');
    return false;
  }
  
  // Remove materials from hand
  hand.splice(Math.max(handIdx1, handIdx2), 1);
  hand.splice(Math.min(handIdx1, handIdx2), 1);
  
  // Add fusion result to hand
  const resultCard = CARD_DB[recipe.result];
  hand.push({ ...resultCard });
  
  // Animation trigger
  await this.ui.playFusionAnimation?.(owner, handIdx1, handIdx2, hand.length - 1);
  
  return true;
}
```

### Multi-Card Fusion (Chain)

```typescript
async performFusionChain(owner: Owner, handIndices: number[]): Promise<boolean> {
  const hand = state[owner].hand;
  const cards = handIndices.map(i => hand[i]).filter(Boolean);
  
  const result = resolveFusionChain(cards.map(c => c.id));
  
  // Remove all consumed cards
  for (let i = handIndices.length - 1; i >= 0; i--) {
    hand.splice(handIndices[i], 1);
  }
  
  // Add final result
  const resultCard = CARD_DB[result.finalCardId];
  hand.push({ ...resultCard });
  
  // Animation
  await this.ui.playFusionChainAnimation?.(owner, handIndices, hand.length - 1);
  
  return true;
}
```

---

## Save / Load (Checkpoints)

### SerializedCheckpoint

```typescript
interface SerializedCheckpoint {
  phase: Phase;
  turn: number;
  activePlayer: Owner;
  player: SerializedPlayerState;
  opponent: SerializedPlayerState;
}

interface SerializedPlayerState {
  lp: number;
  deck: string[];           // Card IDs only
  hand: string[];
  field: {
    monsters: Array<SerializedFieldCardData | null>;
    spellTraps: Array<SerializedFieldSpellTrapData | null>;
    fieldSpell: SerializedFieldSpellTrapData | null;
  };
  graveyard: string[];
  normalSummonUsed: boolean;
}

interface SerializedFieldCardData {
  cardId: string;
  position: Position;
  faceDown: boolean;
  hasAttacked: boolean;
  tempATKBonus: number;
  tempDEFBonus: number;
  // ... (no complex objects)
}
```

### Restore Logic

```typescript
restoreGame(checkpoint: SerializedCheckpoint): void {
  this.state = {
    phase: checkpoint.phase,
    turn: checkpoint.turn,
    activePlayer: checkpoint.activePlayer,
    player: this._deserializePlayer(checkpoint.player),
    opponent: this._deserializePlayer(checkpoint.opponent),
    log: [],
  };
  
  this.ui.render(this.state);
}
```

**Note:** Checkpoints are NOT automatically created — UI must implement `saveSlot` feature.

---

## UICallbacks Interface

### Complete List

```typescript
interface UICallbacks {
  // Required
  render:     (state: GameState) => void;
  log:        (msg: string) => void;
  
  // Optional (for interactive gameplay)
  prompt?:                    (opts: PromptOptions) => Promise<boolean>;
  showResult?:                (result: 'victory' | 'defeat') => void;
  showActivation?:            (card: CardData, text: string) => Promise<void>;
  playAttackAnimation?:       (atkOwner, atkZone, defOwner, defZone) => Promise<void>;
  playFusionAnimation?:       (owner, handIdx1, handIdx2, resultZone) => Promise<void>;
  playFusionChainAnimation?:  (owner, handIndices, resultZone) => Promise<void>;
  playVFX?:                   (type: 'buff'|'heal'|'damage', owner, zone) => Promise<void>;
  playSfx?:                   (sfxId: string) => void;
  showDamageNumber?:          (amount: number, owner: Owner) => void;
  onDraw?:                    (owner: Owner, count: number) => void;
  onDuelEnd?:                 (result, opponentId, stats: DuelStats) => void;
  showCoinToss?:              (playerGoesFirst: boolean) => Promise<void>;
  selectFromDeck?:            (cards: CardData[]) => Promise<CardData>;
}
```

### Engine calls only

```typescript
// Engine.ts
this.ui.render(this.state);
this.ui.log('Summoned Kurama');
await this.ui.prompt({ title: 'Activate?', message: '...' });
await this.ui.playAttackAnimation(...);
```

---

## TriggerBus

### Event System

```typescript
// Subscription
const unsubscribe = TriggerBus.on('onSummon', (ctx) => {
  console.log(`${ctx.card?.name} summoned!`);
});

// Emission (engine internal)
TriggerBus.emit('onSummon', {
  engine: this,
  owner: 'player',
  card: summonedCard,
  fieldCard: fc,
  zone: 3
});

// Unsubscribe
unsubscribe();

// Clear all (for test teardown)
TriggerBus.clear();
```

### Built-in Events

| Event | Fires When |
|-------|------------|
| `onSummon` | Monster summoned |
| `onDestroyByBattle` | Destroyed in battle |
| `onDestroyByOpponent` | Destroyed by opponent |
| `onFlipSummon` | Flip summoned |
| `onDealBattleDamage` | Battle damage dealt |
| `onSentToGrave` | Card sent to grave |
| `passive` | Continuous on-field |

**Modders can** subscribe to custom events via `addTriggerHook()`.

---

## Debug Logger

### Usage

```typescript
import { EchoesOfSanguo } from './debug-logger.js';

// Toggle debugging
EchoesOfSanguo.debug = true;

// Log game event (always buffered)
EchoesOfSanguo.gameEvent('Player summoned Kurama');

// Categorized log
EchoesOfSanguo.log('BATTLE', 'Attacking with Kurama', { atk: 2500 });

// Download log file
EchoesOfSanguo.downloadLog('battle-lost');
```

### Categories

- `PHASE`, `AI`, `BATTLE`, `EFFECT`, `SUMMON`, `SPELL`, `TRAP`, `GAME`, `ERROR`

---

## Dependencies

| Dependency | Description |
|------------|-------------|
| `src/field.ts` | FieldCard, FieldSpellTrap |
| `src/effect-registry.ts` | EFFECT_REGISTRY |
| `src/cards.ts` | CARD_DB, checkFusion() |
| `src/types.ts` | GameState, UICallbacks |
| `src/trigger-bus.ts` | TriggerBus |
| `src/rules.ts` | GAME_RULES |
| `src/debug-logger.ts` | EchoesOfSanguo logging |

---

## Notes / Gotchas

### 1. Hand-Limit Rules

```typescript
// Draw Phase: Can draw if hand < 10
if (hand.length >= GAME_RULES.handLimitDraw) {
  this.addLog('Cannot draw: hand limit reached');
  return;
}

// End Phase: Discard to 8
if (hand.length > GAME_RULES.handLimitEnd) {
  while (hand.length > GAME_RULES.handLimitEnd) {
    // Player must discard
  }
}
```

### 2. Summoning Sickness

```typescript
// Monster cannot attack turn it was summoned
fc.summonedThisTurn = true;

// Battle phase check
if (fc.summonedThisTurn) {
  this.addLog('Cannot attack: summoning sickness');
  return;
}
```

**EXCEPTION:** Fusion Monsters have NO summoning sickness (direct special summon).

### 3. Temp Bonuses Reset

```typescript
// End phase
fc.tempATKBonus = 0;
fc.tempDEFBonus = 0;
```

### 4. Field Spell Bonuses are permanent (while field spell is active)

```typescript
_recalcFieldSpellBonuses(fc: FieldCard): void {
  const fieldSpell = state.player.field.fieldSpell;
  if (!fieldSpell) {
    fc.fieldSpellATKBonus = 0;
    fc.fieldSpellDEFBonus = 0;
    return;
  }
  
  // Parse effect and apply bonuses
  // ... (from effect string)
}
```

### 5. OneMove Rule (optional)

```typescript
// If oneMoveEnabled: Player can move ONE monster AND battle
_triggerOneMoveAdvance(): void {
  if (this.state.oneMoveActionUsed) {
    // Already moved, skip to battle
    this.advancePhase();
  }
}
```

---

## References

- **Effect System** → `docs/effect-system.md` (G2)
- **Cards & Field** → `docs/cards-field.md` (G4)
- **AI System** → `docs/ai-system.md` (G3)
- **Mod API** → `docs/mod-api.md` (G10)

---

**Status**: ✅ Complete
