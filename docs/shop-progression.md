# Shop & Progression — Echoes of Sanguo

**Date:** 2026-04-17  
**Group:** G7  
**Dependencies:** G11 (TCG Format) ✅

---

## Overview

The progression system manages player persistence across the entire game lifecycle. All data is stored client-side in `localStorage` with support for **3 independent save slots**. The shop system provides a data-driven way to define card packs, currencies, and unlock conditions.

**Core Components:**
- `Progression` API — Save slot management, collection, deck, coins
- `SHOP_DATA` — Shop configuration (packs, currencies, backgrounds)
- `PackDef` / `PackSlotDef` — Pack structure with rarity distributions
- `CardPoolDef` — Card filtering for pack contents
- `currencies.ts` — Multi-currency support (coins, moderncoins, ancientcoins)
- `crafting.ts` — Effect item crafting system
- `pack-logic.ts` — Pack opening logic with pity system

---

## Architecture

### Data Flow

```
Player Action
     ↓
Progression API (selectSlot, addCoins, etc.)
     ↓
localStorage (tcg_s{slot}_* keys)
     ↓
Campaign / Shop / Collection screens read state
```

### Save Slot System

```
Slot 1: tcg_s1_collection, tcg_s1_deck, tcg_s1_coins, ...
Slot 2: tcg_s2_collection, tcg_s2_deck, tcg_s2_coins, ...
Slot 3: tcg_s3_collection, tcg_s3_deck, tcg_s3_coins, ...
Global: tcg_slot_meta, tcg_active_slot, tcg_settings
```

---

## Save Slot System

### SlotMeta Interface

```typescript
type SlotId = 1 | 2 | 3;

interface SlotMeta {
  slot: SlotId;              // 1, 2, or 3
  empty: boolean;            // Has no save data
  starterRace: string | null; // Chosen starter race ("warrior", "dragon", etc.)
  coins: number;             // Current coin balance
  currentChapter: string;    // Campaign chapter ("ch1", "ch2", etc.)
  lastSaved: string | null;  // ISO date string of last save
}
```

### Slot Management API

| Function | Signature | Description |
|----------|-----------|-------------|
| `selectSlot` | `(slot: SlotId) => void` | Activate a slot for all subsequent operations |
| `getActiveSlot` | `() => SlotId \| null` | Get currently active slot |
| `isSlotEmpty` | `(slot: SlotId) => boolean` | Check if slot has no save data |
| `getSlotMeta` | `() => SlotMeta[]` | Get metadata for all 3 slots |
| `deleteSlot` | `(slot: SlotId) => void` | Permanently delete all slot data |
| `hasAnySave` | `() => boolean` | Check if any slot has data |

**Example:**

```typescript
import { Progression } from './progression.js';

// Select slot 1
Progression.selectSlot(1);

// Check if slot has data
if (Progression.isSlotEmpty(1)) {
  console.log('Starting new game...');
}

// Get all slot metadata
const slots = Progression.getSlotMeta();
for (const meta of slots) {
  console.log(`Slot ${meta.slot}: ${meta.empty ? 'Empty' : meta.coins + ' coins'}`);
}
```

---

## localStorage Keys

All per-slot data uses the prefix `tcg_s{slot}_`. Global data uses `tcg_` prefix.

### Per-Slot Keys

