---
name: engine-state-reference
description: >
  Read-only reference for engine state management in src/engine/.
  Provides documentation on GameState, PlayerState, FieldCard, and FieldSpellTrap
  structures. Use for understanding state mutations, turn flow, and serialization.
  Does not execute code — read-only consultation on engine architecture.
tools:
  - Read
  - Grep
  - Glob
model: sonnet
---

# src/engine/ State Management

This directory contains the engine layer of the game. The engine is pure TypeScript without React dependencies and manages the complete game state.

## Architecture

The engine communicates exclusively through the `UICallbacks` interface with the UI layer. The UI registers callbacks; the engine invokes them to signal updates.

## State Structure

### GameState (central state object)

```typescript
interface GameState {
  phase: Phase;              // 'draw' | 'main' | 'battle'
  turn: number;              // current round
  activePlayer: Owner;       // 'player' | 'opponent'
  player: PlayerState;
  opponent: PlayerState;
  log: string[];             // battle log (newest entries first)
  firstTurnNoAttack?: boolean;
  skipNextDraw?: Owner;
  oneMoveActionUsed?: boolean;
}
```

### PlayerState

```typescript
interface PlayerState {
  lp: number;                // life points
  deck: CardData[];          // hidden deck
  hand: CardData[];          // hand cards
  field: {
    monsters: Array<FieldCard | null>;      // 5 zones
    spellTraps: Array<FieldSpellTrap | null>; // 5 zones
    fieldSpell: FieldSpellTrap | null;      // field spell
  };
  graveyard: CardData[];     // graveyard
  normalSummonUsed: boolean; // normal summon used this turn
  battleProtection?: boolean; // protection from battle damage
  turnCounters?: TurnCounter[]; // turn-based effects
  fieldFlags?: {
    negateTraps?: boolean;
    negateSpells?: boolean;
    negateMonsterEffects?: boolean;
  };
}
```

### FieldCard (active monster)

```typescript
class FieldCard {
  card: CardData;           // reference to card data
  position: Position;       // 'atk' | 'def'
  faceDown: boolean;        // face-down on field
  hasAttacked: boolean;     // has attacked this turn
  hasFlipSummoned: boolean; // flip summon this turn
  summonedThisTurn: boolean;
  tempATKBonus: number;     // temporary ATK modifiers
  tempDEFBonus: number;
  permATKBonus: number;     // permanent ATK modifiers (equipment)
  permDEFBonus: number;
  fieldSpellATKBonus: number;
  fieldSpellDEFBonus: number;
  equippedCards: Array<{ zone: number; card: CardData }>;
  // Passive Flags (extracted from effects)
  piercing: boolean;
  cannotBeTargeted: boolean;
  canDirectAttack: boolean;
  phoenixRevival: boolean;
  indestructible: boolean;
  effectImmune: boolean;
  cantBeAttacked: boolean;
}
```

### FieldSpellTrap (active spells/traps)

```typescript
class FieldSpellTrap {
  card: CardData;
  faceDown: boolean;
  used: boolean;            // for traps: already activated
  equippedMonsterZone?: number;  // for equipment
  equippedOwner?: Owner;
}
```

## State Changes

### 1. Direct State Mutation (synchronous)

The engine mutates state directly. After changes, `ui.render(state)` is called.

```typescript
this.state.player.lp -= damage;
this.ui.render(this.state);
```

### 2. Asynchronous Actions with Effect Execution

Summons, spells, and attacks can trigger effects:

```typescript
async summonMonster(owner, handIndex, zone, position, faceDown) {
  // ... move card from hand to field
  await this._triggerEffect(fc, owner, 'onSummon', zone);
  TriggerBus.emit('onSummon', { engine: this, owner, card: fc.card, fieldCard: fc, zone });
  this.ui.render(this.state);
}
```

### 3. Turn Switch

```typescript
state.activePlayer = 'opponent';
state.phase = 'draw';
state.turn++;
```

## Turn Flow (Phases)

```
1. Draw Phase    -> refillHand()
2. Main Phase    -> summonMonster(), activateSpell(), setSpellTrap(), performFusion()
3. Battle Phase  -> attack(), attackDirect()
4. End Phase     -> resetMonsterFlags(), tickTurnCounters()
```

## State Serialization (Checkpoints)

The game supports save/load via `SerializedCheckpoint`:

```typescript
interface SerializedCheckpoint {
  phase: Phase;
  turn: number;
  activePlayer: Owner;
  player: SerializedPlayerState;
  opponent: SerializedPlayerState;
  // ... (only IDs, no complex objects)
}
```

## IMPORTANT RULES

- Engine must NEVER import React code directly
- State mutations only through GameEngine methods
- After every mutation, call `ui.render(state)`
- Effects are executed via `executeEffectBlock()`
- TriggerBus for global event communication
