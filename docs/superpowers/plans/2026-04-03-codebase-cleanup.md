# Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three silent bugs (shop validator using wrong field name, locale card names never applied, campaign validator ignoring required type-specific fields) and remove stale dead code and documentation.

**Architecture:** All changes are in-place fixes to existing functions — no new files, no new exports, no restructuring. Each task is independently testable via `npm test`.

**Tech Stack:** TypeScript (strict), Vitest, Node.js ESM (`"type": "module"`, `.js` extensions in imports)

---

## Files Modified

| File | What changes |
|------|-------------|
| `src/tcg-validator.ts` | Remove unused import; rename `packages`→`packs` in shop validation; add type-specific checks to campaign validator |
| `src/tcg-loader.ts` | Apply locale data to card names; translate German comment |
| `tests/tcg-validator.test.ts` | Update existing valid-campaign test; add shop packs test; add campaign type-specific warning tests |
| `tests/tcg-loader.test.ts` | Add locale-only name resolution test |

> `src/def-validator.ts`, `CLAUDE.md`, `README.md` — already updated in planning session.

---

## Task 1: Fix shop validator — `packages` → `packs`

**Files:**
- Modify: `src/tcg-validator.ts` (lines 207–286)
- Modify: `tests/tcg-validator.test.ts` (describe `validateShopJson`)

The current validator runs detailed validation (id, price, slots, cardPool, unlockCondition) against `obj.packages` — a stale field name. `TcgShopJson` defines `packs`. The `packs` block today only checks `Array.isArray`.

- [ ] **Step 1: Write the failing test**

Add inside `describe('validateShopJson', ...)` in `tests/tcg-validator.test.ts`:

```typescript
it('warns on invalid pack entries in packs array', () => {
  const warnings = validateShopJson({
    packs: [
      { price: 0, slots: [] },   // missing id, zero price, empty slots
    ],
  });
  expect(warnings.some(w => w.includes('packs[0]') && w.includes('"id"'))).toBe(true);
  expect(warnings.some(w => w.includes('packs[0]') && w.includes('"price"'))).toBe(true);
  expect(warnings.some(w => w.includes('packs[0]') && w.includes('"slots"'))).toBe(true);
});
```

- [ ] **Step 2: Run test — confirm it FAILS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test -- --reporter=verbose 2>&1 | grep -A3 "invalid pack"
```

Expected: test fails (0 warnings returned, assertions not met) because the validator currently checks `packages` not `packs`.

- [ ] **Step 3: Fix the validator**

In `src/tcg-validator.ts`, replace the entire block from `// Validate packs array (if present)` through the closing `}` of the packages block (lines 206–285) with:

