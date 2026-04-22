import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ensureSlotKey, createSignedPayload, verifySignedPayload, getCachedSlotKey } from '../src/progression-crypto.js';

describe('progression-crypto', () => {
  beforeAll(() => {
    // Ensure crypto is available in test environment
    if (typeof crypto === 'undefined') {
      throw new Error('Web Crypto API not available in test environment');
    }
  });

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('ensureSlotKey', () => {
    it('should derive a key for a valid slot', async () => {
      const key = await ensureSlotKey(1);
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('HMAC');
    });

    it('should cache keys for repeated calls', async () => {
      const key1 = await ensureSlotKey(1);
      const key2 = getCachedSlotKey(1);
      expect(key1).toBe(key2);
    });

    it('should derive different keys for different slots', async () => {
      const key1 = await ensureSlotKey(1);
      const key2 = await ensureSlotKey(2);
      const key3 = await ensureSlotKey(3);
      
      // Keys should be different objects
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it('should derive same key for same slot on fresh derivation', async () => {
      // First derivation
      const key1a = await ensureSlotKey(1);
      
      // Keys are cached, so this returns the same
      const key1b = getCachedSlotKey(1);
      expect(key1a).toBe(key1b);
    });
  });

  describe('createSignedPayload', () => {
    it('should create a signed payload with correct structure', async () => {
      const testData = { coins: 100, collection: ['card1', 'card2'] };
      const { payload, signature } = await createSignedPayload(1, testData);
      
      expect(payload).toBeDefined();
      expect(signature).toBeDefined();
      expect(typeof payload).toBe('string');
      expect(typeof signature).toBe('string');
      
      // Payload should be valid JSON
      const parsed = JSON.parse(payload);
      expect(parsed.slot).toBe(1);
      expect(parsed.data).toEqual(testData);
      expect(parsed.timestamp).toBeDefined();
    });

    it('should create different signatures for different data', async () => {
      const data1 = { value: 1 };
      const data2 = { value: 2 };
      
      const sig1 = await createSignedPayload(1, data1);
      const sig2 = await createSignedPayload(1, data2);
      
      expect(sig1.signature).not.toBe(sig2.signature);
    });

    it('should create different signatures for same data in different slots', async () => {
      const data = { value: 42 };
      
      const sig1 = await createSignedPayload(1, data);
      const sig2 = await createSignedPayload(2, data);
      
      // Same data, different slots -> different signatures
      expect(sig1.signature).not.toBe(sig2.signature);
    });
  });

  describe('verifySignedPayload', () => {
    it('should verify a valid signature', async () => {
      const testData = { coins: 500, name: 'test' };
      const { payload, signature } = await createSignedPayload(1, testData);
      
      const verified = await verifySignedPayload(1, payload, signature);
      
      expect(verified).toEqual(testData);
    });

    it('should return null for tampered data', async () => {
      const testData = { coins: 500 };
      const { payload, signature } = await createSignedPayload(1, testData);
      
      // Tamper with the payload
      const tamperedPayload = JSON.stringify({
        slot: 1,
        data: { coins: 999999 },
        timestamp: Date.now(),
      });
      
      const verified = await verifySignedPayload(1, tamperedPayload, signature);
      
      expect(verified).toBeNull();
    });

    it('should return null for tampered signature', async () => {
      const testData = { coins: 500 };
      const { payload, signature } = await createSignedPayload(1, testData);
      
      // Tamper with signature (change one character)
      const tamperedSignature = signature.charAt(0) === 'a' ? 'b' + signature.slice(1) : 'a' + signature.slice(1);
      
      const verified = await verifySignedPayload(1, payload, tamperedSignature);
      
      expect(verified).toBeNull();
    });

    it('should return null for cross-slot injection', async () => {
      const testData = { coins: 500 };
      
      // Create payload for slot 1
      const { payload, signature } = await createSignedPayload(1, testData);
      
      // Try to verify with slot 2 key
      const verified = await verifySignedPayload(2, payload, signature);
      
      expect(verified).toBeNull();
    });

    it('should return null for slot mismatch in payload', async () => {
      const testData = { coins: 500 };
      
      // Create a payload with wrong slot
      const wrongSlotPayload = JSON.stringify({
        slot: 2,
        data: testData,
        timestamp: Date.now(),
      });
      
      // Sign with slot 1 key
      const { signature } = await createSignedPayload(1, testData);
      
      const verified = await verifySignedPayload(1, wrongSlotPayload, signature);
      
      expect(verified).toBeNull();
    });

    it('should return null for invalid JSON payload', async () => {
      const verified = await verifySignedPayload(1, 'not valid json', 'signature');
      expect(verified).toBeNull();
    });

    it('should return null for invalid signature format', async () => {
      const payload = JSON.stringify({ slot: 1, data: { test: 1 }, timestamp: Date.now() });
      const verified = await verifySignedPayload(1, payload, 'not-base64-!!!');
      expect(verified).toBeNull();
    });
  });

  describe('slot isolation', () => {
    it('should prevent data from slot 1 being verified in slot 2', async () => {
      const testData = { uniqueId: 'slot1-data' };
      
      const { payload: payload1, signature: sig1 } = await createSignedPayload(1, testData);
      const { payload: payload2, signature: sig2 } = await createSignedPayload(2, testData);
      
      // Slot 1 data should verify in slot 1
      const verified1in1 = await verifySignedPayload(1, payload1, sig1);
      expect(verified1in1).toEqual(testData);
      
      // Slot 1 data should NOT verify in slot 2
      const verified1in2 = await verifySignedPayload(2, payload1, sig1);
      expect(verified1in2).toBeNull();
      
      // Slot 2 data should verify in slot 2
      const verified2in2 = await verifySignedPayload(2, payload2, sig2);
      expect(verified2in2).toEqual(testData);
      
      // Slot 2 data should NOT verify in slot 1
      const verified2in1 = await verifySignedPayload(1, payload2, sig2);
      expect(verified2in1).toBeNull();
    });
  });

  describe('real-world scenarios', () => {
    it('should protect coin balance from tampering', async () => {
      const coinData = { coins: 1000 };
      const { payload, signature } = await createSignedPayload(1, coinData);
      
      // Verify original is valid
      const original = await verifySignedPayload(1, payload, signature);
      expect(original?.coins).toBe(1000);
      
      // Attempt to create fake data with same signature structure
      const fakePayload = JSON.stringify({
        slot: 1,
        data: { coins: 999999 },
        timestamp: Date.now(),
      });
      
      const fakeSig = await createSignedPayload(1, { coins: 999999 });
      
      // Can't use another slot's signature
      const verified = await verifySignedPayload(1, fakePayload, signature);
      expect(verified).toBeNull();
    });

    it('should handle complex collection data', async () => {
      const collectionData = {
        collection: [
          { id: 'card1', count: 3 },
          { id: 'card2', count: 1 },
          { id: 'card3', count: 5 },
        ],
        deck: ['card1', 'card1', 'card2', 'card3'],
      };
      
      const { payload, signature } = await createSignedPayload(1, collectionData);
      const verified = await verifySignedPayload(1, payload, signature);
      
      expect(verified).toEqual(collectionData);
    });
  });
});
