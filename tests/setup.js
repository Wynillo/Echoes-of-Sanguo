// Minimal localStorage mock for Node environment (used by progression.js)
import { beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const store = {};
global.localStorage = {
  getItem:    (k)    => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k)    => { delete store[k]; },
  clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
};

// Load card database from base.tcg so engine tests have real card data.
// Only runs in the 'node' vitest environment — jsdom tests don't need card data
// and would fail due to cross-realm ArrayBuffer incompatibility with JSZip.
if (typeof window === 'undefined') {
  URL.createObjectURL ??= () => 'blob:mock'; // polyfill for tcg-loader image extraction
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const { loadTcgFile } = await import('../js/tcg-format/tcg-loader.js');
  const tcgBuf = readFileSync(join(__dirname, '../public/base.tcg'));
  // Node.js Buffer uses a shared pool — slice to get a proper standalone ArrayBuffer
  await loadTcgFile(tcgBuf.buffer.slice(tcgBuf.byteOffset, tcgBuf.byteOffset + tcgBuf.byteLength));
}
