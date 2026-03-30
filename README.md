# Echoes of Sanguo

A browser-based trading card game inspired by **Yu-Gi-Oh! Forbidden Memories** — built with React 19, TypeScript 6.0, Vite 8, and a custom ZIP-based card format (.tcg).

---

## Game Rules

Echoes of Sanguo is a 1v1 duel card game. Each player starts with **8000 Life Points**. The first player to reach 0 loses.

**Core Rules (Forbidden Memories style):**
- No tribute summoning — all monsters are playable immediately
- Unlimited summons per turn
- Newly summoned monsters have summoning sickness (cannot attack the same turn)
- Fusion monsters are the exception: direct special summon from hand, immediately ready to attack
- Hand limit: 8 cards
- Starting hand: 5 cards, draw 1 per turn

---

## Features

### 10 Monster Races
Each race has a distinct playstyle and stat bias:

| Race | Icon | Playstyle |
|---|---|---|
| Fire | 🔥 | Direct damage on summon/destruction |
| Dragon | 🐲 | High ATK, targeting immunity |
| Flying | 🦅 | Weaken opponents, hard to attack |
| Stone | 🪨 | High DEF, strong healing |
| Plant | 🌿 | LP recovery, staying power |
| Warrior | ⚔️ | ATK buffs, piercing damage |
| Magician | 🔮 | Card draw, board control |
| Elf | ✨ | Permanently weaken enemy monsters |
| Demon | 💀 | High damage, high-risk effects |
| Water | 🌊 | Bounce, control, trap synergy |

### 312 Cards
| Type | Count |
|---|---|
| Monster | 245 |
| Fusion Monster | 20 |
| Spell | 28 |
| Trap | 12 |
| Equipment | 7 |
| **Total** | **312** |

**5 Rarity Levels:** Common · Uncommon · Rare · Super Rare · Ultra Rare

### Effect System
Data-driven effect system with the following triggers:
- `onSummon` — effect on summon
- `onDestroyByBattle` — effect when destroyed in battle
- `onDestroyByOpponent` — effect when destroyed by the opponent
- `onFlip` — effect when flipped face-up
- `passive` — continuous effect (`piercing`, `cannotBeTargeted`)

Effects include: direct damage, LP healing, card draw, ATK/DEF buffs and debuffs, bounce, and piercing damage.

### Fusion System
Two monsters in hand can be fused directly. Fusion formulas produce powerful fusion monsters (Level 5–9, up to Ultra Rare).

### Internationalization
Fully translated into **German** and **English** via i18next.

### Mobile App
Android support via **Capacitor 8** — the web game runs natively on Android devices.

---

## Progression

### Progression Loop
```
First launch → Choose starter deck (6 races available)
  → Campaign mode → Progress through 7 chapters → Win duels → Earn Jade Coins
  → Shop → Buy tiered card packages → Receive new cards
  → Build collection → Unlock stronger opponents & new shop tiers
```

### Campaign
The campaign spans **7 chapters** with **39 duels**, story nodes, and gauntlet encounters:

| Chapter | Theme | Nodes |
|---|---|---|
| Han Court | Tutorial / early duels | 9 (8 duels + 1 story) |
| Tournament | Competitive arc | 5 (4 duels + 1 story) |
| Return | Mid-game | 4 (3 duels + 1 story) |
| Wu Xing | Elemental trials | 11 (11 duels) |
| Betrayal | Story pivot | 2 (1 duel + 1 story) |
| Endgame | Final challenges | 7 (6 duels + 1 story) |
| Postgame | Bonus content | 1 (1 duel) |

### Shop

**Tiered Packages** (unlocked via campaign progression):
| Package | Price | Unlock | Max ATK |
|---|---|---|---|
| Recruit's Supply | 250 ◈ | — | 1500 |
| Soldier's Cache | 350 ◈ | Duel 3 | 1800 |
| Officer's Bounty | 450 ◈ | Duel 8 | 2100 |
| Commander's Vault | 550 ◈ | Gauntlet Qualifiers | 2500 |
| Temple Relics | 650 ◈ | Duel 21 | 3000 |
| Warlord's Arsenal | 800 ◈ | Duel 31 | All |

---

## Screens / Navigation

