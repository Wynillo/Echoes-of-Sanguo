// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Web Audio API mocks ──────────────────────────────────

let gainNodes;

function createMockGainNode() {
  return {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockAudioContext() {
  return {
    createGain: vi.fn(() => {
      const node = createMockGainNode();
      gainNodes.push(node);
      return node;
    }),
    createBufferSource: vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
      loop: false,
      onended: null,
    })),
    decodeAudioData: vi.fn(async () => ({})),
    destination: {},
    currentTime: 0,
    state: 'running',
    resume: vi.fn(),
    suspend: vi.fn(),
  };
}

// ── Test suite ───────────────────────────────────────────

describe('Audio.setVolumes', () => {
  let Audio;

  beforeEach(async () => {
    gainNodes = [];
    vi.resetModules();
    localStorage.clear();

    // Provide AudioContext globally before importing the module
    // Must use function() not arrow — AudioContext is called with `new`
    globalThis.AudioContext = vi.fn(function () { return createMockAudioContext(); });

    // Mock fetch so _loadBuffer can trigger _ensureContext
    globalThis.fetch = vi.fn(async function () {
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    });

    const mod = await import('../js/audio.ts');
    Audio = mod.Audio;
  });

  async function initContext() {
    // playSfx triggers _ensureContext → creates gain nodes
    await Audio.playSfx('sfx_button');
  }

  it('updates gain node values correctly', async () => {
    await initContext();
    // gainNodes: [0] = master, [1] = music, [2] = sfx
    Audio.setVolumes(80, 60, 40);
    expect(gainNodes[0].gain.value).toBeCloseTo(0.8);
    expect(gainNodes[1].gain.value).toBeCloseTo(0.6);
    expect(gainNodes[2].gain.value).toBeCloseTo(0.4);
  });

  it('sets all gains to 0 when volumes are 0 (effective mute)', async () => {
    await initContext();
    Audio.setVolumes(0, 0, 0);
    expect(gainNodes[0].gain.value).toBe(0);
    expect(gainNodes[1].gain.value).toBe(0);
    expect(gainNodes[2].gain.value).toBe(0);
  });

  it('sets all gains to 1 when volumes are 100', async () => {
    await initContext();
    Audio.setVolumes(100, 100, 100);
    expect(gainNodes[0].gain.value).toBe(1);
    expect(gainNodes[1].gain.value).toBe(1);
    expect(gainNodes[2].gain.value).toBe(1);
  });

  it('does not crash when called before context is initialized', () => {
    // No initContext call — gain nodes are null
    expect(() => Audio.setVolumes(50, 50, 50)).not.toThrow();
  });

  it('reads initial volumes from saved Progression settings', async () => {
    // Save custom settings BEFORE importing (already reset above)
    localStorage.setItem('tcg_settings', JSON.stringify({
      lang: 'en', volMaster: 75, volMusic: 25, volSfx: 90, refillHand: true,
    }));

    // Re-import to pick up the saved settings during _ensureContext
    vi.resetModules();
    gainNodes = [];
    globalThis.AudioContext = vi.fn(function () { return createMockAudioContext(); });
    globalThis.fetch = vi.fn(async function () {
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
    });

    const mod2 = await import('../js/audio.ts');
    await mod2.Audio.playSfx('sfx_button');

    // _ensureContext applies saved volumes on first init
    expect(gainNodes[0].gain.value).toBeCloseTo(0.75);
    expect(gainNodes[1].gain.value).toBeCloseTo(0.25);
    expect(gainNodes[2].gain.value).toBeCloseTo(0.9);
  });
});
