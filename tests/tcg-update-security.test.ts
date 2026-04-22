import { describe, it, expect } from 'vitest';
import { computeArrayBufferHash } from '../src/storage-security.js';

describe('TCG Update Security', () => {
  describe('computeArrayBufferHash', () => {
    it('should compute SHA-256 hash of ArrayBuffer', async () => {
      const data = new TextEncoder().encode('test data');
      const hash = await computeArrayBufferHash(data.buffer);
      
      // SHA-256 produces 64 character hex string
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce consistent hashes for same data', async () => {
      const data = new TextEncoder().encode('consistent test');
      const hash1 = await computeArrayBufferHash(data.buffer);
      const hash2 = await computeArrayBufferHash(data.buffer);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different data', async () => {
      const data1 = new TextEncoder().encode('test 1');
      const data2 = new TextEncoder().encode('test 2');
      const hash1 = await computeArrayBufferHash(data1.buffer);
      const hash2 = await computeArrayBufferHash(data2.buffer);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
