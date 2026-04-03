import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packTcgArchiveToBuffer } from '../src/tcg-packer.js';
import { loadTcgFile, TcgFormatError } from '../src/tcg-loader.js';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, 'fixtures/base.tcg-src');

describe('loadTcgFile', () => {
  it('loads a valid archive from ArrayBuffer', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer, { lang: '' });

    expect(result.cards).toHaveLength(4);
    expect(result.parsedCards).toHaveLength(4);
    expect(result.localeOverrides.size).toBeGreaterThan(0);
    expect(result.rawImages.size).toBe(4);
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.formatVersion).toBe(2);
    expect(result.meta).toBeDefined();
    expect(result.meta!.fusionRecipes).toHaveLength(1);
  });

  it('returns parsed cards with merged locale', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer);

    const dragon = result.parsedCards.find(c => c.id === 1);
    expect(dragon).toBeDefined();
    expect(dragon!.name).toBe('Ancient Dragon');
    expect(dragon!.type).toBe(1);
    expect(dragon!.atk).toBe(1500);
    expect(dragon!.def).toBe(1200);
    expect(dragon!.attribute).toBe(1);
    expect(dragon!.race).toBe(1);
  });

  it('keeps effect as opaque string', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer);

    const spell = result.parsedCards.find(c => c.id === 3);
    expect(spell).toBeDefined();
    expect(spell!.effect).toBe('drawCard:2');
    expect(spell!.spellType).toBe(1);
  });

  it('loads type metadata', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer);

    expect(result.typeMeta).toBeDefined();
    expect(result.typeMeta!.races).toBeDefined();
    expect(result.typeMeta!.attributes).toBeDefined();
    expect(result.typeMeta!.cardTypes).toBeDefined();
    expect(result.typeMeta!.rarities).toBeDefined();
  });

  it('returns raw images as ArrayBuffers', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer);

    for (const [, imgBuf] of result.rawImages) {
      expect(imgBuf).toBeInstanceOf(ArrayBuffer);
      expect(imgBuf.byteLength).toBeGreaterThan(0);
    }
  });

  it('throws TcgFormatError on corrupt ZIP', async () => {
    const badBuffer = new ArrayBuffer(100);
    await expect(loadTcgFile(badBuffer)).rejects.toThrow(TcgFormatError);
  });

  it('throws TcgFormatError on unsupported format version', async () => {
    const zip = new JSZip();
    zip.file('cards.json', JSON.stringify([{ id: 1, type: 1, level: 4, rarity: 1, name: 'X', description: 'Y' }]));
    zip.file('locales/en.json', JSON.stringify({ 'c1': 'X', 'c1d': 'Y' }));
    zip.file('manifest.json', JSON.stringify({ formatVersion: 999 }));
    zip.file('img/1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });

    await expect(loadTcgFile(buf)).rejects.toThrow(/format version/i);
  });

  it('loads starterDecks.json as standalone file', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const result = await loadTcgFile(buffer);

    expect(result.starterDecks).toBeDefined();
    expect(result.starterDecks!['1']).toEqual([1, 2, 3, 4]);
  });

  it('propagates spirit flag on parsed cards', async () => {
    const zip = new JSZip();
    zip.file('cards.json', JSON.stringify([
      { id: 1, type: 1, level: 4, rarity: 1, atk: 1000, def: 800, spirit: true, name: 'Spirit Monster', description: 'A spirit' },
    ]));
    zip.file('locales/en.json', JSON.stringify({ 'card_1_name': 'Spirit Monster', 'card_1_desc': 'A spirit' }));
    zip.file('manifest.json', JSON.stringify({ formatVersion: 2 }));
    zip.file('img/1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await loadTcgFile(buf);
    expect(result.parsedCards[0].spirit).toBe(true);
    expect(result.cards[0].spirit).toBe(true);
  });

  it('handles Uint8Array with non-zero byteOffset (Buffer pool simulation)', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    // Simulate Node.js Buffer pooling: embed the ZIP data at an offset
    // inside a larger ArrayBuffer with garbage bytes before it.
    const padding = 128;
    const combined = new Uint8Array(padding + buffer.byteLength);
    // Fill padding with random non-ZIP bytes
    for (let i = 0; i < padding; i++) combined[i] = 0xff;
    combined.set(new Uint8Array(buffer), padding);
    // Create a Uint8Array view that starts at the offset
    const view = new Uint8Array(combined.buffer, padding, buffer.byteLength);

    const result = await loadTcgFile(view);
    expect(result.cards).toHaveLength(4);
    expect(result.parsedCards).toHaveLength(4);
  });

  it('calls onProgress callback', async () => {
    const buffer = await packTcgArchiveToBuffer(FIXTURE_DIR);
    const progress: number[] = [];
    await loadTcgFile(buffer, {
      onProgress: (p) => progress.push(p),
    });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('resolves card name from locale when cards.json has no plaintext name', async () => {
    const zip = new JSZip();
    zip.file('cards.json', JSON.stringify([
      { id: 1, type: 1, level: 4, rarity: 1, atk: 1000, def: 800 },
      // no name or description fields
    ]));
    zip.file('locales/en.json', JSON.stringify({
      'card_1_name': 'Locale Dragon',
      'card_1_desc': 'A dragon from locale.',
    }));
    zip.file('manifest.json', JSON.stringify({ formatVersion: 2 }));
    zip.file('img/1.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });

    const result = await loadTcgFile(buf, { lang: 'en' });
    expect(result.parsedCards[0].name).toBe('Locale Dragon');
    expect(result.parsedCards[0].description).toBe('A dragon from locale.');
  });
});
