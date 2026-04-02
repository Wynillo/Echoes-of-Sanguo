import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { validateTcgArchive, validateShopJson, validateCampaignJson, validateFusionFormulasJson, validateOpponentDeck } from '../src/tcg-validator.js';

function makeZip(files: Record<string, string | Buffer>): JSZip {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip;
}

const VALID_CARD = JSON.stringify([{ id: 1, type: 1, level: 4, atk: 1000, def: 800, rarity: 1, attribute: 1, race: 1, name: 'Test Card', description: 'A test card.' }]);
const VALID_LOCALE = JSON.stringify({ 'card_1_name': 'Test Card', 'card_1_desc': 'A test card.' });
const VALID_MANIFEST = JSON.stringify({ formatVersion: 2, name: 'Test' });
// 1x1 white PNG bytes (minimal valid PNG)
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');

describe('validateTcgArchive', () => {
  it('validates a minimal valid archive', async () => {
    const zip = makeZip({
      'cards.json': VALID_CARD,
      'locales/en.json': VALID_LOCALE,
      'manifest.json': VALID_MANIFEST,
      'img/1.png': TINY_PNG,
    });
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.contents).toBeDefined();
    expect(result.contents!.cards).toHaveLength(1);
  });

  it('fails on missing cards.json', async () => {
    const zip = makeZip({
      'locales/en.json': VALID_LOCALE,
      'img/1.png': TINY_PNG,
    });
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cards.json'))).toBe(true);
  });

  it('fails on missing img/ folder', async () => {
    const zip = makeZip({
      'cards.json': VALID_CARD,
      'locales/en.json': VALID_LOCALE,
    });
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('img/'))).toBe(true);
  });

  it('warns on missing images for cards', async () => {
    const zip = makeZip({
      'cards.json': VALID_CARD,
      'locales/en.json': VALID_LOCALE,
      'img/.gitkeep': '',
    });
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('Missing image'))).toBe(true);
  });

  it('accepts plaintext name/description without locale files (with warning)', async () => {
    const cards = JSON.stringify([
      { id: 1, type: 1, level: 4, rarity: 1, name: 'Dragon', description: 'A dragon card' },
    ]);
    const zip = makeZip({
      'cards.json': cards,
      'img/1.png': TINY_PNG,
    });
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('plaintext'))).toBe(true);
  });

  it('warns when using both plaintext and locale files', async () => {
    const cards = JSON.stringify([
      { id: 1, type: 1, level: 4, rarity: 1, name: 'Dragon', description: 'A dragon card' },
    ]);
    const locale = JSON.stringify({ 'card_1_name': 'Fire Dragon' });
    const zip = makeZip({
      'cards.json': cards,
      'locales/en.json': locale,
      'img/1.png': TINY_PNG,
    });
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('locale files will be used'))).toBe(true);
  });
});

describe('validateShopJson', () => {
  it('returns empty warnings for a valid object', () => {
    const warnings = validateShopJson({ packs: [] });
    expect(warnings).toHaveLength(0);
  });

  it('warns on non-object input', () => {
    const warnings = validateShopJson('bad');
    expect(warnings.some(w => w.includes('JSON object'))).toBe(true);
  });
});

describe('validateCampaignJson', () => {
  it('returns empty warnings for valid campaign', () => {
    const campaign = {
      chapters: [{
        id: 'ch1', titleKey: 'chapter_1',
        nodes: [{
          id: 'n1', type: 'duel', position: { x: 0, y: 0 },
          mapIcon: null, unlockCondition: null, rewards: null,
          opponentId: 1, isBoss: false,
        }],
      }],
    };
    const warnings = validateCampaignJson(campaign);
    expect(warnings).toHaveLength(0);
  });

  it('warns on invalid node type', () => {
    const campaign = {
      chapters: [{
        id: 'ch1', nodes: [{
          id: 'n1', type: 'invalid', position: { x: 0, y: 0 },
        }],
      }],
    };
    const warnings = validateCampaignJson(campaign);
    expect(warnings.some(w => w.includes('invalid type'))).toBe(true);
  });

  it('warns on missing chapters', () => {
    const warnings = validateCampaignJson({});
    expect(warnings.some(w => w.includes('chapters'))).toBe(true);
  });
});

describe('validateFusionFormulasJson', () => {
  it('validates correct formulas', () => {
    const data = {
      formulas: [{
        id: 'f1', comboType: 'race+race', operand1: 1, operand2: 2,
        priority: 10, resultPool: [1],
      }],
    };
    const warnings = validateFusionFormulasJson(data);
    expect(warnings).toHaveLength(0);
  });

  it('warns on invalid comboType', () => {
    const data = {
      formulas: [{
        id: 'f1', comboType: 'bad', operand1: 1, operand2: 2,
        priority: 10, resultPool: [1],
      }],
    };
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('comboType'))).toBe(true);
  });
});

describe('validateOpponentDeck', () => {
  it('validates a correct opponent deck', () => {
    const opp = {
      id: 1, name: 'Boss', title: 'The Boss', race: 1,
      flavor: 'Strong', coinsWin: 100, coinsLoss: 10,
      deckIds: [1, 2, 3],
    };
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings).toHaveLength(0);
  });

  it('warns on invalid race', () => {
    const opp = {
      id: 1, name: 'Boss', title: 'The Boss', race: -1,
      flavor: 'Strong', coinsWin: 100, coinsLoss: 10,
      deckIds: [1],
    };
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings.some(w => w.includes('race'))).toBe(true);
  });

  it('cross-validates deckIds against known cards', () => {
    const opp = {
      id: 1, name: 'Boss', title: 'The Boss', race: 1,
      flavor: 'Strong', coinsWin: 100, coinsLoss: 10,
      deckIds: [1, 999],
    };
    const knownCards = new Set([1]);
    const warnings = validateOpponentDeck(opp, 0, knownCards);
    expect(warnings.some(w => w.includes('999'))).toBe(true);
  });
});
