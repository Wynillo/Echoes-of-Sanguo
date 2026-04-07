# Architecture Reference — Echoes of Sanguo

## Layer Boundaries

Import direction is strictly enforced:

- Engine layer imports nothing from `src/react/`
- UI layer imports from engine and data layers freely
- Engine exposes state through `GameEngine` methods; UI registers `UICallbacks` to receive updates

## UICallbacks Interface

The engine never calls React directly. It calls callbacks registered by the UI:

- `render(state)` — full re-render after a state change
- `log(message)` — append to duel log
- `prompt(options)` — request a player decision; returns a Promise
- `showResult(result)` — display win/loss/draw screen
- `playAttackAnimation(attacker, target)` — trigger battle animation

## Directory Map

```
src/
  engine.ts            — GameEngine class: phases, summoning, battle, fusion, win checks
  effect-registry.ts   — EFFECT_REGISTRY: data-driven effect executor
  ai-behaviors.ts      — AI scoring constants and behavior profiles
  ai-orchestrator.ts   — aiTurn() full sequence: draw → main → battle → end
  field.ts             — FieldCard (runtime monster with bonuses/flags), FieldSpellTrap
  rules.ts             — GAME_RULES constants
  trigger-bus.ts       — TriggerBus event emitter
  types.ts             — All TypeScript types: CardData, GameState, PlayerState, UICallbacks, EffectDescriptorMap
  cards.ts             — CARD_DB, FUSION_RECIPES, checkFusion(), makeDeck()
  enums.ts             — Bidirectional enum converters
  tcg-bridge.ts        — Connects @wynillo/tcg-format output → game stores
  effect-serializer.ts — Effect string ↔ CardEffectBlock codec
  campaign.ts          — Node resolution and unlock checking
  campaign-types.ts    — CampaignData, Chapter, CampaignNode, UnlockCondition, NodeRewards
  campaign-store.ts    — Campaign state persistence
  progression.ts       — Player progression and unlock logic
  shop-data.ts         — PackDef, PackageDef, PackSlotDef, CardFilter
  mod-api.ts           — window.EchoesOfSanguoMod public API for modders
  i18n.ts              — i18next setup
  react/
    App.tsx            — Root component and routing logic
    index.tsx          — Entry point
    contexts/          — 6 contexts: GameContext, ProgressionContext, ModalContext,
                         ScreenContext, SelectionContext, CampaignContext
    screens/           — 12 screens + game/ sub-components
    components/        — Shared UI components
    modals/            — Modal overlays
    hooks/             — Custom React hooks
    utils/             — UI-layer utility functions

tests/                 — Vitest unit/integration tests (.test.js)
tests-e2e/             — Playwright E2E tests
css/                   — Tailwind + custom CSS + animations
locales/               — i18next translations: en.json, de.json
public/base.tcg        — Compiled TCG data file (auto-copied from @wynillo/echoes-mod-base by the Vite plugin during build/dev)
docs/tcg-format.md     — Full TCG archive format spec
```

## External Packages

**`@wynillo/tcg-format`** (github:Wynillo/Echoes-of-Sanguo-TCG) — loads, validates, and packs `.tcg` archives. Bridge: `src/tcg-bridge.ts`. Effect strings parsed by `src/effect-serializer.ts`.

**`@wynillo/echoes-mod-base`** (github:Wynillo/Echoes-of-Sanguo-MOD-base) — base card set data: cards, opponents, campaign, shop, metadata, locales. Source files in `node_modules/@wynillo/echoes-mod-base/tcg-src/`. Metadata files use a uniform `{ id, key, value, color }` schema (`key` = PascalCase i18n identifier, `value` = display label).
