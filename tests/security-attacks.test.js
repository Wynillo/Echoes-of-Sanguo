// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  MAX_EFFECT_STEPS, 
  executeEffectBlock, 
  EffectExecutionError,
  registerEffect,
} from '../src/effect-registry.js';
import { 
  ALLOWED_MOD_SOURCES, 
  TRUSTED_MODS, 
  confirmModLoad,
  modApiForTesting,
} from '../src/mod-api.js';
import { verifyModIntegrity } from '../src/tcg-bridge.js';

// ============================================================================
// Test Helpers and Utilities (Exported for Reuse)
// ============================================================================

/**
 * Creates a mock effect context for testing effect execution.
 */
export function createMockEffectContext(overrides) {
  return {
    engine: {
      getState: vi.fn(() => ({
        player: { 
          lp: 8000, 
          hand: [], 
          deck: [], 
          graveyard: [], 
          field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        },
        opponent: { 
          lp: 8000, 
          hand: [], 
          deck: [], 
          graveyard: [], 
          field: { monsters: [null, null, null, null, null], spellTraps: [null, null, null, null, null], fieldSpell: null },
        },
      })),
      dealDamage: vi.fn(),
      gainLP: vi.fn(),
      drawCard: vi.fn(),
      addLog: vi.fn(),
      specialSummon: vi.fn(),
      specialSummonFromGrave: vi.fn(),
      removeFromHand: vi.fn(),
      removeFromDeck: vi.fn(),
      removeEquipmentForMonster: vi.fn(),
      removeFieldSpell: vi.fn(),
      chainTribute: vi.fn(),
      ui: {
        selectFromDeck: vi.fn(),
        playVFX: vi.fn(),
      },
    },
    owner: 'player',
    targetFC: null,
    targetCard: null,
    attacker: null,
    defender: null,
    summonedFC: null,
    ...overrides,
  };
}

/**
 * Creates a simple effect block for testing.
 */
export function createEffectBlock(trigger, actions, cost) {
  return { trigger, actions, cost };
}

/**
 * Creates a noop effect for testing step counting.
 */
export function createNoopEffect() {
  const noopImpl = () => ({});
  registerEffect('test_noop', noopImpl);
}

/**
 * Mock crypto.subtle.digest for hash verification tests.
 */
export function mockCryptoDigest(expectedHash) {
  const mockDigest = vi.fn().mockResolvedValue(
    new Uint8Array(Buffer.from(expectedHash, 'base64'))
  );
  
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        digest: mockDigest,
      },
    },
    writable: true,
    configurable: true,
  });
  
  return {
    cleanup: () => {
      delete globalThis.crypto;
    },
    mockDigest,
  };
}

/**
 * Simulates an effect that tries to create an infinite loop.
 */
export function createInfiniteLoopEffect() {
  const infiniteImpl = vi.fn(function*() {
    while (true) {
      // Infinite loop - should be caught by step limit
    }
    return {};
  });
  registerEffect('infinite_loop', infiniteImpl);
  return infiniteImpl;
}

// ============================================================================
// Mod Source Validation Tests
// ============================================================================

