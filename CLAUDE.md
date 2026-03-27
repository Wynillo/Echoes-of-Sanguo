# CLAUDE.md — Echoes of Sanguo

Browser-based TCG inspired by Yu-Gi-Oh! Forbidden Memories. Built with React 19, TypeScript 6, Vite 8, and a custom ZIP-based card format (.tcg).

## Quick Commands

```bash
npm run dev            # Dev server at localhost:5173
npm run build          # Production build → dist/
npm test               # Run Vitest tests once
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Coverage report (v8)
npm run test:e2e       # Playwright E2E tests (launches dev server)
npm run generate:tcg   # Validate public/base.tcg-src/ folder and pack into public/base.tcg
npm run build:android  # Build + Capacitor sync for Android
npm run cap:sync       # Sync Capacitor changes
npm run cap:open       # Open Android Studio
```

## Architecture

Three-layer design with strict separation:

1. **Engine Layer** (pure TypeScript, no React) — `js/engine.ts`, `js/effect-registry.ts`, `js/ai-behaviors.ts`, `js/ai-orchestrator.ts`, `js/field.ts`, `js/rules.ts`
2. **Data Layer** — `js/types.ts`, `js/cards.ts`, `js/progression.ts`, `js/campaign.ts`, `js/campaign-types.ts`, `js/campaign-store.ts`, `js/shop-data.ts`, `js/tcg-format/`
3. **UI Layer** (React) — `js/react/` with Context-based state management

The engine communicates with the UI through the `UICallbacks` interface (render, log, prompt, showResult, playAttackAnimation, etc.). The engine never imports React.

## Directory Structure

```
js/
├── main.ts                # Entry point (loads base.tcg-src, mounts React)
├── engine.ts              # Game logic (phases, battle, summoning, AI turns)
├── field.ts               # Field management
├── rules.ts               # Game rules
├── types.ts               # Core types/enums (CardData, GameState, Phase, Owner, etc.)
├── type-metadata.ts       # Type metadata helpers
├── cards.ts               # Card database store (CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS)
├── effect-registry.ts     # Data-driven effect executor (EFFECT_REGISTRY)
├── ai-behaviors.ts        # AI behavior profiles (AI_BEHAVIOR_REGISTRY)
├── ai-orchestrator.ts     # AI decision-making orchestrator
├── campaign.ts            # Campaign logic
├── campaign-types.ts      # Campaign type definitions
├── campaign-store.ts      # Campaign state management
├── progression.ts         # Save/load via localStorage (coins, collection, deck)
├── shop-data.ts           # Shop configuration
├── audio.ts               # Web Audio API singleton
├── mod-api.ts             # window.EchoesOfSanguoMod API for community mods
├── i18n.ts                # i18next setup (de + en)
├── debug-logger.ts        # Debug utility
├── tcg-format/            # ZIP-based card format (.tcg) — pack, load, validate
│   ├── index.ts           # Export barrel
│   ├── types.ts           # TCG format types
│   ├── enums.ts           # TCG format enums
│   ├── tcg-loader.ts      # Load .tcg ZIP → CARD_DB, FUSION_RECIPES, etc.
│   ├── tcg-builder.ts     # Pack base.tcg-src/ → base.tcg (ZIP)
│   ├── tcg-validator.ts   # Format validation
│   ├── card-validator.ts  # Card-level validation
│   ├── def-validator.ts   # Definition validator
│   ├── opp-desc-validator.ts # Opponent description validator
│   ├── effect-serializer.ts  # Effect string codec
│   └── generate-base-tcg.ts  # CLI script for npm run generate:tcg
└── react/
    ├── App.tsx             # Root component, screen router
    ├── index.tsx           # React entry point
    ├── contexts/           # GameContext, ProgressionContext, ModalContext, ScreenContext, SelectionContext, CampaignContext
    ├── screens/            # TitleScreen, PressStartScreen, StarterScreen, CampaignScreen, DialogueScreen,
    │                       #   OpponentScreen, GameScreen, DefeatedScreen, ShopScreen, PackOpeningScreen,
    │                       #   CollectionScreen, DeckbuilderScreen, SavePointScreen
    │   └── game/           # GameScreen sub-components (HandArea, LPPanel, OpponentField, PlayerField, PhaseControls)
    ├── components/         # Card, HandCard, FieldCardComponent, FieldSpellTrapComponent, HoverPreview,
    │                       #   CardActivationOverlay, VFXOverlay, ErrorBoundary
    ├── modals/             # BattleLogModal, CardDetailModal, CardListModal, CoinTossModal,
    │                       #   GauntletTransitionModal, GraveSelectModal, OptionsModal, ResultModal, TrapPromptModal
    ├── hooks/              # useAnimatedNumber, useAttackAnimation, useAudio, useFusionAnimation,
    │                       #   useKeyboardShortcuts, useLongPress
    └── utils/              # pack-logic.ts, highlightCardText.tsx

tests/                     # Vitest unit/integration tests
tests-e2e/                 # Playwright E2E tests
css/                       # style.css, animations.css, progression.css
locales/                   # de.json, en.json
public/
├── base.tcg-src/          # TCG source folder (served directly by Vite)
│   ├── cards.json         # Card data (312 cards, numeric IDs)
│   ├── races.json         # Race metadata { id, key, value, color, icon }
│   ├── attributes.json    # Attribute metadata { id, key, value, color, symbol }
│   ├── card_types.json    # Card type metadata { id, key, value, color }
│   ├── rarities.json      # Rarity metadata { id, key, value, color }
│   ├── meta.json          # Starter decks
│   ├── fusion_formulas.json # Fusion recipe formulas
│   ├── manifest.json      # Format version
│   ├── shop.json          # Shop/booster pack & package definitions
│   ├── campaign.json      # Campaign map data (7 chapters, 39 duels)
│   ├── id_migration.json  # String-ID → Numeric-ID mapping
│   ├── locales/           # cards_description.json, opponents_description.json
│   └── opponents/         # 39 per-opponent deck JSON files
├── audio/                 # Music and sound effects
│   ├── music/             # battle, defeat, shop, title, victory
│   └── sfx/               # attack, button, card-play, coin, damage, destroy, draw, fusion, etc.
└── title-bg.png
android/                   # Capacitor Android project
docs/                      # Documentation (tcg-format.md)
```

