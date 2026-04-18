# TCG-Format — Echoes of Sanguo

**As of:** 2026-04-16  
**Group:** G11  
**Dependencies:** G4 (Cards & Field) ✅  
**Estimated time:** 2–3h  

---

## Overview

The `.tcg` format is a **ZIP archive** with JSON files and card images. It contains all card data, opponents, campaigns, shops, and localizations.

**Library:** `@wynillo/tcg-format` (external package)  
**Bridge:** `src/tcg-bridge.ts` (connects TCG with game stores)

---

## Archive Structure

```
base.tcg (ZIP)
├── manifest.json              # Metadata (Name, Version, Author)
├── cards.json                 # All cards (TcgCard[])
├── opponents.json             # Opponent configurations
├── starterDecks.json          # Starter decks per Race
├── fusion_recipes.json        # Explicit fusion recipes
├── tcg-src/
│   ├── opponents/             # Opponent deck files
│   └── ...
├── locales/
│   ├── en.json                # English translations
│   └── de.json                # German translations
└── images/                    # Card images (optional)
```

---

## manifest.json

```json
{
  "id": "base",
  "name": "Echoes of Sanguo - Base Set",
  "version": "1.0.0",
  "author": "Wynillo",
  "description": "Base card set for Echoes of Sanguo",
  "cardCount": 250,
  "formatVersion": "2.0"
}
```

**Fields:**
- `id` — Unique mod ID (for `unloadModCards()`)
- `formatVersion` — TCG format version (compatible with `@wynillo/tcg-format`)
- `cardCount` — Number of cards in the set

---

## cards.json

### TcgCard Structure

```typescript
interface TcgCard {
  id: string;
  name: string;
  type: number;           // 1=Monster, 2=Fusion, 3=Spell, 4=Trap, 5=Equipment
  race?: number;
  attribute?: number;
  rarity?: number;
  level?: number;
  atk?: number;
  def?: number;
  description: string;
  effect?: string;        // Effect string (serialized)
  trapTrigger?: number;   // Trap trigger ID
  target?: string;
  atkBonus?: number;
  defBonus?: number;
  equipRequirement?: {
    race?: number;
    attr?: number;
  };
}
```

**Effect String Format:**
See `docs/effect-system.md` for syntax.

**Example:**
```json
{
  "id": "kurama",
  "name": "Nine-Tailed Fox",
  "type": 1,
  "race": 4,
  "attribute": 3,
  "rarity": 4,
  "level": 4,
  "atk": 1500,
  "def": 1200,
  "description": "A cunning fox spirit.",
  "effect": "onSummon: draw 1"
}
```

---

## opponents.json

```typescript
interface TcgOpponentDeck {
  id: number;
  name: string;
  title: string;
  race: number;
  flavor: string;
  coinsWin: number;
  coinsLoss: number;
  currencyId?: string;
  deckIds: number[];
  behaviorId: 'default' | 'aggressive' | 'defensive' | 'smart' | 'cheating';
  rewardConfig?: DuelRewardConfig;
}
```

**Localization:** Name, Title, Flavor are loaded from `locales/{lang}.json`.

---

## starterDecks.json

```json
{
  "1": [1, 2, 3, 4, 5],
  "2": [6, 7, 8, 9, 10],
  "3": [11, 12, 13, 14, 15],
  "4": [16, 17, 18, 19, 20]
}
```

- **Key:** Race ID (number as string)
- **Value:** Array of card IDs (numbers)

---

## fusion_recipes.json

```json
[
  {
    "materials": ["kurama", "dragon_piper"],
    "result": "dragon_kitsune"
  }
]
```

**Note:** Formulas (race+race, etc.) are defined separately in `FUSION_FORMULAS[]`.

---

## locales/{lang}.json

```json
{
  "cards": {
    "kurama": {
      "name": "Nine-Tailed Fox",
      "description": "A cunning fox spirit."
    }
  },
  "opponents": {
    "1": {
      "name": "Apprentice Duelist",
      "title": "Novice",
      "flavor": "Just starting out."
    }
  },
  "types": {
    "Monster": "Monster",
    "Spell": "Spell",
    "Trap": "Trap"
  },
  "races": {
    "Dragon": "Dragon",
    "Warrior": "Warrior"
  },
  "attributes": {
    "Light": "Light",
    "Dark": "Dark"
  }
}
```

---

## Load Pipeline

### tcg-bridge.ts Flow

```typescript
// 1. loadAndApplyTcg(url: string | ArrayBuffer)
↓
// 2. Extract ZIP (jszip)
↓
// 3. Extract locales/{lang}.json
↓
// 4. Call loadTcgFile() from @wynillo/tcg-format
↓
// 5. Convert TcgCard[] → CardData[]
//    - Enum conversion (int → Race, Attribute)
//    - Effect string parsing
//    - Warnings for unknown values
↓
// 6. applyOpponents(), applyStarterDecks(), etc.
↓
// 7. Fill CARD_DB, FUSION_RECIPES
↓
// 8. Mod tracking (for unload)
```

### Code Example

