// Minimal localStorage mock for Node environment (used by progression.js)
import { afterEach, beforeEach } from 'vitest';
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

// Load card database from public/base.tcg-src/ folder so engine tests have real card data.
// Only runs in the 'node' vitest environment — jsdom tests don't need card data.
// Uses JSZip to pack the folder in-memory and load it as a ZIP buffer.
if (typeof window === 'undefined') {
  URL.createObjectURL ??= () => 'blob:mock'; // polyfill for tcg-loader image extraction
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const { readdirSync } = await import('fs');
  const { readFile: readFileAsync } = await import('fs/promises');
  const JSZip = (await import('jszip')).default;
  const { loadAndApplyTcg } = await import('../src/tcg-bridge.js');

  // Pack public/base.tcg-src/ folder into an in-memory ZIP for the loader
  const folderPath = join(__dirname, '../public/base.tcg-src');
  const zip = new JSZip();

  async function addDir(dir, prefix) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const zipPath  = prefix + entry.name;
      if (entry.isDirectory()) {
        await addDir(fullPath, zipPath + '/');
      } else {
        const data = await readFileAsync(fullPath);
        zip.file(zipPath, data);
      }
    }
  }

  await addDir(folderPath, '');
  // Ensure img/ folder entry exists (JSZip needs at least one entry under it)
  if (!zip.file(/^img\//).length) {
    zip.folder('img');
  }
  const buf = await zip.generateAsync({ type: 'arraybuffer' });
  await loadAndApplyTcg(buf);
}

// Clean TriggerBus between tests so handlers don't leak across test files
const { TriggerBus } = await import('../src/trigger-bus.js');
afterEach(() => { TriggerBus.clear(); });