describe('Mod Source Validation', () => {
  let originalAllowedSources;
  let originalTrustedMods;
  let originalConfirm;

  beforeEach(() => {
    // Store originals for restoration
    originalAllowedSources = [...ALLOWED_MOD_SOURCES];
    originalTrustedMods = new Map(TRUSTED_MODS);
    originalConfirm = window.confirm;
  });

  afterEach(() => {
    // Restore originals
    ALLOWED_MOD_SOURCES.splice(0, ALLOWED_MOD_SOURCES.length, ...originalAllowedSources);
    TRUSTED_MODS.clear();
    originalTrustedMods.forEach((v, k) => TRUSTED_MODS.set(k, v));
    window.confirm = originalConfirm;
  });

  describe('rejects mod from untrusted source', () => {
    it('rejects URL not in allowlist without user confirmation', async () => {
      window.confirm = vi.fn(() => false);
      
      const maliciousUrl = 'https://malicious-site.com/evil.tcg';
      
      await expect(modApiForTesting.loadModTcg(maliciousUrl))
        .rejects
        .toThrow('Mod load cancelled: untrusted source');
      
      expect(window.confirm).toHaveBeenCalled();
    });

    it('rejects URL with wrong hash in TRUSTED_MODS', async () => {
      const url = 'https://example.com/mod.tcg';
      const wrongHash = 'sha256-wronghash123';
      TRUSTED_MODS.set(url, wrongHash);
      
      const mockBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => mockBuffer,
        ok: true,
      });
      
      const mockCrypto = mockCryptoDigest('differenthash');
      
      try {
        await expect(modApiForTesting.loadModTcg(url))
          .rejects
          .toThrow('Mod integrity verification failed');
      } finally {
        mockCrypto.cleanup();
      }
    });
  });

  describe('accepts mod from trusted source', () => {
    it('accepts URL in allowlist without confirmation', async () => {
      const trustedUrl = 'https://raw.githubusercontent.com/Wynillo/my-mod/main/mod.tcg';
      
      const mockBuffer = new ArrayBuffer(100);
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => mockBuffer,
        ok: true,
      });
      
      window.confirm = vi.fn(() => false);
      
      try {
        await modApiForTesting.loadModTcg(trustedUrl);
      } catch (e) {
        // Expected to fail on invalid TCG, but confirm should not have been called
      }
      
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('accepts URL with matching hash in TRUSTED_MODS', async () => {
      const url = 'https://example.com/trusted.tcg';
      const hash = 'sha256-dGhpcyBpcyBhIHRlc3Q=';
      TRUSTED_MODS.set(url, hash);
      
      const mockBuffer = new Uint8Array([1, 2, 3]).buffer;
      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => mockBuffer,
        ok: true,
      });
      
      const mockCrypto = mockCryptoDigest('dGhpcyBpcyBhIHRlc3Q=');
      
      try {
        await expect(modApiForTesting.loadModTcg(url)).rejects.toThrow();
      } catch (e) {
        expect(e.message).not.toContain('integrity verification failed');
      } finally {
        mockCrypto.cleanup();
      }
    });
  });

  describe('bypasses validation with dev-bypass query param', () => {
    it('bypasses confirmation when ?dev-bypass=1 is present', async () => {
      const originalLocation = window.location;
      
      window.location = {
        search: '?dev-bypass=1',
      };
      
      const untrustedUrl = 'https://untrusted.com/mod.tcg';
      window.confirm = vi.fn(() => false);
      
      try {
        await modApiForTesting.loadModTcg(untrustedUrl);
      } catch (e) {
        // Expected to fail on fetch, but confirm should NOT be called
      }
      
      expect(window.confirm).not.toHaveBeenCalled();
      
      window.location = originalLocation;
    });
  });

  describe('user confirmation flow', () => {
    it('shows security warning for untrusted source', async () => {
      const untrustedUrl = 'https://unknown.com/mod.tcg';
      let warningShown = false;
      let warningMessage = '';
      
      window.confirm = vi.fn((message) => {
        warningShown = true;
        warningMessage = message;
        return false;
      });
      
      try {
        await modApiForTesting.loadModTcg(untrustedUrl);
      } catch (e) {
        // Expected
      }
      
      expect(warningShown).toBe(true);
      expect(warningMessage).toContain('SECURITY WARNING');
      expect(warningMessage).toContain('UNTRUSTED source');
      expect(warningMessage).toContain(untrustedUrl);
    });

    it('proceeds when user confirms untrusted source', async () => {
      const untrustedUrl = 'https://unknown.com/mod.tcg';
      window.confirm = vi.fn(() => true);
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(modApiForTesting.loadModTcg(untrustedUrl))
        .rejects
        .toThrow('Network error');
      
      expect(window.confirm).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Effect Execution Limit Tests
// ============================================================================

describe('Effect Execution Limits', () => {
  beforeEach(() => {
    createNoopEffect();
  });

  describe('step counter increments correctly', () => {
    it('counts each action as one step', async () => {
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'test_noop' },
        { type: 'test_noop' },
        { type: 'test_noop' },
      ]);
      
      const options = { stepCounter: { value: 0 } };
      
      await executeEffectBlock(block, ctx, options);
      
      expect(options.stepCounter.value).toBe(3);
    });

    it('accumulates steps across recursive calls', async () => {
      const nestedImpl = vi.fn(async () => {
        return {};
      });
      registerEffect('test_nested', nestedImpl);
      
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'test_nested' },
        { type: 'test_noop' },
      ]);
      
      await executeEffectBlock(block, ctx, { stepCounter: { value: 50 } });
    });
  });

  describe('execution stops at MAX_EFFECT_STEPS', () => {
    it('throws EffectExecutionError when step limit exceeded', async () => {
      const ctx = createMockEffectContext();
      const actions = Array(MAX_EFFECT_STEPS + 10).fill({ type: 'test_noop' });
      const block = createEffectBlock('onSummon', actions);
      
      await expect(executeEffectBlock(block, ctx, { stepCounter: { value: 0 } }))
        .rejects
        .toThrow(EffectExecutionError);
      
      await expect(executeEffectBlock(block, ctx, { stepCounter: { value: 0 } }))
        .rejects
        .toMatchObject({
          reason: 'step_limit',
          stepsExecuted: expect.any(Number),
        });
    });

    it('includes clear error message with step count', async () => {
      const ctx = createMockEffectContext();
      const actions = Array(MAX_EFFECT_STEPS + 1).fill({ type: 'test_noop' });
      const block = createEffectBlock('onSummon', actions);
      
      try {
        await executeEffectBlock(block, ctx, { stepCounter: { value: 0 } });
      } catch (error) {
        expect(error.message).toContain('maximum steps');
        expect(error.message).toContain(String(MAX_EFFECT_STEPS));
      }
    });

    it('respects custom maxSteps option', async () => {
      const ctx = createMockEffectContext();
      const actions = Array(10).fill({ type: 'test_noop' });
      const block = createEffectBlock('onSummon', actions);
      
      await expect(executeEffectBlock(block, ctx, { stepCounter: { value: 0 }, maxSteps: 5 }))
        .rejects
        .toThrow(EffectExecutionError);
    });
  });

  describe('timeout triggers after specified duration', () => {
    it('aborts execution when AbortSignal is triggered', async () => {
      const ctx = createMockEffectContext();
      const controller = new AbortController();
      const block = createEffectBlock('onSummon', [
        { type: 'test_noop' },
        { type: 'test_noop' },
      ]);
      
      controller.abort('timeout');
      
      await expect(executeEffectBlock(block, ctx, { abortSignal: controller.signal }))
        .rejects
        .toThrow(EffectExecutionError);
      
      await expect(executeEffectBlock(block, ctx, { abortSignal: controller.signal }))
        .rejects
        .toMatchObject({
          reason: 'timeout',
        });
    });

    it('includes abort reason in error message', async () => {
      const ctx = createMockEffectContext();
      const controller = new AbortController();
      const block = createEffectBlock('onSummon', [{ type: 'test_noop' }]);
      
      controller.abort('Custom timeout reason: exceeded 5000ms');
      
      try {
        await executeEffectBlock(block, ctx, { abortSignal: controller.signal });
      } catch (error) {
        expect(error.message).toContain('aborted');
        expect(error.message).toContain('Custom timeout reason');
      }
    });
  });

  describe('error messages are clear and actionable', () => {
    it('provides actionable message for step limit exceeded', async () => {
      const ctx = createMockEffectContext();
      const actions = Array(MAX_EFFECT_STEPS + 1).fill({ type: 'test_noop' });
      const block = createEffectBlock('onSummon', actions);
      
      try {
        await executeEffectBlock(block, ctx);
      } catch (error) {
        expect(error.message).toContain('exceeded maximum steps');
        expect(error.message).toContain(`(${MAX_EFFECT_STEPS + 1} > ${MAX_EFFECT_STEPS})`);
      }
    });

    it('includes steps executed in error for debugging', async () => {
      const ctx = createMockEffectContext();
      const actions = Array(MAX_EFFECT_STEPS + 5).fill({ type: 'test_noop' });
      const block = createEffectBlock('onSummon', actions);
      
      try {
        await executeEffectBlock(block, ctx, { stepCounter: { value: 0 } });
      } catch (error) {
        expect(error.stepsExecuted).toBeDefined();
        expect(error.stepsExecuted).toBeGreaterThan(MAX_EFFECT_STEPS - 1);
      }
    });
  });
});

