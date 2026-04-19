// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Progression } from '../src/progression.js';

describe('Progression Constants', () => {
  describe('SAVE_VERSION', () => {
    it('should be exported and accessible', () => {
      expect(Progression.SAVE_VERSION).toBeDefined();
      expect(typeof Progression.SAVE_VERSION).toBe('number');
    });

    it('should have expected value of 2', () => {
      expect(Progression.SAVE_VERSION).toBe(2);
    });
  });

  describe('MAX_SAVE_SLOTS', () => {
    it('should be exported and accessible', () => {
      expect(Progression.MAX_SAVE_SLOTS).toBeDefined();
      expect(typeof Progression.MAX_SAVE_SLOTS).toBe('number');
    });

    it('should have expected value of 3', () => {
      expect(Progression.MAX_SAVE_SLOTS).toBe(3);
    });

    it('should be positive integer', () => {
      expect(Number.isInteger(Progression.MAX_SAVE_SLOTS)).toBe(true);
      expect(Progression.MAX_SAVE_SLOTS).toBeGreaterThan(0);
    });
  });

  describe('CAMPAIGN_OPPONENT_COUNT', () => {
    it('should be exported and accessible', () => {
      expect(Progression.CAMPAIGN_OPPONENT_COUNT).toBeDefined();
      expect(typeof Progression.CAMPAIGN_OPPONENT_COUNT).toBe('number');
    });

    it('should have expected value of 10', () => {
      expect(Progression.CAMPAIGN_OPPONENT_COUNT).toBe(10);
    });

    it('should be positive integer', () => {
      expect(Number.isInteger(Progression.CAMPAIGN_OPPONENT_COUNT)).toBe(true);
      expect(Progression.CAMPAIGN_OPPONENT_COUNT).toBeGreaterThan(0);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('should be exported and accessible', () => {
      expect(Progression.STORAGE_KEYS).toBeDefined();
      expect(typeof Progression.STORAGE_KEYS).toBe('object');
    });

    it('should have SETTINGS key', () => {
      expect(Progression.STORAGE_KEYS.SETTINGS).toBe('tcg_settings');
    });

    it('should have SLOT_META key', () => {
      expect(Progression.STORAGE_KEYS.SLOT_META).toBe('tcg_slot_meta');
    });

    it('should have ACTIVE_SLOT key', () => {
      expect(Progression.STORAGE_KEYS.ACTIVE_SLOT).toBe('tcg_active_slot');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(Progression.STORAGE_KEYS)).toBe(true);
    });
  });
});
