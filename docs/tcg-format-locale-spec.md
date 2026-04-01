# TCG Format Package — Unified Locale Support

Specification for adding single-file locale support to `@wynillo/tcg-format`.

## Motivation

The current locale system uses multiple files per language (`{lang}_{type}.json`), e.g.:
- `de_cards_description.json`
- `de_opponents_description.json`
- `de_races.json`
- `de_attributes.json`
- `de_card_types.json`

This is fragile and hard to maintain. A single `{lang}.json` per language is the standard i18n pattern and simplifies translation workflows.

## New Format

### File: `locales/{lang}.json`

A single JSON file per language containing all translatable strings:

```json
{
  "cards": {
    "1": { "name": "Shadow Hatchling", "description": "A fearsome dragon..." },
    "2": { "name": "Darkscale Drake", "description": "A fearsome dragon..." }
  },
  "opponents": {
    "1": { "name": "Pang Tong", "title": "The Mentor", "flavor": "A wise advisor." }
  },
  "races": {
    "Dragon": "Dragon",
    "Spellcaster": "Spellcaster"
  },
  "attributes": {
    "Light": "Light",
    "Dark": "Dark"
  },
  "cardTypes": {
    "Monster": "Monster",
    "Spell": "Spell"
  },
  "shop": {
    "tier_1_recruit": { "name": "Recruit's Supply", "desc": "9 cards · Beginner" }
  }
}
```

### Section Schemas

#### `cards`
Object keyed by card ID (string). Each value:
```typescript
{ name: string; description: string }
```
Only entries that differ from the default need to be included; missing IDs fall back to the default `cards_description.json`.

#### `opponents`
Object keyed by opponent ID (string). Each value:
```typescript
{ name: string; title: string; flavor: string }
```
Falls back to the default `opponents_description.json` for missing IDs.

#### `races` / `attributes` / `cardTypes`
Flat object mapping the PascalCase `key` from metadata files to the translated display `value`:
```typescript
Record<string, string>
```
Only keys that differ from the default need to be included.

#### `shop`
Object keyed by package `id`. Each value:
```typescript
{ name: string; desc: string }
```

## Required Changes to `@wynillo/tcg-format`

### 1. Detect Unified Locale Files

During archive loading, check for `locales/{lang}.json` files in addition to the existing `{lang}_{type}.json` files.

**Priority**: If both `locales/de.json` and `locales/de_cards_description.json` exist, the unified file takes precedence for sections it contains.

### 2. New Type: `TcgLocaleData`

```typescript
export interface TcgLocaleData {
  cards?: Record<string, { name: string; description: string }>;
  opponents?: Record<string, { name: string; title: string; flavor: string }>;
  races?: Record<string, string>;
  attributes?: Record<string, string>;
  cardTypes?: Record<string, string>;
  shop?: Record<string, { name: string; desc: string }>;
}
```

### 3. Extend `TcgLoadResult`

Add a new field to the load result:

```typescript
export interface TcgLoadResult {
  // ... existing fields ...

  /** Unified locale data keyed by language code. */
  locales?: Map<string, TcgLocaleData>;
}
```

### 4. Card Description Merging

When a unified locale file contains a `"cards"` section:
1. Use its entries to set `name` and `description` on `parsedCards` (same as how `{lang}_cards_description.json` currently works)
2. If the requested `lang` matches, apply card translations directly to `parsedCards`
3. Return the full locale data in `locales` for runtime language switching

### 5. Metadata Translation

When a unified locale file contains `"races"`, `"attributes"`, or `"cardTypes"`:
1. Apply the key→value translations to the corresponding `typeMeta` entries
2. Return them in the `locales` map for downstream use

### 6. Opponent Description Merging

When a unified locale file contains `"opponents"`:
1. Populate `opponentDescriptions` map from the unified file
2. Merge with existing per-type locale files (unified takes precedence)

### 7. Shop Translation

When a unified locale file contains `"shop"`:
1. Overlay `name` and `desc` translations onto `shopData.packages` entries matching by `id`
2. This requires `shopData` packages to use `nameKey`/`descKey` fields in `shop.json`

## Backward Compatibility

- The existing `{lang}_{type}.json` files continue to work as-is
- Archives using only the old format require no changes
- The unified format is opt-in: only activated when `locales/{lang}.json` exists
- When both formats exist, the unified file's sections override the per-type files

## Validation

The validator should:
1. Accept `locales/{lang}.json` as a valid locale file
2. Validate the schema of each section (cards, opponents, races, attributes, cardTypes, shop)
3. Warn if a card/opponent ID in the locale file doesn't exist in the base data
4. Warn if both unified and per-type files exist for the same language and overlap

## Migration Path

1. **Phase 1** (current — handled in game bridge): The game fetches `locales/{lang}.json` directly via `fetch()` and overlays translations onto the mutable stores. The package doesn't need changes yet.
2. **Phase 2** (this spec): The package natively supports the unified format, loads it during `loadTcgFile()`, and returns it in `TcgLoadResult.locales`.
3. **Phase 3**: Deprecate the per-type `{lang}_{type}.json` files. Remove `cards_description.json` and `opponents_description.json` as defaults — all descriptions live in locale files.
