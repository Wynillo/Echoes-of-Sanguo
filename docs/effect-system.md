# Effect System — Echoes of Sanguo

**Date:** 2026-04-16  
**Group:** G2  
**Dependencies:** G4 (Cards & Field) ✅

---

## Overview

The effect system is **data-driven** — effects are stored as strings in the `.tcg` archive and executed by the `EFFECT_REGISTRY` at runtime. No effect logic is hardcoded in the engine.

**Core Components**:
- `EFFECT_REGISTRY` — Map of effect types to implementations (60+ actions)
- `CardEffectBlock` — Data structure for effects (Trigger + Actions)
- `executeEffectBlock()` — Executes effect block with cost validation
- 7 Monster Triggers (`onSummon`, `passive`, etc.)
- 11+ Trap Triggers (`onAttack`, `onOpponentSpell`, etc.)

---

## Architecture

### Data Flow

```
.tcg Archive → effect string
          ↓
parseEffectString() (effect-serializer.ts)
          ↓
CardEffectBlock { trigger, cost?, actions[] }
          ↓
Card is played → Trigger fires
          ↓
_triggerEffect(fc, owner, trigger, zone)
          ↓
executeEffectBlock(block, ctx)
          ↓
EFFECT_REGISTRY[action.type](action, ctx) → EffectSignal
          ↓
Engine processes signal (e.g., cancelAttack)
```

### Effect Execution Sequence

1. **Trigger activation** — Engine calls `_triggerEffect()`
2. **Filter effect blocks** — All blocks with matching trigger
3. **Validate costs** — `canPayCost()` (LP, discards, tributes)
4. **Pay costs** — `payCost()` (subtract LP, remove cards)
5. **Execute actions** — Each action looked up in `EFFECT_REGISTRY`
6. **Aggregate signals** — `EffectSignal { cancelAttack?, destroyAttacker? }`
7. **Process signal** — Engine responds (cancel attack, etc.)

---

## Key Types

### EffectTrigger (7 Monster Triggers)

```typescript
type EffectTrigger =
  | 'onSummon'           // Normal, Flip, or Special Summon
  | 'onDestroyByBattle'  // Destroyed in battle
  | 'onDestroyByOpponent' // Destroyed by opponent (battle or effect)
  | 'onFlipSummon'       // Manually or by attack flip-summoned
  | 'onDealBattleDamage' // Battle damage dealt to opponent
  | 'onSentToGrave'      // Card goes to graveyard
  | 'passive';           // Continuous, while on-field
```

### TrapTrigger (11+ Triggers)

```typescript
type TrapTrigger =
  | 'onFlip'
  | 'onAttack'
  | 'onOwnMonsterAttacked'
  | 'onOpponentSummon'
  | 'manual'              // Manually activated
  | 'onOpponentSpell'
  | 'onAnySummon'
  | 'onOppCardEffect'
  | 'onOpponentDraw';
```

### CardEffectBlock

```typescript
interface CardEffectBlock {
  trigger: EffectTrigger | TrapTrigger;
  cost?: EffectCost;
  actions: EffectDescriptor[];
}
```

### EffectCost

```typescript
interface EffectCost {
  lp?: number;           // Pay LP
  lpHalf?: boolean;      // Pay half LP
  discard?: number;      // Discard cards
  discardRace?: number;  // Discard specific race
  tributeSelf?: boolean; // Tribute own monster
  pay?: Array<{type: string; value: number}>; // Custom costs
}
```

### EffectDescriptor

```typescript
interface EffectDescriptor {
  type: string;          // Effect action type (e.g., 'draw', 'dealDamage')
  value?: number;        // Numeric value (for 'dealDamage 500')
  target?: string;       // Target ('opponent', 'ownMonster', etc.)
  count?: number;        // Count (for 'draw 2')
  race?: number;         // Race filter
  attr?: number;         // Attribute filter
  filter?: CardFilter;   // Complex filter
  from?: string;         // ValueExpr source ('attacker.effectiveATK')
  multiply?: number;     // ValueExpr multiplier
  round?: 'floor' | 'ceil'; // ValueExpr rounding
  [key: string]: any;    // Additional parameters
}
```

### ValueExpr (Dynamic Values)

