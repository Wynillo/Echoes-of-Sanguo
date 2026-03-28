import { describe, it, expect } from 'vitest';
import { validateTcgOpponentDescriptions } from '../src/opp-desc-validator.js';

describe('validateTcgOpponentDescriptions', () => {
  it('validates correct opponent descriptions', () => {
    const descs = [{ id: 1, name: 'Boss', title: 'The Great', flavor: 'A fearsome foe.' }];
    const result = validateTcgOpponentDescriptions(descs);
    expect(result.valid).toBe(true);
  });

  it('rejects non-array', () => {
    const result = validateTcgOpponentDescriptions('not array');
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateTcgOpponentDescriptions([]);
    expect(result.valid).toBe(false);
  });

  it('requires positive integer id', () => {
    const descs = [{ id: 0, name: 'X', title: '', flavor: '' }];
    const result = validateTcgOpponentDescriptions(descs);
    expect(result.valid).toBe(false);
  });

  it('requires non-empty name', () => {
    const descs = [{ id: 1, name: '', title: '', flavor: '' }];
    const result = validateTcgOpponentDescriptions(descs);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate ids', () => {
    const descs = [
      { id: 1, name: 'A', title: '', flavor: '' },
      { id: 1, name: 'B', title: '', flavor: '' },
    ];
    const result = validateTcgOpponentDescriptions(descs);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});
