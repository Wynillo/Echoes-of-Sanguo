# Pack Opening VFX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cheap CSS-gradient/DOM-sparkle rare card reveal effects with a Pixi.js pixel particle explosion, and polish the summary grid to match the pixel-art aesthetic.

**Architecture:** A singleton `fxManager` module owns a single Pixi `Application` mounted as a full-screen canvas overlay (`PixiLayer.tsx`, z-index 9998, `pointer-events: none`). `PackOpeningScreen` calls `fxManager.packReveal(rarity, cardEl)` at the card flip moment, replacing the old DOM-injected sparkles. The GSAP flip animation, screen shake, and all hold timings are untouched.

**Tech Stack:** React 19, TypeScript, GSAP 3, Pixi.js v8, CSS Modules, Vitest

---

## File Map

| Status | File | Responsibility |
|---|---|---|
| Create | `src/react/pixi/fxManager.ts` | Singleton — owns Pixi Application, exposes `packReveal` and `clearAll` |
| Create | `src/react/pixi/PixiLayer.tsx` | React component — mounts the Pixi canvas, calls `fxManager.init` |
| Create | `src/react/pixi/effects/packReveal.ts` | Effect — pixel particles, beams, bloom, flash |
| Create | `tests/pack-opening-vfx.test.js` | Tests for fxManager safety + RARITY_CONFIG values |
| Modify | `package.json` | Add `pixi.js` dependency |
| Modify | `src/App.tsx` | Mount `<PixiLayer />` once in `Router` |
| Modify | `src/react/screens/PackOpeningScreen.tsx` | Remove old FX code, wire fxManager, polish summary |
| Modify | `src/react/screens/PackOpeningScreen.module.css` | Remove dead classes, add summary polish styles |

---

## Task 1: Install pixi.js and scaffold fxManager

**Files:**
- Modify: `package.json`
- Create: `src/react/pixi/fxManager.ts`
- Create: `src/react/pixi/effects/packReveal.ts` (stub)
- Create: `tests/pack-opening-vfx.test.js`

- [ ] **Step 1: Install pixi.js**

```bash
npm install pixi.js@^8
```

Expected: `added N packages` with no errors. Verify:
```bash
grep '"pixi.js"' package.json
```
Expected: `"pixi.js": "^8.x.x"`

- [ ] **Step 2: Write the failing tests**

Create `tests/pack-opening-vfx.test.js`:

```js
import { vi, describe, it, expect } from 'vitest';

vi.mock('pixi.js', () => ({
  Application: class {
    async init() {}
    get stage() { return { addChild() {}, removeChild() {} }; }
    get screen() { return { width: 1024, height: 768 }; }
    get ticker() { return { add() {}, remove() {} }; }
  },
  Container: class {
    constructor() { this.blendMode = 'normal'; }
    addChild() { return this; }
    removeChild() {}
    destroy() {}
  },
  Graphics: class {
    get alpha() { return 1; }
    set alpha(_v) {}
    get filters() { return []; }
    set filters(_v) {}
    rect() { return this; }
    circle() { return this; }
    poly() { return this; }
    fill() { return this; }
    clear() { return this; }
  },
  BlurFilter: class { constructor() {} },
}));

describe('fxManager', () => {
  it('packReveal is safe before init — does not throw', async () => {
    const { fxManager } = await import('../src/react/pixi/fxManager.js');
    // Plain object — packReveal is a no-op before init so getBoundingClientRect is never called
    const fakeEl = /** @type {HTMLElement} */ ({});
    expect(() => fxManager.packReveal(4, fakeEl)).not.toThrow();
  });

  it('clearAll is safe before init — does not throw', async () => {
    const { fxManager } = await import('../src/react/pixi/fxManager.js');
    expect(() => fxManager.clearAll()).not.toThrow();
  });

  it('packReveal is a no-op for Common (1) and Uncommon (2)', async () => {
    const { fxManager } = await import('../src/react/pixi/fxManager.js');
    const fakeEl = /** @type {HTMLElement} */ ({});
    expect(() => fxManager.packReveal(1, fakeEl)).not.toThrow();
    expect(() => fxManager.packReveal(2, fakeEl)).not.toThrow();
  });
});

describe('RARITY_CONFIG', () => {
  it('Rare: 60 particles, 4 beams, no bloom, no spiral', async () => {
    const { RARITY_CONFIG } = await import('../src/react/pixi/effects/packReveal.js');
    expect(RARITY_CONFIG[4].particleCount).toBe(60);
    expect(RARITY_CONFIG[4].beamCount).toBe(4);
    expect(RARITY_CONFIG[4].bloomStrength).toBe(0);
    expect(RARITY_CONFIG[4].spiral).toBe(false);
  });

  it('SuperRare: 120 particles, 6 beams, soft bloom, no spiral', async () => {
    const { RARITY_CONFIG } = await import('../src/react/pixi/effects/packReveal.js');
    expect(RARITY_CONFIG[6].particleCount).toBe(120);
    expect(RARITY_CONFIG[6].beamCount).toBe(6);
    expect(RARITY_CONFIG[6].bloomStrength).toBeGreaterThan(0);
    expect(RARITY_CONFIG[6].spiral).toBe(false);
  });

  it('UltraRare: 180 particles, 8 beams, strong bloom, spiral', async () => {
    const { RARITY_CONFIG } = await import('../src/react/pixi/effects/packReveal.js');
    expect(RARITY_CONFIG[8].particleCount).toBe(180);
    expect(RARITY_CONFIG[8].beamCount).toBe(8);
    expect(RARITY_CONFIG[8].bloomStrength).toBeGreaterThan(RARITY_CONFIG[6].bloomStrength);
    expect(RARITY_CONFIG[8].spiral).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests — confirm they fail (module not found)**

```bash
npm test -- tests/pack-opening-vfx.test.js
```

Expected: FAIL with `Cannot find module '../src/react/pixi/fxManager.js'`

- [ ] **Step 4: Create `src/react/pixi/effects/packReveal.ts` (stub)**

```ts
import type { Application, Container } from 'pixi.js';
import { Rarity } from '../../../types.js';