```typescript
type ValueExpr = number | {
  from: 'attacker.effectiveATK' | 'summoned.atk' | 'defender.def';
  multiply: number;
  round: 'floor' | 'ceil';
};
```

**Example**:
```json
{ "type": "dealDamage", "target": "opponent", "value": { "from": "attacker.effectiveATK", "multiply": 0.5, "round": "floor" } }
// "Deal damage equal to half the attacker's ATK (rounded down)"
```

### EffectContext

```typescript
interface EffectContext {
  engine:       GameEngine;
  owner:        Owner;          // 'player' | 'opponent'
  target?:      FieldCard;      // Target FieldCard (targeted spells/traps)
  targetCard?:  CardData;       // Target CardData (fromGrave spells)
  attacker?:    FieldCard;      // Attacker (onAttack traps)
  defender?:    FieldCard;      // Defender
  summoned?:    FieldCard;      // Just summoned monster
}
```

### EffectSignal

Return value from effect implementations — signals special states to the engine.

```typescript
interface EffectSignal {
  cancelAttack?:     boolean;  // Cancel attack
  destroySummoned?:  boolean;  // Destroy summoned monster
  destroyAttacker?:  boolean;  // Destroy attacker
  cancelEffect?:     boolean;  // Negate effect
  reflectDamage?:    boolean;  // Reflect damage
}
```

---

## API / Methods

### EFFECT_REGISTRY

```typescript
// Register custom effect (Mod API)
registerEffect(type: string, impl: EffectImpl): void;

// Effect implementation signature
type EffectImpl = (action: EffectDescriptor, ctx: ChainEffectCtx) => EffectSignal | Promise<EffectSignal>;
```

### Effect Execution

```typescript
// Main function — executes entire effect block
executeEffectBlock(block: CardEffectBlock, ctx: EffectContext): Promise<EffectSignal>;

// Validate costs (without paying)
canPayCost(block: CardEffectBlock, ctx: PureEffectCtx): boolean;

// Pay costs
payCost(block: CardEffectBlock, ctx: PureEffectCtx): void;

// Extract passive flags (for FieldCard)
extractPassiveFlags(block: CardEffectBlock): Partial<FieldCard>;
```

### Context Factory

```typescript
// Minimal context (read-only)
makePureCtx(ctx: EffectContext): PureEffectCtx;

// Extended context (with summon mutations)
makeChainCtx(ctx: EffectContext): ChainEffectCtx;
```

---

## Effect Actions (60+)

### Damage / Heal (5)

| Action | Parameters | Description |
|--------|------------|-------------|
| `dealDamage` | `{target, value}` | Deal damage (value: number or ValueExpr) |
| `gainLP` | `{target, value}` | Heal LP (value: number or ValueExpr) |
| `reflectBattleDamage` | — | Reflect battle damage back to attacker |
| `destroyAndDamageBoth` | — | Destroy strongest monster, both players take ATK damage |
| `preventBattleDamage` | — | Prevent battle damage and destruction for this turn |

### Draw / Search / Deck Manipulation (10)

| Action | Parameters | Description |
|--------|------------|-------------|
| `draw` | `{target, count}` | Draw cards (target: owner) |
| `searchDeckToHand` | `{filter, count}` | Search deck for card matching filter, add to hand |
| `peekTopCard` | `{owner}` | Look at top card of deck |
| `drawThenDiscard` | `{count, discard}` | Draw N, discard M |
| `discardFromHand` | `{owner, count}` | Discard N cards from hand |
| `discardOppHand` | `{count}` | Opponent discards N cards |
| `discardEntireHand` | `{target}` | Discard entire hand (self/opponent/both) |
| `sendTopCardsToGrave` | `{owner, count}` | Send top N to graveyard |
| `sendTopCardsToGraveOpp` | `{count}` | Opponent sends top N to graveyard |
| `shuffleDeck` | `{owner}` | Shuffle own deck |

### Stat Modification / Buffs (14)

