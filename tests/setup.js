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

// Load card database from base.ac so engine tests have real card data.
// Only runs in the 'node' vitest environment — jsdom tests don't need card data
// and would fail due to cross-realm ArrayBuffer incompatibility with JSZip.
if (typeof window === 'undefined') {
  URL.createObjectURL ??= () => 'blob:mock'; // polyfill for ac-loader image extraction
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const { loadAcFile } = await import('../js/ac-format/ac-loader.js');
  const acBuf = readFileSync(join(__dirname, '../public/base.ac'));
  // Node.js Buffer uses a shared pool — slice to get a proper standalone ArrayBuffer
  await loadAcFile(acBuf.buffer.slice(acBuf.byteOffset, acBuf.byteOffset + acBuf.byteLength));
}