export interface RarityConfig {
  particleCount: number;
  beamCount: number;
  palette: number[];
  bloomStrength: number;
  spiral: boolean;
}

export const RARITY_CONFIG: Record<number, RarityConfig> = {
  [Rarity.Rare]: {
    particleCount: 60,
    beamCount: 4,
    palette: [0x7090ff, 0x4060cc, 0xa0c0ff, 0xffffff, 0x8888ff],
    bloomStrength: 0,
    spiral: false,
  },
  [Rarity.SuperRare]: {
    particleCount: 120,
    beamCount: 6,
    palette: [0xffd700, 0xffaa00, 0xfff0a0, 0xffffff, 0xff8800],
    bloomStrength: 15,
    spiral: false,
  },
  [Rarity.UltraRare]: {
    particleCount: 180,
    beamCount: 8,
    palette: [0xe070ff, 0x9030cc, 0xff80ff, 0xffffff, 0xc040ff, 0xff60ff],
    bloomStrength: 30,
    spiral: true,
  },
};

export function runPackReveal(
  _app: Application,
  _container: Container,
  _rarity: number,
  _cardEl: HTMLElement,
  onDone: () => void,
): void {
  onDone();
}
```

- [ ] **Step 5: Create `src/react/pixi/fxManager.ts`**

```ts
import { Application, Container } from 'pixi.js';
import { Rarity } from '../../types.js';
import { runPackReveal } from './effects/packReveal.js';

let _app: Application | null = null;
const _containers = new Set<Container>();

export const fxManager = {
  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (_app) return;
    _app = new Application();
    await _app.init({
      canvas,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      width: window.innerWidth,
      height: window.innerHeight,
    });
    window.addEventListener('resize', () => {
      _app?.renderer.resize(window.innerWidth, window.innerHeight);
    });
  },

  packReveal(rarity: number, cardEl: HTMLElement): void {
    if (!_app || rarity < Rarity.Rare) return;
    const c = new Container();
    _app.stage.addChild(c);
    _containers.add(c);
    runPackReveal(_app, c, rarity, cardEl, () => {
      _app?.stage.removeChild(c);
      c.destroy({ children: true });
      _containers.delete(c);
    });
  },

  clearAll(): void {
    for (const c of _containers) {
      _app?.stage.removeChild(c);
      c.destroy({ children: true });
    }
    _containers.clear();
  },
};
```

- [ ] **Step 6: Run tests — confirm all 6 pass**

```bash
npm test -- tests/pack-opening-vfx.test.js
```

Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/react/pixi/fxManager.ts src/react/pixi/effects/packReveal.ts tests/pack-opening-vfx.test.js
git commit -m "feat: install pixi.js and scaffold fxManager + RARITY_CONFIG"
```

