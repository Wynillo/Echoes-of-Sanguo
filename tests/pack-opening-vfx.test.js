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
    expect(RARITY_CONFIG[4 /* Rarity.Rare */].particleCount).toBe(60);
    expect(RARITY_CONFIG[4 /* Rarity.Rare */].beamCount).toBe(4);
    expect(RARITY_CONFIG[4 /* Rarity.Rare */].bloomRadius).toBe(0);
    expect(RARITY_CONFIG[4 /* Rarity.Rare */].spiral).toBe(false);
  });

  it('SuperRare: 120 particles, 6 beams, soft bloom, no spiral', async () => {
    const { RARITY_CONFIG } = await import('../src/react/pixi/effects/packReveal.js');
    expect(RARITY_CONFIG[6 /* Rarity.SuperRare */].particleCount).toBe(120);
    expect(RARITY_CONFIG[6 /* Rarity.SuperRare */].beamCount).toBe(6);
    expect(RARITY_CONFIG[6 /* Rarity.SuperRare */].bloomRadius).toBeGreaterThan(0);
    expect(RARITY_CONFIG[6 /* Rarity.SuperRare */].spiral).toBe(false);
  });

  it('UltraRare: 180 particles, 8 beams, strong bloom, spiral', async () => {
    const { RARITY_CONFIG } = await import('../src/react/pixi/effects/packReveal.js');
    expect(RARITY_CONFIG[8 /* Rarity.UltraRare */].particleCount).toBe(180);
    expect(RARITY_CONFIG[8 /* Rarity.UltraRare */].beamCount).toBe(8);
    expect(RARITY_CONFIG[8 /* Rarity.UltraRare */].bloomRadius).toBeGreaterThan(RARITY_CONFIG[6 /* Rarity.SuperRare */].bloomRadius);
    expect(RARITY_CONFIG[8 /* Rarity.UltraRare */].spiral).toBe(true);
  });
});
