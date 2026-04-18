# Echoes of Sanguo — Engine

The game engine and runtime for **Echoes of Sanguo** — a browser-based TCG inspired by **Yu-Gi-Oh! Forbidden Memories**. Built with React 19, TypeScript 6, Vite 8. Loads card content from `.tcg` packs at runtime.

---

## Ecosystem

| Repository | Role |
|---|---|
| **This repo (Engine)** | Game runtime, UI, effect system, AI, mod API |
| [`@wynillo/tcg-format`](https://github.com/Wynillo/Echoes-of-Sanguo-TCG) | TCG archive format library (load / validate / pack `.tcg` files) |
| [`@wynillo/echoes-mod-base`](https://github.com/Wynillo/Echoes-of-Sanguo-MOD-base) | Base card set & content (cards, opponents, campaign, shop, locales) |
| `echoes-of-sanguo-mod-forbiddenmemories` *(coming soon)* | Alternative TCG pack based on Yu-Gi-Oh! Forbidden Memories |

---

## Documentation

Comprehensive documentation is available in [`docs/`](./docs/README.md):

| Topic | File | Status |
|-------|------|--------|
| **Core Engine** | | |
| Cards & Field | [docs/cards-field.md](./docs/cards-field.md) | ✅ Complete |
| Effect System | [docs/effect-system.md](./docs/effect-system.md) | ✅ Complete |
| Engine-Core | [docs/engine-core.md](./docs/engine-core.md) | ✅ Complete |
| TCG Format | [docs/tcg-format.md](./docs/tcg-format.md) | ✅ Complete |
| Mod API | [docs/mod-api.md](./docs/mod-api.md) | ✅ Complete |
| AI System | [docs/ai-system.md](./docs/ai-system.md) | ✅ Complete |
| UI Architecture | [docs/ui-architecture.md](./docs/ui-architecture.md) | ✅ Complete |
| **Content & Progression** | | |
| Opponents & Decks | [docs/opponents-decks.md](./docs/opponents-decks.md) | ✅ Complete |
| Shop & Progression | [docs/shop-progression.md](./docs/shop-progression.md) | ✅ Complete |
| Campaign | [docs/campaign.md](./docs/campaign.md) | ✅ Complete |
| **Reference** | | |
| Architecture | [.claude/architecture.md](./.claude/architecture.md) | ✅ Complete |
| Conventions | [.claude/conventions.md](./.claude/conventions.md) | ✅ Complete |

➡️ **Start here:** [docs/README.md](./docs/README.md) — Full documentation index (10/11 docs complete, 91%)

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

## Engine Features

### Effect System

Data-driven effect system with **60+ actions** and **7 triggers**. Effects are defined as strings in `.tcg` card data and executed by the `EFFECT_REGISTRY` at runtime.

**Triggers:**

| Trigger | Fires when... |
|---|---|
| `onSummon` | Monster is summoned to the field |
| `onDestroyByBattle` | Monster is destroyed in battle |
| `onDestroyByOpponent` | Monster is destroyed by the opponent (battle or effect) |
| `onFlipSummon` | Monster is flip summoned (manually or by attack) |
| `onDealBattleDamage` | Monster deals battle damage to the opponent |
| `onSentToGrave` | Card is sent to the graveyard |
| `passive` | Continuous effect while on the field |

**Effect Actions (grouped by category):**

| Category | Actions |
|---|---|
| **Damage / Heal** | `dealDamage`, `gainLP`, `reflectBattleDamage` |
| **Draw / Search** | `draw`, `searchDeckToHand`, `peekTopCard`, `drawThenDiscard` |
| **Stat Modification** | `buffField`, `debuffField`, `tempBuffField`, `tempDebuffField`, `tempAtkBonus`, `permAtkBonus`, `tempDefBonus`, `permDefBonus`, `halveAtk`, `doubleAtk`, `swapAtkDef` |
| **Removal / Bounce** | `bounceStrongestOpp`, `bounceAttacker`, `bounceAllOppMonsters`, `bounceOppHandToDeck`, `destroyAttacker`, `destroyAllOpp`, `destroyAll`, `destroyWeakestOpp`, `destroyStrongestOpp`, `destroyByFilter`, `destroySummonedIf`, `destroyAndDamageBoth` |
| **Graveyard** | `reviveFromGrave`, `reviveFromEitherGrave`, `salvageFromGrave`, `recycleFromGraveToDeck`, `shuffleGraveIntoDeck`, `sendTopCardsToGrave`, `sendTopCardsToGraveOpp` |
| **Summon / Hand** | `specialSummonFromHand`, `specialSummonFromDeck`, `discardFromHand`, `discardOppHand`, `discardEntireHand`, `createTokens`, `excavateAndSummon` |
| **Control** | `stealMonster`, `stealMonsterTemp`, `cancelAttack`, `cancelEffect`, `preventAttacks`, `preventBattleDamage`, `skipOppDraw`, `changePositionOpp`, `setFaceDown`, `flipAllOppFaceDown` |
| **Spell / Trap Removal** | `destroyOppSpellTrap`, `destroyAllOppSpellTraps`, `destroyAllSpellTraps`, `destroyOppFieldSpell` |
| **Passive Abilities** | `passive_piercing`, `passive_untargetable`, `passive_directAttack`, `passive_vsAttrBonus`, `passive_phoenixRevival`, `passive_indestructible`, `passive_effectImmune`, `passive_cantBeAttacked`, `passive_negateTraps`, `passive_negateSpells`, `passive_negateMonsterEffects` |
| **Utility** | `tributeSelf`, `payCost`, `shuffleDeck`, `gameReset` |

### Fusion System

Two monsters in hand can be fused directly. Fusion formulas produce powerful fusion monsters (Level 5–9, up to Ultra Rare). Recipes are loaded from the `.tcg` pack.

### Mod API

The engine exposes `window.EchoesOfSanguoMod` for runtime modding:

| API | Description |
|---|---|
| `CARD_DB` | Live card database — register new cards directly |
| `FUSION_RECIPES` | Fusion recipe registry |
| `OPPONENT_CONFIGS` | Opponent configuration registry |
| `STARTER_DECKS` | Starter deck definitions |
| `EFFECT_REGISTRY` | Read-only view of all registered effect actions |
| `registerEffect(name, handler)` | Register custom effect actions |
| `loadModTcg(url)` | Load additional `.tcg` archives at runtime |
| `unloadModCards(modId)` | Remove cards and opponents from a loaded mod |
| `getLoadedMods()` | List all currently loaded mods |
| `emitTrigger(event, context)` | Fire custom trigger events |
| `addTriggerHook(event, handler)` | Subscribe to trigger events |

### TriggerBus

Flexible event emitter for extensible hooks. Modders can subscribe to any named event with `on(event, handler)` and fire events with `emit(event, context)`. Supports arbitrary custom event names beyond the built-in triggers.

### AI System

The AI uses configurable behavior profiles that control decision-making:

| Profile | Strategy |
|---|---|
| `default` | Balanced play |
| `aggressive` | Prioritizes attacking and damage |
| `defensive` | Prioritizes defense and survival |
| `smart` | Evaluates board state more deeply |
| `cheating` | Has access to hidden information |

AI turn sequence: draw → main phase (fusions, summons, spells, traps) → battle phase (target selection) → end phase. Behavior profiles are assigned per opponent in the `.tcg` pack.

### Campaign & Shop Systems

The engine supports a **node-based campaign** system with duels, story nodes, gauntlet encounters, and unlock conditions. Campaign structure is defined in the loaded `.tcg` pack.

The engine supports a **tiered shop** system with configurable packages, pricing, unlock conditions, and card pool filters. Shop configuration is defined in the loaded `.tcg` pack.

### Progression

All progress is stored client-side via `localStorage`. The engine manages the full gameplay loop:

```
First launch → Choose starter deck
  → Campaign mode → Win duels → Earn Jade Coins
  → Shop → Buy card packages → Receive new cards
  → Build collection → Unlock stronger opponents & new shop tiers
```

### Internationalization

Fully translated into **German** and **English** via i18next. Card and UI translations are loaded from the `.tcg` pack and locale files.

### Mobile App

Android support via **Capacitor 8** — the web game runs natively on Android devices.

---

## Screens / Navigation

```
[Press Start Screen]
  → [Title Screen]
    → First time: [Starter Deck Selection]  (once, races defined in TCG pack)
    → "Campaign":    [Campaign Map]  → [Dialogue]  → [Opponent Selection]  → [Game Board]  → [Duel Result]
    → "Shop":        [Shop]  → [Pack Opening]
    → "Collection":  [Collection Binder]  (all cards from loaded TCG pack, silhouette for missing)
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
ECHOES-OF-SANGUO-ENGINE/
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
├── src/
│   ├── main.ts                 – Entry point (loads base.tcg from @wynillo/echoes-mod-base, mounts React)
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
│   ├── copy-tcg.ts             – Script to copy base.tcg from @wynillo/echoes-mod-base
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
│   ├── base.tcg                – Compiled card archive (ZIP format, from @wynillo/echoes-mod-base)
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
- **copy-tcg.ts** — copies `base.tcg` from the `@wynillo/echoes-mod-base` package to the public folder

Copy via `npm run copy:tcg` — retrieves the base card set from the external package.

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

## Development

```bash
# Requirements: Node.js >= 18

npm install              # Install dependencies

npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Production build → dist/
npm run copy:tcg         # Copy base.tcg from @wynillo/echoes-mod-base package
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

---

## Optional GitHub API Authentication

The engine checks for TCG updates from GitHub on startup. To avoid rate limiting (60 requests/hour for unauthenticated requests), you can provide a GitHub token:

**1. Create `.env.local` file in project root:**
```bash
cp .env.example .env.local
```

**2. Add your token:**
```env
VITE_GITHUB_TOKEN=your_github_token_here
```

**3. Get a token:**
- Go to https://github.com/settings/tokens
- Create a fine-grained token with no special permissions (public repo read is automatic)
- Authenticated requests get 5,000 requests/hour rate limit

**Note:** The `VITE_` prefix is required for Vite to expose the variable to client-side code. The token is optional - the app works in unauthenticated mode if not provided.
