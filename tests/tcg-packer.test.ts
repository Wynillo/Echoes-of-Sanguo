import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packTcgArchive, packTcgArchiveToBuffer } from '../src/tcg-packer.js';
import { loadTcgFile } from '../src/tcg-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, 'fixtures/base.tcg-src');

describe('packTcgArchiveToBuffer', () => {
  it('packs a valid source folder into a buffer', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('throws on non-existent folder', async () => {
    await expect(packTcgArchiveToBuffer('/nonexistent')).rejects.toThrow('not found');
  });

  it('produces a loadable archive', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer.buffer as ArrayBuffer, { lang: '' });
    expect(result.cards).toHaveLength(4);
    expect(result.parsedCards).toHaveLength(4);
    expect(result.parsedCards[0].name).toBe('Azure Dragon');
    expect(result.rawImages.size).toBe(4);
    expect(result.manifest?.formatVersion).toBe(2);
    expect(result.meta?.fusionRecipes).toHaveLength(1);
  });
});

describe('packTcgArchive', () => {
  it('writes a .tcg file to disk', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'tcg-test-'));
    const outPath = join(tmpDir, 'test.tcg');
    try {
      await packTcgArchive(FIXTURE_DIR, outPath);
      // Load from disk to verify
      const { readFile } = await import('node:fs/promises');
      const buf = await readFile(outPath);
      const result = await loadTcgFile(buf.buffer as ArrayBuffer);
      expect(result.cards).toHaveLength(4);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });
});
