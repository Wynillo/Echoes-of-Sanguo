// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { computeHash, verifyHash, computeArrayBufferHash } from '../src/storage-security.js';

describe('storage-security', () => {
  describe('computeHash', () => {
    it('computes SHA-256 hash of string', async () => {
      const hash = await computeHash('test data');
      expect(hash).toBe('916f0027a575074ce72a331777c3527d64427f64db61bd50bacb6606e726669f');
    });

    it('produces different hashes for different inputs', async () => {
      const hash1 = await computeHash('data1');
      const hash2 = await computeHash('data2');
      expect(hash1).not.toBe(hash2);
    });

    it('produces same hash for same input', async () => {
      const hash1 = await computeHash('consistent data');
      const hash2 = await computeHash('consistent data');
      expect(hash1).toBe(hash2);
    });

    it('handles empty string', async () => {
      const hash = await computeHash('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('handles unicode characters', async () => {
      const hash = await computeHash('你好世界');
      expect(hash).toHaveLength(64);
    });
  });

  describe('verifyHash', () => {
    it('returns true for matching hash', async () => {
      const data = 'test data';
      const hash = await computeHash(data);
      expect(await verifyHash(data, hash)).toBe(true);
    });

    it('returns false for mismatched hash', async () => {
      const data = 'test data';
      const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';
      expect(await verifyHash(data, wrongHash)).toBe(false);
    });

    it('returns false for tampered data', async () => {
      const originalData = 'original data';
      const hash = await computeHash(originalData);
      const tamperedData = 'tampered data';
      expect(await verifyHash(tamperedData, hash)).toBe(false);
    });
  });

  describe('computeArrayBufferHash', () => {
    it('computes hash of ArrayBuffer', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('test buffer');
      expect(await computeArrayBufferHash(data.buffer)).toHaveLength(64);
    });

    it('produces consistent hashes for same buffer', async () => {
      const encoder = new TextEncoder();
      const data = encoder.encode('consistent');
      const hash1 = await computeArrayBufferHash(data.buffer);
      const hash2 = await computeArrayBufferHash(data.buffer);
      expect(hash1).toBe(hash2);
    });

    it('different buffers produce different hashes', async () => {
      const encoder = new TextEncoder();
      const data1 = encoder.encode('buffer1');
      const data2 = encoder.encode('buffer2');
      const hash1 = await computeArrayBufferHash(data1.buffer);
      const hash2 = await computeArrayBufferHash(data2.buffer);
      expect(hash1).not.toBe(hash2);
    });
  });
});
