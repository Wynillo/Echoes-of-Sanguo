# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

`@wynillo/tcg-format` is a TypeScript library for loading, validating, and packing `.tcg` archives — the portable card data format used by the Echoes of Sanguo game engine and card creator. This is a **format library**, not a game engine. It extracts and validates data without implementing game rules or rendering.

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js >= 18
- **Module system:** ESM (`"type": "module"` in package.json, Node16 module resolution)
- **Dependencies:** JSZip (ZIP handling)
- **Testing:** Vitest
- **Build:** `tsc` (TypeScript compiler)
- **Package registry:** GitHub Packages (`@wynillo` scope)

## Common Commands

```bash
npm run build        # Compile TypeScript to dist/
npm test             # Run tests once (vitest run)
npm run test:watch   # Run tests in watch mode
```

There is no linter or formatter configured.

## Project Structure

```
src/
├── index.ts              # Public API exports
├── types.ts              # All type definitions and integer enum constants
├── tcg-loader.ts         # Loads .tcg archives (ZIP → TcgLoadResult)
├── tcg-packer.ts         # Packs directories into .tcg archives (Node.js only)
├── tcg-validator.ts      # Validates archive structure and cross-references
├── card-validator.ts     # Validates TcgCard[] schema
├── def-validator.ts      # Validates TcgCardDefinition[] schema
├── opp-desc-validator.ts # Validates opponent description schema
└── cli.ts                # CLI entry point (validate, pack, inspect commands)

tests/
├── *.test.ts                   # Unit tests for each module
└── fixtures/base.tcg-src/      # Sample .tcg source folder for tests
```

## Architecture Notes

- **Pure/functional design** — no global state mutations, all data flows through function returns.
- **Environment-agnostic loader** — works in both browser (fetch) and Node.js; returns raw `ArrayBuffer` for images instead of blob URLs.
- **Node-only packer** — `packTcgArchive` and `packTcgArchiveToBuffer` use `node:fs`.
- **Multi-stage validation** — individual validators (cards, definitions, opponents) compose into the archive validator. Validation collects all errors rather than failing fast.
- **Custom error types** — `TcgNetworkError` for fetch failures, `TcgFormatError` for structural/validation failures.

## Code Conventions

- **Import extensions** — always use `.js` extensions in TypeScript imports (required by Node16 module resolution).
- **Integer enums** — card properties (types, attributes, races, rarities) use plain integer constants, not TypeScript enums. Constants are exported from `types.ts` (e.g., `TCG_TYPE_MONSTER = 1`).
- **Strict TypeScript** — `strict: true` in tsconfig.json. All code must pass strict type checking.
- **No classes for data** — card data uses plain interfaces (`TcgCard`, `TcgParsedCard`). Validators and loaders are standalone functions.

## Key Domain Concepts

| Concept | Values | Notes |
|---------|--------|-------|
| Card Types | 1=Monster, 2=Fusion, 3=Spell, 4=Trap, 5=Equipment | Monsters/Fusions have ATK/DEF/level; Spells have spellType; Traps have trapTrigger; Equipment has bonuses |
| Spell Types | 1=normal, 2=targeted, 3=fromGrave, 4=field | Spells only |
| Trap Triggers | 1=onAttack, 2=onOwnMonsterAttacked, 3=onOpponentSummon, 4=manual, 5=onOpponentSpell, 6=onAnySummon, 7=onOpponentTrap | Traps only |
| Attributes | 1=Light, 2=Dark, 3=Fire, 4=Water, 5=Earth, 6=Wind | Optional on monsters/fusions |
| Races | Base: 1-12 (Dragon, Spellcaster, Warrior, Beast, Plant, Rock, Phoenix, Undead, Aqua, Insect, Machine, Pyro); extensible by mods (20+) | Optional on monsters/fusions |
| Rarities | 1=Common, 2=Uncommon, 4=Rare, 6=Super Rare, 8=Ultra Rare | Non-consecutive integers |
| Levels | 1-12 | Monsters and fusions only |

## Archive Contents (`.tcg` file)

A `.tcg` file is a ZIP archive containing:
- `cards.json` (required) — card data array (supports `spirit: true` flag for spirit monsters)
- `img/` — card artwork PNGs (named by card ID)
- `manifest.json` — format version, author, features
- `mod.json` — mod metadata (id, name, version, author, type, compatibility)
- `meta.json` — fusion recipes, opponent configs, starter decks (legacy)
- `starterDecks.json` — standalone starter deck definitions (replaces meta.starterDecks)
- `opponents/` — opponent deck JSON files
- `opponents_description.json` — localized opponent metadata (can also live under `locales/`)
- `campaign.json` — story campaign structure
- `shop.json` — booster pack definitions (supports `nameKey`/`descKey` i18n keys and `cardPool` filters)
- `fusion_formulas.json` — fusion recipe definitions
- `rules.json` — game rules (opaque to format library)
- `locales/` — locale override files (en.json, de.json, etc.)
- `ui/` — UI assets (shop backgrounds, etc.)
- `races.json`, `attributes.json`, `card_types.json`, `rarities.json` — metadata lookups