| Logical Key | localStorage Key | Data Type | Description |
|-------------|------------------|-----------|-------------|
| `initialized` | `tcg_s{slot}_initialized` | string | Slot initialized flag |
| `starter_chosen` | `tcg_s{slot}_starter_chosen` | string | Starter selection complete |
| `starter_race` | `tcg_s{slot}_starter_race` | string | Selected race |
| `collection` | `tcg_s{slot}_collection` | `CollectionEntry[]` | Card collection with counts |
| `deck` | `tcg_s{slot}_deck` | `string[]` | Current deck (40 card IDs) |
| `currency_coins` | `tcg_s{slot}_currency_coins` | number | Coin balance |
| `opponents` | `tcg_s{slot}_opponents` | `Record<number, OpponentRecord>` | Opponent unlock/wins/losses |
| `campaign_progress` | `tcg_s{slot}_campaign_progress` | `CampaignProgress` | Completed nodes, chapter |
| `seen_cards` | `tcg_s{slot}_seen_cards` | `string[]` | Cards player has seen |
| `effect_items` | `tcg_s{slot}_effect_items` | `EffectItemEntry[]` | Owned effect items |
| `crafted_cards` | `tcg_s{slot}_crafted_cards` | `CraftedCardRecord[]` | Custom crafted cards |
| `next_crafted_id` | `tcg_s{slot}_next_crafted_id` | number | Next crafted card ID counter |
| `save_version` | `tcg_s{slot}_save_version` | number | Migration version |
| `duel_checkpoint` | `tcg_s{slot}_duel_checkpoint` | any | Duel resume data |

### Global Keys

| Key | Description |
|-----|-------------|
| `tcg_slot_meta` | Metadata for all slots (for save/load screen) |
| `tcg_active_slot` | Currently active slot ID |
| `tcg_settings` | Global settings (language, volume, controller) |
| `tcg_migration_pending` | Migration flag for v1 -> v2 |

---

## Progression API

### Initialization

```typescript
// Call once at app startup
Progression.init();

// Check if first launch (needs starter selection)
if (Progression.isFirstLaunch()) {
  showStarterSelection();
}

// Mark starter chosen
Progression.markStarterChosen('warrior'); // or 'dragon', 'spellcaster', etc.
```

### Collection Management

```typescript
interface CollectionEntry {
  id: string;     // Card ID
  count: number;  // Owned count
}

// Get collection
const collection: CollectionEntry[] = Progression.getCollection();

// Add cards
Progression.addCardsToCollection(['card1', 'card2']);
Progression.addCardsToCollection([{ id: 'card3' }, { id: 'card4' }]);

// Remove cards (decrements count)
Progression.removeCardsFromCollection(['card1']);

// Check ownership
const owns: boolean = Progression.ownsCard('kurama');
const count: number = Progression.cardCount('kurama');
```

### Deck Management

```typescript
// Get current deck (null if not set)
const deck: string[] | null = Progression.getDeck();

// Save deck (40 cards)
Progression.saveDeck(['card1', 'card2', /* ... 38 more ... */]);
```

### Currency (Legacy API)

```typescript
// These use the default 'coins' currency
const coins: number = Progression.getCoins();
const newBalance: number = Progression.addCoins(100);
const spent: boolean = Progression.spendCoins(50); // false if insufficient
```

### Multi-Currency API

```typescript
import { getCurrency, addCurrency, spendCurrency } from './currencies.js';

// Get currency for specific slot
const coins = getCurrency(1, 'coins');
const modern = getCurrency(1, 'moderncoins');
const ancient = getCurrency(1, 'ancientcoins');

// Add currency
addCurrency(1, 'coins', 100);
addCurrency(1, 'moderncoins', 10);

// Spend currency (returns false if insufficient)
const success = spendCurrency(1, 'ancientcoins', 5);
```

### Opponent Records

```typescript
interface OpponentRecord {
  unlocked: boolean;
  wins: number;
  losses: number;
}

// Get all opponent records
const opponents = Progression.getOpponents();

// Record duel result
Progression.recordDuelResult(1, true);  // Won vs opponent 1
Progression.recordDuelResult(1, false); // Lost vs opponent 1

// Check unlock status
const unlocked = Progression.isOpponentUnlocked(2);
```

### Campaign Progress

```typescript
interface CampaignProgress {
  completedNodes: string[];  // Completed node IDs
  currentChapter: string;    // Current chapter ID
}

// Get progress
const progress = Progression.getCampaignProgress();

// Mark node complete
Progression.markNodeComplete('ch1_node3');

// Check completion
const isDone = Progression.isNodeComplete('ch1_node3');
```

### Seen Cards

```typescript
// Get set of seen card IDs
const seen: Set<string> = Progression.getSeenCards();

// Mark cards as seen (for collection binder silhouettes)
Progression.markCardsAsSeen(['card1', 'card2']);
```

