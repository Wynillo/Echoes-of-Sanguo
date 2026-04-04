import { describe, it, expect } from 'vitest';
import {
  validateTcgCards,
  validateTcgDefinitions,
  validateTcgOpponentDescriptions,
  validateShopJson,
  validateCampaignJson,
  validateFusionFormulasJson,
  validateOpponentDeck,
} from '../dist/validators.js';

describe('validators secondary entry', () => {
  it('exports validateTcgCards and works', () => {
    const result = validateTcgCards([
      { id: 1, type: 1, level: 4, rarity: 1, name: 'Test', description: 'A test card' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('exports validateTcgDefinitions and works', () => {
    const result = validateTcgDefinitions([
      { id: 1, name: 'Test', description: 'A test card' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('exports validateTcgOpponentDescriptions and works', () => {
    const result = validateTcgOpponentDescriptions([
      { id: 1, name: 'Opponent', title: 'Title', flavor: 'Flavor text' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('exports validateShopJson and works', () => {
    const warnings = validateShopJson({
      packs: [{ id: 'test-pack', name: 'Test Pack', price: 100, icon: 'icon', color: '#fff', slots: [{ count: 5 }] }],
    });
    expect(warnings.length).toBe(0);
  });

  it('exports validateCampaignJson and works', () => {
    const warnings = validateCampaignJson({
      chapters: [{ id: 'ch1', titleKey: 'ch1_title', nodes: [] }],
    });
    expect(warnings.length).toBe(0);
  });

  it('exports validateFusionFormulasJson and works', () => {
    const warnings = validateFusionFormulasJson({
      formulas: [{ id: 'test', comboType: 'race+race', operand1: 1, operand2: 2, priority: 1, resultPool: [1] }],
    });
    expect(warnings.length).toBe(0);
  });

  it('exports validateOpponentDeck and works', () => {
    const warnings = validateOpponentDeck({
      id: 1,
      name: 'Test Opponent',
      title: 'Challenger',
      race: 1,
      flavor: 'Test flavor',
      coinsWin: 100,
      coinsLoss: 50,
      deckIds: [1, 2, 3],
    }, 0);
    expect(warnings.length).toBe(0);
  });
});
