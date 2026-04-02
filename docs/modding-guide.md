# Echoes of Sanguo — Modding Guide

Echoes of Sanguo exposes a live modding API via `window.EchoesOfSanguoMod`. Mods can add cards, opponents, fusions, and completely custom effects — without touching the game's source code.

---

## Prerequisites

- A modern browser with DevTools access, **or** a hosted HTML page with a `<script>` tag
- Basic JavaScript knowledge
- For `.tcg` archives: the format spec in [`docs/tcg-format.md`](./tcg-format.md)

The mod API is available as soon as the game finishes loading. Check readiness with:

```javascript
if (window.EchoesOfSanguoMod) {
  // safe to use
}
```

---

## API Reference

### `window.EchoesOfSanguoMod`

| Property / Method | Type | Description |
|---|---|---|
| `CARD_DB` | `Record<string, CardData>` | Live card registry — add or overwrite cards by ID |
| `FUSION_RECIPES` | `FusionRecipe[]` | Specific card-pair fusion recipes — push to add |
| `OPPONENT_CONFIGS` | `OpponentConfig[]` | Opponent definitions — push to add |
| `STARTER_DECKS` | `Record<number, string[]>` | Starter deck lists keyed by race ID |
| `EFFECT_REGISTRY` | `Map<string, EffectImpl>` | Read-only view of all registered effect handlers |
| `registerEffect(type, impl)` | `void` | Register a new effect handler |
| `loadModTcg(url)` | `Promise<void>` | Load a `.tcg` archive from a URL and merge its contents |
| `unloadModCards(modId)` | `void` | Remove cards and opponents added by a specific mod |
| `getLoadedMods()` | `ModEntry[]` | List all currently loaded mods with metadata |
| `emitTrigger(name, payload)` | `void` | Fire a named TriggerBus event |
| `addTriggerHook(name, handler)` | `() => void` | Subscribe to a trigger event; returns unsubscribe function |

---

## Adding Cards Directly

You can add cards to `CARD_DB` directly. IDs must be unique strings. For game data to survive across sessions, re-inject your mod in every page load.

```javascript
const mod = window.EchoesOfSanguoMod;

mod.CARD_DB['my_fire_dragon'] = {
  id:          'my_fire_dragon',
  name:        'Crimson Fire Drake',
  type:        1,        // 1 = Monster
  attribute:   3,        // 3 = Fire
  race:        1,        // 1 = Dragon
  rarity:      4,        // 4 = Rare
  level:       6,
  atk:         2200,
  def:         1800,
  description: 'A ferocious dragon wreathed in crimson flames.',
};
```

See [`docs/tcg-format.md`](./tcg-format.md) for the full field reference and all integer enum values.

---

## Adding Fusion Recipes

Push `FusionRecipe` objects to pair two specific card IDs into a result:

```javascript
const mod = window.EchoesOfSanguoMod;

mod.FUSION_RECIPES.push({
  materials: ['my_fire_dragon', '1'],   // two card IDs
  result:    'my_ultimate_dragon',       // result card ID
});
```

For race/attribute formula-based fusions, load a full `.tcg` archive with a `fusion_formulas.json` file instead (see the archive format below).

---

## Adding Opponents

```javascript
const mod = window.EchoesOfSanguoMod;

mod.OPPONENT_CONFIGS.push({
  id:       9001,
  name:     'Shadow Duelist',
  title:    'Unknown Challenger',
  race:     2,           // 2 = Spellcaster
  flavor:   'A mysterious figure from the shadows.',
  coinsWin: 500,
  coinsLoss: 50,
  deckIds:  ['1', '1', '1', '2', '2', '3', '3', 'my_fire_dragon'],
  behavior: 'aggressive',
});
```

Available `behavior` values: `"default"`, `"aggressive"`, `"defensive"`, `"smart"`, `"cheating"`.

---

## Custom Effects

Register a new effect type with `registerEffect(type, impl)`. The `impl` function receives a descriptor (the action payload) and an `EffectContext`.

### Example: Deal damage equal to your monster's ATK

**Effect string** (used in `cards.json`):

```
onSummon:mirrorStrike()
```

**Registration:**

```javascript
window.EchoesOfSanguoMod.registerEffect('mirrorStrike', (desc, ctx) => {
  const state   = ctx.engine.getState();
  const myMons  = state[ctx.owner].field.monsters.filter(Boolean);
  const maxATK  = myMons.reduce((m, fc) => Math.max(m, fc.effectiveATK()), 0);
  const opp     = ctx.owner === 'player' ? 'opponent' : 'player';
  ctx.engine.dealDamage(opp, maxATK);
  return {};
});
```

### EffectContext fields

| Field | Type | Available when |
|---|---|---|
| `engine` | `GameEngine` | always |
| `owner` | `'player' \| 'opponent'` | always |
| `targetFC` | `FieldCard` | targeted spells/traps |
| `targetCard` | `CardData` | fromGrave spells |
| `attacker` | `FieldCard` | onAttack / onOwnMonsterAttacked traps |
| `defender` | `FieldCard` | onOwnMonsterAttacked traps |
| `summonedFC` | `FieldCard` | onOpponentSummon traps |

