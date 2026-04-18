# Mod API — Echoes of Sanguo

**As of:** 2026-04-16  
**Group:** G10  
**Dependencies:** G1 (Engine-Core) ✅, G2 (Effect-System) ✅  
**Estimated time:** 2h  

---

## Overview

The Mod API enables **Runtime-Modding** via `window.EchoesOfSanguoMod`. Modders can load Cards, Opponents, Effects, and entire `.tcg` Archives.

**Access:**
```javascript
const mod = window.EchoesOfSanguoMod;
```

---

## API Reference

### Live Stores

| Property | Type | Description |
|----------|-----|--------------|
| `CARD_DB` | `Record<string, CardData>` | Live card database — directly mutate |
| `FUSION_RECIPES` | `FusionRecipe[]` | Fusion recipes — `push()` to add |
| `OPPONENT_CONFIGS` | `OpponentConfig[]` | Opponent configurations — `push()` |
| `STARTER_DECKS` | `Record<number, string[]>` | Starter decks — Keys = Race IDs |
| `EFFECT_REGISTRY` | `Map<string, EffectImpl>` | Read-only — all registered Effects |

### Methods

| Method | Signature | Description |
|--------|----------|--------------|
| `registerEffect` | `(type, impl) => void` | Register custom Effect handler |
| `loadModTcg` | `(source, onProgress) => Promise` | Load `.tcg` Archive |
| `unloadModCards` | `(source) => boolean` | Remove mod cards (partial) |
| `getLoadedMods` | `() => LoadedMod[]` | List all loaded mods |
| `getCurrentManifest` | `() => Manifest \| null` | Current manifest |
| `emitTrigger` | `(event, ctx) => void` | Fire custom Trigger |
| `addTriggerHook` | `(event, handler) => () => void` | Subscribe to Trigger |

---

## Adding Cards

### Directly to CARD_DB

```javascript
window.EchoesOfSanguoMod.CARD_DB['mod:dragon_01'] = {
  id: 'mod:dragon_01',
  name: 'Mod Dragon',
  type: 1, // Monster
  race: 1, // Warrior
  attribute: 3, // Fire
  rarity: 4, // Rare
  level: 7,
  atk: 2500,
  def: 2000,
  description: 'A powerful modded dragon.',
  effect: {
    trigger: 'onSummon',
    actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }]
  }
};
```

**Important:** ID should have a prefix (`mod:`) to avoid collisions.

---

## Custom Effect Handler

### Register

```javascript
window.EchoesOfSanguoMod.registerEffect('myCustomEffect', (action, ctx) => {
  ctx.log('Custom effect fired!');
  
  // Custom logic
  ctx.draw(ctx.owner, action.count ?? 1);
  
  // Optional: Return signal
  return {};
});
```

### Usage in .tcg

```
onSummon: myCustomEffect 2
```

---

## Loading TCG Mod

### From URL

```javascript
try {
  await window.EchoesOfSanguoMod.loadModTcg('https://example.com/mymod.tcg');
  console.log('Mod loaded!');
} catch (e) {
  console.error('Failed to load mod:', e);
}
```

### From ArrayBuffer (File Upload)

```javascript
const file = document.getElementById('mod-upload').files[0];
const buffer = await file.arrayBuffer();
await window.EchoesOfSanguoMod.loadModTcg(buffer, (pct) => {
  console.log(`Loading: ${pct}%`);
});
```

---

## Subscribing to Triggers

### Built-in Trigger

```javascript
// Subscribe
const unsubscribe = window.EchoesOfSanguoMod.addTriggerHook('onSummon', (ctx) => {
  if (ctx.card?.id === 'mod:dragon_01') {
    console.log('Mod Dragon summoned!', ctx);
  }
});

// Later: unsubscribe()
unsubscribe();
```

### Firing Custom Trigger

```javascript
// Owner Mod
window.EchoesOfSanguoMod.emitTrigger('mod:myEvent', {
  card: myCard,
  state: gameEngine.getState(),
  owner: 'player'
});

// Subscriber
window.EchoesOfSanguoMod.addTriggerHook('mod:myEvent', (ctx) => {
  console.log('Custom event!', ctx);
});
```

---

## Adding Fusion Recipes

```javascript
window.EchoesOfSanguoMod.FUSION_RECIPES.push({
  materials: ['mod:card1', 'mod:card2'],
  result: 'mod:fusion_result'
});
```

---

## Adding Opponents

```javascript
window.EchoesOfSanguoMod.OPPONENT_CONFIGS.push({
  id: 999,
  name: 'Mod Boss',
  title: 'The Modder',
  race: 1,
  flavor: 'A modded opponent',
  coinsWin: 100,
  coinsLoss: 10,
  deckIds: ['mod:dragon_01', 'mod:card2', 'mod:card3'],
  behaviorId: 'smart',
  currencyId: 'coins'
});
```

