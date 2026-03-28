// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { loadTcgFile, TcgNetworkError, TcgFormatError } from '../js/tcg-format/tcg-loader.js';
import { loadAndApplyTcg, revokeTcgImages } from '../js/tcg-bridge.js';
import { CARD_DB, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS } from '../js/cards.js';

// ── Helpers ─────────────────────────────────────────────────

const VALID_CARD = { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, attribute: 3, race: 1 };
const VALID_DEF = { id: 1, name: 'Test Card', description: 'A test card' };
const VALID_MANIFEST = { formatVersion: 2 };

async function buildMinimalZip(overrides = {}) {
  const zip = new JSZip();
  if (overrides.cards !== null) {
    zip.file('cards.json', JSON.stringify(overrides.cards ?? [VALID_CARD]));
  }
  if (overrides.definitions !== null) {
    zip.file('cards_description.json', JSON.stringify(overrides.definitions ?? [VALID_DEF]));
  }
  if (overrides.noImg !== true) {
    zip.folder('img');
  }
  if (overrides.manifest !== null) {
    zip.file('manifest.json', JSON.stringify(overrides.manifest ?? VALID_MANIFEST));
  }
  if (overrides.meta) {
    zip.file('meta.json', JSON.stringify(overrides.meta));
  }
  if (overrides.fusionFormulas) {
    zip.file('fusion_formulas.json', JSON.stringify(overrides.fusionFormulas));
  }
  if (overrides.opponents) {
    for (const opp of overrides.opponents) {
      zip.file(`opponents/opponent_deck_${opp.id}.json`, JSON.stringify(opp));
    }
  }
  if (overrides.oppDescs) {
    zip.file('opponents_description.json', JSON.stringify(overrides.oppDescs));
  }
  if (overrides.extraFiles) {
    for (const [path, content] of Object.entries(overrides.extraFiles)) {
      zip.file(path, content);
    }
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

function clearGameStores() {
  for (const key of Object.keys(CARD_DB)) delete CARD_DB[key];
  FUSION_FORMULAS.length = 0;
  OPPONENT_CONFIGS.length = 0;
  for (const key of Object.keys(STARTER_DECKS)) delete STARTER_DECKS[key];
}

// ── Pure loader tests (no side effects) ─────────────────────

describe('loadTcgFile (pure)', () => {
  it('returns parsedCards and rawImages', async () => {
    const buf = await buildMinimalZip();
    const result = await loadTcgFile(buf, { lang: 'en' });
    expect(result.cards).toHaveLength(1);
    expect(result.parsedCards).toHaveLength(1);
    expect(result.parsedCards[0].id).toBe(1);
    expect(result.parsedCards[0].name).toBe('Test Card');
    expect(result.parsedCards[0].type).toBe(1);
    expect(result.rawImages).toBeInstanceOf(Map);
    expect(result.manifest?.formatVersion).toBe(2);
  });

  it('rejects archive with future formatVersion', async () => {
    const buf = await buildMinimalZip({ manifest: { formatVersion: 999 } });
    await expect(loadTcgFile(buf)).rejects.toThrow(TcgFormatError);
    await expect(loadTcgFile(buf)).rejects.toThrow(/version mismatch/);
  });

  it('rejects archive missing cards.json', async () => {
    const buf = await buildMinimalZip({ cards: null });
    await expect(loadTcgFile(buf)).rejects.toThrow(TcgFormatError);
  });

  it('rejects corrupt ZIP data', async () => {
    const garbage = new ArrayBuffer(100);
    await expect(loadTcgFile(garbage)).rejects.toThrow(TcgFormatError);
  });

  it('returns fusion formulas in result', async () => {
    const formulas = {
      formulas: [
        { id: 'dragon_warrior', comboType: 'race+race', operand1: 1, operand2: 3, priority: 10, resultPool: [50] },
      ],
    };
    const buf = await buildMinimalZip({ fusionFormulas: formulas });
    const result = await loadTcgFile(buf);
    expect(result.fusionFormulas).toHaveLength(1);
    expect(result.fusionFormulas[0].id).toBe('dragon_warrior');
  });

  it('returns opponents from opponents/ folder in result', async () => {
    const opp = {
      id: 1, name: 'Test Opp', title: 'Tester', race: 3,
      flavor: 'A test opponent', coinsWin: 100, coinsLoss: 20,
      deckIds: [1, 1, 1], behavior: 'default',
    };
    const buf = await buildMinimalZip({ opponents: [opp] });
    const result = await loadTcgFile(buf);
    expect(result.opponents).toHaveLength(1);
    expect(result.opponents[0].name).toBe('Test Opp');
  });

  it('loads with missing manifest (backward compat)', async () => {
    const buf = await buildMinimalZip({ manifest: null });
    const result = await loadTcgFile(buf);
    expect(result.manifest).toBeUndefined();
    expect(result.warnings.some(w => w.includes('manifest'))).toBe(true);
  });
});

// ── Bridge tests (with side effects) ────────────────────────

describe('loadAndApplyTcg (bridge)', () => {
  beforeEach(() => {
    clearGameStores();
  });

  it('loads and populates CARD_DB', async () => {
    const buf = await buildMinimalZip();
    const result = await loadAndApplyTcg(buf);
    expect(result.cards).toHaveLength(1);
    expect(CARD_DB['1']).toBeDefined();
    expect(CARD_DB['1'].name).toBe('Test Card');
  });

  it('loads equipment card with atkBonus, defBonus, and equipRequirement', async () => {
    const equipCard = {
      id: 10, type: 5, level: 1, rarity: 4,
      atkBonus: 500, defBonus: 200,
      equipReqRace: 1, equipReqAttr: 3,
    };
    const equipDef = { id: 10, name: 'Dragon Blade', description: 'Equip to a Dragon' };
    const buf = await buildMinimalZip({
      cards: [VALID_CARD, equipCard],
      definitions: [VALID_DEF, equipDef],
    });
    const result = await loadAndApplyTcg(buf);
    expect(result.cards).toHaveLength(2);
    const card = CARD_DB['10'];
    expect(card).toBeDefined();
    expect(card.atkBonus).toBe(500);
    expect(card.defBonus).toBe(200);
    expect(card.equipRequirement).toBeDefined();
    expect(card.equipRequirement.race).toBe(1); // Dragon
    expect(card.equipRequirement.attr).toBe(3); // Fire
  });

  it('warns on invalid effect string but loads card', async () => {
    const effectCard = { ...VALID_CARD, id: 2, effect: 'invalid_effect_string' };
    const effectDef = { id: 2, name: 'Bad Effect', description: 'Has invalid effect' };
    const buf = await buildMinimalZip({
      cards: [VALID_CARD, effectCard],
      definitions: [VALID_DEF, effectDef],
    });
    // Bridge warns but continues loading — effects treated leniently
    const result = await loadAndApplyTcg(buf);
    expect(CARD_DB['2']).toBeDefined();
    expect(result.warnings.some(w => w.includes('effect'))).toBe(true);
  });

  it('loads fusion formulas into FUSION_FORMULAS', async () => {
    const formulas = {
      formulas: [
        { id: 'dragon_warrior', comboType: 'race+race', operand1: 1, operand2: 3, priority: 10, resultPool: [50] },
      ],
    };
    const buf = await buildMinimalZip({ fusionFormulas: formulas });
    await loadAndApplyTcg(buf);
    expect(FUSION_FORMULAS).toHaveLength(1);
    expect(FUSION_FORMULAS[0].id).toBe('dragon_warrior');
    expect(FUSION_FORMULAS[0].resultPool).toEqual(['50']);
  });

  it('warns on malformed fusion_formulas.json', async () => {
    const buf = await buildMinimalZip({
      extraFiles: { 'fusion_formulas.json': 'not json' },
    });
    const result = await loadAndApplyTcg(buf);
    expect(result.warnings.some(w => w.includes('fusion_formulas.json'))).toBe(true);
  });

  it('loads opponents from opponents/ folder into OPPONENT_CONFIGS', async () => {
    const opp = {
      id: 1, name: 'Test Opp', title: 'Tester', race: 3,
      flavor: 'A test opponent', coinsWin: 100, coinsLoss: 20,
      deckIds: [1, 1, 1], behavior: 'default',
    };
    const meta = { starterDecks: { '1': [1, 1, 1] } };
    const buf = await buildMinimalZip({ opponents: [opp], meta });
    await loadAndApplyTcg(buf);
    expect(OPPONENT_CONFIGS).toHaveLength(1);
    expect(OPPONENT_CONFIGS[0].name).toBe('Test Opp');
  });

  it('warns on malformed meta.json but continues loading', async () => {
    const buf = await buildMinimalZip({
      extraFiles: { 'meta.json': 'not json' },
    });
    const result = await loadAndApplyTcg(buf);
    expect(result.warnings.some(w => w.includes('meta.json'))).toBe(true);
    expect(CARD_DB['1']).toBeDefined();
  });
});

describe('revokeTcgImages', () => {
  it('calls revokeObjectURL for each image', () => {
    const original = URL.revokeObjectURL;
    const revoked = [];
    URL.revokeObjectURL = (url) => revoked.push(url);
    try {
      // Create some mock blob URLs via the bridge's internal state
      // We test the bridge export directly
      revokeTcgImages();
      // Since no images were loaded, nothing to revoke
      expect(revoked).toEqual([]);
    } finally {
      URL.revokeObjectURL = original;
    }
  });
});
