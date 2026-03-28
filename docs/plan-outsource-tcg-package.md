# Plan: Outsource TCG Package to Separate Repository

## Context

The `js/tcg-format/` folder is a format library for the custom `.tcg` ZIP-based card archive format. It handles serialization, validation, ZIP packaging, and loading of card data. It has enough scope to stand alone as a reusable npm package — useful to any community mod author or third-party tool that needs to read/write `.tcg` files — but currently it is tightly coupled to the main game's internals through six internal import paths, making extraction non-trivial.

The goal is to create a standalone `@wynillo/tcg-format` npm package in its own GitHub repository, then consume it as a regular dependency in the main game repo.

---

## Critical Files

**In `js/tcg-format/` (all to be moved/adapted):**
- `js/tcg-format/index.ts` — public export barrel
- `js/tcg-format/types.ts` — TcgCard, TcgManifest, TcgMeta, etc.
- `js/tcg-format/enums.ts` — bidirectional int↔string converters; imports `CardType, Attribute, Race, Rarity` from game
- `js/tcg-format/effect-serializer.ts` — imports `CardEffectBlock`, `EffectDescriptor`, `CardFilter`, `ValueExpr`, `StatTarget`, `EffectTrigger`, `TrapTrigger` from game `types.js`
- `js/tcg-format/tcg-loader.ts` — imports from `cards.js`, `rules.js`, `type-metadata.js`, `shop-data.js`, `campaign-store.js`; **directly mutates global stores**
- `js/tcg-format/tcg-builder.ts` — imports `CardData`, `CardType`, `TYPE_META` from game
- `js/tcg-format/generate-base-tcg.ts` — CLI packing script (stays in game repo or new repo)
- `js/tcg-format/tcg-validator.ts`, `card-validator.ts`, `def-validator.ts`, `opp-desc-validator.ts` — pure validation, no game deps

**In main repo (to be created/updated):**
- `js/types.ts` — needs to re-export moved effect types from the package
- `js/main.ts` — calls `loadTcgFile()`; update to use bridge
- `js/tcg-bridge.ts` — **NEW** — converts TcgLoadResult → game types, populates stores

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

## Implementation Steps

### Step 1 — Create the new repository

Create a new GitHub repo under `wynillo/echoes-of-sanguo-tcg-format`.

New repo structure:
```
echoes-of-sanguo-tcg-format/
├── package.json          # name: "@wynillo/tcg-format", type: module
├── tsconfig.json         # target ES2020, moduleResolution: bundler, noEmit: false
├── src/
│   ├── index.ts          # public API barrel
│   ├── types.ts          # TcgCard, TcgManifest, TcgMeta, etc. (NO effect types)
│   ├── enums.ts          # refactored: string literal types, NO game imports
│   ├── effect-serializer.ts  # RAW grammar layer only (parseEffectString, serializeEffectString)
│   ├── card-validator.ts
│   ├── def-validator.ts
│   ├── opp-desc-validator.ts
│   ├── tcg-validator.ts
│   └── tcg-loader.ts     # refactored: pure, returns expanded TcgLoadResult
├── scripts/
│   └── generate-base-tcg.ts   # packing CLI script (copied from main repo)
└── tests/
    ├── tcg-format.test.js   # enum/validator tests (moved from main repo)
    ├── tcg-loader.test.js   # loader tests (adapted for new pure API)
    └── tcg-validator.test.js # moved from main repo
```

