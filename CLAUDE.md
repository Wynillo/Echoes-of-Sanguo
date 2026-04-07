# CLAUDE.md — Echoes of Sanguo

Browser-based TCG inspired by Yu-Gi-Oh! Forbidden Memories. React 19, TypeScript 6, Vite 8, custom ZIP-based card format (`.tcg`).

## Commands

```bash
npm run dev            # Dev server at localhost:5173
npm run build          # Production build → dist/
npm test               # Vitest unit/integration tests
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Coverage report (v8)
npm run test:e2e       # Playwright E2E (auto-starts dev server)
npm run generate:engine-dts  # Generate eos-engine.d.ts for modders
npm run build:android  # Build + Capacitor sync for Android
npm run cap:sync       # Sync Capacitor changes
npm run cap:open       # Open Android Studio
```

## Architecture

Three layers with strict separation:

1. **Engine** (pure TypeScript, no React) — `src/engine.ts`, `src/effect-registry.ts`, `src/ai-behaviors.ts`, `src/ai-orchestrator.ts`, `src/field.ts`, `src/rules.ts`
2. **Data** — `src/types.ts`, `src/cards.ts`, `src/enums.ts`, `src/progression.ts`, `src/campaign.ts`, `src/tcg-bridge.ts`, external packages `@wynillo/tcg-format` and `@wynillo/echoes-mod-base`
3. **UI** (React) — `src/react/` with Context-based state management

The engine communicates with the UI only through the `UICallbacks` interface. Keep the engine as pure TypeScript; all UI interaction must go through UICallbacks.

## Code Style

- No decorative dividers or section separators in comments
- No comments that restate what the code does — code must be self-documenting
- Only comment to explain *why*, not *what*
- ES module imports use `.js` extension in paths (TypeScript with bundler resolution)

## CI/CD

The deploy pipeline (`deploy.yml`) must not be broken. It runs agnix validation on CLAUDE.md and agent configs — any referenced npm scripts must exist in package.json.

## Reference

- Architecture & directory map: .claude/architecture.md
- Conventions (state, commits, i18n, effects, testing): .claude/conventions.md
- CI/CD workflows: .claude/cicd.md
- TCG format schema: `docs/tcg-format.md`
