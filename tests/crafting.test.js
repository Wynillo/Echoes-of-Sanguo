import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { CARD_DB } from '../src/cards.js';
import { GAME_RULES, applyRules } from '../src/rules.js';
import { isCraftedId, buildCraftedCard, craftEffectMonster } from '../src/crafting.js';
import { EFFECT_SOURCES } from '../src/effect-items.js';
import { Progression } from '../src/progression.js';
import { spendCurrency } from '../src/currencies.js';

const TEST_CARDS = {
  'monster_001': { id: 'monster_001', name: 'Test Monster', type: 1, atk: 1000, def: 1000, description: 'A test monster' },
  'effect_monster_001': { id: 'effect_monster_001', name: 'Effect Monster', type: 1, atk: 1500, def: 1200, description: 'Has effect', effects: [{ trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] }] },
};

describe('Crafting', () => {
  let cardCountSpy;
  let effectItemCountSpy;
  let addCraftedCardSpy;
  let addCardsToCollectionSpy;
  let removeCardsFromCollectionSpy;
  let removeEffectItemSpy;
  let spendCurrencySpy;

  let registerTestEffectSource;

  beforeEach(() => {
    Object.keys(TEST_CARDS).forEach(k => { CARD_DB[k] = TEST_CARDS[k]; });
    applyRules({ craftingEnabled: false, craftingCurrency: undefined, craftingCost: 0 });
    Object.keys(EFFECT_SOURCES).forEach(k => delete EFFECT_SOURCES[k]);

    registerTestEffectSource = (source) => {
      EFFECT_SOURCES[source.id] = source;
    };

    localStorage.clear();
    sessionStorage.clear();
    Progression.selectSlot(1);
    Progression.init();

    cardCountSpy = vi.spyOn(Progression, 'cardCount');
    effectItemCountSpy = vi.spyOn(Progression, 'getEffectItemCount');
    addCraftedCardSpy = vi.spyOn(Progression, 'addCraftedCard').mockReturnValue('100000000');
    addCardsToCollectionSpy = vi.spyOn(Progression, 'addCardsToCollection').mockImplementation(() => {});
    removeCardsFromCollectionSpy = vi.spyOn(Progression, 'removeCardsFromCollection').mockImplementation(() => {});
    removeEffectItemSpy = vi.spyOn(Progression, 'removeEffectItem').mockImplementation(() => true);
    spendCurrencySpy = vi.spyOn({ spendCurrency }, 'spendCurrency');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.keys(TEST_CARDS).forEach(k => { delete CARD_DB[k]; });
  });

  describe('isCraftedId', () => {
    it('should return true for IDs >= 100000000', () => {
      expect(isCraftedId('100000000')).toBe(true);
      expect(isCraftedId('150000000')).toBe(true);
      expect(isCraftedId(100000001)).toBe(true);
    });

    it('should return false for IDs < 100000000', () => {
      expect(isCraftedId('1')).toBe(false);
      expect(isCraftedId('999')).toBe(false);
      expect(isCraftedId(1500)).toBe(false);
    });
  });

  describe('buildCraftedCard', () => {
    it('should combine base card stats with effect source effects', () => {
      registerTestEffectSource({ id: 'effect_monster_001', name: 'Test Effect', rarity: 4 });
      
      const record = { id: '100000000', baseId: 'monster_001', effectSourceId: 'effect_monster_001' };
      const card = buildCraftedCard(record);
      
      expect(card).not.toBeNull();
      expect(card.id).toBe('100000000');
      expect(card.name).toBe('Test Monster');
      expect(card.atk).toBe(1000);
      expect(card.effects).toHaveLength(1);
    });

    it('should return null for invalid base card', () => {
      const record = { id: '100000000', baseId: 'nonexistent', effectSourceId: 'effect_monster_001' };
      expect(buildCraftedCard(record)).toBeNull();
    });
  });

  describe('craftEffectMonster', () => {
    it('should fail when crafting is disabled', () => {
      const result = craftEffectMonster('monster_001', 'effect_monster_001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Crafting is disabled');
    });

    it('should fail when player does not own base card', () => {
      applyRules({ craftingEnabled: true });
      cardCountSpy.mockReturnValue(0);
      registerTestEffectSource({ id: 'effect_monster_001', name: 'Test Effect', rarity: 4 });
      
      const result = craftEffectMonster('monster_001', 'effect_monster_001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('You do not own this base card');
    });

    it('should fail when base card has existing effect', () => {
      applyRules({ craftingEnabled: true });
      
      const result = craftEffectMonster('effect_monster_001', 'effect_monster_001');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Base card already has an effect');
    });

    it('should succeed with valid inputs and free crafting', () => {
      applyRules({ craftingEnabled: true, craftingCost: 0 });
      registerTestEffectSource({ id: 'effect_monster_001', name: 'Test Effect', rarity: 4 });
      cardCountSpy.mockReturnValue(1);
      effectItemCountSpy.mockReturnValue(1);
      
      const result = craftEffectMonster('monster_001', 'effect_monster_001');
      expect(result.success).toBe(true);
      expect(result.card).toBeDefined();
      expect(addCraftedCardSpy).toHaveBeenCalledWith('monster_001', 'effect_monster_001');
    });
  });
});