```typescript
async function loadAndApplyTcg(
  source: string | ArrayBuffer,
  onProgress?: (percent: number) => void
): Promise<void> {
  // Extract ZIP
  const zip = await JSZip.loadAsync(source);
  
  // Extract locale
  const localeFile = zip.file(`locales/${lang}.json`);
  const locale = JSON.parse(await localeFile.async('text'));
  
  // Load TCG via library
  const result = await loadTcgFile({
    zipContent: zip,
    locale,
    onProgress
  });
  
  // Apply opponents
  if (result.opponents) {
    applyOpponents(result.opponents, locale.opponents);
  }
  
  // Apply cards
  for (const card of result.cards) {
    CARD_DB[card.id] = convertCardData(card);
  }
  
  // Track mod
  loadedMods.push({
    source: typeof source === 'string' ? source : 'arraybuffer',
    cardIds: result.cards.map(c => c.id),
    timestamp: Date.now()
  });
}
```

---

## Effect Serialization

### Library API (`@wynillo/tcg-format`)

```typescript
// Re-exported in src/effect-serializer.ts
import {
  isValidEffectString,
  parseEffectString,
  serializeEffect,
  deserializeEffect,
  isMultiBlockEffect
} from '@wynillo/tcg-format';
```

### Usage

```typescript
// Parse string → CardEffectBlock
const block = parseEffectString('onSummon: draw 2', 'monster');

// Serialize Block → string
const str = serializeEffect({
  trigger: 'onSummon',
  actions: [{ type: 'draw', count: 2 }]
});
// Result: "onSummon: draw 2"

// Validation
if (!isValidEffectString(effectString)) {
  console.warn('Invalid effect string!');
}
```

---

## Mod System

### Loaded Mod Tracking

```typescript
interface LoadedMod {
  source: string;       // URL or 'arraybuffer'
  cardIds: string[];    // All card IDs from this mod
  opponentIds: number[];
  timestamp: number;
}

const loadedMods: LoadedMod[] = [];
```

### Partial Unload

```typescript
function unloadModCards(source: string): boolean {
  const modIndex = loadedMods.findIndex(m => m.source === source);
  if (modIndex === -1) return false;
  
  const mod = loadedMods[modIndex];
  
  // Remove cards
  for (const cardId of mod.cardIds) {
    delete CARD_DB[cardId];
  }
  
  // Remove opponents
  const oppIds = new Set(mod.opponentIds);
  OPPONENT_CONFIGS.splice(
    OPPONENT_CONFIGS.findIndex(o => oppIds.has(o.id)),
    mod.opponentIds.length
  );
  
  loadedMods.splice(modIndex, 1);
  return true;
}
```

**Note:** Fusion recipes, shop data, campaign data are NOT reverted.

---

## Type Metadata

Loaded from `.tcg` via `applyTypeMeta()`:

```typescript
interface TypeMetaData {
  races?: RaceMeta[];
  attributes?: AttributeMeta[];
  rarities?: RarityMeta[];
  cardTypes?: CardTypeMeta[];
}

function applyTypeMeta(data: TypeMetaData): void {
  TYPE_META.races = data.races ?? [];
  TYPE_META.attributes = data.attributes ?? [];
  // ...
  rebuildIndices();
}
```

**Default values** can be set in `type-metadata.ts:initDefaults()`.

---

## Validation & Errors

### Card Conversion Warnings

```typescript
// In tcg-bridge.ts
if (!getRaceById(card.race)) {
  console.warn(`Unknown race ${card.race} for card ${card.id}`);
}

if (CARD_DB[card.id]) {
  console.warn(`Card ID collision: ${card.id} (overwriting)`);
}
```

### Effect Validation

```typescript
if (card.effect && !isValidEffectString(card.effect)) {
  console.warn(`Invalid effect string for card ${card.id}: "${card.effect}"`);
}
```

---

## Dependencies

| Dependency | Description |
|------------|-------------|
| `@wynillo/tcg-format` | TCG loading, validation, packing |
| `jszip` | ZIP extraction |
| `src/cards.ts` | CARD_DB store |
| `src/tcg-builder.ts` | CardData → TcgCard conversion |
| `src/effect-serializer.ts` | Effect parsing |
| `src/enums.ts` | Int → Enum conversion |

---

## Notes / Gotchas

### 1. Card IDs are Strings

Even though base set IDs are numbers (`"1"`, `"2"`), all IDs are **strings**. Mods should use descriptive IDs (`"mod:dragon_01"`).

### 2. Effect Strings are Optional

Cards without effects have `effect: undefined` or `effect: ""`.

### 3. Locale Fallback

When locale not found:
```typescript
const locale = result.locales.get(lang) 
            ?? result.locales.values().next().value;  // Fallback to first
```

### 4. Mod Loading Order

Mods are processed in loading order. On ID collisions, **later loaded mod overwrites** earlier ones.

### 5. TCG-Format Version

`formatVersion` in manifest.json determines compatibility with `@wynillo/tcg-format`.

---

## References

- **Cards & Field** → `docs/cards-field.md` (G4)
- **Effect System** → `docs/effect-system.md` (G2)
- **Mod API** → `docs/mod-api.md` (G10)

---

**Status:** ✅ Complete
