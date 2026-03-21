// ============================================================
// AETHERIAL CLASH — Generate base.ac
// Run: npm run generate:ac
// ============================================================

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CARD_DB, FUSION_RECIPES, OPPONENT_CONFIGS } from '../cards.js';
// Importing cards-data populates CARD_DB with all generated cards.
import { STARTER_DECKS } from '../cards-data.js';
import { buildAcArchive } from './ac-builder.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const cardCount = Object.keys(CARD_DB).length;
  console.log(`Building base.ac from ${cardCount} cards …`);

  const { zip, idMapping } = buildAcArchive(
    CARD_DB,
    { lang: 'de', includeMeta: true },
    {
      fusionRecipes: FUSION_RECIPES,
      opponentConfigs: OPPONENT_CONFIGS,
      starterDecks: STARTER_DECKS,
    },
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  const outPath = resolve(__dirname, '../../public/base.ac');
  writeFileSync(outPath, buf);

  const kb = (buf.length / 1024).toFixed(1);
  console.log(`✔ base.ac written to public/base.ac (${cardCount} cards, ${kb} KB)`);
}

main().catch(err => {
  console.error('Failed to generate base.ac:', err);
  process.exit(1);
});