## Key Conventions

### Naming
- **Classes/Types**: PascalCase (`GameEngine`, `FieldCard`, `CardData`)
- **Functions/variables**: camelCase (`drawCard`, `executeEffectBlock`)
- **Constants**: UPPER_SNAKE_CASE (`HAND_LIMIT_END`, `CARD_DB`, `FUSION_RECIPES`)
- **Enums**: PascalCase members (`CardType.Monster`, `Race.Dragon`)

### Imports
- ES modules throughout; use `.js` extension in import paths (TypeScript with bundler resolution)
- Example: `import { CardType, Attribute } from './types.js';`

### State Management
- React Context API only (no Redux/Zustand)
- Six contexts: GameContext, ProgressionContext, ModalContext, ScreenContext, SelectionContext, CampaignContext
- Persistence via localStorage with `tcg_` / `eos_` key prefixes

### Commit Messages
Conventional commits with scope:
```
feat(ui): add Press Start screen with pixel animation
fix(starter): resolve key type mismatch in deck selection
refactor(ai): decouple AI behavior from engine into registry
test(format): add TCG validator edge case tests
```

### Effects System
Card effects are **data-driven** via `CardEffectBlock` descriptors, not hardcoded:
```typescript
{ trigger: 'onSummon', actions: [{ type: 'buffAtkRace', race: Race.Warrior, value: 200 }] }
```
New effects are added to `EFFECT_REGISTRY` in `effect-registry.ts`. Never hardcode effect logic in the engine.

### Internationalization
All user-facing strings go through i18next. Translation files: `locales/de.json`, `locales/en.json`. Use `t('key')` via `useTranslation()` hook.

## TCG Source Files

`public/base.tcg-src/` is the **source folder** for the base card set. All JSON files
and assets live here and are served directly by Vite during development.

Metadata files use a uniform `{ id, key, value, color }` schema where:
- `key` is the stable PascalCase identifier (e.g. `'Dragon'`) used for i18n lookups
- `value` is the display label (localized at runtime via `locales/{lang}_*.json` overrides)
- `icon` (races) and `symbol` (attributes) are optional extra fields

For distribution as a standalone `.tcg` archive, run `npm run generate:tcg` to pack
the folder contents into `public/base.tcg`. Keep both the source folder and
the distributed archive in sync — changes to one must be reflected in the other.

## Key Types (js/types.ts)

- `CardData` — card definition (id, name, type, atk, def, effect, etc.)
- `GameState` — full game snapshot (phase, turn, player/opponent states, log)
- `PlayerState` — LP, deck, hand, field (monsters + spellTraps), graveyard
- `FieldCard` — runtime monster instance with bonuses and status flags
- `UICallbacks` — engine→UI communication interface
- `CardEffectBlock` — { trigger, actions: EffectDescriptor[] }
- Enums: `CardType` (Monster, Fusion, Spell, Trap, Equipment), `Attribute`, `Race`, `Rarity`, `SpellType`
- Union types: `Owner` ('player'|'opponent'), `Phase` ('draw'|'main'|'battle'|'end'), `Position` ('atk'|'def')
- Additional unions: `TrapTrigger`, `EffectTrigger` ('onSummon'|'onDestroyByBattle'|'onDestroyByOpponent'|'passive'|'onFlip')

## Testing

### Unit/Integration (Vitest)
- Test files in `tests/` with `.test.js` extension
- Setup file: `tests/setup.js` (mocks Web Audio API, DOM)
- Common helpers: `makeCallbacks()`, `makeEngine()`, `placeMonster()` for test setup
- Run: `npm test` or `npm run test:watch`

### E2E (Playwright)
- Test files in `tests-e2e/`
- Config: `playwright.config.ts` (Chromium, 1280x800, 15s timeout)
- Auto-starts dev server on port 5173
- Run: `npm run test:e2e`

## CI/CD

GitHub Actions (`.github/workflows/`):
- `deploy.yml` — Triggers on push to `main`: `npm ci` → `npm test` → `npm run build` → deploy to GitHub Pages (Node.js 20)
- `summary.yml` — AI issue summarization workflow

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 |
| Language | TypeScript 6.0 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 + custom CSS + GSAP animations |
| Testing | Vitest 4 + Playwright 1.58 |
| i18n | i18next |
| Mobile | Capacitor 8 (Android) |
| Fonts | Press Start 2P, Silkscreen (pixel art theme) |