---

## Task 2: Create PixiLayer and mount in App.tsx

**Files:**
- Create: `src/react/pixi/PixiLayer.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/react/pixi/PixiLayer.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { fxManager } from './fxManager.js';

export function PixiLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    fxManager.init(canvas).catch(console.error);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
      }}
    />
  );
}
```

- [ ] **Step 2: Add import to `src/App.tsx`**

After the line `import { OfflineIndicator } from './components/OfflineIndicator.js';`, add:

```tsx
import { PixiLayer } from './react/pixi/PixiLayer.js';
```

Wait — `App.tsx` is at `src/react/App.tsx` or `src/App.tsx`? Check the actual path:

```bash
ls src/react/App.tsx src/App.tsx 2>/dev/null
```

Use whichever path exists. The import inside `App.tsx` should be:
```tsx
import { PixiLayer } from './pixi/PixiLayer.js';
```
(if `App.tsx` is in `src/react/`) or:
```tsx
import { PixiLayer } from './react/pixi/PixiLayer.js';
```
(if `App.tsx` is in `src/`).

Based on the exploration, `App.tsx` is at `src/react/App.tsx` — but the imports in it reference `../progression.js` etc., so it's actually `src/react/App.tsx`. Use:
```tsx
import { PixiLayer } from './pixi/PixiLayer.js';
```

- [ ] **Step 3: Mount `<PixiLayer />` in the Router function**

In `src/App.tsx` (or `src/react/App.tsx`), find the end of the `Router` function return. Add `<PixiLayer />` immediately before the `screen-transition-overlay` div:

```tsx
      <PixiLayer />
      <div id="screen-transition-overlay" style={{ position: 'fixed', inset: 0, background: '#000', opacity: 0, pointerEvents: 'none', zIndex: 9999, transition: 'opacity 200ms ease' }} />
```

- [ ] **Step 4: Smoke test — confirm canvas is in the DOM**

```bash
npm run dev
```

Open http://localhost:5173. Open DevTools → Elements. Search for `canvas` — there should be one with `position: fixed; z-index: 9998`. Check the Console for errors (there should be none).

- [ ] **Step 5: Run tests to confirm no regressions**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/react/pixi/PixiLayer.tsx src/react/App.tsx
git commit -m "feat: add PixiLayer canvas overlay, mount once in App"
```

(Use the actual path of `App.tsx` in the `git add` command.)

---

## Task 3: Implement the packReveal particle effect

**Files:**
- Modify: `src/react/pixi/effects/packReveal.ts` (replaces stub with full implementation)

- [ ] **Step 1: Replace the stub with the full implementation**

Replace the entire content of `src/react/pixi/effects/packReveal.ts`:

```ts
import { Application, BlurFilter, Container, Graphics } from 'pixi.js';
import { Rarity } from '../../../types.js';

export interface RarityConfig {
  particleCount: number;
  beamCount: number;
  palette: number[];
  bloomStrength: number;
  spiral: boolean;
}

export const RARITY_CONFIG: Record<number, RarityConfig> = {
  [Rarity.Rare]: {
    particleCount: 60,
    beamCount: 4,
    palette: [0x7090ff, 0x4060cc, 0xa0c0ff, 0xffffff, 0x8888ff],
    bloomStrength: 0,
    spiral: false,
  },
  [Rarity.SuperRare]: {
    particleCount: 120,
    beamCount: 6,
    palette: [0xffd700, 0xffaa00, 0xfff0a0, 0xffffff, 0xff8800],
    bloomStrength: 15,
    spiral: false,
  },
  [Rarity.UltraRare]: {
    particleCount: 180,
    beamCount: 8,
    palette: [0xe070ff, 0x9030cc, 0xff80ff, 0xffffff, 0xc040ff, 0xff60ff],
    bloomStrength: 30,
    spiral: true,
  },
};

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  color: number;
  alpha: number;
  decay: number;
  shape: 'square' | 'cross' | 'diamond';
}

