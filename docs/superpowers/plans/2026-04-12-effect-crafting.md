# Effect Crafting System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a crafting system that allows players to permanently combine normal monsters with effect items to create new effect monsters.

**Architecture:** Effect items are stored separately from cards, referenced by existing effect monster IDs. Crafted cards get generated IDs in reserved range (>= 100M) and are reconstructed at runtime from base card + effect source.

**Tech Stack:** TypeScript, React, Vitest, localStorage (Progression)

---

## File Structure

### New Files
- `src/effect-items.ts` - Effect source definitions and registry
- `src/crafting.ts` - Core crafting logic (ID generation, card building, validation)
- `src/react/CraftingScreen.tsx` - UI component for crafting tab
- `tests/crafting.test.ts` - Unit tests

### Modified Files
- `src/rules.ts` - Add crafting feature flags
- `src/shop-data.ts` - Extend PackSlotDef with effectItems
- `src/progression.ts` - Add effect item + crafted card storage
- `src/cards.ts` - Resolve crafted cards in makeDeck()
- `src/react/utils/pack-logic.ts` - Handle effect item slot drops

---

## Task 1: Add Crafting Feature Flags to Rules

**Files:**
- Modify: `src/rules.ts`

- [ ] **Step 1: Add crafting configuration fields to GAME_RULES**

```typescript
// In src/rules.ts, add to GAME_RULES object:
export const GAME_RULES = {
  startingLP: 8000,
  maxLP: 99999,
  handLimitDraw: 10,
  handLimitEnd: 8,
  fieldZones: 5,
  maxDeckSize: 40,
  maxCardCopies: 3,
  drawPerTurn: 1,
  handRefillSize: 5,
  refillHandEnabled: true,
  craftingEnabled: false,
  craftingCurrency: undefined as string | undefined,
  craftingCost: 0,
};
```

- [ ] **Step 2: Commit**

```bash
git add src/rules.ts
git commit -m "feat(crafting): add crafting feature flags to GAME_RULES"
```

---

## Task 2: Create Effect Items Module

**Files:**
- Create: `src/effect-items.ts`

- [ ] **Step 1: Create effect-items.ts with types and registry**

```typescript
// src/effect-items.ts
export interface EffectSource {
  id: string;
  name: string;
  rarity: number;
}

export const EFFECT_SOURCES: Record<string, EffectSource> = {};

export function getEffectSource(id: string): EffectSource | undefined {
  return EFFECT_SOURCES[id];
}

export function getEffectSourcesByRarity(rarity: number): EffectSource[] {
  return Object.values(EFFECT_SOURCES).filter(e => e.rarity === rarity);
}

export function registerEffectSource(source: EffectSource): void {
  EFFECT_SOURCES[source.id] = source;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/effect-items.ts
git commit -m "feat(crafting): add effect items module with types and registry"
```

---

## Task 3: Extend PackSlotDef for Effect Items

**Files:**
- Modify: `src/shop-data.ts`

- [ ] **Step 1: Add effectItems field to PackSlotDef interface**

```typescript
// In src/shop-data.ts, find PackSlotDef interface and add effectItems field:
export interface PackSlotDef {
  count: number;
  rarity?: number;
  pool?: string;
  distribution?: Record<string, number>;
  effectItems?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shop-data.ts
git commit -m "feat(crafting): extend PackSlotDef with effectItems field"
```

---

## Task 4: Add Effect Items Storage to Progression

**Files:**
- Modify: `src/progression.ts`

- [ ] **Step 1: Add effectItems key to SLOT_KEY_NAMES**

Find the SLOT_KEY_NAMES constant and add:

```typescript
const SLOT_KEY_NAMES = {
  initialized:      'initialized',
  starterChosen:    'starter_chosen',
  starterRace:      'starter_race',
  collection:       'collection',
  deck:             'deck',
  coins:            'jade_coins',
  opponents:        'opponents',
  version:          'save_version',
  seenCards:        'seen_cards',
  campaignProgress: 'campaign_progress',
  effectItems:      'effect_items',
} as const;
```

