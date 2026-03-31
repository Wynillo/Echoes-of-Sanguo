import { copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
const dest = resolve(__dirname, '../public/base.tcg');

copyFileSync(src, dest);
console.log(`Copied base.tcg → public/base.tcg`);