interface Beam {
  angle: number;
  alpha: number;
  decay: number;
  color: number;
  length: number;
  halfWidth: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function runPackReveal(
  app: Application,
  container: Container,
  rarity: number,
  cardEl: HTMLElement,
  onDone: () => void,
): void {
  const cfg = RARITY_CONFIG[rarity];
  if (!cfg) { onDone(); return; }

  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const W = app.screen.width;
  const H = app.screen.height;

  // Full-screen flash
  const flash = new Graphics();
  flash.rect(0, 0, W, H).fill({ color: 0xfffee8 });
  flash.alpha = 0.8;
  container.addChild(flash);

  // Bloom for SR / UR
  let bloom: Graphics | null = null;
  let bloomAlpha = 0;
  if (cfg.bloomStrength > 0) {
    bloom = new Graphics();
    bloom.circle(cx, cy, 100).fill({ color: cfg.palette[0] });
    bloom.alpha = 0.6;
    bloom.filters = [new BlurFilter({ strength: cfg.bloomStrength })];
    container.addChild(bloom);
    bloomAlpha = 0.6;
  }

  // Beams — additive blend container
  const beamContainer = new Container();
  beamContainer.blendMode = 'add';
  container.addChild(beamContainer);
  const beamG = new Graphics();
  beamContainer.addChild(beamG);

  const beams: Beam[] = Array.from({ length: cfg.beamCount }, (_, i) => ({
    angle: (i / cfg.beamCount) * Math.PI * 2 + Math.random() * 0.4,
    alpha: 0.7,
    decay: 0.01 + Math.random() * 0.005,
    color: pick(cfg.palette),
    length: 320 + Math.random() * 120,
    halfWidth: 12 + Math.random() * 14,
  }));

  // Main particle burst
  const SIZES = [2, 3, 3, 4, 4, 6];
  const SHAPES: Particle['shape'][] = ['square', 'square', 'square', 'cross', 'diamond'];

  const particles: Particle[] = Array.from({ length: cfg.particleCount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 6;
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: pick(SIZES),
      color: pick(cfg.palette),
      alpha: 1,
      decay: 0.008 + Math.random() * 0.009,
      shape: pick(SHAPES),
    };
  });