- [ ] **Step 2: Define EffectItemEntry interface**

Add near the top of the file after imports:

```typescript
interface EffectItemEntry {
  id: string;
  count: number;
}
```

- [ ] **Step 3: Add getEffectItems function**

Add inside the Progression IIFE, near other getter functions:

```typescript
function getEffectItems(): EffectItemEntry[] {
  return _load(_key(SLOT_KEY_NAMES.effectItems), [], v => Array.isArray(v));
}
```

- [ ] **Step 4: Add addEffectItem function**

```typescript
function addEffectItem(id: string, count: number = 1): void {
  const items = getEffectItems();
  const existing = items.find(e => e.id === id);
  if (existing) {
    existing.count += count;
  } else {
    items.push({ id, count });
  }
  _save(_key(SLOT_KEY_NAMES.effectItems), items);
}
```

- [ ] **Step 5: Add removeEffectItem function**

```typescript
function removeEffectItem(id: string, count: number = 1): boolean {
  const items = getEffectItems();
  const idx = items.findIndex(e => e.id === id);
  if (idx === -1) return false;
  
  items[idx].count -= count;
  if (items[idx].count <= 0) {
    items.splice(idx, 1);
  }
  _save(_key(SLOT_KEY_NAMES.effectItems), items);
  return true;
}
```

- [ ] **Step 6: Add getEffectItemCount function**

```typescript
function getEffectItemCount(id: string): number {
  const items = getEffectItems();
  const entry = items.find(e => e.id === id);
  return entry ? entry.count : 0;
}
```

- [ ] **Step 7: Export functions in public API**

Add to the return object at the end of the Progression IIFE:

```typescript
return {
  // ... existing exports
  getEffectItems,
  addEffectItem,
  removeEffectItem,
  getEffectItemCount,
};
```

- [ ] **Step 8: Commit**

```bash
git add src/progression.ts
git commit -m "feat(crafting): add effect items storage to Progression"
```

---

## Task 5: Add Crafted Cards Storage to Progression

**Files:**
- Modify: `src/progression.ts`

- [ ] **Step 1: Add craftedCards and nextCraftedId keys to SLOT_KEY_NAMES**

```typescript
const SLOT_KEY_NAMES = {
  // ... existing keys
  effectItems:      'effect_items',
  craftedCards:     'crafted_cards',
  nextCraftedId:    'next_crafted_id',
} as const;
```

- [ ] **Step 2: Define CraftedCardRecord interface**

Add after EffectItemEntry:

```typescript
interface CraftedCardRecord {
  id: string;
  baseId: string;
  effectSourceId: string;
}
```

- [ ] **Step 3: Add getCraftedCards function**

```typescript
function getCraftedCards(): CraftedCardRecord[] {
  return _load(_key(SLOT_KEY_NAMES.craftedCards), [], v => Array.isArray(v));
}
```

- [ ] **Step 4: Add getNextCraftedId function**

```typescript
function getNextCraftedId(): number {
  return _load(_key(SLOT_KEY_NAMES.nextCraftedId), 1, v => typeof v === 'number');
}
```

- [ ] **Step 5: Add incrementCraftedId function**

```typescript
function incrementCraftedId(): void {
  const next = getNextCraftedId() + 1;
  _save(_key(SLOT_KEY_NAMES.nextCraftedId), next);
}
```

- [ ] **Step 6: Add addCraftedCard function**

```typescript
function addCraftedCard(baseId: string, effectSourceId: string): string {
  const CRAFTED_ID_OFFSET = 100_000_000;
  const nextId = getNextCraftedId();
  incrementCraftedId();
  
  const generatedId = String(CRAFTED_ID_OFFSET + nextId);
  
  const records = getCraftedCards();
  records.push({
    id: generatedId,
    baseId,
    effectSourceId,
  });
  _save(_key(SLOT_KEY_NAMES.craftedCards), records);
  
  return generatedId;
}
```

