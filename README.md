# Echoes of Sanguo

A browser-based trading card game inspired by **Yu-Gi-Oh! Forbidden Memories** — built with React 19, TypeScript 5.9, Vite 8, and a custom ZIP-based card format (.tcg).

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

### 722+ Cards
| Type | Count |
|---|---|
| Normal Monster | ~390 |
| Effect Monster | 208 |
| Fusion Monster | 30 |
| Spell | 76 |
| Trap | 44 |
| **Total** | **~722** |

**5 Rarity Levels:** Common · Uncommon · Rare · Super Rare · Ultra Rare

### Effect System
Data-driven effect system with the following triggers:
- `onSummon` — effect on summon
- `onDestroyByBattle` — effect when destroyed in battle
- `onDestroyByOpponent` — effect when destroyed by the opponent
- `passive` — continuous effect (`piercing`, `cannotBeTargeted`)

Effects include: direct damage, LP healing, card draw, ATK/DEF buffs and debuffs, bounce, and piercing damage.

### Fusion System
Two monsters in hand can be fused directly. 30+ recipes produce powerful fusion monsters (Level 5–9, up to Ultra Rare).

### Internationalization
Fully translated into **German** and **English** via i18next.

### Mobile App
Android support via **Capacitor 8** — the web game runs natively on Android devices.

---

## Progression

### Progression Loop
```
First launch → Choose starter deck (10 races available)
  → Challenge opponents → Win duels → Earn Ether Coins
  → Shop → Buy booster packs → Receive new cards
  → Build collection → Unlock stronger opponents
```

### 10 Opponents (unlocked sequentially)
| # | Name | Race | Difficulty | Coins (Win / Loss) |
|---|---|---|---|---|
| 1 | Apprentice Finn | Warrior | Tutorial | 100 / 20 |
| 2 | Gardener Mira | Plant | Easy | 150 / 30 |
| 3 | Whisperer Syl | Elf | Medium | 200 / 40 |
| 4 | Deep Sea Fisher | Water | Medium | 200 / 40 |
| 5 | Volcano Smith | Fire | Medium-Hard | 250 / 50 |
| 6 | Stone Guardian Grom | Stone | Hard | 300 / 60 |
| 7 | Shadow Dealer | Demon | Hard | 300 / 60 |
| 8 | Wind Weaver | Flying | Very Hard | 400 / 80 |
| 9 | Archmage Theron | Magician | Very Hard | 400 / 80 |
| 10 | Dragon Lord Varek | Dragon | Extreme | 500 / 100 |

### Booster Packs
| Pack | Price | Contents |
|---|---|---|
| Starter Pack | 200 ◈ | 9 cards, one race, Common/Uncommon-heavy |
| Race Pack | 350 ◈ | 9 cards, chosen race |
| Ether Pack | 500 ◈ | 9 cards, all races |
| Rarity Pack | 600 ◈ | 9 cards, minimum Rare, increased SR/UR chance |

**Pack Slot Rules:** Slots 1–5 Common · Slots 6–7 Uncommon · Slot 8 Rare · Slot 9 Rare (75%) / Super Rare (20%) / Ultra Rare (5%)

---

## Screens / Navigation

```
[Title Screen]
  → First time: [Starter Deck Selection]  (once, 10 races to choose from)
  → "Start Duel":   [Opponent Selection]  → [Game Board]  → [Duel Result]
  → "Shop":         [Shop]  → [Pack Opening]
  → "Collection":   [Collection Binder]  (722+ cards, silhouette for missing)
  → "Deckbuilder":  [Deck Builder]  (own cards only, 40-card deck)
  → "Save Point":   [Save / Load]
```

---

## Tech Stack