```
[Press Start Screen]
  → [Title Screen]
    → First time: [Starter Deck Selection]  (once, 6 races to choose from)
    → "Campaign":    [Campaign Map]  → [Dialogue]  → [Opponent Selection]  → [Game Board]  → [Duel Result]
    → "Shop":        [Shop]  → [Pack Opening]
    → "Collection":  [Collection Binder]  (312 cards, silhouette for missing)
    → "Deckbuilder": [Deck Builder]  (own cards only, 40-card deck)
    → "Save Point":  [Save / Load]
```

---

## Tech Stack

| Technology | Usage |
|---|---|
| **React 19.2.4** | UI framework with Context-based state management |
| **TypeScript 6.0** | Type safety for game engine & UI |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS 4** | Styling (system fonts, dark fantasy design) |
| **GSAP 3.14** | Animations (attacks, card effects) |
| **i18next** | Internationalization (DE/EN) |
| **Capacitor 8** | Android app bridge |
| **Vitest 4** | Unit and integration tests (jsdom) |
| **Playwright 1.58** | End-to-end tests |
| **@wynillo/tcg-format** | Card format library (external package) |

**No backend** — all data is stored client-side via `localStorage`.

---

## File Structure

```
ECHOES-OF-SANGUO/
├── index.html                  – Entry HTML (React root + CRT overlay)
├── package.json                – Dependencies & scripts
├── vite.config.js              – Vite build configuration
├── tailwind.config.ts          – Tailwind theme (pixel fonts, dark fantasy)
├── capacitor.config.ts         – Capacitor Android configuration
├── tsconfig.json               – TypeScript configuration
├── css/
│   ├── style.css               – Main stylesheet
│   ├── animations.css          – Card & battle animations
│   └── progression.css         – Shop/collection screen styles
├── js/
│   ├── main.ts                 – Entry point (loads base.tcg-src, mounts React)
│   ├── types.ts                – Core type definitions (enums, interfaces)
│   ├── type-metadata.ts        – Type metadata helpers
│   ├── cards.ts                – Card database store & lookup functions
│   ├── engine.ts               – Game engine (phases, battle, fusion, AI turns)
│   ├── field.ts                – Field management
│   ├── rules.ts                – Game rules
│   ├── effect-registry.ts      – Data-driven effect executor (EFFECT_REGISTRY)
│   ├── ai-behaviors.ts         – AI behavior profiles (AI_BEHAVIOR_REGISTRY)
│   ├── ai-orchestrator.ts      – AI decision-making orchestrator
│   ├── campaign.ts             – Campaign logic
│   ├── campaign-types.ts       – Campaign type definitions
│   ├── campaign-store.ts       – Campaign state management
│   ├── progression.ts          – localStorage manager (coins, collection, deck)
│   ├── shop-data.ts            – Shop configuration
│   ├── audio.ts                – SFX/music manager (Web Audio API)
│   ├── i18n.ts                 – i18next setup
│   ├── mod-api.ts              – Modding API (window.EchoesOfSanguoMod)
│   ├── debug-logger.ts         – Debug utility
│   ├── tcg-bridge.ts           – Bridge: @wynillo/tcg-format → game stores
│   ├── tcg-builder.ts          – Converts CardData → TcgCard for packing
│   ├── enums.ts                – Bidirectional enum converters (int ↔ game enums)
│   ├── effect-serializer.ts    – Effect string codec (serialize/deserialize)
│   ├── generate-base-tcg.ts    – CLI wrapper → @wynillo/tcg-format packTcgArchive()
│   ├── trigger-bus.ts          – Event emitter for extensible trigger hooks
│   └── react/
│       ├── App.tsx             – Root component (provider tree + screen router)
│       ├── index.tsx           – React entry point
│       ├── contexts/           – React contexts (Game, Screen, Progression, Modal, Selection, Campaign)
│       ├── screens/            – Screen components (PressStart, Title, Starter, Campaign, Dialogue,
│       │                         Opponent, Game, DuelResult, Shop, PackOpening, Collection, Deckbuilder, SavePoint)
│       │   └── game/           – GameScreen sub-components (HandArea, LPPanel, OpponentField, PlayerField, PhaseControls)
│       ├── components/         – Reusable UI (Card, HandCard, FieldCard, FieldSpellTrap, HoverPreview,
│       │                         CardActivationOverlay, VFXOverlay, ErrorBoundary)
│       ├── modals/             – Modals (BattleLog, CardDetail, CardList, CoinToss, GauntletTransition,
│       │                         GraveSelect, Options, Result, TrapPrompt)
│       ├── hooks/              – Custom hooks (useAnimatedNumber, useAttackAnimation, useAudio,
│       │                         useFusionAnimation, useKeyboardShortcuts, useLongPress)
│       └── utils/              – pack-logic.ts, highlightCardText.tsx
├── public/
│   ├── base.tcg                – Compiled card archive (ZIP format)
│   ├── base.tcg-src/           – Source data for base.tcg (served directly by Vite)
│   │   ├── cards.json          – 312 cards (numeric IDs)
│   │   ├── meta.json           – Starter decks
│   │   ├── fusion_formulas.json – Fusion recipe formulas
│   │   ├── races.json          – Race metadata { id, key, value, color, icon }
│   │   ├── attributes.json     – Attribute metadata { id, key, value, color, symbol }
│   │   ├── card_types.json     – Card type metadata (Monster, Fusion, Spell, Trap, Equipment)
│   │   ├── rarities.json       – Rarity metadata { id, key, value, color }
│   │   ├── manifest.json       – Format version
│   │   ├── shop.json           – Booster pack & package definitions
│   │   ├── campaign.json       – Campaign map (7 chapters, 39 duels)
│   │   ├── id_migration.json   – String-ID → Numeric-ID mapping
│   │   ├── opponents/          – 39 per-opponent deck JSON files
│   │   └── locales/            – cards_description.json, opponents_description.json
│   └── audio/                  – Music (5 tracks) and SFX (12 effects)
├── locales/
│   ├── de.json                 – German translations
│   └── en.json                 – English translations
├── tests/                      – Unit/integration tests (Vitest, 21 test files)
├── tests-e2e/                  – End-to-end tests (Playwright)
├── docs/                       – Documentation (tcg-format.md, card-effects-table.md, ux-audit.md, and more)
└── android/                    – Capacitor Android project
```