- [ ] **Step 7: Add findCraftedRecord function**

```typescript
function findCraftedRecord(id: string): CraftedCardRecord | undefined {
  const records = getCraftedCards();
  return records.find(r => r.id === id);
}
```

- [ ] **Step 8: Export functions in public API**

```typescript
return {
  // ... existing exports
  getEffectItems,
  addEffectItem,
  removeEffectItem,
  getEffectItemCount,
  getCraftedCards,
  addCraftedCard,
  findCraftedRecord,
};
```

- [ ] **Step 9: Commit**

```bash
git add src/progression.ts
git commit -m "feat(crafting): add crafted cards storage to Progression"
```

---

## Task 6: Create Crafting Module

**Files:**
- Create: `src/crafting.ts`

- [ ] **Step 1: Create crafting.ts with ID utilities and card building**

```typescript
// src/crafting.ts
import { CARD_DB } from './cards.js';
import { GAME_RULES } from './rules.js';
import { Progression } from './progression.js';
import { getEffectSource } from './effect-items.js';
import { spendCurrency } from './currencies.js';
import type { CardData } from './types.js';
import type { CraftedCardRecord } from './progression.js';

const CRAFTED_ID_OFFSET = 100_000_000;

export function isCraftedId(id: string | number): boolean {
  return Number(id) >= CRAFTED_ID_OFFSET;
}

export function buildCraftedCard(record: CraftedCardRecord): CardData | null {
  const baseCard = CARD_DB[record.baseId];
  const effectSource = CARD_DB[record.effectSourceId];
  
  if (!baseCard || !effectSource) return null;
  
  return {
    ...baseCard,
    id: record.id,
    effects: effectSource.effects ?? (effectSource.effect ? [effectSource.effect] : []),
  };
}

export function resolveCraftedCard(id: string): CardData | null {
  const record = Progression.findCraftedRecord(id);
  if (!record) return null;
  return buildCraftedCard(record);
}

export interface CraftResult {
  success: boolean;
  card?: CardData;
  error?: string;
}

export function craftEffectMonster(
  baseCardId: string,
  effectSourceId: string,
): CraftResult {
  if (!GAME_RULES.craftingEnabled) {
    return { success: false, error: 'Crafting is disabled' };
  }
  
  const baseCard = CARD_DB[baseCardId];
  if (!baseCard) {
    return { success: false, error: 'Base card not found' };
  }
  
  if (baseCard.type !== 1) {
    return { success: false, error: 'Base card must be a monster' };
  }
  
  if (baseCard.effect || baseCard.effects) {
    return { success: false, error: 'Base card already has an effect' };
  }
  
  const effectSource = getEffectSource(effectSourceId);
  if (!effectSource) {
    return { success: false, error: 'Effect source not found' };
  }
  
  const cardCount = Progression.cardCount(baseCardId);
  if (cardCount <= 0) {
    return { success: false, error: 'You do not own this base card' };
  }
  
  const itemCount = Progression.getEffectItemCount(effectSourceId);
  if (itemCount <= 0) {
    return { success: false, error: 'You do not own this effect item' };
  }
  
  if (GAME_RULES.craftingCurrency && GAME_RULES.craftingCost > 0) {
    const spent = spendCurrency(Progression.getActiveSlot()!, GAME_RULES.craftingCurrency, GAME_RULES.craftingCost);
    if (!spent) {
      return { success: false, error: 'Insufficient currency' };
    }
  }
  
  Progression.addCardsToCollection([{ id: baseCardId, count: -1 }]);
  Progression.removeEffectItem(effectSourceId, 1);
  
  const newId = Progression.addCraftedCard(baseCardId, effectSourceId);
  Progression.addCardsToCollection([{ id: newId, count: 1 }]);
  
  const card = buildCraftedCard({ id: newId, baseId: baseCardId, effectSourceId });
  
  return { success: true, card };
}

export function getCard(id: string | number): CardData | null {
  const strId = String(id);
  
  if (isCraftedId(strId)) {
    return resolveCraftedCard(strId);
  }
  
  return CARD_DB[strId] ?? null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/crafting.ts
git commit -m "feat(crafting): add crafting module with ID generation and card building"
```