---

## Shop System

### SHOP_DATA Structure

```typescript
interface ShopData {
  packs: PackDef[];                    // Available card packs
  currencies: CurrencyDef[];           // Defined currencies
  backgrounds: Record<string, string>; // Background assets
}

// Global shop data (populated from .tcg pack)
export const SHOP_DATA: ShopData = {
  backgrounds: {},
  packs: [],
  currencies: [{ id: 'coins', nameKey: 'common.coins', icon: '\u25c8' }],
};

// Apply data from .tcg pack
applyShopData({
  packs: [/* ... */],
  currencies: [/* ... */],
  backgrounds: { shop: '/bg/shop.png' },
});
```

### PackDef

```typescript
interface PackDef {
  id: string;                    // Unique pack ID
  name: string;                  // Display name
  desc: string;                  // Description
  nameKey?: string;              // i18n key for name
  descKey?: string;              // i18n key for description
  price: number | PackPrice;     // Price (number = default currency)
  icon: string;                  // Icon identifier
  color: string;                 // Theme color
  slots: PackSlotDef[];          // Card slots in pack
  cardPool?: CardPoolDef;        // Card filtering
  unlockCondition?: UnlockCondition; // Unlock requirement
}

interface PackPrice {
  currencyId: string;  // Currency ID
  amount: number;      // Price amount
}
```

### PackSlotDef

```typescript
interface PackSlotDef {
  count: number;                      // Number of cards in this slot
  rarity?: number;                    // Fixed rarity (1=C, 2=U, 4=R, 6=SR, 8=UR)
  pool?: string;                      // Pool identifier
  distribution?: Record<string, number>; // Rarity -> probability
  effectItems?: boolean;              // Drop effect items instead of cards
}
```

**Example Pack Definition:**

```typescript
const examplePack: PackDef = {
  id: 'starter_pack',
  name: 'Starter Pack',
  desc: 'Basic cards for new players',
  price: 100,
  icon: 'pack_basic',
  color: '#4a90d9',
  slots: [
    { count: 4 },                    // 4 cards with default rarity distribution
    { count: 1, rarity: 4 },         // 1 guaranteed Rare
  ],
  cardPool: {
    include: { maxRarity: 4 },       // Only Common to Rare
    exclude: { types: [2] },         // No Fusion monsters
  },
  unlockCondition: null,             // Always available
};
```

### CardPoolDef & CardFilter

```typescript
interface CardPoolDef {
  include?: CardFilter;  // Cards must match ALL include fields
  exclude?: CardFilter;  // Cards matching ALL exclude fields are removed
}

interface CardFilter {
  races?: number[];       // Race enum values
  attributes?: number[];  // Attribute enum values
  types?: number[];       // CardType enum (1=Monster, 2=Fusion, 3=Spell, 4=Trap)
  maxRarity?: number;     // Rarity upper bound (inclusive)
  minRarity?: number;     // Rarity lower bound (inclusive)
  maxAtk?: number;        // ATK upper bound
  maxLevel?: number;      // Level upper bound
  spellTypes?: string[];  // Spell types ('normal', 'targeted', 'fromGrave')
  ids?: number[];         // Specific card IDs (override other filters)
}
```

**Filter Logic:**
- All specified fields use **AND** logic within a filter
- `include.ids` always keeps those cards (unless in `exclude.ids`)
- `exclude.ids` removes cards last (highest priority)

**Example:**

```typescript
const pool: CardPoolDef = {
  include: {
    races: [1, 2],           // Warrior or Dragon
    minRarity: 2,            // Uncommon or better
    maxAtk: 2000,            // ATK <= 2000
  },
  exclude: {
    ids: [123, 456],         // Exclude specific cards
    types: [2],              // No Fusion monsters
  },
};
```

---

## Rarity Drop Rates

### Default Rates

