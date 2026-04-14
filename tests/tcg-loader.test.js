// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { loadTcgFile, TcgFormatError } from '@wynillo/tcg-format';
import { loadAndApplyTcg } from '../src/tcg-bridge.js';
import { CARD_DB, FUSION_FORMULAS, OPPONENT_CONFIGS, STARTER_DECKS } from '../src/cards.js';

// ── Helpers ─────────────────────────────────────────────────

const VALID_CARD = { id: 1, type: 1, level: 3, rarity: 1, atk: 1000, def: 800, attribute: 3, race: 1 };

async function buildMinimalZip(overrides = {}) {
  const zip = new JSZip();
  if (overrides.cards !== null) {
    zip.file('cards.json', JSON.stringify(overrides.cards ?? [VALID_CARD]));
  }
  if (overrides.noImg !== true) {
    zip.folder('img');
  }
  if (overrides.fusionFormulas) {
    zip.file('fusion_formulas.json', JSON.stringify(overrides.fusionFormulas));
  }
  if (overrides.opponents) {
    zip.file('opponents.json', JSON.stringify(overrides.opponents));
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

  it('returns opponents from root-level opponents.json in result', async () => {
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
    expect(CARD_DB['1'].name).toBe('Card #1');
  });

  it('loads equipment card with atkBonus, defBonus', async () => {
    const equipCard = {
      id: 10, type: 5, level: 1, rarity: 4,
      atkBonus: 500, defBonus: 200,
    };
    const buf = await buildMinimalZip({
      cards: [VALID_CARD, equipCard],
    });
    const result = await loadAndApplyTcg(buf);
    expect(result.cards).toHaveLength(2);
    const card = CARD_DB['10'];
    expect(card).toBeDefined();
    expect(card.atkBonus).toBe(500);
    expect(card.defBonus).toBe(200);
  });

  it('infers trapTrigger from effect string when not set in TCG data', async () => {
    const trapCard = {
      id: 99, type: 4, rarity: 1,
      effect: 'onAttack:destroyAttacker()',
    };
    const buf = await buildMinimalZip({ cards: [VALID_CARD, trapCard] });
    await loadAndApplyTcg(buf);
    const card = CARD_DB['99'];
    expect(card).toBeDefined();
    expect(card.trapTrigger).toBe('onAttack');
  });

  it('preserves explicit trapTrigger over effect-inferred value', async () => {
    const trapCard = {
      id: 98, type: 4, rarity: 1, trapTrigger: 5,
      effect: 'onOpponentSpell:cancelEffect()',
    };
    const buf = await buildMinimalZip({ cards: [VALID_CARD, trapCard] });
    await loadAndApplyTcg(buf);
    const card = CARD_DB['98'];
    expect(card).toBeDefined();
    expect(card.trapTrigger).toBe('onOpponentSpell');
  });

  it('warns on invalid effect string but loads card', async () => {
    const effectCard = { ...VALID_CARD, id: 2, effect: 'invalid_effect_string' };
    const buf = await buildMinimalZip({
      cards: [VALID_CARD, effectCard],
    });
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

  it('loads opponents from root-level opponents.json into OPPONENT_CONFIGS', async () => {
    const opp = {
      id: 1, name: 'Test Opp', title: 'Tester', race: 3,
      flavor: 'A test opponent', coinsWin: 100, coinsLoss: 20,
      deckIds: [1, 1, 1], behavior: 'default',
    };
    const buf = await buildMinimalZip({ opponents: [opp] });
    await loadAndApplyTcg(buf);
    expect(OPPONENT_CONFIGS).toHaveLength(1);
    expect(OPPONENT_CONFIGS[0].name).toBe('Test Opp');
  });

  it('loads starter decks from starterDecks.json', async () => {
    const buf = await buildMinimalZip({
      extraFiles: { 'starterDecks.json': JSON.stringify({ '1': [1, 1, 1] }) },
    });
    await loadAndApplyTcg(buf);
    expect(STARTER_DECKS[1]).toEqual(['1', '1', '1']);
  });
});