---

## Task 7: Extend Cards Module for Crafted Card Resolution

**Files:**
- Modify: `src/cards.ts`

- [ ] **Step 1: Import crafting functions at top of cards.ts**

Add to imports:

```typescript
import { isCraftedId, resolveCraftedCard } from './crafting.js';
```

- [ ] **Step 2: Modify makeDeck to resolve crafted cards**

Find the makeDeck function and update the card lookup:

```typescript
export function makeDeck(ids: string[]): CardData[] {
  return ids.flatMap(id => {
    let card = CARD_DB[id];
    
    if (!card && isCraftedId(id)) {
      card = resolveCraftedCard(id);
    }
    
    if (!card) {
      console.warn(`[makeDeck] Unknown card ID "${id}" – skipping.`);
      return [];
    }
    if (!card.effect && !card.effects) return [{ ...card }];
    const cloned: CardData = { ...card };
    if (card.effect) cloned.effect = { ...card.effect, actions: [...card.effect.actions] };
    if (card.effects) cloned.effects = card.effects.map(b => ({ ...b, actions: [...b.actions] }));
    return [cloned];
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/cards.ts
git commit -m "feat(crafting): resolve crafted cards in makeDeck"
```

---

## Task 8: Handle Effect Item Drops in Pack Logic

**Files:**
- Modify: `src/react/utils/pack-logic.ts`

- [ ] **Step 1: Import effect items module**

Add to imports:

```typescript
import { EFFECT_SOURCES, type EffectSource } from '../../effect-items.js';
```

- [ ] **Step 2: Add pickEffectItem helper function**

Add before openPack function:

```typescript
function pickEffectItem(
  rarity?: number,
  distribution?: Record<string, number>,
): EffectSource | null {
  const sources = Object.values(EFFECT_SOURCES);
  if (sources.length === 0) return null;
  
  if (rarity !== undefined) {
    const filtered = sources.filter(s => s.rarity === rarity);
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
  }
  
  if (distribution) {
    const r = Math.random();
    let cumulative = 0;
    const entries = Object.entries(distribution)
      .map(([k, v]) => [Number(k), v] as [number, number])
      .sort((a, b) => a[1] - b[1]);
    
    for (const [rarityValue, prob] of entries) {
      cumulative += prob;
      if (r < cumulative) {
        const filtered = sources.filter(s => s.rarity === rarityValue);
        if (filtered.length > 0) {
          return filtered[Math.floor(Math.random() * filtered.length)];
        }
      }
    }
  }
  
  return sources[Math.floor(Math.random() * sources.length)];
}
```

- [ ] **Step 3: Update openPack return type and add effect item handling**

Modify the openPack function:

```typescript
export function openPack(packId: string): (CardData | EffectSource)[] {
  const pkg = SHOP_DATA.packs.find(p => p.id === packId);
  if (!pkg) return [];

  const pool = buildCardPool(pkg.cardPool);
  const results: (CardData | EffectSource)[] = [];

  for (const slot of pkg.slots) {
    if (slot.effectItems) {
      for (let i = 0; i < slot.count; i++) {
        const item = pickEffectItem(slot.rarity, slot.distribution);
        if (item) results.push(item);
      }
    } else {
      const rarities = _applyPity(_expandSlots({ slots: [slot] }));
      for (const rarity of rarities) {
        let candidates = pool.filter(c => (c.rarity ?? 1) === rarity);
        const fallbacks: Partial<Record<Rarity, Rarity>> = {
          [8]: 6,
          [6]: 4,
          [4]: 2,
          [2]: 1,
        };
        let currentRarity = rarity;
        while (!candidates.length && fallbacks[currentRarity]) {
          currentRarity = fallbacks[currentRarity]!;
          candidates = pool.filter(c => (c.rarity ?? 1) === currentRarity);
        }
        if (!candidates.length) candidates = pool.length ? pool : Object.values(CARD_DB) as CardData[];
        results.push(candidates[Math.floor(Math.random() * candidates.length)]);
      }
    }
  }

  return results;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/react/utils/pack-logic.ts
git commit -m "feat(crafting): handle effect item drops in pack logic"
```

