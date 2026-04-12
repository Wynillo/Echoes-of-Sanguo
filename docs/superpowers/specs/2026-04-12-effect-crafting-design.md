# Effect Crafting System Design

**Date:** 2026-04-12  
**Status:** Draft

## Overview

A crafting system that allows players to permanently enhance normal monster cards by combining them with effect items. The resulting cards are stored as dynamically generated entries with their own unique IDs.

## Core Concept

```
Normal Monster + Effect Item (from Packs) + Currency → Effect Monster (new generated card)
```

Example: `Drake (ATK 1500, no effect)` + `Fire Dragon Effect Item` → `Drake with Fire Dragon's effect`

## Feature Flag

Controlled via `GAME_RULES` in `src/rules.ts`:

```typescript
export const GAME_RULES = {
  // ... existing rules
  craftingEnabled: false,
  craftingCurrency: undefined as string | undefined,
  craftingCost: 0,
};
```

- `craftingEnabled`: Master switch. When `false`, effect items don't drop and crafting UI is inaccessible.
- `craftingCurrency`: Currency ID for crafting cost. `undefined` = free crafting.
- `craftingCost`: Amount of currency required.

## Data Structures

### Effect Items

Effect items are not cards - they're crafting materials that reference existing effect monsters.

**New file:** `src/effect-items.ts`

```typescript
export interface EffectSource {
  id: string;           // ID of the source effect monster in CARD_DB
  name: string;         // Display name for the effect item
  rarity: number;       // Rarity for pack drop logic
}

export const EFFECT_SOURCES: Record<string, EffectSource> = {
  // Populated by mods/TCG archives
};
```

### Pack Slot Extension

**Modified:** `src/shop-data.ts`

```typescript
export interface PackSlotDef {
  count: number;
  rarity?: number;
  pool?: string;
  distribution?: Record<string, number>;
  effectItems?: boolean;  // NEW: if true, draws from EFFECT_SOURCES instead of CARD_DB
}
```

Example pack with effect items:

```typescript
{
  id: 'effect_pack',
  slots: [
    { count: 3, rarity: 2 },
    { count: 1, effectItems: true },  // Drops one effect item
  ],
}
```

### Crafted Card Records

Generated cards are tracked separately from CARD_DB.

```typescript
export interface CraftedCardRecord {
  id: string;              // Generated ID (>= 100_000_000, stored as string)
  baseId: string;          // Original base monster ID
  effectSourceId: string;  // Effect item source ID
}
```

### Progression Storage

**New keys in `src/progression.ts`:**

```typescript
// Added to SLOT_KEY_NAMES:
craftedCards: 'crafted_cards',    // CraftedCardRecord[]
nextCraftedId: 'next_crafted_id', // Counter starting at 1
```

**New API functions:**

```typescript
function getCraftedCards(): CraftedCardRecord[];
function addCraftedCard(baseId: string, effectSourceId: string): string;
function getCraftedCardData(id: string): CardData | null;
```

## ID Generation

Generated card IDs use a reserved numeric range to avoid collision with TCG-defined cards. IDs are generated as numbers but stored/used as strings for consistency with `CARD_DB`.

```typescript
const CRAFTED_ID_OFFSET = 100_000_000;

function generateCraftedId(): string {
  const nextId = getNextCraftedId();
  incrementCraftedId();
  return String(CRAFTED_ID_OFFSET + nextId);
}

function isCraftedId(id: string | number): boolean {
  return Number(id) >= CRAFTED_ID_OFFSET;
}
```

- Reserved range: `100_000_000` to `199_999_999`
- Counter stored per save slot in progression
- Returned as string for compatibility with CARD_DB key type

## Crafting Logic

**New file:** `src/crafting.ts`

### Main Function

```typescript
function craftEffectMonster(
  baseCardId: string,
  effectSourceId: string,
): { success: boolean; card?: CardData; error?: string }
```

### Validation

- `GAME_RULES.craftingEnabled === true`
- Base card exists in CARD_DB and has `type === CardType.Monster`
- Base card has no existing `effect` or `effects` field
- Effect source exists in EFFECT_SOURCES
- Player has sufficient currency (if configured)
- Player owns the base card (count > 0)
- Player owns the effect item (count > 0)

### Execution

1. Validate all conditions
2. Deduct currency from player
3. Remove base card from collection (decrement count)
4. Remove effect item from collection (decrement count)
5. Generate new crafted card ID
6. Store `CraftedCardRecord` in progression
7. Add generated card to collection

### Card Generation

```typescript
function buildCraftedCard(record: CraftedCardRecord): CardData | null {
  const baseCard = CARD_DB[record.baseId];
  const effectSource = CARD_DB[record.effectSourceId];
  
  if (!baseCard || !effectSource) return null;
  
  return {
    ...baseCard,
    id: record.id,
    effects: effectSource.effects ?? (effectSource.effect ? [effectSource.effect] : []),
  };
}
```

Note: Generated cards always use `effects` array, never singular `effect` field.

## Runtime Resolution

Generated cards don't exist in `CARD_DB`. They must be resolved at runtime.

### Integration in makeDeck()

**Modified:** `src/cards.ts`