| Action | Parameters | Description |
|--------|------------|-------------|
| `buffField` | `{race?, atk, def}` | Permanent ATK/DEF bonus for all own monsters (optional race filter) |
| `tempBuffField` | `{race?, atk, def}` | Temporary ATK/DEF bonus (reset at turn end) |
| `debuffField` | `{race?, atk, def}` | Permanent ATK/DEF reduction for opponent monsters |
| `tempDebuffField` | `{race?, atk, def}` | Temporary reduction |
| `tempAtkBonus` | `{target, value}` | Temporary ATK bonus for target monster |
| `permAtkBonus` | `{target, value}` | Permanent ATK bonus |
| `tempDefBonus` | `{target, value}` | Temporary DEF bonus |
| `permDefBonus` | `{target, value}` | Permanent DEF bonus |
| `halveAtk` | `{target}` | Halve ATK |
| `doubleAtk` | `{target}` | Double ATK |
| `swapAtkDef` | `{target}` | Swap ATK and DEF |

### Removal / Bounce / Destruction (13)

| Action | Parameters | Description |
|--------|------------|-------------|
| `bounceStrongestOpp` | — | Return opponent's strongest monster to hand |
| `bounceAttacker` | — | Return attacking monster to hand |
| `bounceAllOppMonsters` | — | Return all opponent monsters to hand |
| `bounceOppHandToDeck` | `{count}` | Opponent puts N cards from hand on deck |
| `destroyAttacker` | — | Destroy attacker, cancel attack |
| `destroySummonedIf` | `{threshold}` | Destroy summoned monster if ATK ≥ threshold |
| `destroyAllOpp` | — | Destroy all opponent monsters |
| `destroyAll` | — | Destroy all monsters on both sides |
| `destroyWeakestOpp` | — | Destroy opponent's weakest monster |
| `destroyStrongestOpp` | — | Destroy opponent's strongest monster |
| `destroyByFilter` | `{filter, mode}` | Destroy by filter (weakest/strongest/highestDef/first) |
| `setFaceDown` | `{target}` | Set target monster face-down in DEF |
| `flipAllOppFaceDown` | — | Set all opponent monsters face-down |

### Graveyard / Revival (7)

| Action | Parameters | Description |
|--------|------------|-------------|
| `reviveFromGrave` | `{target}` | Special summon from graveyard |
| `reviveFromEitherGrave` | — | Revive highest ATK monster from either graveyard |
| `salvageFromGrave` | `{filter}` | Add card from graveyard to hand |
| `recycleFromGraveToDeck` | `{filter}` | Put card from graveyard on deck |
| `shuffleGraveIntoDeck` | — | Shuffle entire graveyard into deck |

### Summon / Token / Special Summon (5)

| Action | Parameters | Description |
|--------|------------|-------------|
| `specialSummonFromHand` | `{filter, position}` | Special summon from hand |
| `specialSummonFromDeck` | `{filter, faceDown}` | Special summon from deck (optional face-down) |
| `createTokens` | `{count, position}` | Create N token monsters |
| `excavateAndSummon` | `{count, maxLevel}` | Excavate top N, summon monster ≤ maxLevel |
| `tributeSelf` | — | Tribute own monster (for costs) |

### Control Change / Position (6)

| Action | Parameters | Description |
|--------|------------|-------------|
| `stealMonster` | — | Take control of opponent's strongest monster |
| `stealMonsterTemp` | — | Take temporary control |
| `cancelAttack` | — | Cancel current attack |
| `cancelEffect` | — | Negate current effect |
| `changePositionOpp` | — | Change position of opponent monster |
| `preventAttacks` | `{turns}` | Prevent opponent attacks for N turns |

### Spell / Trap Removal (4)

| Action | Parameters | Description |
|--------|------------|-------------|
| `destroyOppSpellTrap` | — | Destroy one opponent Spell/Trap |
| `destroyAllOppSpellTraps` | — | Destroy all opponent Spells/Traps |
| `destroyAllSpellTraps` | — | Destroy all Spells/Traps on both sides |
| `destroyOppFieldSpell` | — | Destroy opponent Field Spell |

### Passive Abilities (11)

| Action | Flag in FieldCard |
|--------|-------------------|
| `passive_piercing` | `piercing: true` |
| `passive_untargetable` | `cannotBeTargeted: true` |
| `passive_directAttack` | `canDirectAttack: true` |
| `passive_vsAttrBonus` | `vsAttrBonus: {attr, bonus}` |
| `passive_phoenixRevival` | `phoenixRevival: true` |
| `passive_indestructible` | `indestructible: true` |
| `passive_effectImmune` | `effectImmune: true` |
| `passive_cantBeAttacked` | `cantBeAttacked: true` |
| `passive_negateTraps` | Field-Flag: `negateTraps: true` |
| `passive_negateSpells` | Field-Flag: `negateSpells: true` |
| `passive_negateMonsterEffects` | Field-Flag: `negateMonsterEffects: true` |

