import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CARD_DB, resolveFusionChain, checkFusion } from '../js/cards.js';
import { CardType } from '../js/types.js';

// ── Helpers ────────────────────────────────────────────────

/** Inject a temporary card into CARD_DB for testing. */
function injectCard(id, overrides = {}) {
  CARD_DB[id] = {
    id,
    name: overrides.name ?? `Card ${id}`,
    type: overrides.type ?? CardType.Monster,
    description: '',
    atk: overrides.atk ?? 1000,
    def: overrides.def ?? 1000,
    race: overrides.race,
    attribute: overrides.attribute,
    ...overrides,
  };
}

function cleanupCards(...ids) {
  for (const id of ids) delete CARD_DB[id];
}

// ── resolveFusionChain tests ─────────────────────────────

describe('resolveFusionChain', () => {

  it('returns the single card when given 1 card', () => {
    const result = resolveFusionChain(['1']);
    expect(result.finalCardId).toBe('1');
    expect(result.steps).toHaveLength(0);
    expect(result.consumedIds).toHaveLength(0);
  });

  it('returns empty result when given 0 cards', () => {
    const result = resolveFusionChain([]);
    expect(result.finalCardId).toBe('');
    expect(result.steps).toHaveLength(0);
  });

  it('resolves a 2-card fusion using explicit recipes', () => {
    // Cards 4+5 = 246 is an existing explicit recipe
    const result = resolveFusionChain(['4', '5']);
    expect(result.finalCardId).toBe('246');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].fused).toBe(true);
    expect(result.consumedIds).toContain('4');
    expect(result.consumedIds).toContain('5');
  });

  describe('fallback rules (no fusion)', () => {
    const MON_A = '_test_mon_a';
    const MON_B = '_test_mon_b';
    const SPELL_A = '_test_spell_a';
    const SPELL_B = '_test_spell_b';

    beforeEach(() => {
      injectCard(MON_A, { name: 'MonA', type: CardType.Monster, atk: 500 });
      injectCard(MON_B, { name: 'MonB', type: CardType.Monster, atk: 800 });
      injectCard(SPELL_A, { name: 'SpellA', type: CardType.Spell, atk: undefined, def: undefined });
      injectCard(SPELL_B, { name: 'SpellB', type: CardType.Spell, atk: undefined, def: undefined });
    });

    afterEach(() => cleanupCards(MON_A, MON_B, SPELL_A, SPELL_B));

    it('keeps monster when only one card is a monster (monster first)', () => {
      const result = resolveFusionChain([MON_A, SPELL_A]);
      expect(result.finalCardId).toBe(MON_A);
      expect(result.steps[0].fused).toBe(false);
      expect(result.steps[0].discardedId).toBe(SPELL_A);
      expect(result.consumedIds).toContain(SPELL_A);
      expect(result.consumedIds).not.toContain(MON_A);
    });

    it('keeps monster when only one card is a monster (spell first)', () => {
      const result = resolveFusionChain([SPELL_A, MON_A]);
      expect(result.finalCardId).toBe(MON_A);
      expect(result.steps[0].fused).toBe(false);
      expect(result.steps[0].discardedId).toBe(SPELL_A);
    });

    it('discards first card when both are monsters', () => {
      const result = resolveFusionChain([MON_A, MON_B]);
      expect(result.finalCardId).toBe(MON_B);
      expect(result.steps[0].fused).toBe(false);
      expect(result.steps[0].discardedId).toBe(MON_A);
    });

    it('discards first card when neither is a monster', () => {
      const result = resolveFusionChain([SPELL_A, SPELL_B]);
      expect(result.finalCardId).toBe(SPELL_B);
      expect(result.steps[0].fused).toBe(false);
      expect(result.steps[0].discardedId).toBe(SPELL_A);
    });
  });

  describe('multi-card chains', () => {
    const MON_X = '_test_chain_mon';
    const SPELL_X = '_test_chain_spell';

    beforeEach(() => {
      injectCard(MON_X, { name: 'ChainMon', type: CardType.Monster, atk: 600 });
      injectCard(SPELL_X, { name: 'ChainSpell', type: CardType.Spell, atk: undefined, def: undefined });
    });

    afterEach(() => cleanupCards(MON_X, SPELL_X));

    it('chains multiple fallback steps correctly', () => {
      // MON_X + SPELL_X = keep MON_X (monster kept)
      // MON_X + SPELL_X = keep MON_X again
      const result = resolveFusionChain([MON_X, SPELL_X, SPELL_X]);
      // Note: same ID used twice is fine — represents two copies
      expect(result.finalCardId).toBe(MON_X);
      expect(result.steps).toHaveLength(2);
      // Both spells discarded
      expect(result.consumedIds.filter(id => id === SPELL_X)).toHaveLength(2);
    });

    it('consumedIds has the right count for fused + fallback mix', () => {
      // Use explicit recipe: 4+5 → 246, then 246 + spell (fallback: keep 246)
      const result = resolveFusionChain(['4', '5', SPELL_X]);
      expect(result.finalCardId).toBe('246');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].fused).toBe(true);
      expect(result.steps[1].fused).toBe(false);
      expect(result.steps[1].discardedId).toBe(SPELL_X);
    });
  });
});