```typescript
// src/react/utils/pack-logic.ts
/**
 * Default rarity probability distribution for pack openings.
 * Values represent probabilities (0.0-1.0) and MUST sum to 1.0 (100%).
 */
export const DEFAULT_RARITY_PROBABILITIES: Record<string, number> = {
  [1]: 0.60,    // 60% - Common
  [2]: 0.30,    // 30% - Uncommon
  [4]: 0.089,   // 8.9% - Rare
  [6]: 0.01,    // 1% - Super Rare
  [8]: 0.001,   // 0.1% - Ultra Rare
};

// Deprecated alias (for backward compatibility)
export const RARITY_DROP_RATES = DEFAULT_RARITY_PROBABILITIES;
```

### Validation

The probability distribution is validated at runtime to ensure values sum to 1.0:

```typescript
// Throws Error if distribution doesn't sum to 100%
validateProbabilityDistribution(DEFAULT_RARITY_PROBABILITIES);
```

### Rarity Enum Values

| Value | Name | Color |
|-------|------|-------|
| 1 | Common | White/Gray |
| 2 | Uncommon | Green |
| 4 | Rare | Blue |
| 6 | Super Rare | Purple |
| 8 | Ultra Rare | Gold |

### Pity System

If no card in a pack opening is Rare (4) or better, one card is upgraded to Rare:

```typescript
// Pack with 5 Commons -> 4 Commons + 1 Rare (pity upgrade)
// Pack with 3 Commons + 2 Uncommons -> 3 Commons + 1 Uncommon + 1 Rare
```

The pity system prefers upgrading the highest rarity below Rare (Uncommon over Common).

### Custom Distributions

Override default rates per slot:

```typescript
const premiumPack: PackDef = {
  slots: [
    {
      count: 5,
      distribution: {
        [4]: 0.70,   // 70% Rare
        [6]: 0.25,   // 25% Super Rare
        [8]: 0.05,   // 5% Ultra Rare
      },
    },
  ],
};
```

---

## Unlock Conditions

### Types

```typescript
type UnlockCondition =
  | { type: 'nodeComplete'; nodeId: string }  // Campaign node completed
  | { type: 'winsCount'; count: number }      // Total wins across all opponents
  | null;                                      // Always unlocked
```

### Checking Unlock Status

```typescript
import { isPackUnlocked } from './react/utils/pack-logic.js';

const pack = SHOP_DATA.packs.find(p => p.id === 'advanced_pack');
if (isPackUnlocked(pack)) {
  showPackInShop(pack);
} else {
  showLockedMessage(pack.unlockCondition);
}
```

**Examples:**

```typescript
// Unlock after completing chapter 1
{ type: 'nodeComplete', nodeId: 'ch1_final' }

// Unlock after 10 total wins
{ type: 'winsCount', count: 10 }

// Always available
null
```

---

## Multi-Currency Support

### CurrencyDef

```typescript
interface CurrencyDef {
  id: string;           // Unique ID ('coins', 'moderncoins', 'ancientcoins')
  nameKey: string;      // i18n key ('shop.coins', 'shop.moderncoins')
  icon: string;         // Display icon
  requiredChapter?: number; // Chapter unlock requirement
}
```

### Storage

Each currency is stored separately:

```
tcg_s1_currency_coins        // Default coins
tcg_s1_currency_moderncoins  // Modern currency
tcg_s1_currency_ancientcoins // Ancient currency
```

### Usage in Packs

```typescript
const modernPack: PackDef = {
  id: 'modern_pack',
  price: { currencyId: 'moderncoins', amount: 50 },
  // ...
};

const ancientPack: PackDef = {
  id: 'ancient_pack',
  price: { currencyId: 'ancientcoins', amount: 10 },
  // ...
};
```

---

## Effect Items & Crafting

### Effect Items

Effect items are consumable items that can be used to craft custom effect monsters.

```typescript
interface EffectItemEntry {
  id: string;    // Effect item ID
  count: number; // Owned count
}

// Get owned effect items
const items = Progression.getEffectItems();

// Add items
Progression.addEffectItem('fire_breath', 2);

// Remove items (returns false if insufficient)
const removed = Progression.removeEffectItem('fire_breath', 1);

// Get count
const count = Progression.getEffectItemCount('fire_breath');
```