### Utility (5)

| Action | Parameters | Description |
|--------|------------|-------------|
| `tributeSelf` | — | Tribute own monster |
| `payCost` | — | Pay costs (internal use) |
| `shuffleDeck` | — | Shuffle deck |
| `gameReset` | — | Reset game (all cards to decks, redraw) |
| `skipOppDraw` | — | Skip opponent's Draw Phase |

---

## Effect String Format

Effects are stored in the `.tcg` archive as strings:

**Format**:
```
trigger[: cost] → action1, action2, ...
```

**Examples**:
```
onSummon: draw 2
onDestroyByBattle: dealDamage opponent attacker.effectiveATK
passive: passive_piercing
onFlipSummon: destroyAllOpp
manual: discardFromHand 1, draw 2
onSentToGrave: sacrificeSelf, reviveFromGrave target:strongest
```

**Value Expressions**:
```
dealDamage opponent 500           // Fixed value
dealDamage opponent attacker.effectiveATK  // Dynamic (attacker's ATK)
dealDamage opponent summoned.atk * 0.5 floor  // Half ATK, rounded down
```

---

## Execution Flow (Detail)

### 1. Trigger fires

```typescript
// In engine.ts:_triggerEffect()
const blocks = card.effect?.trigger === trigger ? [card.effect] : [];
if (card.effects) {
  blocks.push(...card.effects.filter(b => b.trigger === trigger));
}

for (const block of blocks) {
  const signal = await executeEffectBlock(block, ctx);
  // Aggregate signals
}
```

### 2. Cost validation

```typescript
function canPayCost(block: CardEffectBlock, ctx: PureEffectCtx): boolean {
  const { cost } = block;
  if (!cost) return true;
  
  if (cost.lp && ctx.state[ctx.owner].lp < cost.lp) return false;
  if (cost.lpHalf && ctx.state[ctx.owner].lp <= 1) return false;
  if (cost.discard && ctx.state[ctx.owner].hand.length < cost.discard) return false;
  if (cost.tributeSelf && !ctx.target) return false;
  
  return true;
}
```

### 3. Cost payment

```typescript
function payCost(block: CardEffectBlock, ctx: PureEffectCtx): void {
  const { cost } = block;
  if (!cost) return;
  
  if (cost.lp) ctx.damage(ctx.owner, cost.lp);
  if (cost.discard) {
    for (let i = 0; i < cost.discard; i++) {
      ctx.removeFromHand(ctx.owner, 0);
    }
  }
  if (cost.tributeSelf) ctx.destroyMonster(...);
}
```

### 4. Action Execution

```typescript
async function executeEffectBlock(block: CardEffectBlock, ctx: EffectContext): Promise<EffectSignal> {
  const signal: EffectSignal = {};
  
  if (!canPayCost(block, makePureCtx(ctx))) return signal;
  payCost(block, makePureCtx(ctx));
  
  for (const action of block.actions) {
    const impl = EFFECT_REGISTRY.get(action.type);
    if (impl) {
      const result = await impl(action, makeChainCtx(ctx));
      Object.assign(signal, result); // Merge signals
    }
  }
  
  return signal;
}
```

---

## Examples

### Simple On-Summon Effect

**Card**:
```json
{
  "id": "magician_of_faith",
  "effect": {
    "trigger": "onFlipSummon",
    "actions": [{ "type": "searchDeckToHand", "filter": { "spellType": "normal" } }]
  }
}
```

**Effect**: "When Flip Summoned: Search 1 Normal Spell Card from your Deck and add it to your hand."

---

### Cost-Required Effect

**Card**:
```json
{
  "effect": {
    "trigger": "manual",
    "cost": { "lp": 500 },
    "actions": [{ "type": "draw", "count": 2, "target": "owner" }]
  }
}
```

**Effect**: "Pay 500 LP: Draw 2 cards."

---

### Value Expression (Dynamic Damage)

