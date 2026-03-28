import { describe, it, expect } from 'vitest';
import { validateTcgDefinitions } from '../src/def-validator.js';

describe('validateTcgDefinitions', () => {
  it('validates correct definitions', () => {
    const defs = [{ id: 1, name: 'Card One', description: 'A test card.' }];
    const result = validateTcgDefinitions(defs);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array input', () => {
    const result = validateTcgDefinitions({});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('JSON array');
  });

  it('rejects empty array', () => {
    const result = validateTcgDefinitions([]);
    expect(result.valid).toBe(false);
  });

  it('requires positive integer id', () => {
    const defs = [{ id: -1, name: 'Bad', description: 'Bad id' }];
    const result = validateTcgDefinitions(defs);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('requires non-empty name', () => {
    const defs = [{ id: 1, name: '', description: 'No name' }];
    const result = validateTcgDefinitions(defs);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('requires non-empty description', () => {
    const defs = [{ id: 1, name: 'Card', description: '' }];
    const result = validateTcgDefinitions(defs);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('description'))).toBe(true);
  });

  it('detects duplicate ids', () => {
    const defs = [
      { id: 1, name: 'A', description: 'A' },
      { id: 1, name: 'B', description: 'B' },
    ];
    const result = validateTcgDefinitions(defs);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});