```typescript
  // Validate packs array (if present)
  if (obj.packs !== undefined) {
    if (!Array.isArray(obj.packs)) {
      warnings.push('shop.json: packs must be an array');
    } else {
      const seenIds = new Set<string>();
      for (let i = 0; i < obj.packs.length; i++) {
        const pkg = obj.packs[i] as Record<string, unknown>;
        const prefix = `shop.json: packs[${i}]`;

        if (typeof pkg !== 'object' || pkg === null) {
          warnings.push(`${prefix}: must be an object`);
          continue;
        }

        // Required fields
        if (typeof pkg.id !== 'string' || !pkg.id) {
          warnings.push(`${prefix}: missing or invalid "id"`);
        } else {
          if (seenIds.has(pkg.id)) warnings.push(`${prefix}: duplicate pack id "${pkg.id}"`);
          seenIds.add(pkg.id);
        }
        const hasName = typeof pkg.name === 'string';
        if (!hasName) warnings.push(`${prefix}: missing "name"`);
        if (typeof pkg.price !== 'number' || pkg.price <= 0) warnings.push(`${prefix}: "price" must be a positive number`);
        if (!Array.isArray(pkg.slots) || !(pkg.slots as unknown[]).length) {
          warnings.push(`${prefix}: "slots" must be a non-empty array`);
        }

        // Validate cardPool (optional)
        if (pkg.cardPool !== undefined) {
          const cp = pkg.cardPool as Record<string, unknown>;
          for (const side of ['include', 'exclude'] as const) {
            if (cp[side] !== undefined) {
              if (typeof cp[side] !== 'object' || cp[side] === null || Array.isArray(cp[side])) {
                warnings.push(`${prefix}.cardPool.${side}: must be an object`);
              } else {
                const f = cp[side] as Record<string, unknown>;
                for (const arrField of ['races', 'attributes', 'types', 'spellTypes', 'ids']) {
                  if (f[arrField] !== undefined && !Array.isArray(f[arrField])) {
                    warnings.push(`${prefix}.cardPool.${side}.${arrField}: must be an array`);
                  }
                }
                for (const numField of ['maxRarity', 'minRarity', 'maxAtk', 'maxLevel']) {
                  if (f[numField] !== undefined && typeof f[numField] !== 'number') {
                    warnings.push(`${prefix}.cardPool.${side}.${numField}: must be a number`);
                  }
                }
              }
            }
          }
        }

        // Validate unlockCondition (optional)
        if (pkg.unlockCondition !== undefined && pkg.unlockCondition !== null) {
          const cond = pkg.unlockCondition as Record<string, unknown>;
          if (cond.type === 'nodeComplete') {
            if (typeof cond.nodeId !== 'string') {
              warnings.push(`${prefix}.unlockCondition: nodeComplete requires a string "nodeId"`);
            } else if (knownNodeIds && !knownNodeIds.has(cond.nodeId)) {
              warnings.push(`${prefix}.unlockCondition: nodeId "${cond.nodeId}" not found in campaign.json`);
            }
          } else if (cond.type === 'winsCount') {
            if (typeof cond.count !== 'number' || cond.count <= 0) {
              warnings.push(`${prefix}.unlockCondition: winsCount requires a positive "count"`);
            }
          } else {
            warnings.push(`${prefix}.unlockCondition: unknown type "${cond.type}" (expected: nodeComplete, winsCount)`);
          }
        }
      }
    }
  }
```

- [ ] **Step 4: Run all tests — confirm they PASS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test
```

Expected: all tests pass (previously passing `validateShopJson({ packs: [] })` still passes; new test now passes).

- [ ] **Step 5: Commit**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claire\worktrees\tender-mendel" && git add src/tcg-validator.ts tests/tcg-validator.test.ts && git commit -m "fix: shop validator validates packs field instead of stale packages field"
```

---

## Task 2: Fix campaign validator — add type-specific required field checks

**Files:**
- Modify: `src/tcg-validator.ts` (after line ~387, inside the node loop)
- Modify: `tests/tcg-validator.test.ts` (describe `validateCampaignJson`)

The existing "valid campaign" test creates a DuelNode without `preDialogue`/`postDialogue`, which will break after the fix. Update it first.

- [ ] **Step 1: Update the existing valid-campaign test**

In `tests/tcg-validator.test.ts`, the first test inside `describe('validateCampaignJson', ...)` currently creates a node object without `preDialogue`/`postDialogue`. Replace that node object:

```typescript
// BEFORE:
nodes: [{
  id: 'n1', type: 'duel', position: { x: 0, y: 0 },
  mapIcon: null, unlockCondition: null, rewards: null,
  opponentId: 1, isBoss: false,
}],

// AFTER:
nodes: [{
  id: 'n1', type: 'duel', position: { x: 0, y: 0 },
  mapIcon: null, unlockCondition: null, rewards: null,
  opponentId: 1, isBoss: false,
  preDialogue: null, postDialogue: null,
}],
```

- [ ] **Step 2: Write the failing tests**

Add inside `describe('validateCampaignJson', ...)` in `tests/tcg-validator.test.ts`:

