import { afterEach } from 'vitest';

// Capture node-env detection before we mutate window below — the fixture loader
// further down guards on `typeof window === 'undefined'` and must see the original
// value, not the mock we assign here.
const isNodeEnv = typeof window === 'undefined';

if (isNodeEnv) {
  global.window = {
    confirm: () => false,
    location: { search: '' },
    EchoesOfSanguoMod: null,
  };
}

const store = {};
global.localStorage = {
  getItem:    (k)    => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k)    => { delete store[k]; },
  clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
};

const sessionStore = {};
global.sessionStorage = {
  getItem:    (k)    => sessionStore[k] ?? null,
  setItem:    (k, v) => { sessionStore[k] = String(v); },
  removeItem: (k)    => { delete sessionStore[k]; },
  clear:      ()     => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); },
};

if (isNodeEnv) {
  URL.createObjectURL ??= () => 'blob:mock';

  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
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

  for (const raw of fixture.cards) {
    const card = { ...raw, id: String(raw.id) };
    if (card.effect && typeof card.effect === 'string') {
      const parsed = {};
      parseEffectString(card.effect, parsed);
      Object.assign(card, parsed);
    }
    CARD_DB[card.id] = card;
  }

  for (const r of fixture.fusionRecipes) {
    FUSION_RECIPES.push({
      materials: [String(r.materials[0]), String(r.materials[1])],
      result: String(r.result),
    });
  }

  const formulas = fixture.fusionFormulas.map(f => ({
    ...f,
    resultPool: f.resultPool.map(String),
  }));
  formulas.sort((a, b) => b.priority - a.priority);
  FUSION_FORMULAS.push(...formulas);

  for (const o of fixture.opponents) {
    OPPONENT_CONFIGS.push({
      id: o.id, name: o.name, title: o.title, race: o.race,
      flavor: o.flavor, coinsWin: o.coinsWin, coinsLoss: o.coinsLoss,
      deckIds: o.deckIds.map(String),
    });
  }

  for (const [raceKey, ids] of Object.entries(fixture.starterDecks)) {
    STARTER_DECKS[Number(raceKey)] = ids.map(String);
  }
  const firstDeck = Object.values(STARTER_DECKS)[0];
  if (firstDeck) {
    PLAYER_DECK_IDS.splice(0, PLAYER_DECK_IDS.length, ...firstDeck);
    OPPONENT_DECK_IDS.splice(0, OPPONENT_DECK_IDS.length, ...firstDeck);
  }

  if (fixture.shopData) {
    applyShopData(fixture.shopData);
  }
}

const { TriggerBus } = await import('../src/trigger-bus.js');
afterEach(() => { TriggerBus.clear(); });