### CraftedCardRecord

Crafted cards combine a base monster with an effect source:

```typescript
interface CraftedCardRecord {
  id: string;           // Generated ID (>= 100_000_000)
  baseId: string;       // Base monster card ID
  effectSourceId: string; // Effect source card ID
}
```

### Crafting API

```typescript
import { craftEffectMonster, isCraftedId, resolveCraftedCard } from './crafting.js';

// Craft a new effect monster
const result = craftEffectMonster('warrior_base', 'fire_breath_effect');
if (result.success) {
  console.log(`Crafted: ${result.card!.name}`);
} else {
  console.error(result.error);
}

// Check if ID is crafted
const isCustom = isCraftedId('100000001'); // true

// Resolve crafted card data
const cardData = resolveCraftedCard('100000001');
```

### Crafting Requirements

1. Own the base monster card
2. Own the effect item
3. Base card must be a normal monster (no existing effect)
4. Pay crafting cost (if enabled in `GAME_RULES`)

---

## Examples

### Progression Initialization

```typescript
import { Progression } from './progression.js';

// At app startup
function initializeGame() {
  // Initialize progression system
  Progression.init();
  
  // Check for pending migration
  if (Progression.hasMigrationPending()) {
    showMigrationDialog();
    return;
  }
  
  // Check if any save exists
  if (!Progression.hasAnySave()) {
    showNewGameScreen();
    return;
  }
  
  // Show load game screen with slot selection
  const slots = Progression.getSlotMeta();
  showLoadGameScreen(slots);
}

// After slot selection
function startGame(slotId: SlotId) {
  Progression.selectSlot(slotId);
  
  if (Progression.isFirstLaunch()) {
    showStarterSelection();
  } else {
    showTitleScreen();
  }
}

// After starter selection
function completeStarterSelection(race: string) {
  Progression.markStarterChosen(race);
  
  // Give starter deck
  const starterDeck = STARTER_DECKS[race];
  Progression.saveDeck(starterDeck);
  Progression.addCardsToCollection(starterDeck);
  
  // Give starting coins
  Progression.addCoins(500);
  
  showTitleScreen();
}
```

### Shop Pack Opening

```typescript
import { openPack, buildCardPool, isPackUnlocked } from './react/utils/pack-logic.js';
import { Progression } from './progression.js';
import { SHOP_DATA } from './shop-data.js';

function buyPack(packId: string) {
  const pack = SHOP_DATA.packs.find(p => p.id === packId);
  if (!pack) return;
  
  // Check unlock condition
  if (!isPackUnlocked(pack)) {
    alert('This pack is locked!');
    return;
  }
  
  // Determine price
  const price = typeof pack.price === 'number' 
    ? { currencyId: 'coins', amount: pack.price }
    : pack.price;
  
  // Check and spend currency
  const { spendCurrency } = await import('./currencies.js');
  const success = spendCurrency(
    Progression.getActiveSlot()!, 
    price.currencyId, 
    price.amount
  );
  
  if (!success) {
    alert('Not enough currency!');
    return;
  }
  
  // Open pack
  const results = openPack(packId);
  
  // Process results
  const cardIds: string[] = [];
  const effectItemIds: string[] = [];
  
  for (const item of results) {
    if ('id' in item && 'atk' in item) {
      // It's a CardData
      cardIds.push(item.id);
    } else {
      // It's an EffectSource
      effectItemIds.push(item.id);
    }
  }
  
  // Add to collection
  if (cardIds.length > 0) {
    Progression.addCardsToCollection(cardIds);
    Progression.markCardsAsSeen(cardIds);
  }
  
  // Add effect items
  for (const itemId of effectItemIds) {
    Progression.addEffectItem(itemId, 1);
  }
  
  // Show pack opening animation
  showPackOpening(results);
}
```

### Building Custom Card Pool

