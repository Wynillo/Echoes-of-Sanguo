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

// Load card database from @wynillo/echoes-mod-base package so engine tests have real card data.
// Only runs in the 'node' vitest environment — jsdom tests don't need card data.
// Reads the pre-built base.tcg archive directly as an ArrayBuffer.
if (typeof window === 'undefined') {
  URL.createObjectURL ??= () => 'blob:mock'; // polyfill for tcg-loader image extraction
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const { loadAndApplyTcg } = await import('../src/tcg-bridge.js');

  const tcgPath = join(__dirname, '../node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
  const buf = readFileSync(tcgPath).buffer;
  await loadAndApplyTcg(buf);
}

// Clean TriggerBus between tests so handlers don't leak across test files
const { TriggerBus } = await import('../src/trigger-bus.js');
afterEach(() => { TriggerBus.clear(); });
