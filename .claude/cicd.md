# CI/CD — Echoes of Sanguo

All workflows are in `.github/workflows/`.

## deploy.yml — Main deploy pipeline

Triggers on push to `main`:
1. Validate agent configs (agnix)
2. `npm install`
3. `npm test`
4. `npm run build` (Vite plugin auto-copies base.tcg)
5. Playwright E2E tests (Chromium)
6. Deploy to GitHub Pages (Node.js 24)

**Do not break the deploy pipeline.** Any changes to CLAUDE.md, agent configs, workflows, or package.json scripts must pass agnix validation.

## release.yml — Version release

Triggers on version tags (`v*`):
1. Build
2. `npm run generate:engine-dts` — generates `eos-engine.d.ts` for modders
3. Create GitHub Release with artifact

## deploy-hetzner.yml — Hetzner server deployment

Triggered separately for server-side deployment.

## summary.yml — AI issue summarization

Automated issue summarization workflow.
