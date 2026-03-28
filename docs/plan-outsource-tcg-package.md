# Plan: Outsource TCG Package to Separate Repository

## Context

The `js/tcg-format/` folder is a format library for the custom `.tcg` ZIP-based card archive format. It handles serialization, validation, ZIP packaging, and loading of card data. It has enough scope to stand alone as a reusable npm package — useful to any community mod author or third-party tool that needs to read/write `.tcg` files — but currently it is tightly coupled to the main game's internals through six internal import paths, making extraction non-trivial.

The goal is to create a standalone `@wynillo/tcg-format` npm package in its own GitHub repository, then consume it as a regular dependency in the main game repo.

---

## Critical Files

**Move to `@wynillo/tcg-format` package:**
- `js/tcg-format/index.ts` — public export barrel
- `js/tcg-format/types.ts` — TcgCard, TcgManifest, TcgMeta, etc.
- `js/tcg-format/enums.ts` — bidirectional int↔string converters (refactored to remove game imports)
- `js/tcg-format/tcg-loader.ts` — refactored to return pure data (no global store mutations)
- `js/tcg-format/tcg-validator.ts`, `card-validator.ts`, `def-validator.ts`, `opp-desc-validator.ts` — pure validation

**Stay in game repo (move from `js/tcg-format/` to `js/`):**
- `js/tcg-format/effect-serializer.ts` → `js/effect-serializer.ts` — uses game effect types; package treats effects as opaque strings
- `js/tcg-format/tcg-builder.ts` → `js/tcg-builder.ts` — uses `CardData`, `TYPE_META`; needed for `generate:tcg`

**Created/updated in game repo:**
- `js/tcg-bridge.ts` — **NEW** — converts TcgLoadResult → game types, populates stores, mod tracking
- `js/trigger-bus.ts` — **NEW** — event emitter for extensible trigger hooks
- `js/main.ts` — update to use bridge
- `js/types.ts` — no changes (effect types stay here untouched)
- `js/generate-base-tcg.ts` — thin wrapper calling package's `packTcgArchive()`

---

## Internal Dependency Map (Current)

```
tcg-format/enums.ts        ← CardType, Attribute, Race, Rarity      (../types.js)
tcg-format/effect-serializer.ts ← CardEffectBlock, EffectDescriptor,
                                   CardFilter, ValueExpr, StatTarget,
                                   EffectTrigger, TrapTrigger         (../types.js)
tcg-format/tcg-loader.ts   ← CardData, FusionRecipe, OpponentConfig  (../types.js)
                           ← CARD_DB, FUSION_RECIPES, etc.           (../cards.js)   [mutated!]
                           ← applyRules()                            (../rules.js)
                           ← applyTypeMeta(), TYPE_META              (../type-metadata.js)
                           ← applyShopData()                         (../shop-data.js)
                           ← applyCampaignData()                     (../campaign-store.js)
tcg-format/tcg-builder.ts  ← CardData, CardType                      (../types.js)
                           ← TYPE_META                               (../type-metadata.js)
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

**How `enums.ts` loses its game dependency**: Change converter signatures from TypeScript enum types to string literal types matching enum values:
```typescript
// Before: import { CardType } from '../types.js';
// After: own string literal type
export type CardTypeKey = 'Monster' | 'Fusion' | 'Spell' | 'Trap' | 'Equipment';
export function cardTypeToInt(type: CardTypeKey): number { ... }
```
Since `CardType.Monster === 'Monster'` (TypeScript string enum), all call sites in the engine compile without changes.

---

## Implementation Steps (Ordered — Game Stays Green at Each Step)

### Step 1 — Refactor `EffectDescriptor` to `EffectDescriptorMap`

Convert the closed `EffectDescriptor` union in `js/types.ts` to an open `EffectDescriptorMap` interface (see EffectDescriptor Extensibility Refactor section). Update `effect-registry.ts` and `mod-api.ts` typing. Tests green. This is done first because it's a pure engine refactor with no external dependencies.

### Step 2 — Create the new repository

Create a new GitHub repo under `wynillo/echoes-of-sanguo-tcg-format`.

New repo structure:
```
echoes-of-sanguo-tcg-format/
├── package.json          # name: "@wynillo/tcg-format", type: module
├── tsconfig.json         # target ES2020, moduleResolution: bundler, noEmit: false
├── src/
│   ├── index.ts          # public API barrel
│   ├── types.ts          # TcgCard, TcgManifest, TcgMeta, TcgDecodedCard, etc. (NO effect types)
│   ├── enums.ts          # refactored: string literal types, NO game imports
│   ├── card-validator.ts
│   ├── def-validator.ts
│   ├── opp-desc-validator.ts
│   ├── tcg-validator.ts
│   ├── tcg-loader.ts     # refactored: pure, returns expanded TcgLoadResult
│   ├── tcg-packer.ts     # packs a source folder → .tcg ZIP (used by CLI + programmatic API)
│   └── cli.ts            # CLI entry point: validate, pack, inspect commands
└── tests/
    ├── tcg-format.test.js   # enum/validator tests (moved from main repo)
    ├── tcg-loader.test.js   # loader tests (adapted for new pure API)
    ├── tcg-packer.test.js   # packing tests
    └── tcg-validator.test.js # moved from main repo
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

