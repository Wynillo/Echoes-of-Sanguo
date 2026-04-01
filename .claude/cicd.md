# CI/CD — Echoes of Sanguo

All workflows are in `.github/workflows/`.

## deploy.yml — Main deploy pipeline

Triggers on push to `main`:
1. `npm ci`
2. `npm test`
3. `npm run copy:tcg`
4. Playwright E2E tests (Chromium)
5. `npm run build`
6. Deploy to GitHub Pages (Node.js 22)

## release.yml — Version release

Triggers on version tags (`v*`):
1. Build
2. `npm run generate:engine-dts` — generates `eos-engine.d.ts` for modders
3. Create GitHub Release with artifact

## deploy-hetzner.yml — Hetzner server deployment

Triggered separately for server-side deployment.

## summary.yml — AI issue summarization

Automated issue summarization workflow.