| Technology | Usage |
|---|---|
| **React 19.2.4** | UI framework with Context-based state management |
| **TypeScript 5.9** | Type safety for game engine & UI |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS 4** | Styling (pixel font theme, dark fantasy design) |
| **GSAP 3.14** | Animations (attacks, card effects) |
| **i18next** | Internationalization (DE/EN) |
| **Capacitor 8** | Android app bridge |
| **Vitest 4** | Unit and integration tests (jsdom) |
| **Playwright 1.58** | End-to-end tests |

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
├── css/
│   ├── style.css               – Main stylesheet
│   ├── animations.css          – Card & battle animations
│   └── progression.css         – Shop/collection screen styles
├── js/
│   ├── main.js                 – Entry point (loads base.tcg, mounts React)
│   ├── types.ts                – Core type definitions (enums, interfaces)
│   ├── cards.ts                – Card database store & lookup functions
│   ├── cards-data.ts           – Extended card definitions
│   ├── engine.ts               – Game engine (phases, battle, fusion, AI turns)
│   ├── effect-registry.ts      – Data-driven effect executor (EFFECT_REGISTRY)
│   ├── ai-behaviors.ts         – AI behavior profiles (AI_BEHAVIOR_REGISTRY)
│   ├── progression.ts          – localStorage manager (coins, collection, deck)
│   ├── audio.ts                – SFX/music manager (Web Audio API)
│   ├── i18n.ts                 – i18next setup
│   ├── mod-api.ts              – Modding API (window.EchoesOfSanguoMod)
│   ├── tcg-format/             – Custom card format (.tcg = ZIP archive with JSON)
│   │   ├── tcg-builder.ts      – Packs base.tcg-src/ → base.tcg (ZIP)
│   │   ├── tcg-loader.ts       – Loads .tcg ZIP → CARD_DB, FUSION_RECIPES, etc.
│   │   ├── tcg-validator.ts    – Validation logic for TCG archives
│   │   ├── effect-serializer.ts – Effect string codec
│   │   └── generate-base-tcg.ts – CLI: validate & pack base.tcg-src/
│   └── react/
│       ├── App.tsx             – Root component (provider tree + screen router)
│       ├── contexts/           – React contexts (Game, Screen, Progression, Modal, Selection)
│       ├── screens/            – Screen components (Title, Starter, Opponent, Game, Shop, PackOpening, Collection, Deckbuilder, SavePoint)
│       ├── components/         – Reusable UI components (Card, HandCard, FieldCard, HoverPreview)
│       ├── modals/             – Modal dialogs (CardAction, CardDetail, CardList, GraveSelect, TrapPrompt, Options, Result)
│       ├── hooks/              – Custom hooks (useAnimatedNumber, useAttackAnimation, useAudio, useKeyboardShortcuts)
│       └── utils/
│           └── pack-logic.ts   – Booster pack generation
├── public/
│   ├── base.tcg                – Compiled card archive (ZIP format)
│   ├── base.tcg-src/           – Source data for base.tcg (served directly by Vite)
│   │   ├── cards.json          – Card stats (numeric IDs)
│   │   ├── meta.json           – Fusion recipes & starter decks
│   │   ├── races.json          – Race metadata { id, key, value, color, icon }
│   │   ├── attributes.json     – Attribute metadata { id, key, value, color, symbol }
│   │   ├── card_types.json     – Card type metadata { id, key, value, color }
│   │   ├── rarities.json       – Rarity metadata { id, key, value, color }
│   │   ├── manifest.json       – Format version
│   │   ├── shop.json           – Booster pack definitions
│   │   ├── campaign.json       – Campaign map data
│   │   ├── id_migration.json   – String-ID → Numeric-ID mapping
│   │   ├── opponents/          – Per-opponent deck JSON files
│   │   └── locales/            – Translation overrides (de_cards_description.json, etc.)
│   └── audio/                  – Sound effects
├── locales/
│   ├── de.json                 – German translations
│   └── en.json                 – English translations
├── tests/                      – Unit/integration tests (Vitest)
├── tests-e2e/                  – End-to-end tests (Playwright)
└── android/                    – Capacitor Android project
```

---

## Card Format (.tcg)

`base.tcg` is a **ZIP archive** (renamed to `.tcg`) containing JSON files and card artwork. It is loaded on startup:

- **tcg-builder.ts** — packs `public/base.tcg-src/` → `public/base.tcg` (ZIP)
- **tcg-loader.ts** — unpacks the ZIP and populates CARD_DB, FUSION_RECIPES, etc.
- **tcg-validator.ts** — checks completeness and consistency of the archive
- **effect-serializer.ts** — parses and serializes effect strings

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

npm test                 # Run tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Test coverage report
npm run test:e2e         # End-to-end tests (Playwright)

npm run build:android    # Build + Capacitor sync for Android
npm run cap:sync         # Sync Capacitor changes
npm run cap:open         # Open Android Studio
```