---

## Card Format (.tcg)

`base.tcg` is a **ZIP archive** (renamed to `.tcg`) containing JSON files and card artwork. It is loaded on startup.

The core TCG format library has been extracted to the [`@wynillo/tcg-format`](https://github.com/Wynillo/Echoes-of-Sanguo-TCG) package. It handles loading, validation, and packing of `.tcg` archives with zero game-engine dependencies.

**In this repo** (game-specific glue):
- **tcg-bridge.ts** — connects `@wynillo/tcg-format` output to game stores (CARD_DB, FUSION_RECIPES, etc.)
- **tcg-builder.ts** — converts `CardData` → `TcgCard` for packing
- **effect-serializer.ts** — parses and serializes effect strings (the package treats effects as opaque)
- **enums.ts** — bidirectional converters between TCG integer IDs and game enums
- **generate-base-tcg.ts** — thin CLI wrapper calling the package's `packTcgArchive()`

Generate via `npm run generate:tcg` — validates `public/base.tcg-src/` and repacks it.

---

## Persistence

All progress data is stored in `localStorage` (prefixes `tcg_` and `eos_`):

| Key | Contents |
|---|---|
| `tcg_initialized` | Marks first launch complete |
| `tcg_starter_chosen` | Starter selection completed |
| `tcg_starter_race` | Chosen starter race |
| `tcg_collection` | Card collection `[{id, count}, ...]` |
| `tcg_deck` | Current deck (40 cards) |
| `eos_jade_coins` | Current coin balance |
| `tcg_opponents` | Opponent status `{1: {unlocked, wins, losses}, ...}` |
| `tcg_settings` | User settings |
| `tcg_seen_cards` | Cards seen by the player |
| `tcg_save_version` | Migration version |

---

## AI

The AI plays strategically according to a fixed priority:
1. Summon fusion from hand (if possible)
2. Play all monsters from hand
3. Activate spell cards
4. Set traps
5. Attack: prefers monsters it can destroy; otherwise attacks directly

---

## Development

```bash
# Requirements: Node.js >= 18

npm install              # Install dependencies

npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build → dist/
npm run generate:tcg     # Generate base.tcg from card source data
npm run generate:engine-dts  # Generate eos-engine.d.ts for modders

npm test                 # Run tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Test coverage report
npm run test:e2e         # End-to-end tests (Playwright)

npm run build:android    # Build + Capacitor sync for Android
npm run cap:sync         # Sync Capacitor changes
npm run cap:open         # Open Android Studio

# @wynillo/tcg-format is installed automatically from GitHub via npm install.
# To develop against a local clone, use npm link:
# cd /path/to/Echoes-of-Sanguo-TCG && npm ci && npm run build && npm link
# cd <this-repo> && npm link @wynillo/tcg-format
```