  // Spiral ring for UltraRare
  const SPIRAL_PALETTE = [0xff6060, 0xffcc00, 0x60ff60, 0x60a0ff, 0xe070ff];
  const spiralParticles: Particle[] = cfg.spiral
    ? Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 40) * Math.PI * 2;
        const r = 55 + Math.random() * 20;
        const tangent = angle + Math.PI / 2;
        const speed = 2.5 + Math.random() * 2;
        return {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r,
          vx: Math.cos(tangent) * speed,
          vy: Math.sin(tangent) * speed,
          size: 4,
          color: SPIRAL_PALETTE[i % SPIRAL_PALETTE.length],
          alpha: 1,
          decay: 0.007,
          shape: 'square' as const,
        };
      })
    : [];

  const particleG = new Graphics();
  container.addChild(particleG);

  const allParticles = [...particles, ...spiralParticles];
  let flashAlpha = 0.8;

  function tick() {
    // Flash decay
    flashAlpha = Math.max(0, flashAlpha - 0.07);
    flash.alpha = flashAlpha;

    // Bloom decay
    if (bloom) {
      bloomAlpha = Math.max(0, bloomAlpha - 0.008);
      bloom.alpha = bloomAlpha;
    }

    // Beams
    beamG.clear();
    for (const b of beams) {
      if (b.alpha <= 0) continue;
      b.angle += 0.006;
      b.alpha -= b.decay;
      const a = Math.max(0, b.alpha);
      const cos = Math.cos(b.angle);
      const sin = Math.sin(b.angle);
      const hw = b.halfWidth;
      const len = b.length;
      beamG.poly([
        cx, cy,
        cx + cos * len - sin * hw, cy + sin * len + cos * hw,
        cx + cos * len + sin * hw, cy + sin * len - cos * hw,
      ]).fill({ color: b.color, alpha: a * 0.45 });
    }

    // Particles
    particleG.clear();
    let anyAlive = false;
    for (const p of allParticles) {
      if (p.alpha <= 0) continue;
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.12;
      p.vx *= 0.97;
      p.alpha = Math.max(0, p.alpha - p.decay);
      if (p.alpha <= 0) continue;
      anyAlive = true;
      const a = p.alpha;
      const rx = Math.round(p.x);
      const ry = Math.round(p.y);
      const s = p.size;
      if (p.shape === 'cross') {
        particleG.rect(rx - Math.floor(s / 2), ry - 1, s, 2).fill({ color: p.color, alpha: a });
        particleG.rect(rx - 1, ry - Math.floor(s / 2), 2, s).fill({ color: p.color, alpha: a });
      } else if (p.shape === 'diamond') {
        const h = s / 2;
        particleG.poly([p.x, p.y - h, p.x + h, p.y, p.x, p.y + h, p.x - h, p.y])
          .fill({ color: p.color, alpha: a });
      } else {
        particleG.rect(rx, ry, s, s).fill({ color: p.color, alpha: a });
      }
    }

    const beamsAlive = beams.some(b => b.alpha > 0);
    if (!anyAlive && !beamsAlive && flashAlpha <= 0 && bloomAlpha <= 0) {
      app.ticker.remove(tick);
      onDone();
    }
  }

  app.ticker.add(tick);
}
```

- [ ] **Step 2: Run tests — confirm all 6 still pass**

```bash
npm test -- tests/pack-opening-vfx.test.js
```

Expected: PASS (6 tests — the mock intercepts the pixi.js import so the stub/real file difference doesn't matter for tests)

- [ ] **Step 3: Smoke test in dev**

```bash
npm run dev
```

Navigate: Shop → buy any booster that contains a Rare or higher card → tap to open → watch the reveal phase. When a Rare+ card flips, you should see a pixel particle explosion on the Pixi canvas. Check the console for errors.

(If no Rare+ cards appear in the pack, open multiple packs — or temporarily change the `rarity < Rarity.Rare` guard to `rarity < Rarity.Uncommon` to test with all cards, then revert.)

- [ ] **Step 4: Commit**

```bash
git add src/react/pixi/effects/packReveal.ts
git commit -m "feat: implement Pixi pixel particle explosion for rare card reveals"
```

---

## Task 4: Wire fxManager into PackOpeningScreen — reveal phase

**Files:**
- Modify: `src/react/screens/PackOpeningScreen.tsx`

This task removes the old sparkle/bg/ray code from `PackOpeningScreen.tsx` and replaces it with the Pixi + scanline tint approach.

- [ ] **Step 1: Add the fxManager import**

At the top of `PackOpeningScreen.tsx`, after the existing imports, add:

```ts
import { fxManager } from '../pixi/fxManager.js';
```

- [ ] **Step 2: Replace SPARKLE_CONFIG with SCANLINE_COLORS**

Remove the `SPARKLE_CONFIG` constant and its block comment (lines 27–32):

```ts
// DELETE THIS:
/** Rarity → sparkle config */
const SPARKLE_CONFIG: Record<number, { count: number; color: string; beams: number; burstSize: 'normal' | 'large'; small: boolean }> = {
  [Rarity.Rare]:      { count: 6,  color: '#7090ff', beams: 0, burstSize: 'normal', small: true },
  [Rarity.SuperRare]: { count: 12, color: '#ffd700', beams: 4, burstSize: 'normal', small: false },
  [Rarity.UltraRare]: { count: 18, color: '#e080ff', beams: 6, burstSize: 'large',  small: false },
};
```

Replace with:

```ts
const SCANLINE_COLORS: Record<number, string> = {
  [Rarity.Rare]:      'rgba(112, 144, 255, 0.08)',
  [Rarity.SuperRare]: 'rgba(255, 215, 0, 0.06)',
  [Rarity.UltraRare]: 'rgba(224, 112, 255, 0.08)',
};
```

- [ ] **Step 3: Delete the spawnRevealFX and getBgClass functions**

Delete the entire `spawnRevealFX` function (lines 45–80, the block starting with `function spawnRevealFX`).

Delete the entire `getBgClass` function (lines 96–104, the block starting with `function getBgClass`).

- [ ] **Step 4: Update refs — remove bgRef and lightRaysRef, add scanlineTintRef**

In the refs block inside the component, remove:

```ts
// DELETE:
const lightRaysRef = useRef<HTMLDivElement>(null);
const bgRef = useRef<HTMLDivElement>(null);
```

Add in their place:

```ts
const scanlineTintRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 5: Update handleSkip to call fxManager.clearAll()**

Replace the existing `handleSkip` with:

```ts
const handleSkip = useCallback(() => {
  if (phase === 'summary') return;
  if (phase === 'pack' && !tearing) return;
  fxManager.clearAll();
  if (phase === 'pack') {
    skipRef.current = true;
    tlRef.current?.kill();
    setPhase('summary');
    return;
  }
  fastForwardRef.current = true;
  tlRef.current?.timeScale(8);
}, [phase, tearing]);
```

- [ ] **Step 6: Update the reveal useEffect — strip old FX, add Pixi + scanline**

Inside `revealSequence`, find the section from `const holdTime = ...` down to the `tl.to(cardEl, { scale: 0.3 ... })` exit tween. Make these changes in order:

