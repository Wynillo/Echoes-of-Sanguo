// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { Progression } from '../js/progression.ts';

beforeEach(() => {
  localStorage.clear();
  Progression.selectSlot(1);
  Progression.init();
});

describe('volume settings – defaults', () => {
  it('returns default volumes when nothing is saved', () => {
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(50);
    expect(s.volMusic).toBe(50);
    expect(s.volSfx).toBe(50);
  });

  it('returns default language and refillHand', () => {
    const s = Progression.getSettings();
    expect(s.lang).toBe('en');
    expect(s.refillHand).toBe(true);
  });
});

describe('volume settings – save / load round-trip', () => {
  it('persists custom volume values', () => {
    Progression.saveSettings({ lang: 'de', volMaster: 80, volMusic: 60, volSfx: 40, refillHand: false });
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(80);
    expect(s.volMusic).toBe(60);
    expect(s.volSfx).toBe(40);
    expect(s.lang).toBe('de');
    expect(s.refillHand).toBe(false);
  });

  it('handles volume at minimum (0)', () => {
    Progression.saveSettings({ lang: 'en', volMaster: 0, volMusic: 0, volSfx: 0, refillHand: true });
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(0);
    expect(s.volMusic).toBe(0);
    expect(s.volSfx).toBe(0);
  });

  it('handles volume at maximum (100)', () => {
    Progression.saveSettings({ lang: 'en', volMaster: 100, volMusic: 100, volSfx: 100, refillHand: true });
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(100);
    expect(s.volMusic).toBe(100);
    expect(s.volSfx).toBe(100);
  });
});

describe('volume settings – edge cases', () => {
  it('merges partial saved data with defaults', () => {
    localStorage.setItem('tcg_settings', JSON.stringify({ lang: 'de' }));
    const s = Progression.getSettings();
    expect(s.lang).toBe('de');
    expect(s.volMaster).toBe(50);
    expect(s.volMusic).toBe(50);
    expect(s.volSfx).toBe(50);
    expect(s.refillHand).toBe(true);
  });

  it('returns defaults when localStorage contains invalid JSON', () => {
    localStorage.setItem('tcg_settings', '{broken json!!!');
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(50);
    expect(s.volMusic).toBe(50);
    expect(s.volSfx).toBe(50);
  });

  it('overwrites previous settings completely', () => {
    Progression.saveSettings({ lang: 'de', volMaster: 10, volMusic: 20, volSfx: 30, refillHand: false });
    Progression.saveSettings({ lang: 'en', volMaster: 90, volMusic: 80, volSfx: 70, refillHand: true });
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(90);
    expect(s.volMusic).toBe(80);
    expect(s.volSfx).toBe(70);
  });
});
