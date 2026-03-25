# Echoes of Sanguo — `.tcg` File Format

A `.tcg` file is a **ZIP archive** renamed to `.tcg`. It contains all data needed to run a card set: card definitions, images, localizations, opponents, shop configuration, and an optional campaign graph.

---

## Archive Structure

```
my-set.tcg  (ZIP)
│
├── cards.json                       ← REQUIRED · card stat data
├── cards_description.json           ← REQUIRED · default card names + descriptions (English)
├── img/                             ← REQUIRED · card artwork
│   ├── 1.png
│   ├── 2.png
│   └── ...
│
├── manifest.json                    ← recommended · format version + metadata
├── meta.json                        ← required for fusion + starter decks
├── id_migration.json                ← recommended · numeric ID → string ID mapping
│
├── races.json                       ← optional · race display metadata
├── attributes.json                  ← optional · attribute display metadata
├── card_types.json                  ← optional · card type display metadata
├── rarities.json                    ← optional · rarity display metadata
│
├── rules.json                       ← optional · override game constants
├── shop.json                        ← optional · booster pack definitions
├── campaign.json                    ← optional · campaign graph
│
├── opponents/                       ← optional · one file per opponent
│   ├── opponent_deck_1.json
│   └── ...
│
└── locales/                         ← optional · translation overrides
    ├── de_cards_description.json
    ├── de_races.json
    ├── de_attributes.json
    └── de_card_types.json
```

---

## Integer Enums

All enum fields in the format use integers, not strings.

### Card Type (`type`)
| ID | Key | Default Label |
|----|-----|---------------|
| 1 | Monster | Monster |
| 2 | Fusion | Fusion Monster |
| 3 | Spell | Spell |
| 4 | Trap | Trap |

### Attribute (`attribute`)
| ID | Key |
|----|-----|
| 1 | Light |
| 2 | Dark |
| 3 | Fire |
| 4 | Water |
| 5 | Earth |
| 6 | Wind |

### Race (`race`)
| ID | Key |
|----|-----|
| 1 | Dragon |
| 2 | Spellcaster |
| 3 | Warrior |
| 4 | Fire |
| 5 | Plant |
| 6 | Stone |
| 7 | Flyer |
| 8 | Elf |
| 9 | Demon |
| 10 | Water |

### Rarity (`rarity`)
| ID | Key |
|----|-----|
| 1 | Common |
| 2 | Uncommon |
| 4 | Rare |
| 6 | Super Rare |
| 8 | Ultra Rare |

### Spell Type (`spellType`)
| ID | Key |
|----|-----|
| 1 | normal |
| 2 | targeted |
| 3 | fromGrave |

### Trap Trigger (`trapTrigger`)
| ID | Key |
|----|-----|
| 1 | onAttack |
| 2 | onOwnMonsterAttacked |
| 3 | onOpponentSummon |
| 4 | manual |

---

## Required Files

### `cards.json`

Array of card stat objects. All integer IDs must be positive and unique.