**Remove** `bgEl` and `raysEl` local variables:
```ts
// DELETE:
const bgEl = bgRef.current;
const raysEl = lightRaysRef.current;
```

**Remove** `hasSparkle`, `hasBg`, `hasRays` variables:
```ts
// DELETE:
const hasSparkle = rarity in SPARKLE_CONFIG;
const hasBg = rarity >= Rarity.Uncommon;
const hasRays = rarity >= Rarity.SuperRare;
```

**Remove** the bg fade-in block:
```ts
// DELETE:
if (hasBg && bgEl) {
  tl.to(bgEl, { opacity: 1, duration: 0.3, ease: 'steps(4)' }, 0);
}
```

**Remove** the light rays fade-in block:
```ts
// DELETE:
if (hasRays && raysEl) {
  tl.to(raysEl, { opacity: 1, duration: 0.4, ease: 'steps(5)' }, 0);
}
```

**Remove** the sparkle spawn block:
```ts
// DELETE:
if (hasSparkle) {
  tl.call(() => {
    if (cardEl) spawnRevealFX(cardEl, rarity);
    if (frontEl) frontEl.classList.add(styles.sparkle);
  });
}
```

**Remove** the bg/rays fade-out blocks:
```ts
// DELETE:
if (hasBg && bgEl) {
  tl.to(bgEl, { opacity: 0, duration: 0.2, ease: 'steps(3)' }, `-=${0.15}`);
}
if (hasRays && raysEl) {
  tl.to(raysEl, { opacity: 0, duration: 0.2, ease: 'steps(3)' }, '<');
}
```

**Add** the Pixi + scanline tint calls immediately after the `Audio.playSfx('sfx_pack_reveal')` call:

```ts
// Pixi particle effect + scanline tint at flip moment
tl.call(() => {
  if (rarity >= Rarity.Rare && cardEl) {
    fxManager.packReveal(rarity, cardEl);
    const tintEl = scanlineTintRef.current;
    if (tintEl) {
      tintEl.style.setProperty(
        '--scanline-color',
        SCANLINE_COLORS[rarity] ?? 'rgba(255,255,255,0.04)',
      );
    }
  }
}, undefined, '-=0.2');

if (rarity >= Rarity.Rare) {
  tl.fromTo(
    scanlineTintRef.current!,
    { opacity: 0 },
    { opacity: 1, duration: 0.05, ease: 'none' },
    '-=0.2',
  ).to(scanlineTintRef.current!, { opacity: 0, duration: 0.3, ease: 'power2.in' });
}
```

- [ ] **Step 7: Update the reveal phase JSX**

The Phase 2 return currently has a `bgEffect` div and a `lightRaysContainer` div. Replace the entire Phase 2 return with:

