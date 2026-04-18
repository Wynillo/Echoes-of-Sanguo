import { describe, it, expect } from 'vitest';
import { MAX_TCG_SIZE_BYTES, formatBytes } from '../src/tcg-config.js';

describe('tcg-config', () => {
  describe('MAX_TCG_SIZE_BYTES', () => {
    it('should be 50MB in bytes', () => {
      const expected = 50 * 1024 * 1024;
      expect(MAX_TCG_SIZE_BYTES).toBe(expected);
    });

    it('should be a positive integer', () => {
      expect(MAX_TCG_SIZE_BYTES).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_TCG_SIZE_BYTES)).toBe(true);
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format the max TCG size correctly', () => {
      expect(formatBytes(MAX_TCG_SIZE_BYTES)).toBe('50.0 MB');
    });

    it('should format 1KB correctly', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
    });

    it('should format 1MB correctly', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    });
  });
});