### Step 4 — Refactor `enums.ts` (remove game imports)

Replace all `CardType` references with inline string literals:
```typescript
// Before
import { CardType } from '../types.js';
export function cardTypeToInt(type: CardType): number { ... }

// After
export type CardTypeKey = 'Monster' | 'Fusion' | 'Spell' | 'Trap' | 'Equipment';
export function cardTypeToInt(type: CardTypeKey): number { ... }
```
Same pattern for `AttributeKey`, `RaceKey`, `RarityKey`. Since the main repo's `CardType.Monster === 'Monster'`, all existing call sites pass without changes.

### Step 5 — Add `TcgDecodedCard` to `js/tcg-format/types.ts`

The package's loader needs to return fully-decoded card objects (with enum string values, parsed effects) without using the game's `CardData` type. Add a new type to `src/types.ts`:

```typescript
// src/types.ts — package-native decoded card (no game imports)
export interface TcgDecodedCard {
  id:           string;          // stringified numeric id (e.g. "42")
  name:         string;
  type:         CardTypeKey;     // 'Monster' | 'Fusion' | ...
  attribute?:   AttributeKey;
  race?:        RaceKey;
  rarity?:      RarityKey;
  level?:       number;
  atk?:         number;
  def?:         number;
  description:  string;
  effectString?: string;         // raw serialized effect string (package doesn't interpret)
  spellType?:   string;
  trapTrigger?: string;
  target?:      string;
  atkBonus?:    number;
  defBonus?:    number;
  equipRequirement?: { race?: RaceKey; attr?: AttributeKey };
}
```

Note: `effectString` is kept as a raw string — the package doesn't decode it to `CardEffectBlock` (that's the engine's job). The engine bridge calls its own `deserializeEffect(card.effectString)` to produce a typed `CardEffectBlock`.

The game's `CardData` in `js/types.ts` remains the source of truth for the game, with its own `effect?: CardEffectBlock`. The bridge converts `TcgDecodedCard → CardData` by deserializing the effect string.

### Step 6 — Refactor `tcg-loader.ts` (eliminate side effects)

Remove all game store imports. Change `loadTcgFile()` to return all data instead of applying it:

