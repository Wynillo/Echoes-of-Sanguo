# Conventions — Echoes of Sanguo

## State Management

- React Context API only — no Redux or Zustand
- Six contexts: GameContext, ProgressionContext, ModalContext, ScreenContext, SelectionContext, CampaignContext
- Persistence via localStorage with `tcg_` / `eos_` key prefixes

## Effects System

Card effects are **data-driven** via `CardEffectBlock` descriptors, never hardcoded:

```typescript
{ trigger: 'onSummon', actions: [{ type: 'buffAtkRace', race: Race.Warrior, value: 200 }] }
```

New effects go into `EFFECT_REGISTRY` in `src/effect-registry.ts`. Never hardcode effect logic in `engine.ts`.

## Internationalization

All user-facing strings go through i18next. Use `t('key')` via `useTranslation()`. Translation files: `locales/en.json`, `locales/de.json`. New UI text must be added to both files simultaneously.

## Commit Messages

Conventional commits with scope:

```
feat(ui): add Press Start screen with pixel animation
fix(starter): resolve key type mismatch in deck selection
refactor(ai): decouple AI behavior from engine into registry
test(format): add TCG validator edge case tests
```

Common scopes: `ui`, `engine`, `ai`, `tcg`, `i18n`, `campaign`, `shop`, `test`, `ci`, `build`.

## Testing

### Unit/Integration (Vitest)

- Files in `tests/` with `.test.js` extension
- Setup file: `tests/setup.js` — mocks Web Audio API and DOM globals
- Common helpers: `makeCallbacks()`, `makeEngine()`, `placeMonster()`
- Run: `npm test` or `npm run test:watch`

### E2E (Playwright)

- Files in `tests-e2e/`
- Config: `playwright.config.ts` — Chromium, 1280×800, 15s timeout
- Auto-starts dev server on port 5173
- Run: `npm run test:e2e`