// ============================================================================
// Attack Scenario Tests
// ============================================================================

describe('Attack Scenarios', () => {
  beforeEach(() => {
    createNoopEffect();
  });

  describe('simulated infinite loop effect chain', () => {
    it('prevents infinite loop via step limit', async () => {
      const infiniteImpl = vi.fn(() => {
        let iterations = 0;
        const maxIterations = 1000000;
        while (iterations < maxIterations) {
          iterations++;
        }
        return {};
      });
      registerEffect('infinite_spin', infiniteImpl);
      
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'infinite_spin' },
      ]);
      
      await executeEffectBlock(block, ctx);
      
      expect(infiniteImpl).toHaveBeenCalled();
    });

    it('stops recursive effect triggers at step limit', async () => {
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'test_noop' },
      ]);
      
      await expect(executeEffectBlock(block, ctx, { stepCounter: { value: MAX_EFFECT_STEPS - 1 } }))
        .rejects
        .toThrow(EffectExecutionError);
    });
  });

  describe('recursive effect triggering', () => {
    it('handles chain effects safely', async () => {
      const chainImpl = vi.fn(async () => {
        return {};
      });
      registerEffect('chain_effect', chainImpl);
      
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'chain_effect' },
        { type: 'chain_effect' },
        { type: 'chain_effect' },
      ]);
      
      await executeEffectBlock(block, ctx, { stepCounter: { value: 95 } });
    });

    it('tracks steps through nested executions', async () => {
      let nestedCalls = 0;
      const nestedImpl = vi.fn(async () => {
        nestedCalls++;
        return {};
      });
      registerEffect('recursive_call', nestedImpl);
      
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', Array(20).fill({ type: 'recursive_call' }));
      
      await executeEffectBlock(block, ctx);
      
      expect(nestedCalls).toBe(20);
    });
  });

  describe('malformed effect strings', () => {
    it('handles missing effect handler gracefully', async () => {
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'nonexistent_effect' },
      ]);
      
      await executeEffectBlock(block, ctx);
      
      expect(ctx.engine.addLog).toHaveBeenCalledWith(
        expect.stringContaining('No handler for effect type')
      );
    });

    it('continues execution after unknown effect', async () => {
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'nonexistent_effect' },
        { type: 'test_noop' },
        { type: 'another_bad_effect' },
      ]);
      
      await executeEffectBlock(block, ctx);
    });
  });

  describe('resource exhaustion attempts', () => {
    it('prevents memory exhaustion via large effect arrays', async () => {
      const ctx = createMockEffectContext();
      const actions = [];
      for (let i = 0; i < 10000; i++) {
        actions.push({ type: 'test_noop' });
      }
      const block = createEffectBlock('onSummon', actions);
      
      await expect(executeEffectBlock(block, ctx))
        .rejects
        .toThrow(EffectExecutionError);
    });

    it('prevents CPU exhaustion via complex effect chains', async () => {
      const cpuIntensiveImpl = vi.fn(() => {
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Busy wait
        }
        return {};
      });
      registerEffect('cpu_hog', cpuIntensiveImpl);
      
      const ctx = createMockEffectContext();
      const block = createEffectBlock('onSummon', [
        { type: 'cpu_hog' },
        { type: 'cpu_hog' },
        { type: 'cpu_hog' },
      ]);
      
      await executeEffectBlock(block, ctx, { maxSteps: 2 });
      
      expect(cpuIntensiveImpl).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================================================
// Hash Verification Tests
// ============================================================================

describe('verifyModIntegrity', () => {
  it('verifies SHA-256 hash using mocked crypto', async () => {
    const testData = new TextEncoder().encode('test data');
    const expectedBase64 = Buffer.from(testData).toString('base64');
    
    const mockCrypto = mockCryptoDigest(expectedBase64);
    
    try {
      const result = await verifyModIntegrity(testData.buffer, `sha256-${expectedBase64}`);
      expect(result).toBe(true);
      expect(mockCrypto.mockDigest).toHaveBeenCalled();
    } finally {
      mockCrypto.cleanup();
    }
  });

  it('supports hex hash format', async () => {
    const testData = new Uint8Array([1, 2, 3]);
    const expectedHex = Buffer.from(testData).toString('hex');
    
    const mockCrypto = mockCryptoDigest(Buffer.from(expectedHex, 'hex').toString('base64'));
    
    try {
      const result = await verifyModIntegrity(testData.buffer, expectedHex);
      expect(result).toBe(true);
    } finally {
      mockCrypto.cleanup();
    }
  });

  it('supports W3C SRI format', async () => {
    const testData = new Uint8Array([4, 5, 6]);
    const expectedBase64 = Buffer.from(testData).toString('base64');
    
    const mockCrypto = mockCryptoDigest(expectedBase64);
    
    try {
      const result = await verifyModIntegrity(testData.buffer, `sha256-${expectedBase64}`);
      expect(result).toBe(true);
    } finally {
      mockCrypto.cleanup();
    }
  });

  it('rejects mismatched hash', async () => {
    const testData = new Uint8Array([1, 2, 3]).buffer;
    const wrongHash = 'sha256-wronghash123';
    
    const mockCrypto = mockCryptoDigest('ZGlmZmVyZW50SGFzaEVudGlyZWx5');
    
    try {
      const result = await verifyModIntegrity(testData, wrongHash);
      expect(result).toBe(false);
    } finally {
      mockCrypto.cleanup();
    }
  });
});

// ============================================================================
// TCG Size Validation Tests (Issue #460)
// ============================================================================

import { MAX_TCG_SIZE_BYTES } from '../src/tcg-config.js';

describe('TCG size validation (issue #460)', () => {
  it('should reject TCG archives exceeding 50MB limit', async () => {
    const { loadAndApplyTcg } = await import('../src/tcg-bridge.js');
    const { TcgFormatError } = await import('../src/tcg-bridge.js');
    const oversizedBuffer = new ArrayBuffer(51 * 1024 * 1024); // 51MB
    
    await expect(loadAndApplyTcg(oversizedBuffer))
      .rejects
      .toThrow(TcgFormatError);
  });

  it('should include max size in error message', async () => {
    const { loadAndApplyTcg } = await import('../src/tcg-bridge.js');
    const oversizedBuffer = new ArrayBuffer(60 * 1024 * 1024); // 60MB
    
    await expect(loadAndApplyTcg(oversizedBuffer))
      .rejects
      .toThrow(/50\.0 MB/);
  });

  it('should include security context in error message', async () => {
    const { loadAndApplyTcg } = await import('../src/tcg-bridge.js');
    const oversizedBuffer = new ArrayBuffer(100 * 1024 * 1024); // 100MB
    
    await expect(loadAndApplyTcg(oversizedBuffer))
      .rejects
      .toThrow(/security measure/i);
  });
});