```typescript
it('warns on duel node missing preDialogue and postDialogue', () => {
  const campaign = {
    chapters: [{
      id: 'ch1', titleKey: 'chapter_1',
      nodes: [{
        id: 'n1', type: 'duel', position: { x: 0, y: 0 },
        mapIcon: null, unlockCondition: null, rewards: null,
        opponentId: 1, isBoss: false,
        // preDialogue and postDialogue intentionally omitted
      }],
    }],
  };
  const warnings = validateCampaignJson(campaign);
  expect(warnings.some(w => w.includes('preDialogue'))).toBe(true);
  expect(warnings.some(w => w.includes('postDialogue'))).toBe(true);
});

it('warns on story node missing scene', () => {
  const campaign = {
    chapters: [{
      id: 'ch1', titleKey: 'chapter_1',
      nodes: [{
        id: 'n1', type: 'story', position: { x: 0, y: 0 },
        mapIcon: null, unlockCondition: null, rewards: null,
        // scene intentionally omitted
      }],
    }],
  };
  const warnings = validateCampaignJson(campaign);
  expect(warnings.some(w => w.includes('"scene"'))).toBe(true);
});

it('warns on shop node missing shopId', () => {
  const campaign = {
    chapters: [{
      id: 'ch1', titleKey: 'chapter_1',
      nodes: [{
        id: 'n1', type: 'shop', position: { x: 0, y: 0 },
        mapIcon: null, unlockCondition: null, rewards: null,
        // shopId intentionally omitted
      }],
    }],
  };
  const warnings = validateCampaignJson(campaign);
  expect(warnings.some(w => w.includes('"shopId"'))).toBe(true);
});

it('warns on branch node missing promptKey and options', () => {
  const campaign = {
    chapters: [{
      id: 'ch1', titleKey: 'chapter_1',
      nodes: [{
        id: 'n1', type: 'branch', position: { x: 0, y: 0 },
        mapIcon: null, unlockCondition: null, rewards: null,
        // promptKey and options intentionally omitted
      }],
    }],
  };
  const warnings = validateCampaignJson(campaign);
  expect(warnings.some(w => w.includes('"promptKey"'))).toBe(true);
  expect(warnings.some(w => w.includes('"options"'))).toBe(true);
});
```

- [ ] **Step 3: Run tests — confirm new tests FAIL, existing tests PASS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗|×)" | head -30
```

Expected: the 4 new tests fail (no warnings emitted yet); all pre-existing tests pass.

- [ ] **Step 4: Add type-specific validation to campaign validator**

In `src/tcg-validator.ts`, after the gauntlet validation block (after the closing `}` on line ~387), still inside the node loop, add:

```typescript
      // Validate type-specific required fields (all warnings — campaign.json is optional)
      switch (n.type) {
        case 'duel':
          if (!('preDialogue' in n)) warnings.push(`campaign.json: node "${n.id}": duel node missing required field "preDialogue"`);
          if (!('postDialogue' in n)) warnings.push(`campaign.json: node "${n.id}": duel node missing required field "postDialogue"`);
          break;
        case 'story':
          if (typeof n.scene !== 'object' || n.scene === null) warnings.push(`campaign.json: node "${n.id}": story node missing required field "scene"`);
          break;
        case 'shop':
          if (typeof n.shopId !== 'string' || !n.shopId) warnings.push(`campaign.json: node "${n.id}": shop node missing required field "shopId"`);
          break;
        case 'branch':
          if (typeof n.promptKey !== 'string' || !n.promptKey) warnings.push(`campaign.json: node "${n.id}": branch node missing required field "promptKey"`);
          if (!Array.isArray(n.options) || (n.options as unknown[]).length === 0) warnings.push(`campaign.json: node "${n.id}": branch node missing required field "options"`);
          break;
      }
```

Place this block immediately after the gauntlet validation (after the `}` that closes the `if (n.gauntlet !== undefined...)` block, still before the closing `}` of the node `for` loop).

- [ ] **Step 5: Run all tests — confirm they PASS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && git add src/tcg-validator.ts tests/tcg-validator.test.ts && git commit -m "fix: campaign validator checks type-specific required fields (preDialogue, scene, shopId, etc.)"
```

---

## Task 3: Fix locale card name resolution

**Files:**
- Modify: `src/tcg-loader.ts` (lines 255–256)
- Modify: `tests/tcg-loader.test.ts`

`localeData` (a `Record<string, string>`) is computed at line 252 but never used. Card names always come from `tc.name`/`tc.description`, so locale-only archives get empty names.

Key convention confirmed in fixture: locale keys are `card_${id}_name` and `card_${id}_desc`.

- [ ] **Step 1: Write the failing test**

Add inside `describe('loadTcgFile', ...)` in `tests/tcg-loader.test.ts`:

```typescript
it('resolves card name from locale when cards.json has no plaintext name', async () => {
  const zip = new JSZip();
  zip.file('cards.json', JSON.stringify([
    { id: 1, type: 1, level: 4, rarity: 1, atk: 1000, def: 800 },
    // no name or description fields
  ]));
  zip.file('locales/en.json', JSON.stringify({
    'card_1_name': 'Locale Dragon',
    'card_1_desc': 'A dragon from locale.',
  }));
  zip.file('manifest.json', JSON.stringify({ formatVersion: 2 }));
  zip.file('img/1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const buf = await zip.generateAsync({ type: 'arraybuffer' });

  const result = await loadTcgFile(buf, { lang: 'en' });
  expect(result.parsedCards[0].name).toBe('Locale Dragon');
  expect(result.parsedCards[0].description).toBe('A dragon from locale.');
});
```