---

## Task 9: Write Unit Tests for Crafting

**Files:**
- Create: `tests/crafting.test.ts`

- [ ] **Step 1: Create test file with basic crafting tests**

```typescript
// tests/crafting.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/cards.js', () => ({
  CARD_DB: {
    'monster_001': { id: 'monster_001', name: 'Test Monster', type: 1, atk: 1000, def: 1000, description: 'A test monster' },
    'effect_monster_001': { id: 'effect_monster_001', name: 'Effect Monster', type: 1, atk: 1500, def: 1200, description: 'Has effect', effects: [{ trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] }] },
  },
}));

vi.mock('../src/progression.js', () => ({
  Progression: {
    getActiveSlot: () => 1,
    cardCount: vi.fn(() => 1),
    getEffectItemCount: vi.fn(() => 1),
    addCardsToCollection: vi.fn(),
    removeEffectItem: vi.fn(),
    addCraftedCard: vi.fn(() => '100000001'),
    findCraftedRecord: vi.fn(),
  },
}));

vi.mock('../src/currencies.js', () => ({
  spendCurrency: vi.fn(() => true),
}));

import { GAME_RULES, applyRules } from '../src/rules.js';
import { isCraftedId, buildCraftedCard, craftEffectMonster } from '../src/crafting.js';
import { EFFECT_SOURCES, registerEffectSource } from '../src/effect-items.js';
import { Progression } from '../src/progression.js';

describe('Crafting', () => {
  beforeEach(() => {
    applyRules({ craftingEnabled: false, craftingCurrency: undefined, craftingCost: 0 });
    Object.keys(EFFECT_SOURCES).forEach(k => delete EFFECT_SOURCES[k]);
    vi.clearAllMocks();
  });

  describe('isCraftedId', () => {
    it('should return true for IDs >= 100000000', () => {
      expect(isCraftedId('100000000')).toBe(true);
      expect(isCraftedId('150000000')).toBe(true);
      expect(isCraftedId(100000001)).toBe(true);
    });

    it('should return false for IDs < 100000000', () => {
      expect(isCraftedId('1')).toBe(false);
      expect(isCraftedId('999')).toBe(false);
      expect(isCraftedId(1500)).toBe(false);
    });
  });

  describe('buildCraftedCard', () => {
    it('should combine base card stats with effect source effects', () => {
      registerEffectSource({ id: 'effect_monster_001', name: 'Test Effect', rarity: 4 });
      
      const record = { id: '100000001', baseId: 'monster_001', effectSourceId: 'effect_monster_001' };
      const card = buildCraftedCard(record);
      
      expect(card).not.toBeNull();
      expect(card!.id).toBe('100000001');
      expect(card!.name).toBe('Test Monster');
      expect(card!.atk).toBe(1000);
      expect(card!.effects).toHaveLength(1);
    });

    it('should return null for invalid base card', () => {
      const record = { id: '100000001', baseId: 'nonexistent', effectSourceId: 'effect_monster_001' };
      expect(buildCraftedCard(record)).toBeNull();
    });
  });

  describe('craftEffectMonster', () => {
    it('should fail when crafting is disabled', () => {
      const result = craftEffectMonster('monster_001', 'effect_monster_001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Crafting is disabled');
    });

    it('should fail when player does not own base card', () => {
      applyRules({ craftingEnabled: true });
      vi.mocked(Progression.cardCount).mockReturnValue(0);
      registerEffectSource({ id: 'effect_monster_001', name: 'Test Effect', rarity: 4 });
      
      const result = craftEffectMonster('monster_001', 'effect_monster_001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('You do not own this base card');
    });

    it('should fail when base card has existing effect', () => {
      applyRules({ craftingEnabled: true });
      
      const result = craftEffectMonster('effect_monster_001', 'effect_monster_001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Base card already has an effect');
    });

    it('should succeed with valid inputs and free crafting', () => {
      applyRules({ craftingEnabled: true, craftingCost: 0 });
      registerEffectSource({ id: 'effect_monster_001', name: 'Test Effect', rarity: 4 });
      
      const result = craftEffectMonster('monster_001', 'effect_monster_001');
      expect(result.success).toBe(true);
      expect(result.card).toBeDefined();
      expect(Progression.addCraftedCard).toHaveBeenCalledWith('monster_001', 'effect_monster_001');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they work**

```bash
npm test -- tests/crafting.test.ts
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/crafting.test.ts
git commit -m "test(crafting): add unit tests for crafting logic"
```

---

## Task 10: Create CraftingScreen UI Component

**Files:**
- Create: `src/react/CraftingScreen.tsx`

- [ ] **Step 1: Create CraftingScreen component**

```typescript
// src/react/CraftingScreen.tsx
import { useState, useMemo } from 'react';
import { CARD_DB } from '../cards.js';
import { GAME_RULES } from '../rules.js';
import { Progression } from '../progression.js';
import { EFFECT_SOURCES } from '../effect-items.js';
import { craftEffectMonster } from '../crafting.js';
import { getCurrency } from '../currencies.js';
import type { CardData } from '../types.js';
import './CraftingScreen.css';