```tsx
if (phase === 'reveal') {
  const currentCard = revealIndex >= 0 ? sortedCards[revealIndex] : null;
  const rarColor = currentCard ? (getRarityById((currentCard as any).rarity)?.color ?? '#aaa') : '#aaa';

  return (
    <div ref={screenRef} className={styles.screen} onClick={handleSkip}>
      {/* Scanline tint — opacity driven by GSAP at rare reveal moment */}
      <div ref={scanlineTintRef} className={styles.scanlineTint} />

      <div className={styles.revealPhase}>
        <div className={styles.revealStage}>
          {currentCard && (
            <div
              ref={revealCardRef}
              className={styles.revealCard}
              style={{ '--rarity-color': rarColor } as React.CSSProperties}
            >
              <div className={styles.revealCardInner}>
                <div className={styles.revealCardBack}>
                  <div className={styles.cardBackPattern}>
                    <span className={styles.backLabel}>A</span>
                  </div>
                </div>
                <div className={styles.revealCardFront}>
                  <Card card={currentCard} big />
                  {!ownedBefore.has(currentCard.id) && (
                    <div className={styles.newBadge}>{t('pack_opening.new_badge')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.revealCounter}>
          {revealIndex + 1} / {sortedCards.length}
        </div>

        <div className={styles.miniStrip}>
          {sortedCards.slice(0, revealIndex).map((card, i) => {
            const rc = getRarityById((card as any).rarity)?.color ?? '#aaa';
            const icon = TYPE_ICONS[card.type] ?? '?';
            return (
              <div
                key={i}
                className={styles.miniCard}
                style={{ '--rarity-color': rc, borderColor: rc } as React.CSSProperties}
              >
                <span className={styles.miniCardIcon}><RaceIcon icon={icon} /></span>
              </div>
            );
          })}
        </div>

        <div className={styles.skipHint}>{t('pack_opening.skip_hint')}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 9: Smoke test in dev — verify reveal phase**

```bash
npm run dev
```

Open a booster pack and verify:
- Common/Uncommon cards: flip plays normally, no particles or glow behind the card
- Rare card: pixel explosion fires, 4 beams radiate, scanline tint briefly flashes blue
- SuperRare: 120-particle gold explosion, bloom glow behind card
- UltraRare: 180 particles + spiral ring, 8 beams, purple/rainbow palette, strong bloom
- Click during reveal: `fxManager.clearAll()` fires, canvas clears immediately, sequence jumps forward
- No console errors

- [ ] **Step 10: Commit**

```bash
git add src/react/screens/PackOpeningScreen.tsx
git commit -m "feat: wire fxManager into reveal phase, replace CSS FX with Pixi + scanline tint"
```

---

## Task 5: Summary phase polish + CSS cleanup

**Files:**
- Modify: `src/react/screens/PackOpeningScreen.tsx` (summary section only)
- Modify: `src/react/screens/PackOpeningScreen.module.css`

- [ ] **Step 1: Add helper functions to PackOpeningScreen.tsx**

After the `TYPE_ICONS` constant, add:

```ts
const RARITY_LABELS: Record<number, string> = {
  [Rarity.Common]:    'C',
  [Rarity.Uncommon]:  'U',
  [Rarity.Rare]:      'R',
  [Rarity.SuperRare]: 'SR',
  [Rarity.UltraRare]: 'UR',
};

function getRarityBorderClass(rarity: number, s: Record<string, string>): string {
  switch (rarity) {
    case Rarity.Common:    return s.borderCommon;
    case Rarity.Uncommon:  return s.borderUncommon;
    case Rarity.Rare:      return s.borderRare;
    case Rarity.SuperRare: return s.borderSuperRare;
    case Rarity.UltraRare: return s.borderUltraRare;
    default: return '';
  }
}

function getNewBadgeClass(rarity: number, s: Record<string, string>): string {
  switch (rarity) {
    case Rarity.Common:    return s.newBadgeCommon;
    case Rarity.Uncommon:  return s.newBadgeUncommon;
    case Rarity.Rare:      return s.newBadgeRare;
    case Rarity.SuperRare: return s.newBadgeSuperRare;
    case Rarity.UltraRare: return s.newBadgeUltraRare;
    default: return s.newBadgeCommon;
  }
}
```

- [ ] **Step 2: Add rarityBreakdown computed value in the component body**

Inside `PackOpeningScreen`, after the `sortedCards` useMemo:

```ts
const rarityBreakdown = useMemo(() => {
  const counts = new Map<number, number>();
  for (const card of sortedCards) {
    const r = card.rarity ?? Rarity.Common;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => b - a)
    .map(([r, n]) => `${n} ${RARITY_LABELS[r] ?? '?'}`)
    .join(' · ');
}, [sortedCards]);
```

- [ ] **Step 3: Replace the Phase 3 (summary) return**

Replace the entire Phase 3 return with:

```tsx
return (
  <div className={styles.screen}>
    <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('shop')}>
      {t('pack_opening.back_shop')}
    </button>
    <div className={styles.summaryPhase}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('pack_opening.title')}</h2>
        {rarityBreakdown && <p className={styles.breakdown}>{rarityBreakdown}</p>}
      </div>

      <div className={styles.grid}>
        {sortedCards.map((card, i) => {
          const isNew = !ownedBefore.has(card.id);
          const rarity = card.rarity ?? Rarity.Common;
          return (
            <div
              key={i}
              className={`${styles.cardWrapper} ${getRarityBorderClass(rarity, styles)}`}
              style={{ animationDelay: `${i * 0.08}s`, cursor: 'pointer' }}
              onClick={() => openModal({ type: 'card-detail', card })}
            >
              {isNew && (
                <div className={`${styles.newBadge} ${getNewBadgeClass(rarity, styles)}`}>
                  {t('pack_opening.new_badge')}
                </div>
              )}
              <Card card={card} />
            </div>
          );
        })}
      </div>

      <div className={styles.buttons}>
        <button className="btn-primary" onClick={() => navigateTo('save-point')}>
          {t('pack_opening.home')}
        </button>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 4: Remove dead CSS from PackOpeningScreen.module.css**