- [ ] **Step 2: Run test — confirm it FAILS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test -- --reporter=verbose 2>&1 | grep -A5 "locale when cards"
```

Expected: test fails — `parsedCards[0].name` is `'Card #1'` (the fallback from `tcgCardToParsedCard`) instead of `'Locale Dragon'`.

- [ ] **Step 3: Apply localeData in the card-building loop**

In `src/tcg-loader.ts`, replace lines 255–256:

```typescript
// BEFORE:
    let name = tc.name || '';
    let description = tc.description || '';
```

```typescript
// AFTER:
    let name = (hasLocaleFiles && localeData[`card_${tc.id}_name`]) || tc.name || '';
    let description = (hasLocaleFiles && localeData[`card_${tc.id}_desc`]) || tc.description || '';
```

- [ ] **Step 4: Run all tests — confirm they PASS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test
```

Expected: all tests pass (existing "returns parsed cards with merged locale" still passes because the fixture has matching names in both cards.json and locales/en.json; new test now passes).

- [ ] **Step 5: Commit**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && git add src/tcg-loader.ts tests/tcg-loader.test.ts && git commit -m "fix: apply locale data to card name/description in loader (was computed but never used)"
```

---

## Task 4: Remove unused import + translate German comment

**Files:**
- Modify: `src/tcg-validator.ts` (line 7)
- Modify: `src/tcg-loader.ts` (line 258)

No behavior changes — no new tests needed. Run the full suite after to confirm nothing broke.

- [ ] **Step 1: Remove unused import from tcg-validator.ts**

In `src/tcg-validator.ts` line 7, remove `TcgCardDefinition` from the import:

```typescript
// BEFORE:
import type { TcgCard, TcgCardDefinition, TcgOpponentDescription, TcgManifest, ValidationResult } from './types.js';

// AFTER:
import type { TcgCard, TcgOpponentDescription, TcgManifest, ValidationResult } from './types.js';
```

- [ ] **Step 2: Translate German comment in tcg-loader.ts**

In `src/tcg-loader.ts` line 258, replace the comment:

```typescript
// BEFORE:
    // Wenn locale files vorhanden, warnen falls name/description fehlen

// AFTER:
    // If locale files are present, warn if a card has no name or description
```

- [ ] **Step 3: Run all tests — confirm they PASS**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd "D:\Code\Echoes-of-Sanguo-TCG\.claude\worktrees\tender-mendel" && git add src/tcg-validator.ts src/tcg-loader.ts && git commit -m "chore: remove unused TcgCardDefinition import; translate German comment to English"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|-----------------|------|
| Shop validator: `packages` → `packs`, update warning strings | Task 1 |
| Campaign validator: DuelNode preDialogue/postDialogue | Task 2 |
| Campaign validator: StoryNode scene, ShopNode shopId, BranchNode promptKey/options | Task 2 |
| Locale card names applied (localeData used) | Task 3 |
| Remove unused import TcgCardDefinition | Task 4 |
| Translate German comment | Task 4 |
| def-validator.ts JSDoc/comments updated | Done in planning |
| CLAUDE.md cards_description.json removed | Done in planning |
| README.md row removed | Done in planning |
| Shop test updated to use `packs` field with detail | Task 1 |
| Campaign test updated (add preDialogue/postDialogue to valid fixture) | Task 2 |
| Loader test: locale-only name resolution | Task 3 |

All spec items covered. ✓

### Placeholder scan

No TBDs, TODOs, "handle edge cases", or "similar to Task N" patterns present. ✓

### Type consistency

- `localeData` is `Record<string, string>` — `localeData[\`card_${tc.id}_name\`]` returns `string | undefined`, which is handled by the `||` fallback chain. ✓
- `n.scene`, `n.shopId`, `n.promptKey`, `n.options` — all accessed via `n` typed as `Record<string, unknown>`, consistent with the existing pattern in the validator. ✓
- `obj.packs` replaces `obj.packages` throughout — no mixed references remain. ✓
