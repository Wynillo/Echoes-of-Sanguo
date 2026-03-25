// ============================================================
// ECHOES OF SANGUO — TCG Archive Generator
// Usage: npm run generate:tcg
//
// Validates and reports on the public/base.tcg-src/ folder structure,
// then packs it into a distributable archive at public/base.tcg.
// The folder is the source of truth; the archive is for distribution.
// ============================================================

import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '../../');
const TCG_FOLDER = join(REPO_ROOT, 'public/base.tcg-src');
const OUT_ZIP    = join(REPO_ROOT, 'public/base.tcg');

async function addDirToZip(zip: JSZip, dir: string, zipPrefix: string): Promise<number> {
  let count = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const zipPath  = zipPrefix + entry.name;
    if (entry.isDirectory()) {
      count += await addDirToZip(zip, fullPath, zipPath + '/');
    } else {
      const data = await readFile(fullPath);
      zip.file(zipPath, data);
      count++;
    }
  }
  return count;
}

async function main() {
  // Validate folder exists
  try {
    await stat(TCG_FOLDER);
  } catch {
    throw new Error(`public/base.tcg-src/ folder not found at ${TCG_FOLDER}`);
  }

  // Required files check
  const REQUIRED = ['cards.json', 'manifest.json', 'meta.json', 'races.json', 'attributes.json', 'card_types.json', 'rarities.json'];
  const missing: string[] = [];
  for (const f of REQUIRED) {
    try {
      await stat(join(TCG_FOLDER, f));
    } catch {
      missing.push(f);
    }
  }
  if (missing.length > 0) {
    console.warn(`WARNING: Missing required files: ${missing.join(', ')}`);
  }

  // Validate cards.json is valid JSON
  try {
    const cardsRaw = await readFile(join(TCG_FOLDER, 'cards.json'), 'utf-8');
    const cards = JSON.parse(cardsRaw);
    console.log(`cards.json: ${cards.length} cards`);
  } catch (e) {
    console.error('cards.json: invalid JSON:', e);
  }

  // Pack folder into ZIP
  console.log(`\nPacking ${TCG_FOLDER} → ${OUT_ZIP} ...`);
  const zip = new JSZip();
  const count = await addDirToZip(zip, TCG_FOLDER, '');

  // Ensure img/ directory always exists in archive (required by validator)
  const hasImgFolder = Object.keys(zip.files).some(f => f.startsWith('img/'));
  if (!hasImgFolder) zip.folder('img');
  console.log(`  Added ${count} files`);

  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await writeFile(OUT_ZIP, out);
  console.log(`Done. Written ${OUT_ZIP} (${(out.length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('generate-base-tcg failed:', err);
  process.exit(1);
});
