import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve('node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
const dest = resolve('public/base.tcg');

if (!existsSync(src)) {
  console.error(`Error: base.tcg not found at ${src}`);
  console.error('Ensure @wynillo/echoes-mod-base is installed.');
  process.exit(1);
}

copyFileSync(src, dest);
console.log('Copied base.tcg → public/base.tcg');