```typescript
export function makeDeck(ids: string[]): CardData[] {
  return ids.flatMap(id => {
    let card = CARD_DB[id];
    
    // Check for generated/crafted cards
    if (!card && isCraftedId(id)) {
      card = resolveCraftedCard(id);
    }
    
    if (!card) {
      console.warn(`[makeDeck] Unknown card ID "${id}" – skipping.`);
      return [];
    }
    
    // ... rest of cloning logic
  });
}
```

### Client-Side Card Lookup

UI components should use a unified lookup function:

```typescript
function getCard(id: number | string): CardData | null {
  const strId = String(id);
  const numId = Number(id);
  
  if (numId >= CRAFTED_ID_OFFSET) {
    return resolveCraftedCard(numId);
  }
  
  return CARD_DB[strId] ?? null;
}
```

## Effect Item Collection

Effect items are stored in a separate structure, not mixed with the card collection.

**New progression key:**

```typescript
// Added to SLOT_KEY_NAMES:
effectItems: 'effect_items',  // EffectItemEntry[]
```

**Effect item entry:**

```typescript
interface EffectItemEntry {
  id: string;    // ID of the source effect monster
  count: number;
}
```

**New Progression API:**

```typescript
function getEffectItems(): EffectItemEntry[];
function addEffectItem(id: string, count?: number): void;
function removeEffectItem(id: string, count?: number): boolean;
function getEffectItemCount(id: string): number;
```

This separation keeps the card collection clean and avoids type conflicts with `CollectionEntry.id: string`.

### Pack Logic Integration

**Modified:** `src/react/utils/pack-logic.ts`

```typescript
export function openPack(packId: string): (CardData | EffectSource)[] {
  const pkg = SHOP_DATA.packs.find(p => p.id === packId);
  if (!pkg) return [];
  
  const results: (CardData | EffectSource)[] = [];
  
  for (const slot of pkg.slots) {
    if (slot.effectItems) {
      // Draw from EFFECT_SOURCES
      for (let i = 0; i < slot.count; i++) {
        const item = pickEffectItem(slot.rarity, slot.distribution);
        if (item) results.push(item);
      }
    } else {
      // Existing card draw logic
      // ...
    }
  }
  
  return results;
}
```

## UI: Crafting Tab

**Location:** New tab in Shop screen (alongside Packs tab)

**New component:** `src/react/CraftingScreen.tsx`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Packs]  [Crafting]                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ BASE MONSTERS    │  │ EFFECT ITEMS     │                │
│  │ ──────────────── │  │ ──────────────── │                │
│  │ [Drake] x2       │  │ [Fire Dragon] x1 │                │
│  │ [Soldier] x3     │  │ [Ice Wyrm] x1    │                │
│  │ ...              │  │ ...              │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  ┌───────────────────────────────────────────┐             │
│  │ PREVIEW                                   │             │
│  │ ───────────────────────────────────────── │             │
│  │ Drake with Fire Dragon Effect             │             │
│  │ ATK: 1500  DEF: 1200                      │             │
│  │ Effect: Deal 300 damage on summon         │             │
│  │                                           │             │
│  │ Cost: 100 Essence  [CRAFT]                │             │
│  └───────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### User Flow

1. Player selects a base monster from left panel (filtered to normal monsters only)
2. Player selects an effect item from right panel
3. Preview panel shows the resulting card
4. Player clicks CRAFT button
5. Confirmation dialog appears (optional)
6. On success, cards/items are removed from collection, new card is added
7. UI updates to reflect changes

### Error Handling

UI should display clear error messages:
- "Crafting is disabled" (when `craftingEnabled === false`)
- "Not enough Essence" (when insufficient currency)
- "Select a base monster and effect item" (when nothing selected)

## Testing Strategy

### Unit Tests

- `craftEffectMonster()` validation logic
- `buildCraftedCard()` card generation
- ID generation and counter persistence
- Currency deduction

### Integration Tests

- Full crafting flow end-to-end
- Pack opening with effect items
- Deck building with crafted cards
- Save/load with crafted cards in collection
- Feature flag disable path

### Test File

`tests/crafting.test.ts`

```typescript
describe('Crafting', () => {
  it('should validate base card is a normal monster');
  it('should generate unique IDs for crafted cards');
  it('should remove materials from collection');
  it('should add crafted card to collection');
  it('should respect craftingEnabled flag');
  it('should deduct currency when configured');
  it('should allow free crafting when no currency set');
});
```

## File Changes Summary

### New Files
- `src/crafting.ts` - Core crafting logic
- `src/effect-items.ts` - Effect source definitions
- `src/react/CraftingScreen.tsx` - UI component

### Modified Files
- `src/rules.ts` - Add crafting configuration fields
- `src/progression.ts` - Add crafted card storage and API
- `src/cards.ts` - Extend makeDeck() for crafted cards
- `src/shop-data.ts` - Extend PackSlotDef
- `src/react/utils/pack-logic.ts` - Handle effect item slots
- `src/react/Shop.tsx` - Add Crafting tab (file name may vary)

## Migration Notes

- Existing saves are compatible - crafted cards list starts empty
- No breaking changes to TCG format
- Mods can define EFFECT_SOURCES via TCG archive

## Open Questions

None currently identified.
