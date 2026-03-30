// ============================================================
// ECHOES OF SANGUO — TCG Archive Generator
// Usage: npm run generate:tcg
//
// Packs public/base.tcg-src/ into public/base.tcg using the
// @wynillo/tcg-format package's packer.
// ============================================================

import { packTcgArchive } from '@wynillo/tcg-format';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceDir = resolve(__dirname, '../public/base.tcg-src');
const outputPath = resolve(__dirname, '../public/base.tcg');

console.log(`Packing ${sourceDir} → ${outputPath} ...`);
await packTcgArchive(sourceDir, outputPath);
console.log('Done.');