**NOT in the package (semantic layer stays in game repo):**
- Full `serializeEffect`/`deserializeEffect` (typed CardEffectBlock) — `js/effect-serializer.ts` (built on top of the package's raw parser)
- `tcg-builder.ts` — stays in game repo (uses `CardData`, `TYPE_META`; only needed for `generate:tcg`)

`package.json` key fields:
```json
{
  "name": "@wynillo/tcg-format",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "dependencies": { "jszip": "^3.10.1" },
  "devDependencies": { "typescript": "^6.0.2", "vitest": "^4.1.2" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "generate:tcg": "node --loader ts-node/esm scripts/generate-base-tcg.ts"
  }
}
```

### Step 2 — Split `effect-serializer.ts` across both repos

**`EOS:TCG` owns the raw string grammar** — add to `src/effect-serializer.ts`:
```typescript
// Raw token types — no game types needed
export interface RawEffectAction { type: string; args: string[] }
export interface RawEffectBlock  { trigger: string; actions: RawEffectAction[] }

/** Parse "trigger:action1(a,b);action2(c)" → RawEffectBlock */
export function parseEffectString(s: string): RawEffectBlock { ... }

/** Serialize RawEffectBlock → compact string */
export function serializeEffectString(block: RawEffectBlock): string { ... }

/** Validate the string syntax (no semantic check) */
export function isValidEffectStringSyntax(s: string): boolean { ... }
```

**`EOS:Engine` owns the semantic layer** — keep `js/effect-serializer.ts` (or fold into `js/tcg-format/effect-serializer.ts`), now built on top of the package:
```typescript
import { parseEffectString, serializeEffectString } from '@wynillo/tcg-format';
import type { CardEffectBlock, EffectDescriptor, ... } from './types.js';

/** Full deserialize: string → typed CardEffectBlock (game-specific) */
export function deserializeEffect(s: string): CardEffectBlock {
  const raw = parseEffectString(s);
  // engine maps raw.trigger → EffectTrigger, raw.actions → EffectDescriptor[]
  ...
}

/** Full serialize: typed CardEffectBlock → string */
export function serializeEffect(block: CardEffectBlock): string {
  // engine maps typed actions → RawEffectAction[], then delegates to package
  const raw = toRaw(block);
  return serializeEffectString(raw);
}

/** Semantic validation (trigger names, action names, arg counts) */
export function isValidEffectString(s: string): boolean { ... }
```

This means:
- Adding a new effect action in `EOS:Engine` (e.g., `'teleportMonster'`) requires no changes to `EOS:TCG`
- The wire format grammar stays stable in the package
- `isValidEffectStringSyntax` in the package checks structure only; `isValidEffectString` in the engine checks semantics

### Step 3 — Refactor `src/enums.ts` (remove game imports)

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

### Step 3b — Add `TcgDecodedCard` to the package

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

### Step 4 — Refactor `src/tcg-loader.ts` (eliminate side effects)

Remove all game store imports. Change `loadTcgFile()` to return all data instead of applying it:

**New expanded `TcgLoadResult`:**
```typescript
interface TcgLoadResult {
  cards: TcgCard[];
  definitions: Map<string, TcgCardDefinition[]>;
  images: Map<number, string>;  // card id → blob URL
  meta?: TcgMeta;
  manifest?: TcgManifest;
  opponents?: TcgOpponentDeck[];
  opponentDescriptions?: TcgOpponentDescription[];
  rules?: Record<string, unknown>;       // parsed rules.json
  shopData?: TcgShopJson;               // with blob URLs resolved
  campaignData?: TcgCampaignJson;
  fusionFormulas?: TcgFusionFormula[];
  races?: TcgRaceEntry[];               // locale-applied
  attributes?: TcgAttributeEntry[];     // locale-applied
  cardTypes?: TcgCardTypeEntry[];
  rarities?: TcgRarityEntry[];
  warnings: string[];
}
```

Remove the `tcgCardToCardData()` function (it uses `CardData` which is a game type) — this moves to the main repo's bridge.

### Step 5 — Refactor `src/tcg-builder.ts`

Remove `cardDataToTcgCard()` and `cardDataToTcgDef()` (game-type dependent, move to bridge).

Keep and refactor to accept data as parameters:
```typescript
// Before: reads TYPE_META global
export function buildRacesJson(): TcgRacesJson

// After: pure function
export function buildRacesJson(races: TcgRaceEntry[]): TcgRacesJson
```

### Step 5b — Consolidate campaign types

`js/tcg-format/types.ts` currently has a full copy of `CampaignData` and also re-exports `CampaignData as TcgCampaignJson` from `../campaign-types.js`. This is a circular dependency that must be broken.

**After migration**: The package's `src/types.ts` is the single canonical source for `TcgCampaignJson`, `DialogueScene`, `ForegroundSprite`, `CampaignChapter`, `CampaignNode`, etc.

In the game repo:
- `js/campaign-types.ts`: delete the dialogue/campaign structure types; keep only `CampaignProgress`, `PendingDuel`, `NodeRewards`; re-export `TcgCampaignJson as CampaignData` from `@wynillo/tcg-format`
- `js/react/screens/DialogueScreen.tsx`: change import to `from '@wynillo/tcg-format'`
- `js/campaign.ts`: change `CampaignData` import to `from '@wynillo/tcg-format'`

### Step 6 — Create `js/tcg-bridge.ts` in main repo

This file does everything `tcg-loader.ts` used to do on the game side:

```typescript
// js/tcg-bridge.ts
import { loadTcgFile, type TcgLoadResult, type TcgDecodedCard } from '@wynillo/tcg-format';
import { CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS } from './cards.js';
import { applyRules } from './rules.js';
import { applyTypeMeta } from './type-metadata.js';
import { applyShopData } from './shop-data.js';
import { applyCampaignData } from './campaign-store.js';
import type { CardData } from './types.js';
import { deserializeEffect } from './effect-serializer.js';  // engine's semantic deserializer

function decodedToCardData(decoded: TcgDecodedCard): CardData {
  return {
    ...decoded,
    // Deserialize the raw effect string into a typed CardEffectBlock
    effect: decoded.effectString ? deserializeEffect(decoded.effectString) : undefined,
  } as CardData;
}

export async function loadAndApplyTcg(
  source: string | ArrayBuffer,
  onProgress?: (percent: number) => void,
): Promise<TcgLoadResult> {
  const result = await loadTcgFile(source, { onProgress });

  // Convert TcgDecodedCard[] → CardData[] (engine adds typed effect parsing)
  for (const decoded of result.decodedCards) {
    const cardData = decodedToCardData(decoded);
    CARD_DB[cardData.id] = cardData;
  }

  // Apply game-specific side effects
  if (result.typeMeta?.races)      applyTypeMeta({ races: result.typeMeta.races });
  if (result.typeMeta?.attributes) applyTypeMeta({ attributes: result.typeMeta.attributes });
  if (result.typeMeta?.cardTypes)  applyTypeMeta({ cardTypes: result.typeMeta.cardTypes });
  if (result.typeMeta?.rarities)   applyTypeMeta({ rarities: result.typeMeta.rarities });
  if (result.rules)       applyRules(result.rules);
  if (result.shopData)    applyShopData(result.shopData);
  if (result.campaignData) applyCampaignData(result.campaignData);
  if (result.meta)        applyTcgMeta(result.meta, result.opponents, result.opponentDescriptions);
  if (result.fusionFormulas) applyFusionFormulas(result.fusionFormulas);

  return result;
}
```

### Step 7 — Update `js/main.ts`

```typescript
// Before
import { loadTcgFile } from './tcg-format/index.js';
// After
import { loadAndApplyTcg } from './tcg-bridge.js';
```

### Step 8 — No changes to `js/types.ts`

Effect types and all game types remain exactly as-is. The only change is removing any import from `./tcg-format/` that was formerly needed for types now supplied by the package (none, since `TcgLoadResult` and format types are only used in the bridge and main entry point).

### Step 9 — Update `generate:tcg` script

The generate script in the main repo (`js/tcg-format/generate-base-tcg.ts`) is self-contained (just zips the source folder). Either:
- **Option A**: Keep a copy in the main repo (easier, avoids a dev tooling dep)
- **Option B**: Import it from the package's CLI export

Recommend **Option A**: copy `generate-base-tcg.ts` to `js/generate-base-tcg.ts` in the main repo.

Update `package.json`:
```json
"generate:tcg": "vite-node js/generate-base-tcg.ts"
```

### Step 10 — Delete `js/tcg-format/`

After verifying all imports resolve and tests pass, remove the directory.

### Step 11 — Update tests

**Move to new package repo:**
- `tests/tcg-format.test.js` — enum converters, validators, builder (update imports to `@wynillo/tcg-format`)
- `tests/tcg-loader.test.js` — adapt for new pure API (no global store mutations)
- `tests/tcg-validator.test.js` — archive validation tests

**Stay in main repo:**
- `tests/card-data-integrity.test.js` — imports `isValidEffectString` from `js/effect-serializer.ts` (the semantic layer; no change needed)
- Add tests for the engine-side `serializeEffect`/`deserializeEffect` wrapping the raw grammar

**In new package repo:**
- Add `tests/effect-serializer.test.js` for `parseEffectString`/`serializeEffectString` (raw grammar tests only)

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

**In `@wynillo/eos-types`** — export `EffectDescriptorMap` so modders extend it:
```typescript
// modder's my-mod-types.d.ts
declare module '@wynillo/eos-types' {
  interface EffectDescriptorMap {
    teleportMonster: { from: 'hand' | 'field'; to: 'hand' | 'field' };
  }
}
```

Same pattern applies to `EffectTrigger` if we convert it from a string union to a similar extensible interface.

---

## Ordered Migration (Game Always Stays Green)

Each step keeps all tests passing. No step should break the running app.

1. **Refactor `EffectDescriptor` to `EffectDescriptorMap`** in `js/types.ts`. Convert the closed union to an interface-derived type. Update `effect-registry.ts` and `mod-api.ts` typing accordingly. Tests green.
2. **Extract `effect-types.ts`** inside `js/tcg-format/` — copy `CardType`/`Race`/`Attribute`/`Rarity`/effect types there; have `js/types.ts` re-export from `./tcg-format/effect-types.js`. Update `enums.ts` and `effect-serializer.ts` to import from `./effect-types.js`. Tests green.
3. **Add `TcgDecodedCard`** to `js/tcg-format/types.ts`. Refactor the private `tcgCardToCardData` in `tcg-loader.ts` to return `TcgDecodedCard` (with `effectString` instead of parsed `CardEffectBlock`). Tests green.
4. **Introduce `parseTcgArchive()`** as a new pure export alongside the existing `loadTcgFile()` shim. Create `js/tcg-bridge.ts`. Update `js/main.ts` to use bridge + new function. Deprecate `loadTcgFile` but don't delete yet. Tests green.
5. **Consolidate campaign types** (Step 5b above). Tests green.
6. **Refactor `tcg-builder.ts`**: remove `TYPE_META` dep, accept data as params. Tests green.
7. **Verify all `../` imports gone** from `js/tcg-format/`. It must compile in isolation.
8. **Create the new `@wynillo/tcg-format` repo**. Copy cleaned files. Set up build, tests. CI green.
9. **Publish package** and install in game repo. Flip imports from local `./tcg-format/` to `@wynillo/tcg-format`. Delete `js/tcg-format/`. Tests green.
10. **Publish `@wynillo/eos-types`** — auto-generated types-only package exporting `EffectDescriptorMap`, `CardEffectBlock`, `CardData`, mod API types. Modders install as devDep.
11. **Clean up**: remove `loadTcgFile` shim, finalize mod API `loadModTcg` + typed `registerEffect`, update `generate:tcg` script.

## Mod Support (Runtime .tcg Loading)

Community mod authors need to load external `.tcg` files at runtime without a game rebuild. This is preserved and improved:

**Package API stays open**: The package exports `loadTcgFile(url | ArrayBuffer)` as a first-class public API returning raw `TcgLoadResult` (TcgCard[], TcgManifest, etc.). Mods can call this directly via dynamic import without touching game internals.

**Bridge accepts any URL**: `loadAndApplyTcg(url)` in `tcg-bridge.ts` is called with any `.tcg` URL — `base.tcg` or a community mod URL. It can be called multiple times to layer multiple sets.

**Expose via mod API** (`js/mod-api.ts`): Add `loadModTcg` to `window.EchoesOfSanguoMod` so external mod scripts can load a `.tcg` archive with a single call:
```typescript
// New entry in mod-api.ts
import { loadAndApplyTcg } from './tcg-bridge.js';
const modApi = {
  ...existing,
  /** Load a community .tcg archive and merge its cards into the game. */
  loadModTcg: loadAndApplyTcg,
};
```

This is a net improvement over today: currently there is no supported way for a mod script to load a `.tcg` archive; they can only push individual cards to `CARD_DB`. After this change, mod authors can do:
```javascript
await window.EchoesOfSanguoMod.loadModTcg('https://mod-author.com/my-expansion.tcg');
```

**Modder capabilities after all changes:**

| Capability | Status | How |
|---|---|---|
| Ship new cards/opponents via `.tcg` | ✅ | Core mod workflow |
| Use all existing effects/triggers | ✅ | Stable effect strings |
| Register custom JS effect handlers | ✅ | `registerEffect` in mod API |
| Extend `EffectDescriptorMap` with typed custom actions | ✅ | Declaration merging via `@wynillo/eos-types` |
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
