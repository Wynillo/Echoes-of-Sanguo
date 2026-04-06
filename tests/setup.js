// Minimal localStorage mock for Node environment (used by progression.js)
import { afterEach } from 'vitest';
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

// Populate card database from a stable test fixture so engine tests are
// independent of the @wynillo/echoes-mod-base package version.
// Only runs in the 'node' vitest environment — jsdom tests load their own data.
if (typeof window === 'undefined') {
  URL.createObjectURL ??= () => 'blob:mock';
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const {
    CARD_DB, FUSION_RECIPES, FUSION_FORMULAS, OPPONENT_CONFIGS,
    STARTER_DECKS, PLAYER_DECK_IDS, OPPONENT_DECK_IDS,
  } = await import('../src/cards.js');
  const { parseEffectString } = await import('../src/effect-serializer.js');
  const { applyShopData } = await import('../src/shop-data.js');

  const fixture = JSON.parse(
    readFileSync(join(__dirname, 'fixtures/test-data.json'), 'utf-8')
  );

  // Cards
  for (const raw of fixture.cards) {
    const card = { ...raw, id: String(raw.id) };
    if (card.effect && typeof card.effect === 'string') {
      const parsed = {};
      parseEffectString(card.effect, parsed);
      Object.assign(card, parsed);
    }
    CARD_DB[card.id] = card;
  }

  // Fusion recipes
  for (const r of fixture.fusionRecipes) {
    FUSION_RECIPES.push({
      materials: [String(r.materials[0]), String(r.materials[1])],
      result: String(r.result),
    });
  }

  // Fusion formulas (pre-sort by descending priority)
  const formulas = fixture.fusionFormulas.map(f => ({
    ...f,
    resultPool: f.resultPool.map(String),
  }));
  formulas.sort((a, b) => b.priority - a.priority);
  FUSION_FORMULAS.push(...formulas);

  // Opponents
  for (const o of fixture.opponents) {
    OPPONENT_CONFIGS.push({
      id: o.id, name: o.name, title: o.title, race: o.race,
      flavor: o.flavor, coinsWin: o.coinsWin, coinsLoss: o.coinsLoss,
      deckIds: o.deckIds.map(String),
    });
  }

  // Starter decks → also sets PLAYER_DECK_IDS and OPPONENT_DECK_IDS
  for (const [raceKey, ids] of Object.entries(fixture.starterDecks)) {
    STARTER_DECKS[Number(raceKey)] = ids.map(String);
  }
  const firstDeck = Object.values(STARTER_DECKS)[0];
  if (firstDeck) {
    PLAYER_DECK_IDS.splice(0, PLAYER_DECK_IDS.length, ...firstDeck);
    OPPONENT_DECK_IDS.splice(0, OPPONENT_DECK_IDS.length, ...firstDeck);
  }

  // Shop data
  if (fixture.shopData) {
    applyShopData(fixture.shopData);
  }
}

// Clean TriggerBus between tests so handlers don't leak across test files
const { TriggerBus } = await import('../src/trigger-bus.js');
afterEach(() => { TriggerBus.clear(); });