```typescript
import { buildCardPool } from './react/utils/pack-logic.js';

const customPool = buildCardPool({
  include: {
    types: [1],           // Only monsters
    races: [1, 2, 3],     // Warrior, Dragon, Spellcaster
    maxRarity: 4,         // Up to Rare
    maxLevel: 4,          // Level 4 or lower
  },
  exclude: {
    ids: [1001, 1002],    // Exclude specific cards
    minRarity: 3,         // Exclude Rare+
  },
});

console.log(`Pool contains ${customPool.length} cards`);
```

---

## Dependencies

| File | Description |
|------|-------------|
| `src/progression.ts` | Main progression API, slot management, save/load |
| `src/shop-data.ts` | Shop configuration types and `SHOP_DATA` store |
| `src/currencies.ts` | Multi-currency functions (`getCurrency`, `addCurrency`, `spendCurrency`) |
| `src/crafting.ts` | Effect item crafting system |
| `src/react/utils/pack-logic.ts` | Pack opening logic, card pool building, pity system |
| `src/effect-items.ts` | Effect source definitions |

---

## Notes / Gotchas

### 1. localStorage Limits

Browser `localStorage` is typically limited to **5-10 MB**. The progression system stores:
- Collection (can grow large with many unique cards)
- Deck (40 card IDs)
- Opponent records (fixed size)
- Campaign progress (scales with content)
- Crafted cards (unbounded)

**Mitigation:** Crafted cards are stored as lightweight records, not full card data. The actual card is reconstructed on demand.

### 2. Save Version Migrations

The system supports save migrations via `save_version`:

```typescript
const SAVE_VERSION = 2; // Current version

// In init(), check saved version
if (savedVersion < 2) {
  // Perform migration
  migrateV1ToV2();
}
```

**v1 -> v2 Migration:** Clears collection and deck if old uppercase IDs detected (format change).

### 3. Starter Race is Permanent

Once `markStarterChosen()` is called, the starter race cannot be changed for that slot. This affects:
- Starting deck composition
- Campaign dialogue variations
- Available starter cards

### 4. Crafted Card IDs

Crafted cards use IDs starting at `100_000_000`:

```typescript
const CRAFTED_ID_OFFSET = 100_000_000;
// First crafted card: 100000000
// Second: 100000001
// etc.
```

These IDs are stored in the collection like regular cards. When resolving card data:

```typescript
// In cards.ts makeDeck()
if (isCraftedId(id)) {
  return resolveCraftedCard(id);
}
return CARD_DB[id];
```

### 5. Slot Must Be Selected

Most Progression APIs require an active slot:

```typescript
Progression.selectSlot(1); // Must call first

// These will throw if no slot selected:
Progression.getCoins();
Progression.getCollection();
Progression.saveDeck(deck);
```

### 6. Effect Items vs Cards

Pack slots can drop either cards OR effect items (not both):

```typescript
{ count: 1, effectItems: true }  // Drops effect item
{ count: 1, rarity: 4 }          // Drops card
```

### 7. Collection Entry Format

Collection stores `{id, count}` not raw card IDs:

```typescript
// Storage format
[
  { id: 'card1', count: 3 },
  { id: 'card2', count: 1 },
]

// NOT ['card1', 'card1', 'card1', 'card2']
```

### 8. Backup and Recovery

The system provides soft-reset backup:

```typescript
// Before destructive operation
Progression.backupToSession();

// Restore if needed
Progression.restoreFromBackup();

// Check if backup exists
if (Progression.hasBackup()) {
  showRestoreOption();
}
```

### 9. Duel Checkpoint

Duel state can be saved for resuming:

```typescript
// Save during duel
Progression.saveDuelCheckpoint({
  turn: 5,
  playerLP: 4000,
  opponentLP: 3200,
  // ... game state
});

// Load on resume
const checkpoint = Progression.loadDuelCheckpoint();

// Clear when duel ends
Progression.clearDuelCheckpoint();
```

---

## References

- **TCG Format** → `docs/tcg-format.md` (G11)
- **Campaign** → `docs/campaign.md` (G6)
- **Cards & Field** → `docs/cards-field.md` (G4)
- **Mod API** → `docs/mod-api.md` (G10)

---

**Status**: ✅ Complete