**Card**:
```json
{
  "effect": {
    "trigger": "onDealBattleDamage",
    "actions": [{
      "type": "dealDamage",
      "target": "opponent",
      "value": { "from": "attacker.effectiveATK", "multiply": 0.5, "round": "floor" }
    }]
  }
}
```

**Effect**: "When this card deals battle damage: Deal additional damage equal to half this card's ATK (rounded down)."

---

### Multi-Block Effect

**Card with multiple effects**:
```json
{
  "effects": [
    {
      "trigger": "onSummon",
      "actions": [{ "type": "buffField", "race": 1, "atk": 200 }]
    },
    {
      "trigger": "passive",
      "actions": [{ "type": "passive_piercing" }]
    },
    {
      "trigger": "onDestroyByBattle",
      "actions": [{ "type": "draw", "count": 1 }]
    }
  ]
}
```

**Effects**:
- "When Summoned: All Warrior monsters gain 200 ATK"
- "Passive: Piercing"
- "When Destroyed by Battle: Draw 1 card"

---

## Custom Effect Handler (for Modders)

```typescript
// Mod API
window.EchoesOfSanguoMod.registerEffect('myCustomEffect', (action, ctx) => {
  ctx.log('Custom effect fired!');
  
  // Custom logic
  ctx.draw(ctx.owner, action.count ?? 1);
  
  // Return signal
  return {};
});
```

**Usage in .tcg**:
```
onSummon: myCustomEffect 2
```

---

## Dependencies

| Dependency | Description |
|------------|-------------|
| `@wynillo/tcg-format` | Effect serializer (parseEffectString, serializeEffect) |
| `src/effect-registry.ts` | All 60+ effect implementations |
| `src/effect-serializer.ts` | String ↔ CardEffectBlock codec |
| `src/field.ts` | `FieldCard` (for passive flags) |
| `src/types.ts` | `CardEffectBlock`, `EffectContext` |
| `src/enums.ts` | Trigger validation |

---

## Notes / Gotchas

### 1. A-Trigger vs B-Trigger

**A-Trigger** (before action):
- `onSummon`, `onFlipSummon`
- Fires AFTER successful summon

**B-Trigger** (reactive):
- `onDestroyByBattle`, `onDealBattleDamage`
- Fires DURING resolution

**Important**: A-Triggers can still change the board; B-Triggers see the resolved state.

### 2. Passive flags are extracted once

On summon, `passive:` actions are converted to `FieldCard` flags:

```typescript
// In engine.ts:summonMonster()
fc.piercing = blocks.some(b => 
  b.actions.some(a => a.type === 'passive_piercing')
);
```

**Subsequent changes** to `CardData.effect` have **no effect** on a `FieldCard` already on the field.

### 3. Effect signals are aggregated

When multiple effects fire, signals are merged:

```typescript
const totalSignal = {};
for (const block of blocks) {
  const signal = await executeEffectBlock(block, ctx);
  Object.assign(totalSignal, signal); // Later effects override
}
```

**Priority**: Later effects override earlier ones for conflicting signals.

### 4. Targeting (Context Variables)

Effect handlers have access to:
- `ctx.attacker` — attacking FieldCard
- `ctx.defender` — defending FieldCard
- `ctx.summoned` — just summoned FieldCard
- `ctx.target` — targeted FieldCard (for targeted Spells/Traps)
- `ctx.targetCard` — targeted CardData (for fromGrave Spells)

**Example **(Targeted Spell)
```typescript
registerEffect('destroyMonster', (action, ctx) => {
  if (!ctx.target) return {};
  return { destroySummoned: true }; // Engine destroys ctx.target
});
```

### 5. ValueExpr Rounding

```typescript
{ from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' }
// ATK = 1500 → 1500 * 0.5 = 750 (floor)
// ATK = 1501 → 1501 * 0.5 = 750.5 → 750 (floor)
```

### 6. Filter Logic

`CardFilter` uses AND logic:

```typescript
{ race: [1, 2], minAtk: 1500, maxLevel: 4 }
// Matches: (race=1 OR race=2) AND ATK≥1500 AND level≤4
```

---

## References

- **Cards & Field** → `docs/cards-field.md` (G4)
- **Engine-Core** → `docs/engine-core.md` (G1)
- **Mod API** → `docs/mod-api.md` (G10)

---

**Status**: ✅ Complete
