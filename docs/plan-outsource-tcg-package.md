# Plan: Outsource TCG Package to Separate Repository

## Context

The `js/tcg-format/` folder is a format library for the custom `.tcg` ZIP-based card archive format. It handles serialization, validation, ZIP packaging, and loading of card data. It has enough scope to stand alone as a reusable npm package — useful to any community mod author or third-party tool that needs to read/write `.tcg` files — but currently it is tightly coupled to the main game's internals through six internal import paths, making extraction non-trivial.

The goal is to create a standalone `@wynillo/tcg-format` npm package in its own GitHub repository, then consume it as a regular dependency in the main game repo.

---

## Critical Files

**Move to `@wynillo/tcg-format` package:**
- `js/tcg-format/index.ts` — public export barrel
- `js/tcg-format/types.ts` — TcgCard, TcgManifest, TcgMeta, etc.
- `js/tcg-format/tcg-loader.ts` — refactored to return pure data (no global store mutations, no browser globals)
- `js/tcg-format/tcg-validator.ts` — pure validation (no effect imports)
- `js/tcg-format/card-validator.ts` — **remove the `isValidEffectString` import and call** (line 8 + line 85); effect strings are opaque in the package; engine validates after loading
- `js/tcg-format/def-validator.ts`, `opp-desc-validator.ts` — pure validation, no changes needed

**Stay in game repo (move from `js/tcg-format/` to `js/`):**
- `js/tcg-format/enums.ts` → `js/enums.ts` — keeps game enum imports; converters are identity mappings; package does NOT export converters
- `js/tcg-format/effect-serializer.ts` → `js/effect-serializer.ts` — uses game effect types; package treats effects as opaque strings
- `js/tcg-format/tcg-builder.ts` → `js/tcg-builder.ts` — uses `CardData`, `TYPE_META`; needed for `generate:tcg`
- `js/tcg-format/generate-base-tcg.ts` → `js/generate-base-tcg.ts` — CLI packing script; replaced by thin wrapper calling package's `packTcgArchive()`

**Created/updated in game repo:**
- `js/tcg-bridge.ts` — **NEW** — converts TcgLoadResult → game types, populates stores, mod tracking
- `js/trigger-bus.ts` — **NEW** — event emitter for extensible trigger hooks
- `js/main.ts` — update to use bridge
- `js/types.ts` — no changes (effect types stay here untouched)
- `js/generate-base-tcg.ts` — thin wrapper calling package's `packTcgArchive()`

---

## Internal Dependency Map (Current → Target)

**Current** (all in `js/tcg-format/`, coupled to game internals):
```
tcg-format/enums.ts         ← CardType, Attribute, Race, Rarity     (../types.js)
tcg-format/card-validator.ts← isValidEffectString                    (./effect-serializer.js)
tcg-format/effect-serializer.ts ← CardEffectBlock, EffectDescriptor,
                                   CardFilter, ValueExpr, StatTarget,
                                   EffectTrigger, TrapTrigger         (../types.js)
tcg-format/tcg-loader.ts   ← CardData, FusionRecipe, OpponentConfig  (../types.js)
                           ← CARD_DB, FUSION_RECIPES, etc.           (../cards.js)  [mutated!]
                           ← applyRules()                            (../rules.js)
                           ← applyTypeMeta(), TYPE_META              (../type-metadata.js)
                           ← applyShopData()                         (../shop-data.js)
                           ← applyCampaignData()                     (../campaign-store.js)
tcg-format/tcg-builder.ts  ← CardData, CardType                      (../types.js)
                           ← TYPE_META                               (../type-metadata.js)
                           ← serializeEffect                         (./effect-serializer.js)
```

**Target** (after extraction):
```
@wynillo/tcg-format          ← jszip only; zero game imports
  src/tcg-loader.ts            — pure: returns TcgLoadResult, no mutations, no browser globals
  src/card-validator.ts        — effect field treated as opaque string; no effect-serializer dep

js/enums.ts (engine)         ← CardType, Attribute, Race, Rarity     (./types.js)
js/effect-serializer.ts      ← CardEffectBlock, ...                   (./types.js)
                             ← intToSpellType, intToTrapTrigger, ...  (./enums.js)
js/tcg-builder.ts            ← CardData, CardType                     (./types.js)
                             ← TYPE_META                              (./type-metadata.js)
                             ← serializeEffect                        (./effect-serializer.js)
                             ← TcgCard, TcgManifest, ...              (@wynillo/tcg-format)
js/tcg-bridge.ts (new)       ← loadTcgFile, TcgParsedCard, ...        (@wynillo/tcg-format)
                             ← CARD_DB, FUSION_RECIPES, ...           (./cards.js)  [mutated here]
                             ← intToCardType, intToRace, ...          (./enums.js)
                             ← deserializeEffect                      (./effect-serializer.js)
                             ← applyTypeMeta, applyRules, ...         (various game modules)
```

---

## Type Ownership Decision

**The key constraint**: `EOS:Engine` must be free to add new effect types, triggers, and spell types without forcing a `EOS:TCG` package update. Modders should not need to rebuild `EOS:TCG` just to use basic effects. Therefore, ALL gameplay-extensible types stay in the engine.

**`EOS:TCG` owns only stable, format-level types** (no game imports at all):
- `TcgCard`, `TcgManifest`, `TcgMeta`, `TcgOpponentDeck`, `TcgCardDefinition` — the wire format
- `TcgRaceEntry`, `TcgAttributeEntry`, `TcgCardTypeEntry`, `TcgRarityEntry` — metadata schemas
- `TcgShopJson`, `TcgCampaignJson`, `TcgFusionFormula`, `TcgLoadResult` — optional archive contents
- Int constants: `TCG_TYPE_MONSTER`, `TCG_ATTR_LIGHT`, `TCG_RACE_DRAGON`, etc.
- The `effect` field in `TcgCard` is just `string` — the package treats it as opaque

**`EOS:Engine` retains all gameplay-extensible types** (zero changes to `js/types.ts`):
- `CardEffectBlock`, `EffectDescriptor`, `CardFilter`, `ValueExpr`, `StatTarget`
- `EffectTrigger`, `TrapTrigger`, `SpellType` — engine extends these freely
- `CardData`, `CardType`, `Attribute`, `Race`, `Rarity`
- All game state types

**Consequence**: `effect-serializer.ts` stays in the game repo (it needs the effect types). It will NOT move to the package. Instead, the remaining `js/tcg-format/` slim down in the engine to just `effect-serializer.ts` + `tcg-builder.ts`, or these two files move to `js/` root.

