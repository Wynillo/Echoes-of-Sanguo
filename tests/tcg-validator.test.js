// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { validateTcgArchive, validateFusionFormulasJson, validateOpponentDeck } from '../js/tcg-format/index.js';

// ── Helpers ────────────────────────────────────────────────────

/** Build a minimal valid .tcg ZIP archive for testing. */
function buildMinimalZip() {
  const zip = new JSZip();
  zip.file('cards.json', JSON.stringify([
    { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, attribute: 3, race: 1 },
  ]));
  zip.file('cards_description.json', JSON.stringify([
    { id: 1, name: 'Test Card', description: 'A test card' },
  ]));
  zip.folder('img');
  zip.file('manifest.json', JSON.stringify({ formatVersion: 2 }));
  return zip;
}

// ── validateTcgArchive ─────────────────────────────────────────

describe('validateTcgArchive', () => {
  it('accepts a valid minimal archive', async () => {
    const zip = buildMinimalZip();
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing cards.json', async () => {
    const zip = buildMinimalZip();
    zip.remove('cards.json');
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cards.json'))).toBe(true);
  });

  it('rejects missing cards_description.json', async () => {
    const zip = buildMinimalZip();
    zip.remove('cards_description.json');
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('cards_description'))).toBe(true);
  });

  it('rejects missing img/ folder', async () => {
    const zip = new JSZip();
    zip.file('cards.json', JSON.stringify([
      { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, attribute: 3, race: 1 },
    ]));
    zip.file('cards_description.json', JSON.stringify([
      { id: 1, name: 'Test Card', description: 'A test card' },
    ]));
    zip.file('manifest.json', JSON.stringify({ formatVersion: 2 }));
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('img/'))).toBe(true);
  });

  it('rejects card without matching definition', async () => {
    const zip = buildMinimalZip();
    // Add a second card with no definition
    zip.file('cards.json', JSON.stringify([
      { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, attribute: 3, race: 1 },
      { id: 2, type: 1, level: 4, rarity: 1, atk: 1200, def: 900, attribute: 1, race: 2 },
    ]));
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('2'))).toBe(true);
  });

  it('warns on orphan definition (definition with no matching card)', async () => {
    const zip = buildMinimalZip();
    zip.file('cards_description.json', JSON.stringify([
      { id: 1, name: 'Test Card', description: 'A test card' },
      { id: 99, name: 'Orphan Card', description: 'No matching card entry' },
    ]));
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('99'))).toBe(true);
  });

  it('rejects invalid manifest.json (formatVersion: 0)', async () => {
    const zip = buildMinimalZip();
    zip.file('manifest.json', JSON.stringify({ formatVersion: 0 }));
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('formatVersion'))).toBe(true);
  });

  it('warns when manifest.json is missing', async () => {
    const zip = buildMinimalZip();
    zip.remove('manifest.json');
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('manifest'))).toBe(true);
  });

  it('rejects invalid card in cards.json (negative id)', async () => {
    const zip = buildMinimalZip();
    zip.file('cards.json', JSON.stringify([
      { id: -1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, attribute: 3, race: 1 },
    ]));
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
  });

  it('rejects malformed JSON in cards.json', async () => {
    const zip = buildMinimalZip();
    zip.file('cards.json', '{ not valid json }}}');
    const result = await validateTcgArchive(zip);
    expect(result.valid).toBe(false);
  });
});

// ── validateFusionFormulasJson ──────────────────────────────────

describe('validateFusionFormulasJson', () => {
  /** Build a minimal valid fusion formulas object. */
  function validFormulas() {
    return {
      formulas: [
        { id: 'f1', comboType: 'race+race', operand1: 1, operand2: 2, priority: 10, resultPool: [5] },
      ],
    };
  }

  it('returns no warnings for valid formulas', () => {
    const warnings = validateFusionFormulasJson(validFormulas());
    expect(warnings).toHaveLength(0);
  });

  it('warns when root is not an object', () => {
    const warnings = validateFusionFormulasJson([1, 2, 3]);
    expect(warnings.some(w => w.includes('JSON object'))).toBe(true);
  });

  it('warns when formulas array is missing', () => {
    const warnings = validateFusionFormulasJson({ notFormulas: true });
    expect(warnings.some(w => w.includes('formulas'))).toBe(true);
  });

  it('warns when a formula is missing id', () => {
    const data = validFormulas();
    delete data.formulas[0].id;
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('id'))).toBe(true);
  });

  it('warns when a formula has invalid comboType', () => {
    const data = validFormulas();
    data.formulas[0].comboType = 'invalid_combo';
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('comboType'))).toBe(true);
  });

  it('warns when a formula is missing operand1', () => {
    const data = validFormulas();
    delete data.formulas[0].operand1;
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('operand1'))).toBe(true);
  });

  it('warns when resultPool is empty', () => {
    const data = validFormulas();
    data.formulas[0].resultPool = [];
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('resultPool'))).toBe(true);
  });

  it('warns on duplicate formula id', () => {
    const data = {
      formulas: [
        { id: 'dup', comboType: 'race+race', operand1: 1, operand2: 2, priority: 10, resultPool: [5] },
        { id: 'dup', comboType: 'race+attr', operand1: 3, operand2: 4, priority: 5, resultPool: [6] },
      ],
    };
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('duplicate'))).toBe(true);
  });

  it('warns when resultPool contains non-positive entry', () => {
    const data = validFormulas();
    data.formulas[0].resultPool = [0];
    const warnings = validateFusionFormulasJson(data);
    expect(warnings.some(w => w.includes('resultPool'))).toBe(true);
  });
});

// ── validateOpponentDeck ───────────────────────────────────────

describe('validateOpponentDeck', () => {
  /** Build a minimal valid opponent deck object. */
  function validOpponent() {
    return {
      id: 1,
      name: 'Test Opponent',
      title: 'The Tester',
      race: 1,
      coinsWin: 100,
      coinsLoss: 10,
      deckIds: [1, 2, 3],
    };
  }

  it('returns no warnings for a valid opponent', () => {
    const warnings = validateOpponentDeck(validOpponent(), 0);
    expect(warnings).toHaveLength(0);
  });

  it('warns when id is missing', () => {
    const opp = validOpponent();
    delete opp.id;
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings.some(w => w.includes('id'))).toBe(true);
  });

  it('warns when name is missing', () => {
    const opp = validOpponent();
    opp.name = '';
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings.some(w => w.includes('name'))).toBe(true);
  });

  it('warns when race is invalid (13)', () => {
    const opp = validOpponent();
    opp.race = 13;
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings.some(w => w.includes('race'))).toBe(true);
  });

  it('warns when coinsWin is negative', () => {
    const opp = validOpponent();
    opp.coinsWin = -5;
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings.some(w => w.includes('coinsWin'))).toBe(true);
  });

  it('warns when deckIds is empty', () => {
    const opp = validOpponent();
    opp.deckIds = [];
    const warnings = validateOpponentDeck(opp, 0);
    expect(warnings.some(w => w.includes('deckIds'))).toBe(true);
  });

  it('warns about unknown card ID in deckIds when knownCardIds provided', () => {
    const opp = validOpponent();
    opp.deckIds = [1, 999];
    const knownCardIds = new Set([1, 2, 3]);
    const warnings = validateOpponentDeck(opp, 0, knownCardIds);
    expect(warnings.some(w => w.includes('unknown card') || w.includes('unknown card ID'))).toBe(true);
  });

  it('warns when data is not an object', () => {
    const warnings = validateOpponentDeck('not an object', 0);
    expect(warnings.some(w => w.includes('must be an object'))).toBe(true);
  });
});
