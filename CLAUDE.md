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
npm run generate:engine-dts # Generate eos-engine.d.ts for modders
npm run build:android  # Build + Capacitor sync for Android
npm run cap:sync       # Sync Capacitor changes
npm run cap:open       # Open Android Studio
```

## Architecture

Three-layer design with strict separation:

1. **Engine Layer** (pure TypeScript, no React) — `js/engine.ts`, `js/effect-registry.ts`, `js/ai-behaviors.ts`, `js/ai-orchestrator.ts`, `js/field.ts`, `js/rules.ts`
2. **Data Layer** — `js/types.ts`, `js/cards.ts`, `js/progression.ts`, `js/campaign.ts`, `js/campaign-types.ts`, `js/campaign-store.ts`, `js/shop-data.ts`, `@wynillo/tcg-format` (external package), `js/tcg-bridge.ts`, `js/enums.ts`
3. **UI Layer** (React) — `js/react/` with Context-based state management

The engine communicates with the UI through the `UICallbacks` interface (render, log, prompt, showResult, playAttackAnimation, etc.). The engine never imports React.

## Directory Structure

- `js/` — Engine layer (`engine.ts`, `field.ts`, `rules.ts`, `effect-registry.ts`, `ai-behaviors.ts`, `ai-orchestrator.ts`), data layer (`types.ts`, `cards.ts`, `enums.ts`, `tcg-bridge.ts`, `effect-serializer.ts`, `campaign.ts`, `shop-data.ts`, `progression.ts`), and `react/` UI layer
- `js/react/` — `App.tsx`, `contexts/` (6 contexts), `screens/` (12 screens + `game/` sub-components), `components/`, `modals/`, `hooks/`, `utils/`
- `tests/` — Vitest unit/integration tests (`.test.js`)
- `tests-e2e/` — Playwright E2E tests
- `css/` — Tailwind + custom CSS + animations
- `locales/` — i18next translations (`de.json`, `en.json`)
- `public/base.tcg-src/` — TCG source data (cards, opponents, campaign, shop, metadata, locales). See `docs/tcg-format.md` for schema details
- `docs/` — Format specification, plans, audits

## Key Conventions

### Imports
- ES modules with `.js` extension in import paths (TypeScript with bundler resolution)
- External package: `import { loadTcgFile } from '@wynillo/tcg-format';`

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

### Code Style
- No decorative dividers or section separators in comments
- No comments that restate what the code does — code should be self-documenting
- Only comment to explain *why*, not *what*

### Internationalization
All user-facing strings go through i18next. Translation files: `locales/de.json`, `locales/en.json`. Use `t('key')` via `useTranslation()` hook.

## TCG Source Files

`public/base.tcg-src/` is the source folder for the base card set, served directly by Vite.
Metadata files use a uniform `{ id, key, value, color }` schema (`key` = PascalCase i18n identifier, `value` = display label).
Full format spec: `docs/tcg-format.md`. Core types: `js/types.ts`.

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

## External Package: @wynillo/tcg-format

GitHub dependency ([Wynillo/Echoes-of-Sanguo-TCG](https://github.com/Wynillo/Echoes-of-Sanguo-TCG)) — handles loading, validation, and packing of `.tcg` archives. Bridge: `js/tcg-bridge.ts` connects output to game stores. Effect strings parsed by `js/effect-serializer.ts`.

## CI/CD

GitHub Actions (`.github/workflows/`):
- `deploy.yml` — Triggers on push to `main`: `npm ci` → `npm test` → `npm run generate:tcg` → E2E tests → `npm run build` → deploy to GitHub Pages (Node.js 22)
- `release.yml` — Triggers on version tags (`v*`): build, generate `eos-engine.d.ts`, create GitHub Release
- `deploy-hetzner.yml` — Hetzner deployment workflow
- `summary.yml` — AI issue summarization workflow

