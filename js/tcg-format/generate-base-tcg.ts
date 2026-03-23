// ============================================================
// ECHOES OF SANGUO — TCG Archive Generator
// Usage: npm run generate:tcg
//
// Patches the existing public/base.tcg:
//   - Reads opponent deck files from base-ac-src/opponents/*.json
//   - Adds them to the ZIP as opponents/*.json
//   - Strips opponentConfigs from meta.json (now in individual files)
// ============================================================

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import type { TcgOpponentDeck } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');
const TCG_PATH  = join(REPO_ROOT, 'public/base.tcg');
const SRC_DIR   = join(REPO_ROOT, 'base-ac-src/opponents');

async function main() {
  console.log(`Reading ${TCG_PATH} ...`);
  const zip = await JSZip.loadAsync(await readFile(TCG_PATH));

  // Strip opponentConfigs from meta.json (moved to opponents/ folder)
  const metaFile = zip.file('meta.json');
  if (!metaFile) throw new Error('meta.json not found in base.tcg');
  const meta = JSON.parse(await metaFile.async('string'));
  const hadOpponents = 'opponentConfigs' in meta;
  delete meta.opponentConfigs;
  zip.file('meta.json', JSON.stringify(meta));
  if (hadOpponents) {
    console.log('Stripped opponentConfigs from meta.json');
  }

  // Remove any existing opponents/ entries from the ZIP
  Object.keys(zip.files)
    .filter(f => f.startsWith('opponents/'))
    .forEach(f => zip.remove(f));

  // Add opponents/*.json from source folder
  const srcFiles = (await readdir(SRC_DIR))
    .filter(f => f.endsWith('.json'))
    .sort();

  console.log(`Adding ${srcFiles.length} opponent deck files...`);
  for (const filename of srcFiles) {
    const raw = await readFile(join(SRC_DIR, filename), 'utf-8');
    const parsed: TcgOpponentDeck = JSON.parse(raw);
    console.log(`  opponents/${filename} (id=${parsed.id}, name=${parsed.name})`);
    zip.file(`opponents/${filename}`, JSON.stringify(parsed));
  }

  // Write back to public/base.tcg
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await writeFile(TCG_PATH, out);
  console.log(`Done. Written ${TCG_PATH} (${(out.length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('generate-base-tcg failed:', err);
  process.exit(1);
});