**New expanded `TcgLoadResult`:**
```typescript
interface TcgLoadResult {
  cards: TcgCard[];                         // raw int-based cards from cards.json
  decodedCards: TcgDecodedCard[];           // int→string converted, effect as opaque string
  definitions: Map<string, TcgCardDefinition[]>;  // locale → definitions
  images: Map<number, string>;              // card id → blob URL
  meta?: TcgMeta;
  manifest?: TcgManifest;
  opponents?: TcgOpponentDeck[];
  opponentDescriptions?: Map<string, TcgOpponentDescription[]>;  // locale → descriptions
  rules?: Record<string, unknown>;          // raw rules.json (engine interprets)
  shopData?: TcgShopJson;                  // with blob URLs resolved
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

The loader does the int→string conversion for `decodedCards` using its own enum converters (no game types needed — uses `CardTypeKey`, `RaceKey`, etc.). The `tcgCardToCardData()` function is removed — the bridge in the engine handles `TcgDecodedCard → CardData` conversion (mainly deserializing the effect string).

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

Before the package extraction, move the two files that stay in the engine:
- `js/tcg-format/effect-serializer.ts` → `js/effect-serializer.ts`
  - Update `'../types.js'` → `'./types.js'`
  - Update `'./enums.js'` → `'@wynillo/tcg-format'` (the enum converters it uses — `intToRace`, `attributeToInt`, etc. — live in the package now; this is a valid dependency direction: engine → package)
- `js/tcg-format/tcg-builder.ts` → `js/tcg-builder.ts` (update imports similarly)
- Update all imports across the codebase that reference these files at their old paths.

Tests green. Now `js/tcg-format/` contains ONLY files destined for the package.

### Step 10 — Create `js/tcg-bridge.ts` in main repo

This file does everything `tcg-loader.ts` used to do on the game side, plus mod tracking and collision detection:

```typescript
// js/tcg-bridge.ts
import { loadTcgFile, type TcgLoadResult, type TcgDecodedCard } from '@wynillo/tcg-format';
import { CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from './cards.js';
import { applyRules } from './rules.js';
import { applyTypeMeta } from './type-metadata.js';
import { applyShopData } from './shop-data.js';
import { applyCampaignData } from './campaign-store.js';
import { deserializeEffect, isValidEffectString } from './effect-serializer.js';
import type { CardData } from './types.js';

// ── Mod Tracking ─────────────────────────────────────────────
interface LoadedMod {
  source: string;           // URL or label
  cardIds: string[];        // card IDs this mod added
  opponentIds: number[];    // opponent IDs this mod added
  timestamp: number;
}
const loadedMods: LoadedMod[] = [];

function decodedToCardData(decoded: TcgDecodedCard, warnings: string[]): CardData {
  let effect = undefined;
  if (decoded.effectString) {
    // Semantic validation: warn on unknown effect types (don't hard-fail — custom effects via registerEffect still work)
    if (!isValidEffectString(decoded.effectString)) {
      warnings.push(`Card ${decoded.id}: effect string may contain unknown actions: "${decoded.effectString}"`);
    }
    effect = deserializeEffect(decoded.effectString);
  }
  return { ...decoded, effect } as CardData;
}

export async function loadAndApplyTcg(
  source: string | ArrayBuffer,
  onProgress?: (percent: number) => void,
): Promise<TcgLoadResult> {
  const result = await loadTcgFile(source, { onProgress });
  const mod: LoadedMod = {
    source: typeof source === 'string' ? source : '<ArrayBuffer>',
    cardIds: [], opponentIds: [], timestamp: Date.now(),
  };

  // Convert TcgDecodedCard[] → CardData[] with collision detection
  for (const decoded of result.decodedCards) {
    if (CARD_DB[decoded.id]) {
      result.warnings.push(`Card ${decoded.id} ("${decoded.name}") overwrites existing card "${CARD_DB[decoded.id].name}"`);
    }
    CARD_DB[decoded.id] = decodedToCardData(decoded, result.warnings);
    mod.cardIds.push(decoded.id);
  }

  // Apply game-specific side effects
  if (result.typeMeta?.races)      applyTypeMeta({ races: result.typeMeta.races });
  if (result.typeMeta?.attributes) applyTypeMeta({ attributes: result.typeMeta.attributes });
  if (result.typeMeta?.cardTypes)  applyTypeMeta({ cardTypes: result.typeMeta.cardTypes });
  if (result.typeMeta?.rarities)   applyTypeMeta({ rarities: result.typeMeta.rarities });
  if (result.rules)        applyRules(result.rules);
  if (result.shopData)     applyShopData(result.shopData);
  if (result.campaignData) applyCampaignData(result.campaignData);
  if (result.meta)         applyTcgMeta(result.meta, result.opponents, result.opponentDescriptions);
  if (result.fusionFormulas) applyFusionFormulas(result.fusionFormulas);

  loadedMods.push(mod);
  return result;
}

/**
 * Unload a previously loaded mod by removing its cards and opponents from the game stores.
 * NOTE: This is a partial unload — removes cards and opponents only.
 * Does NOT revert: fusion recipes/formulas, shop data, campaign data, rules, or type metadata.
 * A full unload would require snapshotting all stores before load, which is a v2 feature.
 */
export function unloadMod(source: string): boolean {
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

### Step 15 — Add TriggerBus

Create `js/trigger-bus.ts` (see TriggerBus section). Replace hardcoded trigger dispatch in `engine.ts` with `TriggerBus.emit()`. Expose `emitTrigger` + `addTriggerHook` in mod API. Tests green.

### Step 16 — Generate `eos-engine.d.ts`

Add CI step to produce the standalone `.d.ts` file from `js/types.ts` + `js/mod-api.ts` and attach it to GitHub releases.

### Step 17 — Update tests

**Move to package repo:**
- `tests/tcg-format.test.js` — enum converters, validators
- `tests/tcg-loader.test.js` — adapted for new pure API (assert on `TcgLoadResult`, no global store assertions)
- `tests/tcg-validator.test.js` — archive validation tests
- `tests/tcg-packer.test.js` — new: test `packTcgArchive()` round-trips correctly

**Stay in main repo:**
- `tests/card-data-integrity.test.js` — imports `isValidEffectString` from `js/effect-serializer.ts` (unchanged)
- `tests/tcg-bridge.test.js` — new: test `loadAndApplyTcg` populates `CARD_DB`, collision detection, `unloadMod`
- All effect-serializer tests remain (the serializer stays in the engine)

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

Modders extend it via declaration merging against the declared module:
```typescript
// eos-engine.d.ts (shipped with game releases)
declare module 'eos-engine' {
  interface EffectDescriptorMap {
    dealDamage:   { target: 'opponent' | 'player'; value: ValueExpr };
    buffAtkRace:  { race: string; value: number };
    // ... all built-in effect types
  }
  // ... CardEffectBlock, mod API shape, etc.
}
```

```typescript
// modder's my-mod-types.d.ts
declare module 'eos-engine' {
  interface EffectDescriptorMap {
    teleportMonster: { from: 'hand' | 'field'; to: 'hand' | 'field' };
  }
}
```

The `eos-engine.d.ts` file is auto-generated by CI from `js/types.ts` using `tsc --emitDeclarationOnly` with a wrapper that re-exports into the `'eos-engine'` module declaration.

Same pattern applies to `EffectTrigger` if we convert it from a string union to a similar extensible interface.

## Modder CLI

The package ships a CLI tool via `npx @wynillo/tcg-format <command>`:

| Command | Description |
|---|---|
| `validate <dir>` | Validate a `.tcg` source folder (JSON structure, required files, int ranges) |
| `pack <dir> -o <file>` | Pack a source folder into a `.tcg` ZIP archive |
| `inspect <file>` | Print summary of a `.tcg` archive (card count, format version, file list) |

The CLI is implemented in `src/cli.ts` and uses the same validation/packing functions exposed in the public API. The `generate-base-tcg.ts` script in the game repo is replaced by `npx @wynillo/tcg-format pack public/base.tcg-src/ -o public/base.tcg` (or a thin programmatic wrapper).

Note: The CLI does NOT validate effect strings semantically — it only checks JSON structure and int ranges. Effect strings are opaque at the format level. A future `--engine-validate` flag could accept a path to an engine types file to check effect strings against known types.

---

## Engine Types for Modders (`eos-engine.d.ts`)

The game repo's CI generates a standalone `eos-engine.d.ts` file and attaches it to each GitHub release. It contains:
- `EffectDescriptorMap` (extensible via declaration merging)
- `CardEffectBlock`, `EffectDescriptor`, `EffectTrigger`, `TrapTrigger`, `SpellType`
- `CardData` interface shape
- `EchoesOfSanguoMod` API shape (what's on `window.EchoesOfSanguoMod`)

Generated via `tsc --emitDeclarationOnly` on a subset of `js/types.ts` + `js/mod-api.ts`, wrapped in a `declare module 'eos-engine' { ... }` block.

Modders download it and add it to their project. They extend `EffectDescriptorMap` via declaration merging:
```typescript
// modder's custom-effects.d.ts
declare module 'eos-engine' {
  interface EffectDescriptorMap {
    teleportMonster: { from: 'hand' | 'field'; to: 'hand' | 'field' };
  }
}
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
import { loadAndApplyTcg, unloadMod, getLoadedMods } from './tcg-bridge.js';
const modApi = {
  ...existing,
  /** Load a community .tcg archive and merge its cards into the game. */
  loadModTcg: loadAndApplyTcg,
  /** Unload a previously loaded mod by its source URL. Returns false if not found. */
  unloadModTcg: unloadMod,
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

// Unload
window.EchoesOfSanguoMod.unloadModTcg('https://mod-author.com/my-expansion.tcg');
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
