// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { Progression } from '../src/progression.ts';

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

  it('returns default language', () => {
    const s = Progression.getSettings();
    expect(s.lang).toBe('en');
  });
});

describe('volume settings – save / load round-trip', () => {
  it('persists custom volume values', () => {
    Progression.saveSettings({ lang: 'de', volMaster: 80, volMusic: 60, volSfx: 40 });
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(80);
    expect(s.volMusic).toBe(60);
    expect(s.volSfx).toBe(40);
    expect(s.lang).toBe('de');
  });

  it('handles volume at minimum (0)', () => {
    Progression.saveSettings({ lang: 'en', volMaster: 0, volMusic: 0, volSfx: 0 });
    const s = Progression.getSettings();
    expect(s.volMaster).toBe(0);
    expect(s.volMusic).toBe(0);
    expect(s.volSfx).toBe(0);
  });

  it('handles volume at maximum (100)', () => {
    Progression.saveSettings({ lang: 'en', volMaster: 100, volMusic: 100, volSfx: 100 });
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
  });
});