export function CraftingScreen() {
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const config = useMemo(() => ({
    enabled: GAME_RULES.craftingEnabled,
    currency: GAME_RULES.craftingCurrency,
    cost: GAME_RULES.craftingCost,
  }), []);

  const normalMonsters = useMemo(() => {
    const collection = Progression.getCollection();
    return collection
      .filter(e => e.count > 0)
      .map(e => CARD_DB[e.id])
      .filter((c): c is CardData => !!c && c.type === 1 && !c.effect && !c.effects);
  }, [success]);

  const effectItems = useMemo(() => {
    const items = Progression.getEffectItems();
    return items.filter(e => e.count > 0).map(e => ({
      ...EFFECT_SOURCES[e.id],
      count: e.count,
    })).filter(e => e.id);
  }, [success]);

  const canCraft = selectedBase && selectedEffect && config.enabled;

  const handleCraft = () => {
    if (!selectedBase || !selectedEffect) return;
    
    setError(null);
    const result = craftEffectMonster(selectedBase, selectedEffect);
    
    if (result.success) {
      setSuccess(s => !s);
      setSelectedBase(null);
      setSelectedEffect(null);
    } else {
      setError(result.error || 'Unknown error');
    }
  };

  if (!config.enabled) {
    return (
      <div className="crafting-disabled">
        <p>Crafting is not available.</p>
      </div>
    );
  }

  return (
    <div className="crafting-screen">
      <div className="crafting-panels">
        <div className="crafting-panel">
          <h3>Base Monsters</h3>
          <div className="crafting-list">
            {normalMonsters.map(card => (
              <div
                key={card.id}
                className={`crafting-item ${selectedBase === card.id ? 'selected' : ''}`}
                onClick={() => setSelectedBase(card.id)}
              >
                <span className="crafting-item-name">{card.name}</span>
                <span className="crafting-item-count">x{Progression.cardCount(card.id)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="crafting-panel">
          <h3>Effect Items</h3>
          <div className="crafting-list">
            {effectItems.map(item => (
              <div
                key={item.id}
                className={`crafting-item ${selectedEffect === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedEffect(item.id)}
              >
                <span className="crafting-item-name">{item.name}</span>
                <span className="crafting-item-count">x{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="crafting-preview">
        <h3>Preview</h3>
        {selectedBase && selectedEffect && (
          <div className="preview-card">
            <p><strong>{CARD_DB[selectedBase]?.name}</strong> with effect</p>
          </div>
        )}
        
        {config.cost > 0 && config.currency && (
          <p className="crafting-cost">
            Cost: {config.cost} {config.currency}
          </p>
        )}

        {error && <p className="crafting-error">{error}</p>}

        <button
          className="crafting-button"
          disabled={!canCraft}
          onClick={handleCraft}
        >
          Craft
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CraftingScreen.css**

```css
/* src/react/CraftingScreen.css */
.crafting-screen {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.crafting-disabled {
  padding: 2rem;
  text-align: center;
  color: #888;
}

.crafting-panels {
  display: flex;
  gap: 1rem;
}

.crafting-panel {
  flex: 1;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 0.5rem;
}

.crafting-panel h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #aaa;
}

.crafting-list {
  max-height: 200px;
  overflow-y: auto;
}

.crafting-item {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 2px;
}

.crafting-item:hover {
  background: #333;
}

.crafting-item.selected {
  background: #2a4a2a;
}

.crafting-preview {
  border: 1px solid #444;
  border-radius: 4px;
  padding: 1rem;
}

.preview-card {
  padding: 0.5rem 0;
}

.crafting-cost {
  font-size: 0.9rem;
  color: #aaa;
}

.crafting-error {
  color: #f44;
  font-size: 0.9rem;
}

.crafting-button {
  margin-top: 0.5rem;
  padding: 0.5rem 1rem;
  background: #2a6a2a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.crafting-button:disabled {
  background: #444;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/react/CraftingScreen.tsx src/react/CraftingScreen.css
git commit -m "feat(crafting): add CraftingScreen UI component"
```

---

## Task 11: Integrate Crafting Tab into Shop

**Files:**
- Modify: `src/react/Shop.tsx` (file name may vary - adjust based on actual shop component)

- [ ] **Step 1: Find and modify Shop component to add Crafting tab**

First, find the Shop component:

```bash
grep -l "Shop" src/react/*.tsx
```

Then add the CraftingScreen as a new tab. The exact implementation depends on existing Shop structure. Example modification:

```typescript
import { CraftingScreen } from './CraftingScreen.js';

// In Shop component, add tab state and rendering:
const [activeTab, setActiveTab] = useState<'packs' | 'crafting'>('packs');

// In render:
<div className="shop-tabs">
  <button onClick={() => setActiveTab('packs')} className={activeTab === 'packs' ? 'active' : ''}>Packs</button>
  <button onClick={() => setActiveTab('crafting')} className={activeTab === 'crafting' ? 'active' : ''}>Crafting</button>
</div>

{activeTab === 'packs' && <PacksContent />}
{activeTab === 'crafting' && <CraftingScreen />}
```

- [ ] **Step 2: Commit**

```bash
git add src/react/Shop.tsx
git commit -m "feat(crafting): integrate Crafting tab into Shop"
```

---

## Task 12: Export Types for External Use

**Files:**
- Create or modify: `src/crafting-types.ts` (optional - can be in crafting.ts)

- [ ] **Step 1: Ensure types are exported from crafting.ts**

Verify these types are exported:
- `CraftResult`
- `isCraftedId`
- `buildCraftedCard`
- `resolveCraftedCard`
- `craftEffectMonster`
- `getCard`

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 3: Run build to verify no TypeScript errors**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(crafting): address build issues"
```

---

## Summary

This plan implements the full effect crafting system in 12 tasks:

1. Feature flags in rules.ts
2. Effect items module
3. PackSlotDef extension
4. Effect items storage in progression
5. Crafted cards storage in progression
6. Core crafting module
7. Card resolution in makeDeck
8. Pack logic for effect item drops
9. Unit tests
10. CraftingScreen UI
11. Shop integration
12. Final verification

Each task produces working, testable code. The system is completely toggleable via `GAME_RULES.craftingEnabled`.
