# Codebase Cleanup — Design Spec

**Date:** 2026-04-03
**Branch:** `claude/tender-mendel`
**Scope:** Real bugs, dead code/unused imports, documentation & comments

---

## Context

The library has gone through multiple iterations adding features (i18n via locale files, campaign JSON, shop JSON, trap trigger constants, etc.). In the process, several issues accumulated:

- A renamed field in shop data left detailed validation code under the wrong key
- Locale data for card names is loaded but never applied (silent data loss)
- Campaign validator was never updated to check type-specific required fields
- An import became unused after a refactor
- A comment was left in German in an otherwise English codebase
- Documentation still claims `cards_description.json` is a required file

---

## Changes

### Bug 1 — Shop validator: `packages` → `packs` (`src/tcg-validator.ts`)

**Problem:** `TcgShopJson` defines `packs: TcgPackDef[]`. The validator has two blocks:
- Lines 207–209: trivial array check on `obj.packs`
- Lines 212–283: full detailed validation (id, name, price, slots, cardPool, unlockCondition) on `obj.packages`

`packages` is a stale field name. The detailed validation code is effectively dead — it runs on a field that never exists in real data.

**Fix:** Remove the `packages` block. Move its full validation logic into the `packs` block. The resulting function validates `packs` with the same depth currently applied to `packages`. Update all warning message strings that reference `"package"` to `"pack"` (e.g. `"duplicate package id"` → `"duplicate pack id"`).

---

### Bug 2 — Locale card names never applied (`src/tcg-loader.ts`)

**Problem:** Line 252 computes `localeData` (a `Record<string, string>` from the locale file, e.g. `{ card_1_name: "Ancient Dragon", card_1_desc: "..." }`). But lines 255–256 set `name = tc.name || ''` and `description = tc.description || ''` — `localeData` is never consulted. Cards using locale-only names (no `name`/`description` in cards.json) silently get empty strings.

The fixture hides this because it stores names both in cards.json and in locales/en.json with identical values, so the test passes even with the bug present.

**Fix:** In the card-building loop, look up locale data before falling back to the plaintext field:
```
name = localeData[`card_${tc.id}_name`] || tc.name || ''
description = localeData[`card_${tc.id}_desc`] || tc.description || ''
```
This matches the key convention used in the fixture (`card_1_name`, `card_1_desc`).

---

### Bug 3 — Campaign validator: missing type-specific field checks (`src/tcg-validator.ts`)

**Problem:** `validateCampaignJson` validates shared node fields (`id`, `type`, `position`, `unlockCondition`) but never validates type-specific required fields:

| Node type | Missing field checks |
|-----------|---------------------|
| `duel`    | `preDialogue` (required, can be null), `postDialogue` (required, can be null) |
| `story`   | `scene` (required object) |
| `shop`    | `shopId` (required string) |
| `branch`  | `promptKey` (required string), `options` (required array) |

**Fix:** After the type check at line 338, add a `switch` on `n.type` that validates each type's specific required fields. All checks must emit **warnings** (not errors), consistent with the rest of `validateCampaignJson` — campaign.json is optional, so issues are always warnings. `RewardNode` has no type-specific fields and needs no switch arm.

---

### Dead Code — Unused import (`src/tcg-validator.ts`)

**Problem:** Line 7 imports `TcgCardDefinition` but it is never referenced anywhere in the file.

**Fix:** Remove `TcgCardDefinition` from the import statement.

---

### Documentation — `validateTcgDefinitions` intent undocumented (`src/def-validator.ts`, `src/index.ts`)

**Problem:** `validateTcgDefinitions` is exported from `index.ts` and has dedicated tests, but is never called within `validateTcgArchive`. This looks like dead code but is actually an intentional standalone export (useful for consumers who receive definition arrays separately, e.g. from cards_description.json).

**Fix:** Add a JSDoc comment to `validateTcgDefinitions` clarifying it is a standalone export, not part of the archive validation pipeline. (Already done as part of removing `cards_description.json` references from def-validator.ts.)

---

### Comment — German comment in English codebase (`src/tcg-loader.ts:258`)

**Problem:** `// Wenn locale files vorhanden, warnen falls name/description fehlen`

**Fix:** Replace with English: `// If locale files are present, warn if a card has no name or description`

---

### Remove `cards_description.json` entirely

**Problem:** `cards_description.json` does not exist in the repository and is not loaded by the code. It appears only as stale references in documentation and comments.

**Fix:** Remove all references:
- `CLAUDE.md` "Archive Contents": remove the `cards_description.json` line; remove it from the `locales/` description
- `README.md` archive structure table: remove the row
- `src/def-validator.ts` header comment + JSDoc + error strings: remove file name references; generalize error messages to not mention a specific filename

---

## Files Changed

| File | Change |
|------|--------|
| `src/tcg-validator.ts` | Fix shop validator field name; add campaign type-specific checks; remove unused import |
| `src/tcg-loader.ts` | Apply localeData to card names; fix German comment |
| `src/def-validator.ts` | Add JSDoc to `validateTcgDefinitions` |
| `CLAUDE.md` | Fix `cards_description.json` documentation |

---

## Verification

1. `npm test` — all existing tests must still pass
2. Update the shop validator test in `tests/tcg-validator.test.ts`: add a case that passes a `packs` array with invalid entries (e.g. missing `id`, zero `price`) and assert the expected warning strings appear
3. Manually confirm that a card with no `name`/`description` in cards.json but a matching entry in `locales/en.json` gets the correct name in `parsedCards`
4. Manually confirm campaign validator now warns for a duel node missing `preDialogue`/`postDialogue`
