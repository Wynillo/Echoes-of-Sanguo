// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MAX_COLLECTION_SIZE, MAX_COPIES_PER_CARD } from '../src/progression.js';
import { addCurrency, getCurrency } from '../src/currencies.js';

describe('Storage Quota Management', () => {

  describe('checkQuotaBeforeSave', () => {
    it('returns true when within quota', async () => {
      const { checkQuotaBeforeSave } = await import('../src/progression.js');
      // 4MB limit, requesting 1KB should pass
      expect(checkQuotaBeforeSave(1024)).toBe(true);
    });

    it('returns false when exceeding quota', async () => {
      const { checkQuotaBeforeSave, estimateStorageSize } = await import('../src/progression.js');
      const current = estimateStorageSize();
      const hugeSize = 5 * 1024 * 1024; // 5MB - exceeds 4MB limit
      expect(checkQuotaBeforeSave(hugeSize)).toBe(false);
    });
  });

  describe('Collection Caps', () => {
    it('respects MAX_COLLECTION_SIZE constant', () => {
      expect(MAX_COLLECTION_SIZE).toBe(1000);
    });

    it('respects MAX_COPIES_PER_CARD constant', () => {
      expect(MAX_COPIES_PER_CARD).toBe(99);
    });
  });

  describe('Currency Bounds', () => {
    it('caps currency at maximum amount', () => {
      const slot = 1 as import('../src/progression.js').SlotId;
      
      const result = addCurrency(slot, 'test_coin', 1_000_000);
      expect(result).toBeLessThanOrEqual(999_999);
      
      const stored = getCurrency(slot, 'test_coin');
      expect(stored).toBeLessThanOrEqual(999_999);
    });
  });
});