### Return value

Return an `EffectSignal` object. Return `{}` for no special signal, or any of:

```javascript
return { cancelAttack: true };     // cancel the current attack
return { cancelEffect: true };     // negate the triggering spell (onOpponentSpell traps)
return { destroySummoned: true };  // destroy the just-summoned monster (onOpponentSummon traps)
return { destroyAttacker: true };  // destroy the attacker + cancel attack
```

---

## Loading a `.tcg` Archive

A `.tcg` file is a renamed ZIP containing cards, images, opponents, and more. Load one at runtime:

```javascript
await window.EchoesOfSanguoMod.loadModTcg('https://example.com/my-mod.tcg');
```

Or from a local file (requires browser File API):

```javascript
const file   = document.querySelector('input[type=file]').files[0];
const url    = URL.createObjectURL(file);
await window.EchoesOfSanguoMod.loadModTcg(url);
URL.revokeObjectURL(url);
```

The archive is merged into the running game — no restart needed.

To validate your archive before shipping:

```bash
npm run copy:tcg   # ensures node_modules/@wynillo/echoes-mod-base/tcg-src is up-to-date and reports warnings
```

See [`docs/tcg-format.md`](./tcg-format.md) for the full archive schema.

---

## TriggerBus

The TriggerBus lets effects and mods communicate across card boundaries.

### Subscribe to an event

```javascript
const unsub = window.EchoesOfSanguoMod.addTriggerHook('onSummon', ({ engine, owner, card }) => {
  console.log(`${card.name} was summoned by ${owner}`);
});

// Later, to unsubscribe:
unsub();
```

### Standard trigger names

| Name | Payload fields |
|---|---|
| `onSummon` | `engine`, `owner`, `card`, `fieldCard`, `zone` |
| `onFlipSummon` | `engine`, `owner`, `card`, `fieldCard`, `zone` |
| `onDestroyByBattle` | `engine`, `owner`, `card` |

### Custom trigger names

Fire arbitrary events from a custom effect and listen for them elsewhere:

```javascript
// In your effect:
ctx.engine.ui?.emitTrigger?.('myMod:dragonDestroyed', { engine: ctx.engine });

// In a TriggerBus hook:
window.EchoesOfSanguoMod.addTriggerHook('myMod:dragonDestroyed', ({ engine }) => {
  engine.dealDamage('opponent', 1000);
});
```

---

## Complete Minimal Mod

This standalone HTML snippet adds one card with a custom effect and one opponent — no build step required.

```html
<!DOCTYPE html>
<html>
<head>
  <title>EoS Mod Loader</title>
</head>
<body>
  <iframe src="https://your-game-host.com" id="game" style="width:100%;height:100vh;border:none;"></iframe>
  <script>
    document.getElementById('game').addEventListener('load', () => {
      const mod = document.getElementById('game').contentWindow.EchoesOfSanguoMod;
      if (!mod) return console.error('Mod API not available');

      // 1. Register a custom effect
      mod.registerEffect('onSummonBurn', (_desc, ctx) => {
        const opp = ctx.owner === 'player' ? 'opponent' : 'player';
        ctx.engine.dealDamage(opp, 500);
        return {};
      });

      // 2. Add a card that uses the effect
      mod.CARD_DB['mod_phoenix_ember'] = {
        id:          'mod_phoenix_ember',
        name:        'Phoenix Ember',
        type:        1,
        attribute:   3,
        race:        7,   // Phoenix
        rarity:      6,
        level:       5,
        atk:         1900,
        def:         1200,
        description: 'Deals 500 damage when summoned.',
        effect: {
          trigger: 'onSummon',
          actions: [{ type: 'onSummonBurn' }],
        },
      };

      // 3. Add an opponent using the card
      mod.OPPONENT_CONFIGS.push({
        id:       9001,
        name:     'Ember Duelist',
        title:    'Phoenix Summoner',
        race:     7,
        flavor:   'Summons the undying flame.',
        coinsWin: 300,
        coinsLoss: 30,
        deckIds:  Array(10).fill('mod_phoenix_ember'),
        behavior: 'aggressive',
      });

      console.log('[Mod] Phoenix Ember mod loaded!');
    });
  </script>
</body>
</html>
```

---

## Development Tips

- **Validate archives:** Run `npm run copy:tcg` to ensure node_modules/@wynillo/echoes-mod-base/tcg-src is current and see any format warnings
- **Inspect live state:** `window.EchoesOfSanguoMod.CARD_DB` is a live reference — check it in DevTools
- **Effect strings:** The compact string format (`onSummon:dealDamage(opponent,300)`) is parsed by the TCG format package; when injecting via JS, you can also provide a pre-parsed `effect` object directly (see example above)
- **ID collisions:** Use a unique prefix for all your card IDs (e.g., `mymod_`) to avoid conflicts with the base set
- **Persistence:** The mod API is in-memory. Re-inject your mod script on each page load, or load a `.tcg` archive which is cached for the session