---

## Defining Starter Decks

```javascript
// Key = Race ID (must exist in TYPE_META.races)
window.EchoesOfSanguoMod.STARTER_DECKS[99] = [
  'mod:starter_1',
  'mod:starter_2',
  'mod:starter_3',
  'mod:starter_4',
  'mod:starter_5'
];
```

---

## Unloading Mod

### Partial Unload

```javascript
const success = window.EchoesOfSanguoMod.unloadModCards('https://example.com/mymod.tcg');
if (success) {
  console.log('Mod unloaded (cards and opponents removed)');
} else {
  console.log('Mod not found');
}
```

### Limitations

**is NOT reverted:**
- Fusion recipes
- Shop data
- Campaign data
- Type metadata
- Rules

**Workaround:** Page reload for complete reset.

---

## Listing Loaded Mods

```javascript
const mods = window.EchoesOfSanguoMod.getLoadedMods();
for (const mod of mods) {
  console.log(`Mod: ${mod.source}`);
  console.log(`  Cards: ${mod.cardIds.length}`);
  console.log(`  Opponents: ${mod.opponentIds.length}`);
  console.log(`  Loaded at: ${new Date(mod.timestamp)}`);
}
```

### LoadedMod Interface

```typescript
interface LoadedMod {
  source: string;       // URL or 'arraybuffer'
  cardIds: string[];
  opponentIds: number[];
  timestamp: number;
}
```

---

## Reading Manifest

```javascript
const manifest = window.EchoesOfSanguoMod.getCurrentManifest();
if (manifest) {
  console.log(`Mod: ${manifest.name} v${manifest.version}`);
  console.log(`Author: ${manifest.author}`);
  console.log(`Cards: ${manifest.cardCount}`);
}
```

### Manifest Interface

```typescript
interface TcgManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  cardCount: number;
  formatVersion: string;
}
```

---

## Complete Mod Example

```javascript
// 1. Register custom Effect
window.EchoesOfSanguoMod.registerEffect('stormDamage', (action, ctx) => {
  const damage = ctx.state[ctx.owner].field.monsters
    .filter(Boolean)
    .length * 200;
  
  ctx.damage('opponent', damage);
  ctx.log(`Storm deals ${damage} damage!`);
  
  return {};
});

// 2. Add card
window.EchoesOfSanguoMod.CARD_DB['mod:storm_mage'] = {
  id: 'mod:storm_mage',
  name: 'Storm Mage',
  type: 1,
  race: 5, // Spellcaster
  attribute: 4, // Wind
  level: 4,
  atk: 1500,
  def: 1200,
  description: 'Commands the storm.',
  effect: {
    trigger: 'onSummon',
    actions: [{ type: 'stormDamage' }]
  }
};

// 3. Define starter deck
window.EchoesOfSanguoMod.STARTER_DECKS[99] = ['mod:storm_mage'];

// 4. Subscribe to Summon trigger
window.EchoesOfSanguoMod.addTriggerHook('onSummon', (ctx) => {
  if (ctx.card?.id === 'mod:storm_mage') {
    console.log('Storm Mage summoned!');
  }
});
```

---

## Dependencies

| Dependency | Description |
|--------------|--------------|
| `src/cards.ts` | CARD_DB, FUSION_RECIPES |
| `src/effect-registry.ts` | EFFECT_REGISTRY, registerEffect |
| `src/tcg-bridge.ts` | loadAndApplyTcg, unloadModCards |
| `src/trigger-bus.ts` | TriggerBus emit/on |

---

## Notes / Gotchas

### 1. Hot Reload not supported

Mods can be loaded, but **not** hot-reloaded. For complete reset: Page reload.

### 2. ID Collisions

Mods should use **namespaced IDs**:
```javascript
// Good
'mod:dragon_01'
'mymod:custom_spell'

// Bad (collision with Base-Set)
'1', 'kurama'
```

### 3. Effect Handlers must be synchronous (for A-Triggers)

```javascript
// B-Triggers (async allowed)
registerEffect('asyncEffect', async (action, ctx) => {
  await someAsyncOperation();
  ctx.draw(ctx.owner, 1);
});
```

### 4. TriggerBus Handler Order

Handlers are called in **registration order**:
```javascript
addTriggerHook('onSummon', handler1);  // First
addTriggerHook('onSummon', handler2);  // Second
```

### 5. Partial Unload Limitation

`unloadModCards()` removes **only** cards and opponents. For complete unload:
- Mods should bring their own cleanup logic
- Or: Page reload

---

## References

- **Engine-Core** → `docs/engine-core.md` (G1)
- **Effect-System** → `docs/effect-system.md` (G2)
- **TCG-Format** → `docs/tcg-format.md` (G11)

---

**Status:** ✅ Complete