```json
[
  {
    "id": 1,
    "type": 1,
    "level": 4,
    "rarity": 1,
    "atk": 1200,
    "def": 800,
    "attribute": 3,
    "race": 1
  },
  {
    "id": 2,
    "type": 3,
    "level": 1,
    "rarity": 2,
    "spellType": 2,
    "target": "oppMonster",
    "effect": "manual:tempAtkBonus(oppMonster,-500)"
  }
]
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | unique numeric ID |
| `type` | integer | yes | 1–4, see Card Type table |
| `level` | integer | yes | 1–12 |
| `rarity` | integer | yes | 1, 2, 4, 6, or 8 |
| `atk` | integer | monsters only | attack points |
| `def` | integer | monsters only | defense points |
| `attribute` | integer | monsters only | 1–6 |
| `race` | integer | monsters only | 1–10 |
| `effect` | string | no | effect string, see Effects section |
| `spellType` | integer | spells only | 1–3 |
| `trapTrigger` | integer | traps only | 1–4 |
| `target` | string | targeted spells/traps | `ownMonster` \| `oppMonster` \| `attacker` \| `defender` \| `summonedFC` |

---

### `cards_description.json`

Array mapping numeric card ID to display name and description. Must cover every card in `cards.json`.

```json
[
  { "id": 1, "name": "Sky Dragon", "description": "A fierce dragon from the clouds." },
  { "id": 2, "name": "Dark Binding", "description": "Reduces an opponent's monster ATK by 500." }
]
```

| Field | Type | Required |
|-------|------|----------|
| `id` | integer | yes |
| `name` | string | yes |
| `description` | string | yes |

---

### `img/`

One PNG image per card, named `{id}.png` (e.g. `img/1.png`). Missing images produce a warning but the card still loads with a placeholder.

Recommended size: **177 × 254 px** (standard card ratio).

---

## Recommended Files

### `manifest.json`

Identifies the archive and its format version.

```json
{
  "formatVersion": 2,
  "name": "My Custom Set",
  "author": "YourName",
  "features": [],
  "minEngineVersion": "1.0.0"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `formatVersion` | integer | yes | must be `> 0` |
| `name` | string | no | display name |
| `author` | string | no | |
| `features` | string[] | no | reserved for future feature flags |
| `minEngineVersion` | string | no | semver |

---

### `id_migration.json`

Maps human-readable string IDs to the numeric IDs used in `cards.json`. Allows effects and deck lists to reference cards by stable string names.

```json
{
  "sky_dragon": 1,
  "dark_binding": 2
}
```

Without this file, cards are referenced by their raw numeric IDs everywhere.

---

### `meta.json`

Defines fusion recipes and starter decks. Required if your set includes fusions or a campaign with selectable starter decks.

```json
{
  "fusionRecipes": [
    { "materials": [1, 3], "result": 50 }
  ],
  "starterDecks": {
    "1": [1, 1, 1, 3, 3, 3, 7, 7, 7],
    "3": [2, 2, 2, 5, 5, 5, 8, 8, 8]
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `fusionRecipes` | array | `materials`: two numeric card IDs; `result`: numeric card ID |
| `starterDecks` | object | keys are race IDs (as strings); values are arrays of numeric card IDs |

---

## Display Metadata Files

These files control how races, attributes, card types, and rarities are displayed in the UI. All are optional — the engine falls back to built-in defaults if absent.

Every entry uses the consistent schema `{ id, key, value, color, ... }`:
- `id` — integer matching the enum table above
- `key` — stable identifier string (machine-readable, never translated)
- `value` — display label (default language, usually English)
- `color` — hex color for UI rendering

Locale override files (in `locales/`) may only contain `{ "<id>": "<translated value>" }` entries — `color`, `key`, and other fields are not translated.

---

### `races.json`

```json
[
  { "id": 1, "key": "Dragon",      "value": "Dragon",      "color": "#8040c0", "icon": "🐲" },
  { "id": 2, "key": "Spellcaster", "value": "Spellcaster", "color": "#6060c0", "icon": "🔮" },
  { "id": 3, "key": "Warrior",     "value": "Warrior",     "color": "#c09030", "icon": "⚔️" }
]
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | integer, see Race table |
| `key` | yes | stable identifier, never displayed |
| `value` | yes | display name (default language) |
| `color` | yes | hex color for filter buttons |
| `icon` | no | emoji for filter buttons |

---

### `attributes.json`

```json
[
  { "id": 1, "key": "Light", "value": "Light", "color": "#c09000", "symbol": "☀" },
  { "id": 2, "key": "Dark",  "value": "Dark",  "color": "#7020a0", "symbol": "☽" },
  { "id": 3, "key": "Fire",  "value": "Fire",  "color": "#c0300a", "symbol": "♨" }
]
```

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | integer, see Attribute table |
| `key` | yes | stable identifier |
| `value` | yes | display name |
| `color` | yes | orb color in UI |
| `symbol` | no | single character symbol |

---

### `card_types.json`

```json
[
  { "id": 1, "key": "Monster", "value": "Monster",        "color": "#c8a850" },
  { "id": 2, "key": "Fusion",  "value": "Fusion Monster", "color": "#a050c0" },
  { "id": 3, "key": "Spell",   "value": "Spell",          "color": "#1dc0a0" },
  { "id": 4, "key": "Trap",    "value": "Trap",            "color": "#bc2060" }
]
```

---

### `rarities.json`

Not localized — rarity names like "Common" and "Rare" are treated as universal.

```json
[
  { "id": 1, "key": "Common",    "value": "Common",     "color": "#aaaaaa" },
  { "id": 2, "key": "Uncommon",  "value": "Uncommon",   "color": "#7ec8e3" },
  { "id": 4, "key": "Rare",      "value": "Rare",       "color": "#f5c518" },
  { "id": 6, "key": "SuperRare", "value": "Super Rare", "color": "#c084fc" },
  { "id": 8, "key": "UltraRare", "value": "Ultra Rare", "color": "#f97316" }
]
```

---

## Localization

The `locales/` folder contains translation overrides. Each file is named `{lang}_{target}.json` where `lang` is a two-letter ISO 639-1 code.

### `locales/de_cards_description.json`

Same schema as `cards_description.json` — a full array of `{ id, name, description }`. Only entries that differ from the default need to be included; missing IDs fall back to the root file.

```json
[
  { "id": 1, "name": "Himmelsdrache", "description": "Ein mächtiger Drache aus den Wolken." }
]
```

### `locales/de_races.json`

A flat object mapping `key` to translated `value`. Only entries that differ from the default are needed.

```json
{
  "Dragon":      "Drache",
  "Spellcaster": "Magier",
  "Demon":       "Dämon"
}
```

### `locales/de_attributes.json`

```json
{
  "Light": "Licht",
  "Dark":  "Dunkel",
  "Fire":  "Feuer"
}
```

### `locales/de_card_types.json`

```json
{
  "Spell": "Zauber",
  "Trap":  "Falle"
}
```

---

## Optional Game Files

### `rules.json`

Overrides engine constants. Any field not present keeps its default value.

```json
{
  "startingLP": 4000,
  "handLimitEnd": 6,
  "maxDeckSize": 30
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `startingLP` | `8000` | Starting life points |
| `handLimitDraw` | `10` | Max hand size during draw phase |
| `handLimitEnd` | `8` | Max hand size at end of turn (excess discarded) |
| `fieldZones` | `5` | Number of monster zones per side |
| `maxDeckSize` | `40` | Maximum deck size |
| `maxCardCopies` | `3` | Maximum copies of one card per deck |
| `drawPerTurn` | `1` | Cards drawn per turn |

---

### `shop.json`

Defines booster packs available in the shop.

```json
{
  "packs": [
    {
      "id": "standard",
      "name": "Standard Pack",
      "desc": "9 cards · All races · Balanced",
      "price": 300,
      "icon": "✦",
      "color": "#4080a0",
      "slots": [
        { "count": 5, "rarity": 1 },
        { "count": 2, "rarity": 2 },
        { "count": 1, "rarity": 4 },
        { "count": 1, "pool": "guaranteed_rare_plus", "distribution": { "4": 0.75, "6": 0.20, "8": 0.05 } }
      ]
    }
  ],
  "currency": { "nameKey": "common.coins", "icon": "◈" }
}
```

#### Pack fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | unique identifier |
| `name` | string | yes | display name |
| `desc` | string | yes | short description |
| `price` | integer | yes | cost in coins |
| `icon` | string | yes | single character / emoji |
| `color` | string | yes | hex color |
| `slots` | array | yes | see below |
| `filter` | string | no | `"byRace"` — limits cards to a chosen race |

#### Slot fields

| Field | Type | Notes |
|-------|------|-------|
| `count` | integer | number of cards from this slot |
| `rarity` | integer | fixed rarity (1, 2, 4, 6, or 8) |
| `pool` | string | `"guaranteed_rare_plus"` or `"guaranteed_sr_plus"` for weighted slots |
| `distribution` | object | rarity int → probability (used with `pool`) |

---

### `opponents/`

One JSON file per opponent. File names are arbitrary — the engine reads all `*.json` files inside `opponents/` and sorts them by `id`.

```json
{
  "id": 1,
  "name": "Apprentice Finn",
  "title": "Warrior Apprentice",
  "race": 3,
  "flavor": "An inexperienced fighter. Perfect for practice.",
  "coinsWin": 100,
  "coinsLoss": 20,
  "deckIds": [7, 7, 12, 12, 9, 9, 1, 3, 8, 8],
  "behavior": "aggressive"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | integer | yes | unique, used by campaign nodes |
| `name` | string | yes | default display name |
| `title` | string | yes | subtitle shown in opponent select |
| `race` | integer | yes | race ID (1–10) — used for opponent tile icon |
| `flavor` | string | yes | short flavor text |
| `coinsWin` | integer | yes | coins awarded on player win |
| `coinsLoss` | integer | yes | coins awarded on player loss |
| `deckIds` | integer[] | yes | numeric card IDs (duplicates allowed for multiple copies) |
| `behavior` | string | no | AI profile: `"aggressive"`, `"defensive"`, `"smart"`, `"conservative"` |

#### `locales/de_opponents_description.json`

Array of localized opponent texts. Only `name`, `title`, and `flavor` are translated.

```json
[
  { "id": 1, "name": "Lehrling Finn", "title": "Krieger-Lehrling", "flavor": "Ein unerfahrener Kämpfer." }
]
```

---

### `campaign.json`

Defines a graph-based campaign with chapters and nodes.

```json
{
  "chapters": [
    {
      "id": "ch1",
      "nodes": [
        {
          "id": "duel_1",
          "type": "duel",
          "opponentId": 1,
          "position": { "x": 400, "y": 60 },
          "unlockCondition": null,
          "connections": ["duel_2"]
        },
        {
          "id": "duel_2",
          "type": "duel",
          "opponentId": 2,
          "position": { "x": 400, "y": 140 },
          "unlockCondition": { "type": "nodeComplete", "nodeId": "duel_1" },
          "connections": ["duel_3"],
          "rewards": { "coins": 200, "cards": ["15"] }
        }
      ]
    }
  ]
}
```

#### Node fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | unique across all chapters |
| `type` | string | yes | `duel` \| `story` \| `reward` \| `shop` \| `branch` |
| `position` | object | yes | `{ x, y }` in pixels for map rendering |
| `unlockCondition` | object\|null | yes | `null` = always unlocked (use for the first node) |
| `opponentId` | integer | duel nodes | matches opponent `id` |
| `connections` | string[] | no | node IDs to draw connecting lines to |
| `rewards` | object | no | `{ coins?, cards?, unlocks? }` |
| `dialogueKeys` | string[] | story nodes | i18n keys for dialogue text |

#### Unlock conditions

```json
{ "type": "nodeComplete",  "nodeId": "duel_1" }
{ "type": "allComplete",   "nodeIds": ["duel_2a", "duel_2b"] }
{ "type": "anyComplete",   "nodeIds": ["duel_2a", "duel_2b"] }
{ "type": "cardOwned",     "cardId": "sky_dragon" }
{ "type": "winsCount",     "count": 5 }
```

---

## Effect String Format

Card effects are stored as a compact string:

```
trigger:action(args);action(args)
```

### Triggers

| Trigger | Used by |
|---------|---------|
| `onSummon` | monsters |
| `onDestroyByBattle` | monsters |
| `onDestroyByOpponent` | monsters |
| `passive` | monsters (always-on flags) |
| `onAttack` | traps |
| `onOwnMonsterAttacked` | traps |
| `onOpponentSummon` | traps |
| `manual` | spells, traps |

### Actions

| Action | Arguments | Notes |
|--------|-----------|-------|
| `dealDamage(target,value)` | target: `opponent`\|`self` | |
| `gainLP(target,value)` | target: `opponent`\|`self` | |
| `draw(target,count)` | target: `self`\|`opponent` | |
| `buffAtkRace(raceId,value)` | permanent ATK buff to all friendly monsters of race | |
| `buffAtkAttr(attrId,value)` | permanent ATK buff to all friendly monsters of attribute | |
| `debuffAllOpp(atkD,defD)` | permanent debuff to all opponent monsters | |
| `tempBuffAtkRace(raceId,value)` | temporary (until end of turn) | |
| `tempDebuffAllOpp(atkD[,defD])` | temporary | |
| `bounceStrongestOpp()` | return strongest opponent monster to hand | |
| `bounceAttacker()` | return attacking monster to hand | |
| `bounceAllOppMonsters()` | return all opponent monsters to hand | |
| `searchDeckToHand(attrId)` | add a card of the given attribute from deck to hand | |
| `tempAtkBonus(target,value)` | temporary ATK modification | target: stat target |
| `permAtkBonus(target,value[,attrFilter])` | permanent ATK modification | |
| `tempDefBonus(target,value)` | temporary DEF modification | |
| `permDefBonus(target,value)` | permanent DEF modification | |
| `reviveFromGrave()` | special summon a monster from the graveyard | |
| `cancelAttack()` | cancel the current attack (trap) | |
| `destroyAttacker()` | destroy the attacking monster (trap) | |
| `destroySummonedIf(minAtk)` | destroy the summoned monster if ATK >= minAtk (trap) | |
| `passive_piercing()` | damage carries through to DEF monsters | |
| `passive_untargetable()` | cannot be targeted by effects | |
| `passive_directAttack()` | can attack directly | |
| `passive_vsAttrBonus(attrId,atk)` | bonus ATK when battling monsters of this attribute | |
| `passive_phoenixRevival()` | revives once when destroyed | |

#### Stat targets

`ownMonster` · `oppMonster` · `attacker` · `defender` · `summonedFC`

#### Value expressions

Plain integer or a dynamic reference:

```
300                        → fixed value
attacker.effectiveATK*0.5f → 50% of attacker ATK, rounded down (f = floor)
attacker.effectiveATK*0.5c → 50% of attacker ATK, rounded up   (c = ceil)
```

#### Examples

```
onSummon:dealDamage(opponent,300)
onDestroyByBattle:gainLP(self,500)
passive:passive_piercing();passive_untargetable()
onAttack:dealDamage(opponent,attacker.effectiveATK*0.5f);cancelAttack()
manual:tempAtkBonus(oppMonster,-500)
onOpponentSummon:destroySummonedIf(1800)
```

---

## Minimal Working Set

The smallest valid `.tcg` you can ship:

```
my-set.tcg
├── cards.json               ← at least 1 card
├── cards_description.json   ← name + description for every card
└── img/
    └── 1.png
```

Everything else is optional and loaded when present.

---

## Validation

The engine validates the archive on load and reports errors and warnings to the browser console. Fatal errors (e.g. missing `cards.json`, cards without descriptions) prevent the archive from loading. Warnings (e.g. missing images, unknown fields) are logged but do not block loading.

To validate locally before shipping, run:

```bash
npm run generate:tcg    # rebuilds public/base.tcg and prints any warnings
```