Delete the following rule blocks in their entirety:

- `.bgEffect` — the base class for the removed background overlay
- `.bgUncommon`, `.bgRare`, `.bgSuperRare`, `.bgUltraRare` — rarity background gradients
- `.lightRaysContainer`, `.lightRaysSR`, `.lightRaysUR` — conic gradient light rays
- `.sparkle-particle`, `.sparkle-particle-small` — DOM sparkle divs
- `.sparkle-burst`, `.sparkle-burst-large` — burst circle effect
- `.lightBeam` — DOM beam divs
- `.revealCardFront.sparkle` — the border glow applied via `classList.add`

These are all in the range of lines 243–420 of the original file. After deletion, the file should go from `.revealCardFront { ... }` directly to `.revealCounter { ... }`.

- [ ] **Step 5: Update `.newBadge` base class**

Find the existing `.newBadge` rule and replace it:

```css
.newBadge {
  position: absolute;
  top: 4px; right: 4px;
  font-family: monospace;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 0;
  letter-spacing: 1px;
  z-index: 1;
  text-shadow: none;
}
```

- [ ] **Step 6: Update `.cardWrapper` animation timing**

Find the existing `.cardWrapper` rule and replace the animation line:

```css
.cardWrapper {
  animation: packReveal 0.3s steps(4) both;
  position: relative;
}
```

- [ ] **Step 7: Add new CSS classes**

Append to the end of `PackOpeningScreen.module.css`:

```css
/* Scanline tint overlay — GSAP controls opacity at rare reveal moment */
.scanlineTint {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 201;
  opacity: 0;
  will-change: opacity;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 3px,
    var(--scanline-color, rgba(255, 255, 255, 0.04)) 3px,
    var(--scanline-color, rgba(255, 255, 255, 0.04)) 4px
  );
}

/* Summary rarity pixel borders */
.borderCommon    { box-shadow: inset 0 0 0 2px #555555; }
.borderUncommon  { box-shadow: inset 0 0 0 2px #286e3a; }
.borderRare      { box-shadow: inset 0 0 0 2px #3860cc; }
.borderSuperRare { box-shadow: inset 0 0 0 2px #c8a84b; }
.borderUltraRare { box-shadow: inset 0 0 0 2px #9030cc; }

/* Rarity-coloured NEW badge variants */
.newBadgeCommon    { background: #555555; color: #ffffff; }
.newBadgeUncommon  { background: #286e3a; color: #ffffff; }
.newBadgeRare      { background: #3860cc; color: #ffffff; }
.newBadgeSuperRare { background: #c8a84b; color: #050a14; }
.newBadgeUltraRare { background: #9030cc; color: #ffffff; }

/* Rarity breakdown line below title */
.breakdown {
  font-family: monospace;
  font-size: 0.7rem;
  color: #607090;
  letter-spacing: 2px;
  margin: 4px 0 0;
  text-transform: uppercase;
}
```

- [ ] **Step 8: Add scanline grid to `.summaryPhase`**

Find the existing `.summaryPhase` rule and add a `background` property to it:

```css
.summaryPhase {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 16px 40px;
  overflow-y: auto;
  width: 100%;
  height: 100%;
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 255, 255, 0.012) 3px,
      rgba(255, 255, 255, 0.012) 4px
    ),
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 255, 255, 0.008) 3px,
      rgba(255, 255, 255, 0.008) 4px
    );
}
```

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 10: Full visual check in dev**

```bash
npm run dev
```

Open a booster pack and verify the summary screen:
- Faint scanline grid visible in the background
- Each card has a rarity-coloured 2px pixel border (grey/green/blue/gold/purple)
- NEW badge is monospace, squared (no border-radius), coloured by rarity
- Cards pop in with a snappy `steps(4)` stagger (0.08s delay between cards)
- Header shows rarity breakdown below the title (e.g. `1 SR · 2 R · 2 C`)

- [ ] **Step 11: Final build check**

```bash
npm test && npm run build
```

Expected: All tests pass, build succeeds. Note the bundle size increase from Pixi.js (~400 KB gzipped).

- [ ] **Step 12: Commit**

```bash
git add src/react/screens/PackOpeningScreen.tsx src/react/screens/PackOpeningScreen.module.css
git commit -m "feat: summary grid polish — rarity borders, pixel NEW badge, breakdown header, scanline bg"
```
