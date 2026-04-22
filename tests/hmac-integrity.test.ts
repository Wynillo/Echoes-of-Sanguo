// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeHMAC, verifyHMAC, deriveKey, createHMACEncodedStorage, HMACWrappedData } from '../src/storage-security.js';

// Mock window for node environment
global.window = {
  dispatchEventListener: (() => {
    const listeners = new Map<string, Function[]>();
    return {
      addEventListener: (event: string, handler: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)!.push(handler);
      },
      dispatchEvent: (event: { type: string; detail?: unknown }) => {
        const handlers = listeners.get(event.type);
        if (handlers) {
          handlers.forEach(h => h(event));
        }
        return true;
      },
    };
  })(),
} as unknown as Window & typeof globalThis;

describe('hmac-integrity', () => {
  describe('deriveKey', () => {
    it('derives consistent key from same seed', async () => {
      const key1 = await deriveKey('test-seed-123');
      const key2 = await deriveKey('test-seed-123');
      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64);
    });

    it('derives different keys from different seeds', async () => {
      const key1 = await deriveKey('seed-1');
      const key2 = await deriveKey('seed-2');
      expect(key1).not.toBe(key2);
    });

    it('derives 256-bit key', async () => {
      const key = await deriveKey('any-seed');
      expect(key).toHaveLength(64);
    });
  });

  describe('computeHMAC', () => {
    it('computes HMAC-SHA256 signature', async () => {
      const key = await deriveKey('test-key');
      const data = 'test data';
      const sig = await computeHMAC(key, data);
      expect(sig).toHaveLength(64);
    });

    it('produces consistent signatures', async () => {
      const key = await deriveKey('consistent-key');
      const data = 'same data';
      const sig1 = await computeHMAC(key, data);
      const sig2 = await computeHMAC(key, data);
      expect(sig1).toBe(sig2);
    });

    it('produces different signatures for different data', async () => {
      const key = await deriveKey('test-key');
      const sig1 = await computeHMAC(key, 'data1');
      const sig2 = await computeHMAC(key, 'data2');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyHMAC', () => {
    it('returns true for valid signature', async () => {
      const key = await deriveKey('verify-key');
      const data = 'test data';
      const sig = await computeHMAC(key, data);
      expect(await verifyHMAC(key, data, sig)).toBe(true);
    });

    it('returns false for invalid signature', async () => {
      const key = await deriveKey('verify-key');
      const data = 'test data';
      const wrongSig = '0000000000000000000000000000000000000000000000000000000000000000';
      expect(await verifyHMAC(key, data, wrongSig)).toBe(false);
    });

    it('returns false for tampered data', async () => {
      const key = await deriveKey('verify-key');
      const originalData = 'original data';
      const sig = await computeHMAC(key, originalData);
      const tamperedData = 'tampered data';
      expect(await verifyHMAC(key, tamperedData, sig)).toBe(false);
    });
  });

  describe('createHMACEncodedStorage', () => {
    let storage: ReturnType<typeof createHMACEncodedStorage>;
    const testKeySeed = 'test-storage-key';
    
    beforeEach(() => {
      localStorage.clear();
      storage = createHMACEncodedStorage(testKeySeed, localStorage);
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('saves and loads data', async () => {
      const testData = { coins: 100 };
      
      await storage.save('test-key', testData);
      const loaded = await storage.load('test-key', null);
      
      expect(loaded).toEqual(testData);
    });

    it('handles legacy data without signature', async () => {
      localStorage.setItem('legacy-key', JSON.stringify({ old: true }));
      
      const loaded = await storage.load('legacy-key', null);
      expect(loaded).toEqual({ old: true });
    });

    it('removes data and signature', async () => {
      await storage.save('remove-test', { value: 123 });
      storage.remove('remove-test');
      
      expect(localStorage.getItem('remove-test')).toBeNull();
      expect(localStorage.getItem('remove-test.hmac')).toBeNull();
    });

    it('validates with custom validator', async () => {
      await storage.save('validated', { count: 5 });
      
      const loaded = await storage.load('validated', null, (v) => {
        const obj = v as Record<string, unknown>;
        return typeof obj.count === 'number' && obj.count > 0;
      });
      
      expect(loaded).toEqual({ count: 5 });
    });
  });
});
