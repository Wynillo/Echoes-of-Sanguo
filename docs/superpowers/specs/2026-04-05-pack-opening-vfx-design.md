# Pack Opening VFX Redesign

**Date:** 2026-04-05
**Status:** Approved

## Problem

The pack opening screen's rare card reveal phase does not match the game's pixel-art aesthetic. The CSS radial-gradient backgrounds, conic-gradient light rays, and DOM-injected sparkle divs look cheap compared to the polished card-flip animation. The summary grid also lacks visual personality. Reference target: the Vampire Survivors chest opening — over-the-top pixel chaos, items exploding outward, chunky light beams, tons of particles.

## Solution

Introduce Pixi.js as a shared GPU-accelerated effects layer for the whole app. Replaces the current CSS bg/sparkle/beam system for rare reveals, enables high-quality duel effects later.

---

## 1 — Pixi.js Integration Architecture

A single Pixi `Application` instance lives for the lifetime of the session, mounting a full-screen `<canvas>` absolutely positioned over the entire app with `pointer-events: none`.

### New files

- `src/react/pixi/PixiLayer.tsx` — mounts the canvas into the DOM, creates the Pixi app, keeps it sized to the window. Mounted once in `App.tsx`.
- `src/react/pixi/fxManager.ts` — singleton module that owns the Pixi `Application` and exposes typed fire-and-forget effect methods. Not a React context — effects are side effects, not state.
- `src/react/pixi/effects/packReveal.ts` — the pack reveal effect implementation.

### Public API (initial)

```ts
fxManager.packReveal(rarity: Rarity, cardEl: HTMLElement): void
fxManager.clearAll(): void
```

`packReveal` reads the card's screen position via `getBoundingClientRect()`, fires effects at those coordinates, and cleans up automatically when done. `clearAll` destroys all in-flight Pixi objects immediately — called by `PackOpeningScreen` when the player skips or fast-forwards past a reveal.

### Extensibility

Future methods (`attackImpact`, `cardDestroy`, `spellActivate`) are added to `fxManager.ts` with implementations in `src/react/pixi/effects/`.

---

## 2 — Rare Card Reveal Effects

### What is removed

From `PackOpeningScreen.tsx` and `PackOpeningScreen.module.css`:

- `.bgUncommon`, `.bgRare`, `.bgSuperRare`, `.bgUltraRare` divs and their CSS pulse animations
- `.lightRaysSR`, `.lightRaysUR` conic-gradient divs and CSS
- DOM-injected sparkle `<div>`s and beam `<div>`s spawned mid-GSAP-timeline
- `SPARKLE_CONFIG` constant and all sparkle-spawning logic

### What fires at the card flip moment

`fxManager.packReveal(rarity, revealCardRef.current)` is called in the GSAP timeline at the flip callback, replacing the sparkle/beam injection.

| Effect | Rare | SuperRare | UltraRare |
|---|---|---|---|
| White screen flash | ✓ 80ms | ✓ 80ms | ✓ 80ms |
| Bloom (BlurFilter on bright circle sprite) | — | soft | strong |
| Pixel particles (squares, crosses, diamonds) | ~60, blue palette | ~120, gold palette | ~180 + spiral ring, purple/rainbow |
| Light beams (filled triangles, additive blend) | 4 | 6 | 8 |
| Scanline tint (CSS overlay, GSAP) | ✓ ~0.3s | ✓ ~0.3s | ✓ ~0.3s |

Common and Uncommon: no Pixi effects fired.

### Scanline tint

A full-screen `<div>` with a `repeating-linear-gradient` (horizontal pixel lines, rarity colour at low opacity), already present in the DOM and toggled by GSAP — same pattern as the existing flash overlay. Not rendered on the Pixi canvas.

### What is untouched

GSAP card flip animation, `steps(6)` entrance/exit easing, screen shake, hold times by rarity, mini-strip of previous cards, reveal counter.

---

## 3 — Summary Grid Polish

CSS-only changes to `PackOpeningScreen.module.css` and `PackOpeningScreen.tsx`:

- **Background:** dark scanline grid pattern via `repeating-linear-gradient` instead of flat screen background
- **Card borders:** rarity-coloured pixel borders using stepped `box-shadow` inset — Common: grey, Uncommon: green, Rare: blue, SR: gold, UR: purple
- **"NEW" badge:** monospace, all-caps, no `border-radius` (squared off), rarity-coloured text
- **Card stagger animation:** tightened timing, `steps(4)` easing for pixel-snappy pop-in
- **Header:** pack name + rarity breakdown summary (e.g. `1 SR · 2 R · 2 C`) in monospace above the grid

---

## Critical Files

| File | Change |
|---|---|
| `src/App.tsx` | Mount `<PixiLayer />` once |
| `src/react/pixi/PixiLayer.tsx` | **New** |
| `src/react/pixi/fxManager.ts` | **New** |
| `src/react/pixi/effects/packReveal.ts` | **New** |
| `src/react/screens/PackOpeningScreen.tsx` | Remove bg/sparkle/beam logic; add scanline tint div; call `fxManager.packReveal()` at flip; add rarity breakdown to summary header |
| `src/react/screens/PackOpeningScreen.module.css` | Remove bg/ray/sparkle classes; add summary grid polish styles |

## Dependencies

```
pixi.js  (latest v8.x)
```

---

## Verification

1. `npm run dev` — open pack opening on any booster pack
2. Common/Uncommon cards — flip plays as before, no Pixi effects fire
3. Rare card — pixel explosion fires, 4 light beams radiate, scanline tint flashes blue
4. SuperRare — 120-particle gold explosion, bloom glow on card, 6 beams
5. UltraRare — maximum chaos: 180 particles + spiral ring, strong bloom, 8 beams, purple/rainbow palette
6. Click to skip during reveal — `fxManager.clearAll()` fires, canvas clears immediately
7. `prefers-reduced-motion` — jumps straight to summary, no Pixi fires
8. Summary grid — rarity-coloured pixel borders, squared-off NEW badge, snappy stagger, rarity breakdown in header
9. `npm test` — no regressions
10. `npm run build` — clean build; note bundle size delta from Pixi.js