**How `enums.ts` loses its game dependency**: The game enums are **numeric** (`CardType.Monster = 1`, `Race.Dragon = 1`, etc.) — they are NOT string enums. The current converters in `enums.ts` are identity mappings: `cardTypeToInt(CardType.Monster)` returns `1 === TCG_TYPE_MONSTER`. There is no string intermediate.

The correct strategy is **Option C — converters stay in the engine, the package doesn't export them**:
- `js/tcg-format/enums.ts` moves to `js/enums.ts` (engine file), keeping its game imports untouched
- The package's `src/` has **no converter functions** — it deals purely in raw ints (the wire format already uses ints)
- `TcgParsedCard` uses `number` fields for type/attribute/race/rarity (same numeric values as the engine enums, but typed as `number` in the package's namespace)
- The bridge's `parsedToCardData()` does explicit conversions — casts for enum fields (`type as CardType`) and `intToSpellType`/`intToTrapTrigger` calls for the string-typed fields. A simple spread is not sufficient (see Step 5).

This means no call sites in the engine change at all.

---

## Implementation Steps (Ordered — Game Stays Green at Each Step)

### Step 1 — Refactor `EffectDescriptor` to `EffectDescriptorMap`

Convert the closed `EffectDescriptor` union in `js/types.ts` to an open `EffectDescriptorMap` interface (see EffectDescriptor Extensibility Refactor section). Update `effect-registry.ts` and `mod-api.ts` typing. Tests green. This is done first because it's a pure engine refactor with no external dependencies.

### Step 2 — Create the new repository

> **Timing note**: This step can be deferred until after Steps 3–9 (engine prep) are complete on a feature branch. Creating the repo early is useful for team visibility but is not a prerequisite for the code changes. The files don't move to the new repo until Step 12.

Create a new GitHub repo under `wynillo/echoes-of-sanguo-tcg-format`.

New repo structure:
```
echoes-of-sanguo-tcg-format/
├── package.json          # name: "@wynillo/tcg-format", type: module
├── tsconfig.json         # target ES2020, moduleResolution: bundler, noEmit: false
├── src/
│   ├── index.ts          # public API barrel
│   ├── types.ts          # TcgCard, TcgManifest, TcgMeta, TcgParsedCard, etc. (NO effect types)
│   │                     # NO enums.ts — converters stay in engine; package uses raw ints only
│   ├── card-validator.ts # isValidTrigger + isValidSpellType inlined here (small string sets)
│   ├── def-validator.ts
│   ├── opp-desc-validator.ts
│   ├── tcg-validator.ts
│   ├── tcg-loader.ts     # refactored: pure, returns expanded TcgLoadResult; accepts lang param
│   ├── tcg-packer.ts     # packs a source folder → .tcg ZIP (used by CLI + programmatic API)
│   └── cli.ts            # CLI entry point: validate, pack, inspect commands (uses fs.readFile)
└── tests/
    ├── tcg-validator.test.js # moved from main repo
    ├── tcg-loader.test.js   # loader tests (adapted for new pure API)
    ├── tcg-packer.test.js   # packing tests
    └── tcg-card-validator.test.js # card/def/opp-desc validator tests
```

**NOT in the package (stays in game repo):**
- `effect-serializer.ts` — entire file stays in `js/effect-serializer.ts` (uses game effect types; package treats effects as opaque strings)
- `tcg-builder.ts` — stays in game repo (uses `CardData`, `TYPE_META`; only needed for `generate:tcg`)

`package.json` key fields:
```json
{
  "name": "@wynillo/tcg-format",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "tcg-format": "./dist/cli.js"
  },
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" }
  },
  "dependencies": { "jszip": "^3.10.1" },
  "devDependencies": { "typescript": "^6.0.2", "vitest": "^4.1.2" },
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  }
}
```

The `"bin"` field exposes a CLI for modders (see Modder CLI section below).

Engine types for modders are shipped as a standalone `eos-engine.d.ts` file attached to each game release on GitHub (see Engine Types for Modders section below). No extra npm package or subpath export needed.

### Step 3 — `effect-serializer.ts` stays entirely in the engine

The raw grammar parser (`parseEffectString`) would only be ~40 lines of code in the package — too thin a layer to justify a cross-repo split. Instead:

- **`effect-serializer.ts` stays in `js/` unchanged.** It keeps its imports from `./types.js` and handles both the string grammar and the semantic mapping.
- **The package treats `effect` as an opaque `string`** in `TcgCard.effect`. It never parses, validates, or interprets effect strings.
- **No `effect-serializer.ts` in the package at all.** The `src/` directory in `@wynillo/tcg-format` has no effect-related code.

This means:
- Adding a new effect action in `EOS:Engine` requires zero changes to `EOS:TCG`
- The package is simpler (no grammar code to maintain)
- Modders writing `.tcg` files compose effect strings as plain text in `cards.json` — they don't need a parser

### Step 4 — Move `enums.ts` to the engine (keep game imports)

The game enums are **numeric** (`CardType.Monster = 1`, not `'Monster'`). The converters are identity mappings. Attempting to replace them with string literal types would break every call site in the engine.

**Correct approach**: Move `js/tcg-format/enums.ts` → `js/enums.ts` (engine file). Game imports remain. No signature changes. The package exports **no converter functions** — it deals purely in raw ints.

Update all engine-internal import paths from `'./tcg-format/enums.js'` to `'./enums.js'`. The package's `src/` directory has no `enums.ts` file; the string validator functions (`isValidTrigger`, `isValidSpellType`) move inline to the validator files that need them.

### Step 5 — Add `TcgParsedCard` to `js/tcg-format/types.ts`

The package's loader merges `TcgCard` (int fields) + `TcgCardDefinition` (name, description) into a single flat object. The name "parsed" reflects that the ZIP/JSON parsing is done; the wire-format int values remain as-is — `spellType: 1` not `'normal'`, `type: 3` not `CardType.Spell`. The engine bridge does the final int→enum/string conversion.

`TcgParsedCard` uses `number` for all int fields:

```typescript
// src/types.ts — flat merge of TcgCard (int wire fields) + TcgCardDefinition (name/description)
// Wire-format ints are left as-is; the engine bridge handles int→enum/string conversion.
export interface TcgParsedCard {
  id:            string;   // stringified numeric id (e.g. "42")
  name:          string;   // from TcgCardDefinition for the requested locale
  description:   string;   // from TcgCardDefinition for the requested locale
  type:          number;   // TCG_TYPE_* — same numeric value as CardType enum
  rarity:        number;   // TCG_RARITY_* — same numeric value as Rarity enum
  level?:        number;
  atk?:          number;
  def?:          number;
  attribute?:    number;   // TCG_ATTR_* — same numeric value as Attribute enum
  race?:         number;   // TCG_RACE_* — same numeric value as Race enum
  effectString?: string;   // raw serialized effect string (package treats as opaque)
  spellType?:    number;   // 1=normal, 2=targeted, 3=fromGrave, 4=field
  trapTrigger?:  number;   // 1=onAttack, 2=onOwnMonsterAttacked, 3=onOpponentSummon, 4=manual
  target?:       string;   // targeting hint: 'ownMonster', 'oppMonster', etc.
  atkBonus?:     number;
  defBonus?:     number;
  equipRequirement?: { race?: number; attr?: number };  // int values, not enum
}
```

The game's `CardData` in `js/types.ts` remains the source of truth, with its own `effect?: CardEffectBlock`. The bridge's `parsedToCardData` converts `TcgParsedCard → CardData` by:
- Casting numeric enum fields (`type as CardType`, `rarity as Rarity`, etc.) — safe since values are identical
- Calling `intToSpellType()` / `intToTrapTrigger()` for string-typed fields (these stay in `js/enums.ts`)
- Deserializing `effectString` via `deserializeEffect()`

A simple spread `{ ...parsed, effect }` is **not sufficient** — `spellType` and `trapTrigger` are `number` in `TcgParsedCard` but `SpellType` (`'normal'`|...) and `TrapTrigger` (`'onAttack'`|...) in `CardData`. TypeScript would silently produce incorrect runtime values.

### Step 6 — Refactor `tcg-loader.ts` (eliminate side effects)

> **Scope note**: The current `loadTcgFile()` is ~330 lines and applies data as side effects (mutating 6 global stores, calling `applyTypeMeta`, `applyRules`, `applyShopData`, `applyCampaignData`, creating blob URLs, detecting locale via `navigator.language`). This step touches nearly every section of the loader. It should be done in a dedicated commit or PR and treated as the most complex single step of the migration.

Remove all game store imports. Change `loadTcgFile()` to return all data instead of applying it:

**New expanded `TcgLoadResult`:**
```typescript
interface TcgLoadResult {
  cards: TcgCard[];                         // raw int-based cards from cards.json
  parsedCards: TcgParsedCard[];           // decoded, effect as opaque string, all fields numeric
  definitions: Map<string, TcgCardDefinition[]>;  // locale → definitions
  rawImages: Map<number, ArrayBuffer>;      // card id → raw PNG bytes (NOT blob URLs — loader is environment-agnostic)
  meta?: TcgMeta;
  manifest?: TcgManifest;
  opponents?: TcgOpponentDeck[];
  opponentDescriptions?: Map<string, TcgOpponentDescription[]>;  // locale → descriptions
  rules?: Record<string, unknown>;          // raw rules.json (engine interprets)
  shopData?: TcgShopJson;                  // backgrounds as raw ArrayBuffers, NOT blob URLs
  campaignData?: TcgCampaignJson;
  fusionFormulas?: TcgFusionFormula[];
  typeMeta?: {                             // grouped metadata bundle
    races?: TcgRacesJson;
    attributes?: TcgAttributesJson;
    cardTypes?: TcgCardTypesJson;
    rarities?: TcgRaritiesJson;
  };
  warnings: string[];
}
```

**`loadTcgFile` signature change**:
```typescript
// Before
export async function loadTcgFile(
  source: string | ArrayBuffer,
  options?: { onProgress?: (percent: number) => void }
): Promise<TcgLoadResult>

// After — lang is a parameter, not detected from browser globals
export async function loadTcgFile(
  source: string | ArrayBuffer,
  options?: {
    lang?: string;                         // e.g. 'en', 'de' — defaults to '' (first locale wins)
    onProgress?: (percent: number) => void;
  }
): Promise<TcgLoadResult>
```

Remove `getBrowserLang()` / `navigator.language` from the loader. The bridge passes `navigator.language.substring(0, 2)` from the browser context. The CLI passes `options.lang` from a `--lang` flag.

**Three other key changes**:
1. `URL.createObjectURL` is browser-only — the loader returns raw `ArrayBuffer` per image. The bridge creates blob URLs. `revokeTcgImages()` moves to the bridge.
2. `tcgCardToCardData()` is removed from the loader — the bridge handles `TcgParsedCard → CardData` conversion via an explicit `parsedToCardData()` function (see Step 10).
3. `applyTcgMeta()` and `applyFusionFormulas()` are currently unexported local functions in `tcg-loader.ts`. Their bodies move to the bridge — they mutate game stores and have no place in a pure loader.

### Step 7 — Refactor `js/tcg-format/tcg-builder.ts`

Remove `cardDataToTcgCard()` and `cardDataToTcgDef()` (game-type dependent, move to bridge).

Keep and refactor to accept data as parameters:
```typescript
// Before: reads TYPE_META global
export function buildRacesJson(): TcgRacesJson

// After: pure function
export function buildRacesJson(races: TcgRaceEntry[]): TcgRacesJson
```

### Step 8 — Consolidate campaign types

`js/tcg-format/types.ts` currently has a full copy of `CampaignData` and also re-exports `CampaignData as TcgCampaignJson` from `../campaign-types.js`. This is a circular dependency that must be broken.

**After migration**: The package's `src/types.ts` is the single canonical source for `TcgCampaignJson`, `DialogueScene`, `ForegroundSprite`, `CampaignChapter`, `CampaignNode`, etc.

In the game repo:
- `js/campaign-types.ts`: delete the dialogue/campaign structure types; keep only `CampaignProgress`, `PendingDuel`, `NodeRewards`; re-export `TcgCampaignJson as CampaignData` from `@wynillo/tcg-format`
- `js/react/screens/DialogueScreen.tsx`: change import to `from '@wynillo/tcg-format'`
- `js/campaign.ts`: change `CampaignData` import to `from '@wynillo/tcg-format'`

### Step 9 — Move engine files out of `js/tcg-format/`

Before the package extraction, move the three files that stay in the engine:
- `js/tcg-format/enums.ts` → `js/enums.ts`
  - No import changes needed (game enum imports were already there)
- `js/tcg-format/effect-serializer.ts` → `js/effect-serializer.ts`
  - Update `'../types.js'` → `'./types.js'`
  - Update `'./enums.js'` → `'./enums.js'` (same file, now at `js/enums.ts`)
- `js/tcg-format/tcg-builder.ts` → `js/tcg-builder.ts`
  - Update `'../types.js'` → `'./types.js'`
  - Update `'./enums.js'` → `'./enums.js'` (engine's own enums file)
  - Update `'./effect-serializer.js'` → `'./effect-serializer.js'`
  - Update `'../type-metadata.js'` → `'./type-metadata.js'`
- Update all imports across the codebase that reference these files at their old paths.

**Dependency note**: After this step, `js/tcg-builder.ts` imports from both `@wynillo/tcg-format` (for `TcgCard`, `TcgManifest` format types) AND `./effect-serializer.js` (for `serializeEffect`). Engine → Package is the correct direction; there is no bidirectional dependency since the package never imports from the engine.

Tests green. Now `js/tcg-format/` contains ONLY files destined for the package.

### Step 10 — Create `js/tcg-bridge.ts` in main repo

This file does everything `tcg-loader.ts` used to do on the game side, plus mod tracking and collision detection:

```typescript
// js/tcg-bridge.ts
import { loadTcgFile, type TcgLoadResult, type TcgParsedCard, type TcgMeta, type TcgOpponentDeck, type TcgOpponentDescription, type TcgFusionFormula } from '@wynillo/tcg-format';
import { CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from './cards.js';
import { applyRules } from './rules.js';
import { applyTypeMeta } from './type-metadata.js';
import { applyShopData } from './shop-data.js';
import { applyCampaignData } from './campaign-store.js';
import { deserializeEffect, isValidEffectString } from './effect-serializer.js';
import { intToCardType, intToRarity, intToAttribute, intToRace, intToSpellType, intToTrapTrigger } from './enums.js';
import type { CardData, FusionRecipe, FusionFormula, FusionComboType, OpponentConfig } from './types.js';

// ── Mod Tracking ─────────────────────────────────────────────
interface LoadedMod {
  source: string;           // URL or label
  cardIds: string[];        // card IDs this mod added
  opponentIds: number[];    // opponent IDs this mod added
  timestamp: number;
}
const loadedMods: LoadedMod[] = [];

// ── TcgParsedCard → CardData conversion ───────────────────────
// Mirrors the old tcgCardToCardData() from tcg-loader.ts.
// Cannot use a simple spread: spellType and trapTrigger are `number` in TcgParsedCard
// but string-based types (SpellType, TrapTrigger) in CardData.
function parsedToCardData(p: TcgParsedCard, warnings: string[]): CardData {
  let effect = undefined;
  if (p.effectString) {
    // Semantic validation: warn on unknown types but don't hard-fail (custom effects via registerEffect still work)
    if (!isValidEffectString(p.effectString)) {
      warnings.push(`Card ${p.id}: effect string may contain unknown actions: "${p.effectString}"`);
    }
    try {
      effect = deserializeEffect(p.effectString);
    } catch (e) {
      warnings.push(`Card ${p.id} (${p.name}): failed to deserialize effect — effect disabled. ${e instanceof Error ? e.message : e}`);
    }
  }

  // Wrap all intTo* calls consistently — throw → warn, never crash the load loop
  let type = 1 as CardType;  // fallback: Monster
  try { type = intToCardType(p.type, !!p.effectString); }
  catch { warnings.push(`Card ${p.id}: unknown type int ${p.type}, defaulting to Monster`); }

  let rarity = 1 as Rarity;  // fallback: Common
  try { rarity = intToRarity(p.rarity); }
  catch { warnings.push(`Card ${p.id}: unknown rarity int ${p.rarity}, defaulting to Common`); }

  const card: CardData = {
    id:          p.id,
    name:        p.name,
    type,
    description: p.description,
    level:       p.level ?? undefined,
    rarity,
  };

  if (p.atk !== undefined) card.atk = p.atk;
  if (p.def !== undefined) card.def = p.def;
  if (p.attribute !== undefined && p.attribute > 0) {
    try { card.attribute = intToAttribute(p.attribute); }
    catch { warnings.push(`Card ${p.id}: invalid attribute ${p.attribute}`); }
  }
  if (p.race !== undefined && p.race > 0) {
    try { card.race = intToRace(p.race); }
    catch { warnings.push(`Card ${p.id}: invalid race ${p.race}`); }
  }
  if (effect)       card.effect      = effect;
  if (p.spellType)   card.spellType   = intToSpellType(p.spellType);
  if (p.trapTrigger) card.trapTrigger = intToTrapTrigger(p.trapTrigger);
  if (p.target)      card.target      = p.target;
  if (p.atkBonus !== undefined) card.atkBonus = p.atkBonus;
  if (p.defBonus !== undefined) card.defBonus = p.defBonus;
  if (p.equipRequirement?.race !== undefined || p.equipRequirement?.attr !== undefined) {
    card.equipRequirement = {};
    if (p.equipRequirement.race !== undefined) {
      try { card.equipRequirement.race = intToRace(p.equipRequirement.race); }
      catch { warnings.push(`Card ${p.id}: invalid equipRequirement.race`); }
    }
    if (p.equipRequirement.attr !== undefined) {
      try { card.equipRequirement.attr = intToAttribute(p.equipRequirement.attr); }
      catch { warnings.push(`Card ${p.id}: invalid equipRequirement.attr`); }
    }
  }

  return card;
}

// ── applyTcgMeta — moved from tcg-loader.ts (was unexported local) ──────────
function applyTcgMeta(
  meta: TcgMeta,
  tcgOpponents?: TcgOpponentDeck[],
  oppDescs?: Map<string, TcgOpponentDescription[]>,
  lang?: string,
): void {
  const rid = (numId: number): string => String(numId);

  if (meta.fusionRecipes) {
    const recipes: FusionRecipe[] = meta.fusionRecipes.map(r => ({
      materials: [rid(r.materials[0]), rid(r.materials[1])] as [string, string],
      result: rid(r.result),
    }));
    FUSION_RECIPES.push(...recipes);
  }

  const rawOpponents = tcgOpponents ?? meta.opponentConfigs;
  if (rawOpponents) {
    const localizedDescs = oppDescs?.get(lang ?? '') ?? (oppDescs?.size ? oppDescs.values().next().value! : undefined);
    const oppDescMap = new Map<number, TcgOpponentDescription>();
    if (localizedDescs) {
      for (const d of localizedDescs) oppDescMap.set(d.id, d);
    }
    const configs: OpponentConfig[] = rawOpponents.map(o => {
      const desc = oppDescMap.get(o.id);
      return {
        id: o.id, name: desc?.name ?? o.name, title: desc?.title ?? o.title,
        race: intToRace(o.race), flavor: desc?.flavor ?? o.flavor,
        coinsWin: o.coinsWin, coinsLoss: o.coinsLoss,
        deckIds: o.deckIds.map(rid), behaviorId: o.behavior,
      };
    });
    OPPONENT_CONFIGS.push(...configs);
  }

  if (meta.starterDecks) {
    for (const [raceKey, numIds] of Object.entries(meta.starterDecks)) {
      STARTER_DECKS[Number(raceKey)] = numIds.map(rid);
    }
    const firstDeck = Object.values(STARTER_DECKS)[0];
    if (firstDeck) {
      PLAYER_DECK_IDS.splice(0, PLAYER_DECK_IDS.length, ...firstDeck);
      OPPONENT_DECK_IDS.splice(0, OPPONENT_DECK_IDS.length, ...firstDeck);
    }
  }
}

// ── applyFusionFormulas — moved from tcg-loader.ts (was unexported local) ───
function applyFusionFormulas(raw: TcgFusionFormula[]): void {
  const rid = (numId: number): string => String(numId);
  const converted: FusionFormula[] = raw.map(f => ({
    id: f.id, comboType: f.comboType as FusionComboType,
    operand1: f.operand1, operand2: f.operand2, priority: f.priority,
    resultPool: f.resultPool.map(rid),
  }));
  converted.sort((a, b) => b.priority - a.priority);
  FUSION_FORMULAS.push(...converted);
}

// ── BridgeLoadResult — replaces rawImages with ready-to-use blob URLs ────────
export interface BridgeLoadResult extends Omit<TcgLoadResult, 'rawImages'> {
  images: Map<number, string>;  // card id → blob URL (created by bridge; revoke via revokeTcgImages)
  warnings: string[];
}

// ── Image handling ────────────────────────────────────────────
// Bridge creates blob URLs from raw ArrayBuffers (loader is environment-agnostic)
const blobUrls: Map<number, string> = new Map();
function applyImages(rawImages: Map<number, ArrayBuffer>): Map<number, string> {
  for (const [id, buf] of rawImages) {
    const url = URL.createObjectURL(new Blob([buf], { type: 'image/png' }));
    blobUrls.set(id, url);
  }
  return blobUrls;
}
export function revokeTcgImages(): void {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
}

// ── Public API ────────────────────────────────────────────────
export async function loadAndApplyTcg(
  source: string | ArrayBuffer,
  onProgress?: (percent: number) => void,
): Promise<BridgeLoadResult> {
  const lang = typeof navigator !== 'undefined' ? navigator.language.substring(0, 2) : '';
  const result = await loadTcgFile(source, { lang, onProgress });
  const mod: LoadedMod = {
    source: typeof source === 'string' ? source : '<ArrayBuffer>',
    cardIds: [], opponentIds: [], timestamp: Date.now(),
  };

  // Convert TcgParsedCard[] → CardData[] with collision detection
  for (const parsed of result.parsedCards) {
    if (CARD_DB[parsed.id]) {
      result.warnings.push(`Card ${parsed.id} ("${parsed.name}") overwrites existing card "${CARD_DB[parsed.id].name}"`);
    }
    CARD_DB[parsed.id] = parsedToCardData(parsed, result.warnings);
    mod.cardIds.push(parsed.id);
  }

  // Convert raw ArrayBuffers → blob URLs; return images instead of rawImages
  const images = applyImages(result.rawImages);

  // Apply game-specific side effects
  if (result.typeMeta?.races)      applyTypeMeta({ races: result.typeMeta.races });
  if (result.typeMeta?.attributes) applyTypeMeta({ attributes: result.typeMeta.attributes });
  if (result.typeMeta?.cardTypes)  applyTypeMeta({ cardTypes: result.typeMeta.cardTypes });
  if (result.typeMeta?.rarities)   applyTypeMeta({ rarities: result.typeMeta.rarities });
  if (result.rules)          applyRules(result.rules);
  if (result.shopData)       applyShopData(result.shopData);
  if (result.campaignData)   applyCampaignData(result.campaignData);
  if (result.meta)           applyTcgMeta(result.meta, result.opponents, result.opponentDescriptions, lang);
  if (result.fusionFormulas) applyFusionFormulas(result.fusionFormulas);

  loadedMods.push(mod);
  const { rawImages: _, ...rest } = result;
  return { ...rest, images };
}

/**
 * Partial unload — removes cards and opponents added by this mod only.
 * Does NOT revert: fusion recipes/formulas, shop data, campaign data, rules, or type metadata.
 * Full unload is a v2 feature (see Known Limitations).
 */
export function unloadModCards(source: string): boolean {
  console.warn('[EOS] unloadModCards: partial unload — fusion recipes, shop data, campaign data, rules, and type metadata from this mod are NOT reverted.');
  const idx = loadedMods.findIndex(m => m.source === source);
  if (idx === -1) return false;
  const mod = loadedMods[idx];
  for (const id of mod.cardIds) delete CARD_DB[id];
  for (const id of mod.opponentIds) {
    const oi = OPPONENT_CONFIGS.findIndex(o => o.id === id);
    if (oi !== -1) OPPONENT_CONFIGS.splice(oi, 1);
  }
  loadedMods.splice(idx, 1);
  return true;
}

/** List all currently loaded mods. */
export function getLoadedMods(): readonly LoadedMod[] {
  return loadedMods;
}
```

### Step 11 — Update `js/main.ts`

```typescript
// Before
import { loadTcgFile } from './tcg-format/index.js';
// After
import { loadAndApplyTcg } from './tcg-bridge.js';
```

### Step 12 — Verify isolation, then create the package repo

Verify all `../` imports are gone from `js/tcg-format/`. The remaining files must compile in isolation with only `jszip` as an external dependency.

Create the `@wynillo/tcg-format` repo. Copy cleaned files to `src/`. Add `tcg-packer.ts` (extracted from `generate-base-tcg.ts`) and `cli.ts`. Set up build, tests, CI. CI green.

### Step 13 — Publish package and consume in game repo

1. Publish `@wynillo/tcg-format` to npm (or use `npm link` for local dev)
2. `npm install @wynillo/tcg-format` in game repo
3. Flip all imports from `./tcg-format/` to `@wynillo/tcg-format`
4. Delete `js/tcg-format/` directory
5. Tests green

### Step 14 — Update `generate:tcg` script

The package exports `packTcgArchive(sourceDir, outputPath)` programmatically, and the CLI wraps it. The game repo's script becomes a thin wrapper:

```typescript
// js/generate-base-tcg.ts (game repo — 5 lines)
import { packTcgArchive } from '@wynillo/tcg-format';
const src = new URL('../public/base.tcg-src/', import.meta.url).pathname;
const out = new URL('../public/base.tcg', import.meta.url).pathname;
await packTcgArchive(src, out);
```

Or modders use the CLI: `npx @wynillo/tcg-format pack ./my-mod/ -o my-mod.tcg`

### Step 15 — Add TriggerBus *(optional — consider splitting to follow-up PR)*

> **Scope note**: Steps 15–16 are independent of the TCG package extraction. They add modder value but increase the risk and size of an already large migration. If the PR is already large, consider shipping Steps 1–14 + 17 as the package extraction PR, and deferring Steps 15–16 to a follow-up.

Create `js/trigger-bus.ts` (see TriggerBus section). Replace hardcoded trigger dispatch in `engine.ts` with `TriggerBus.emit()`. Expose `emitTrigger` + `addTriggerHook` in mod API. Tests green.

### Step 16 — Generate `eos-engine.d.ts`

Add CI step to produce the standalone `.d.ts` file from `js/types.ts` + `js/mod-api.ts` and attach it to GitHub releases.

### Step 17 — Update tests

**`tests/tcg-format.test.js` must be split before moving**:
- Currently tests both enum converters (movable) and effect serializer round-trips (must stay in engine). Split into:
  - `tests/tcg-format.test.js` → keep only validator tests; move to package repo
  - `tests/effect-serializer.test.js` → effect string round-trip tests; stay in main repo

**`tests/setup.js` must be updated**:
- Currently calls `loadTcgFile(buf)` which populates global stores as a side effect. After Step 6, the loader is pure — tests that need populated stores must go through the bridge. Update setup to call `loadAndApplyTcg(buf)` via the bridge.

**Move to package repo:**
- `tests/tcg-format.test.js` (validators only, after split above)
- `tests/tcg-loader.test.js` — adapted for new pure API: assert on `TcgLoadResult` fields (`parsedCards`, `rawImages`, `typeMeta`, etc.); no global store assertions; pass explicit `lang: 'en'` option
- `tests/tcg-validator.test.js` — archive validation tests
- `tests/tcg-packer.test.js` — new: test `packTcgArchive()` round-trips correctly

**Stay in main repo:**
- `tests/card-data-integrity.test.js` — imports `isValidEffectString` from `js/effect-serializer.ts` (unchanged)
- `tests/effect-serializer.test.js` — new home for effect string round-trip tests (moved from tcg-format.test.js)
- `tests/tcg-bridge.test.js` — new: test `loadAndApplyTcg` populates `CARD_DB`, collision detection, `unloadMod`

---

## EffectDescriptor Extensibility Refactor

Refactor the closed `EffectDescriptor` union into an open `EffectDescriptorMap` interface so modders can extend it via TypeScript declaration merging.

**In `js/types.ts`** — replace the union with a map + derived type:
```typescript
export interface EffectDescriptorMap {
  dealDamage:   { target: 'opponent' | 'player'; value: ValueExpr };
  buffAtkRace:  { race: Race; value: number };
  drawCard:     { count: number };
  // ... all existing ~30 action types
}

export type EffectDescriptor = {
  [K in keyof EffectDescriptorMap]: { type: K } & EffectDescriptorMap[K]
}[keyof EffectDescriptorMap];
```

**In `js/effect-registry.ts`** — type the registry against the map:
```typescript
type EffectHandler<K extends keyof EffectDescriptorMap> =
  (ctx: EffectContext, action: { type: K } & EffectDescriptorMap[K]) => void;
```

**In `js/mod-api.ts`** — typed `registerEffect`:
```typescript
registerEffect<K extends keyof EffectDescriptorMap>(
  type: K,
  handler: (ctx: EffectContext, action: { type: K } & EffectDescriptorMap[K]) => void
): void
```

**`eos-engine.d.ts`** — shipped as a standalone `.d.ts` file with each game release on GitHub. Contains `EffectDescriptorMap` and all modding-relevant types. Modders download it and add it to their project.

Modders extend it via `declare global` — no `tsconfig.json` paths config needed, no phantom module to resolve:
```typescript
// eos-engine.d.ts (shipped with game releases)
// Add this file to your project to get type safety for EOS modding.
declare global {
  interface EffectDescriptorMap {
    dealDamage:   { target: 'opponent' | 'player'; value: ValueExpr };
    buffAtkRace:  { race: string; value: number };
    // ... all built-in effect types
  }
  interface Window {
    EchoesOfSanguoMod: EchoesOfSanguoModApi;
  }
  // ... CardEffectBlock, ValueExpr, etc.
}
export {};  // makes this a module, enabling augmentation
```

```typescript
// modder's my-mod-types.d.ts — just add new entries, no path config needed
declare global {
  interface EffectDescriptorMap {
    teleportMonster: { from: 'hand' | 'field'; to: 'hand' | 'field' };
  }
}
export {};
```

Using `declare global` instead of `declare module 'eos-engine'` avoids requiring modders to add `"paths"` to their `tsconfig.json`. It works simply by including `eos-engine.d.ts` in the project (via `"include"` or a `/// <reference path="..." />` directive).

The `eos-engine.d.ts` file is auto-generated by CI from `js/types.ts` using `tsc --emitDeclarationOnly` with a wrapper that lifts the relevant interfaces into the global scope.

Same pattern applies to `EffectTrigger` if we convert it from a string union to a similar extensible interface.

## Modder CLI

The package ships a CLI tool via `npx @wynillo/tcg-format <command>`:

| Command | Description |
|---|---|
| `validate <dir>` | Validate a `.tcg` source folder (JSON structure, required files, int ranges) |
| `pack <dir> -o <file>` | Pack a source folder into a `.tcg` ZIP archive |
| `inspect <file>` | Print summary of a `.tcg` archive (card count, format version, file list) |

The CLI is implemented in `src/cli.ts` and uses the same validation/packing functions exposed in the public API. The `generate-base-tcg.ts` script in the game repo is replaced by `npx @wynillo/tcg-format pack public/base.tcg-src/ -o public/base.tcg` (or a thin programmatic wrapper).

**CLI file I/O pattern** — the CLI never uses `fetch()`. It reads files via `fs.readFile` and passes an `ArrayBuffer` to the package's functions:
```typescript
// src/cli.ts (Node.js — safe fs usage)
import { readFile } from 'node:fs/promises';

// inspect <file>
const buf = await readFile(filePath);
const result = await loadTcgFile(buf.buffer, { lang: options.lang ?? '' });

// validate <dir>  — reads source folder JSON files directly, no ZIP involved
// pack <dir> -o <file> — reads source folder, calls packTcgArchive(), writes output
```

The `loadTcgFile` function accepts `string | ArrayBuffer`. When `source` is a `string`, the loader uses `fetch()` (available in browsers and Node.js ≥ 18). When `source` is an `ArrayBuffer`, no network call is made. The CLI always passes an `ArrayBuffer` so `fetch` is never called from the CLI path.

**Node.js version requirement**: The package requires `"node": ">=18"` (for native `fetch` when URL strings are passed, and for `node:fs/promises`). This is documented in `package.json`'s `engines` field.

Note: The CLI does NOT validate effect strings semantically — it only checks JSON structure and int ranges. Effect strings are opaque at the format level. A future `--engine-validate` flag could accept a path to an engine types file to check effect strings against known types.

---

## Engine Types for Modders (`eos-engine.d.ts`)

The game repo's CI generates a standalone `eos-engine.d.ts` file and attaches it to each GitHub release. It contains:
- `EffectDescriptorMap` (extensible via declaration merging)
- `CardEffectBlock`, `EffectDescriptor`, `EffectTrigger`, `TrapTrigger`, `SpellType`
- `CardData` interface shape
- `EchoesOfSanguoMod` API shape (what's on `window.EchoesOfSanguoMod`)

Generated via `tsc --emitDeclarationOnly` on a subset of `js/types.ts` + `js/mod-api.ts`, wrapped in `declare global { ... }`.

Modders download `eos-engine.d.ts`, drop it into their project, and extend `EffectDescriptorMap` via `declare global` — no `tsconfig.json` `"paths"` config required:
```typescript
// modder's custom-effects.d.ts
declare global {
  interface EffectDescriptorMap {
    teleportMonster: { from: 'hand' | 'field'; to: 'hand' | 'field' };
  }
}
export {};
```

---

## TriggerBus

New engine file `js/trigger-bus.ts` — a simple event emitter that replaces hardcoded trigger dispatch:

```typescript
// js/trigger-bus.ts
type TriggerHandler = (ctx: EffectContext) => void;

const handlers = new Map<string, Set<TriggerHandler>>();

export const TriggerBus = {
  on(event: string, handler: TriggerHandler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return () => handlers.get(event)?.delete(handler);  // returns unsubscribe fn
  },
  emit(event: string, ctx: EffectContext) {
    handlers.get(event)?.forEach(h => h(ctx));
  },
  clear() { handlers.clear(); },
};
```

**Engine integration**: Replace hardcoded `executeEffects(card, 'onSummon', ...)` calls in `engine.ts` with `TriggerBus.emit('onSummon', ctx)`. The effect dispatcher subscribes to all built-in triggers at init.

**Test isolation**: The `handlers` map is module-level state and persists between test files in Vitest. Add `TriggerBus.clear()` to `tests/setup.js` in an `afterEach` (or `beforeEach`) hook so each test starts with a clean bus:
```javascript
// tests/setup.js
import { TriggerBus } from '../js/trigger-bus.js';
afterEach(() => { TriggerBus.clear(); });
```

**Mod API exposure**:
```typescript
// In mod-api.ts
const modApi = {
  ...existing,
  /** Fire effects with a custom trigger name. */
  emitTrigger: TriggerBus.emit,
  /** Subscribe to a trigger event (returns unsubscribe function). */
  addTriggerHook: TriggerBus.on,
};
```

Modders create derived triggers:
```javascript
// Mod: fire 'onEliteSummon' whenever a high-level monster is summoned
window.EchoesOfSanguoMod.addTriggerHook('onSummon', (ctx) => {
  if (ctx.card.level >= 7) {
    window.EchoesOfSanguoMod.emitTrigger('onEliteSummon', ctx);
  }
});
```

---

## Mod Support (Runtime .tcg Loading)

Community mod authors need to load external `.tcg` files at runtime without a game rebuild. This is preserved and improved:

**Package API stays open**: The package exports `loadTcgFile(url | ArrayBuffer)` as a first-class public API returning raw `TcgLoadResult` (TcgCard[], TcgManifest, etc.). Mods can call this directly via dynamic import without touching game internals.

**Bridge accepts any URL**: `loadAndApplyTcg(url)` in `tcg-bridge.ts` is called with any `.tcg` URL — `base.tcg` or a community mod URL. It can be called multiple times to layer multiple sets.

**Expose via mod API** (`js/mod-api.ts`): Add mod lifecycle methods to `window.EchoesOfSanguoMod`:
```typescript
// New entries in mod-api.ts
import { loadAndApplyTcg, unloadModCards, getLoadedMods } from './tcg-bridge.js';
const modApi = {
  ...existing,
  /** Load a community .tcg archive and merge its cards into the game. */
  loadModTcg: loadAndApplyTcg,
  /** Partial unload: removes cards and opponents only. See unloadModCards docstring for limitations. */
  unloadModCards,
  /** List all currently loaded mods with their card IDs and load order. */
  getLoadedMods,
};
```

This is a net improvement over today: currently there is no supported way for a mod script to load a `.tcg` archive; they can only push individual cards to `CARD_DB`. After this change, mod authors can do:
```javascript
// Load
await window.EchoesOfSanguoMod.loadModTcg('https://mod-author.com/my-expansion.tcg');

// Check what's loaded
console.log(window.EchoesOfSanguoMod.getLoadedMods());

// Partial unload (cards + opponents only — see unloadModCards docs for limitations)
window.EchoesOfSanguoMod.unloadModCards('https://mod-author.com/my-expansion.tcg');
```

**Collision detection**: When a mod card overwrites an existing card ID, the bridge logs a warning in `result.warnings`. This surfaces in the console so modders can debug conflicts. A future improvement could add card ID namespacing (`modname:42` convention) but this is not required for v1.

**Modder capabilities after all changes:**

| Capability | Status | How |
|---|---|---|
| Ship new cards/opponents via `.tcg` | ✅ | Core mod workflow |
| Use all existing effects/triggers | ✅ | Stable effect strings |
| Register custom JS effect handlers | ✅ | `registerEffect` in mod API |
| Extend `EffectDescriptorMap` with typed custom actions | ✅ | Declaration merging via `eos-engine.d.ts` |
| Create derived trigger hooks | ✅ | `emitTrigger` + `addTriggerHook` in mod API |
| Build `.tcg` tooling (pack/validate) | ✅ | `@wynillo/tcg-format` package alone |
| Load `.tcg` at runtime without rebuild | ✅ | `loadModTcg` in mod API |
| Add new engine lifecycle trigger points | ❌ | Needs engine update (to add `TriggerBus.emit()` call) |

**Format version forward-compatibility**: The `SUPPORTED_FORMAT_VERSION` guard stays in the package loader. When a mod ships a v3 `.tcg` and the game only supports v2, it throws `TcgFormatError` with a clear message. The game repo updates the package version to gain v3 support — same flow as today with an inline version bump.

**CORS constraint**: `loadModTcg('https://...')` uses `fetch()` internally, which is subject to browser CORS policy. If the mod author's server does not set `Access-Control-Allow-Origin: *`, the fetch will fail with a network error. Mod authors must either:
- Host their `.tcg` file on a CORS-enabled server (most CDNs do this by default)
- Distribute the file for users to load locally (e.g. drag-and-drop into the game UI — pass `ArrayBuffer` directly)

Document this in the modder guide shipped with `eos-engine.d.ts`.

---

## Known Limitations / Follow-up Issues

These are intentional v1 gaps that should be tracked as GitHub issues at implementation time so they don't get forgotten.

### 1. `unloadMod` is a partial unload — rename to `unloadModCards`

`unloadMod(source)` removes cards and opponents added by the mod, but does **not** revert:
- Fusion recipes / formulas added by the mod
- Shop data changes
- Campaign data changes
- Rule overrides
- Type metadata changes (races, attributes, card types, rarities)

A modder calling `unloadMod` would reasonably expect a full rollback. To set correct expectations:
- **Rename the function to `unloadModCards`** in the bridge and mod API
- **Log a console warning** at call time: `console.warn('[EOS] unloadModCards: partial unload — fusion recipes, shop data, campaign data, rules, and type metadata from this mod are NOT reverted.')`)
- Update the mod API surface: `unloadModTcg` → `unloadModCards` on `window.EchoesOfSanguoMod`

A full unload would require snapshotting all stores before load and restoring them — deferred to v2.

**Track as**: `feat(bridge): full mod unload via store snapshots` — capture pre-load state in `loadAndApplyTcg`, restore it in `unloadModCards`.

### 2. No card ID namespacing

When a mod ships a card with the same numeric ID as an existing card, the bridge logs a warning but silently overwrites. A namespacing convention (e.g. `modname:42`) would prevent conflicts entirely but requires changes to `CardData.id` typing and all lookup sites. Deferred to v2.

**Track as**: `feat(bridge): card ID namespace support for mod cards`.

### 3. CLI does not validate effect strings semantically

`npx @wynillo/tcg-format validate <dir>` checks JSON structure and int ranges but does not validate effect string content (unknown action types, wrong arg counts). This is intentional — the package treats effects as opaque — but modders would benefit from a `--engine-validate` flag that accepts a path to `eos-engine.d.ts` and checks effect strings against known types.

**Track as**: `feat(cli): --engine-validate flag for semantic effect string checking`.

### 4. `rawImages` uses `ArrayBuffer` — consider `Uint8Array` in v2

`TcgLoadResult.rawImages` is `Map<number, ArrayBuffer>`. `Uint8Array` is more ergonomic for both browser (`new Blob([uint8arr])`) and Node.js consumers, and is the preferred type in modern Web APIs. The bridge wraps the buffer in `new Blob([buf])` regardless, so the difference is minor. Changing the type would be a minor semver bump since it's a pure public API improvement.

**Track as**: `refactor(loader): use Uint8Array instead of ArrayBuffer for rawImages`.

### 5. TriggerBus (Step 15) should be a separate PR

Steps 15–16 (TriggerBus + `eos-engine.d.ts` generation) are independent of the package extraction. TriggerBus touches `engine.ts` — the most critical and complex file in the codebase — and changes the effect dispatch model. Mixing it into the package extraction PR increases review burden and rollback complexity if something goes wrong.

**Recommendation**: Ship Steps 1–14 + 17 as the package extraction PR. Open a follow-up PR for Steps 15–16 once the extraction is stable.

---

## Package Versioning Strategy

`@wynillo/tcg-format` follows semver. The game repo pins a **caret range** (`"^1.0.0"`) to receive non-breaking updates automatically.

| Change type | Semver bump | Example |
|---|---|---|
| New **optional** field in `TcgCard` or `TcgLoadResult` | **minor** | Add `fusionFormulas?` to result |
| New **required** field in `TcgCard` | **major** | Any new mandatory wire field |
| `TcgManifest.formatVersion` bump | **minor** (if backward-compatible) or **major** | Format v2 → v3 |
| Bug fix or validation improvement | **patch** | Fix off-by-one in int range check |
| New CLI command or flag | **minor** | Add `--lang` flag to `inspect` |

**`formatVersion` vs npm version**: These are independent. `formatVersion` in `TcgManifest` is the wire format version (checked at load time). The npm package version tracks the package's own code. A package `v1.2.0` can still load format v2 archives.

**Game repo constraint**: The game repo should use `"@wynillo/tcg-format": "^1.0.0"` (caret). When a major version bump is needed, update the game repo's `package.json` explicitly and migrate any changed API call sites.

---

## Package Publishing

For local development before publishing:
1. `npm link` in package repo
2. `npm link @wynillo/tcg-format` in game repo

For CI:
1. Publish `@wynillo/tcg-format` to npm (or GitHub Packages)
2. Update game repo dependency to use published version

---

## Verification

1. `npm test` — all tests pass in both repos
2. `npm run generate:tcg` — generates `public/base.tcg` without error
3. `npm run dev` — game loads and plays normally
4. `npm run build` — production build succeeds, chunk sizes unchanged
5. `npm run test:e2e` — Playwright tests pass end-to-end
6. Check that `@wynillo/tcg-format` can be imported in isolation without any game code present (verify in a fresh Node.js script)
