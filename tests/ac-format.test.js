// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  // Enum converters
  cardTypeToInt, intToCardType,
  attributeToInt, intToAttribute,
  raceToInt, intToRace,
  rarityToInt, intToRarity,
  // Effect serializer
  serializeEffect, deserializeEffect, isValidEffectString,
  // Validators
  validateAcCards, validateAcDefinitions,
  // Builder
  cardDataToAcCard, cardDataToAcDef,
  // Constants
  AC_TYPE_MONSTER, AC_TYPE_FUSION, AC_TYPE_SPELL, AC_TYPE_TRAP,
  AC_RARITY_COMMON, AC_RARITY_ULTRA_RARE,
} from '../js/ac-format/index.js';
import { CardType, Attribute, Race, Rarity } from '../js/types.js';

// ── Enum Converter Tests ────────────────────────────────────

describe('Enum Converters', () => {
  describe('CardType', () => {
    it('maps Monster to 1', () => {
      expect(cardTypeToInt(CardType.Monster)).toBe(AC_TYPE_MONSTER);
    });

    it('maps fusion to 2, spell to 3, trap to 4', () => {
      expect(cardTypeToInt(CardType.Fusion)).toBe(AC_TYPE_FUSION);
      expect(cardTypeToInt(CardType.Spell)).toBe(AC_TYPE_SPELL);
      expect(cardTypeToInt(CardType.Trap)).toBe(AC_TYPE_TRAP);
    });

    it('converts back from int', () => {
      expect(intToCardType(AC_TYPE_MONSTER, false)).toBe(CardType.Monster);
      expect(intToCardType(AC_TYPE_MONSTER, true)).toBe(CardType.Monster);
      expect(intToCardType(AC_TYPE_FUSION, false)).toBe(CardType.Fusion);
      expect(intToCardType(AC_TYPE_SPELL, false)).toBe(CardType.Spell);
      expect(intToCardType(AC_TYPE_TRAP, false)).toBe(CardType.Trap);
    });

    it('throws for unknown types', () => {
      expect(() => cardTypeToInt(99)).toThrow();
      expect(() => intToCardType(99, false)).toThrow();
    });
  });

  describe('Attribute', () => {
    it('round-trips all attributes', () => {
      for (const attr of [Attribute.Fire, Attribute.Water, Attribute.Earth, Attribute.Wind, Attribute.Light, Attribute.Dark]) {
        const n = attributeToInt(attr);
        expect(intToAttribute(n)).toBe(attr);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('Race', () => {
    it('round-trips all races', () => {
      const races = [Race.Fire, Race.Dragon, Race.Flyer, Race.Stone, Race.Plant, Race.Warrior, Race.Spellcaster, Race.Elf, Race.Demon, Race.Water];
      for (const race of races) {
        const n = raceToInt(race);
        expect(intToRace(n)).toBe(race);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('Rarity', () => {
    it('round-trips all rarities', () => {
      const rarities = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.SuperRare, Rarity.UltraRare];
      for (const r of rarities) {
        const n = rarityToInt(r);
        expect(intToRarity(n)).toBe(r);
      }
    });

    it('uses 1-8 range', () => {
      expect(rarityToInt(Rarity.Common)).toBe(1);
      expect(rarityToInt(Rarity.UltraRare)).toBe(8);
    });
  });
});

// ── Effect Serializer Tests ─────────────────────────────────

describe('Effect Serializer', () => {
  it('serializes simple dealDamage', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] };
    expect(serializeEffect(block)).toBe('onSummon:dealDamage(opponent,300)');
  });

  it('serializes gainLP', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 1000 }] };
    expect(serializeEffect(block)).toBe('onSummon:gainLP(self,1000)');
  });

  it('serializes draw', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'draw', target: 'self', count: 2 }] };
    expect(serializeEffect(block)).toBe('onSummon:draw(self,2)');
  });

  it('serializes passive effects', () => {
    const block = { trigger: 'passive', actions: [{ type: 'passive_piercing' }] };
    expect(serializeEffect(block)).toBe('passive:passive_piercing()');
  });

  it('serializes debuffAllOpp', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'debuffAllOpp', atkD: 600, defD: 0 }] };
    expect(serializeEffect(block)).toBe('onSummon:debuffAllOpp(600,0)');
  });

  it('serializes ValueExpr with floor rounding', () => {
    const block = {
      trigger: 'onAttack',
      actions: [
        { type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } },
        { type: 'cancelAttack' },
      ]
    };
    const s = serializeEffect(block);
    expect(s).toBe('onAttack:dealDamage(opponent,attacker.effectiveATK*0.5f);cancelAttack()');
  });

  it('serializes buffAtkRace with int race', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'buffAtkRace', race: Race.Fire, value: 200 }] };
    const s = serializeEffect(block);
    expect(s).toBe(`onSummon:buffAtkRace(${raceToInt(Race.Fire)},200)`);
  });

  it('serializes passive_vsAttrBonus', () => {
    const block = { trigger: 'passive', actions: [{ type: 'passive_vsAttrBonus', attr: Attribute.Dark, atk: 500 }] };
    const s = serializeEffect(block);
    expect(s).toBe(`passive:passive_vsAttrBonus(${attributeToInt(Attribute.Dark)},500)`);
  });

  it('serializes permAtkBonus with attrFilter', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 500, attrFilter: Attribute.Dark }] };
    const s = serializeEffect(block);
    expect(s).toContain('permAtkBonus(ownMonster,500,');
  });

  // Round-trip tests
  it('round-trips all simple effects', () => {
    const effects = [
      { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 300 }] },
      { trigger: 'onSummon', actions: [{ type: 'gainLP', target: 'self', value: 1000 }] },
      { trigger: 'onSummon', actions: [{ type: 'draw', target: 'self', count: 2 }] },
      { trigger: 'onDestroyByBattle', actions: [{ type: 'dealDamage', target: 'opponent', value: 500 }] },
      { trigger: 'passive', actions: [{ type: 'passive_piercing' }] },
      { trigger: 'passive', actions: [{ type: 'passive_untargetable' }] },
      { trigger: 'passive', actions: [{ type: 'passive_directAttack' }] },
      { trigger: 'passive', actions: [{ type: 'passive_phoenixRevival' }] },
      { trigger: 'onSummon', actions: [{ type: 'bounceStrongestOpp' }] },
      { trigger: 'onSummon', actions: [{ type: 'reviveFromGrave' }] },
      { trigger: 'onAttack', actions: [{ type: 'cancelAttack' }] },
      { trigger: 'onAttack', actions: [{ type: 'destroyAttacker' }] },
      { trigger: 'onOpponentSummon', actions: [{ type: 'destroySummonedIf', minAtk: 1000 }] },
    ];

    for (const block of effects) {
      const serialized = serializeEffect(block);
      const deserialized = deserializeEffect(serialized);
      expect(deserialized).toEqual(block);
    }
  });

  it('round-trips complex multi-action effect', () => {
    const block = {
      trigger: 'onAttack',
      actions: [
        { type: 'dealDamage', target: 'opponent', value: { from: 'attacker.effectiveATK', multiply: 0.5, round: 'floor' } },
        { type: 'cancelAttack' },
      ]
    };
    const deserialized = deserializeEffect(serializeEffect(block));
    expect(deserialized).toEqual(block);
  });

  it('validates effect strings', () => {
    expect(isValidEffectString('onSummon:dealDamage(opponent,300)')).toBe(true);
    expect(isValidEffectString('passive:passive_piercing()')).toBe(true);
    expect(isValidEffectString('invalid')).toBe(false);
    expect(isValidEffectString('onSummon:unknownAction()')).toBe(false);
  });
});

// ── Card Validator Tests ────────────────────────────────────

describe('Card Validator', () => {
  const validMonster = { id: 1, level: 3, atk: 1000, def: 800, rarity: 1, type: 1, attribute: 3, race: 4 };
  const validSpell = { id: 2, level: 1, rarity: 1, type: 3, effect: 'onSummon:dealDamage(opponent,800)' };
  const validTrap = { id: 3, level: 1, rarity: 1, type: 4 };

  it('validates a correct card array', () => {
    const result = validateAcCards([validMonster, validSpell, validTrap]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array', () => {
    const result = validateAcCards({});
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateAcCards([]);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid id', () => {
    const result = validateAcCards([{ ...validMonster, id: -1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('id');
  });

  it('rejects invalid level', () => {
    const result = validateAcCards([{ ...validMonster, level: 0 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('level');
  });

  it('rejects invalid rarity', () => {
    const result = validateAcCards([{ ...validMonster, rarity: 3 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('rarity');
  });

  it('rejects invalid type', () => {
    const result = validateAcCards([{ ...validMonster, type: 5 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('type');
  });

  it('rejects attribute on spells', () => {
    const result = validateAcCards([{ ...validSpell, attribute: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('attribute');
  });

  it('rejects race on traps', () => {
    const result = validateAcCards([{ ...validTrap, race: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('race');
  });

  it('rejects atk on spells', () => {
    const result = validateAcCards([{ ...validSpell, atk: 100 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('atk');
  });

  it('detects duplicate ids', () => {
    const result = validateAcCards([validMonster, { ...validSpell, id: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });

  it('rejects invalid effect syntax', () => {
    const result = validateAcCards([{ ...validMonster, effect: 'not_a_valid_effect' }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('effect');
  });

  it('accepts valid effect syntax', () => {
    const result = validateAcCards([{ ...validMonster, effect: 'onSummon:dealDamage(opponent,300)' }]);
    expect(result.valid).toBe(true);
  });
});

// ── Definition Validator Tests ──────────────────────────────

describe('Definition Validator', () => {
  it('validates correct definitions', () => {
    const result = validateAcDefinitions([
      { id: 1, name: 'Fire Dragon', description: 'A fiery dragon' },
      { id: 2, name: 'Ice Spell', description: 'A cold spell' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('rejects non-array', () => {
    const result = validateAcDefinitions('not an array');
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateAcDefinitions([]);
    expect(result.valid).toBe(false);
  });

  it('rejects missing name', () => {
    const result = validateAcDefinitions([{ id: 1, name: '', description: 'test' }]);
    expect(result.valid).toBe(false);
  });

  it('rejects missing description', () => {
    const result = validateAcDefinitions([{ id: 1, name: 'Test', description: '' }]);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid id', () => {
    const result = validateAcDefinitions([{ id: 0, name: 'Test', description: 'Test' }]);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate ids', () => {
    const result = validateAcDefinitions([
      { id: 1, name: 'A', description: 'A' },
      { id: 1, name: 'B', description: 'B' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});

// ── Builder Tests ───────────────────────────────────────────

describe('AC Builder', () => {
  it('converts a monster CardData to AcCard', () => {
    const card = {
      id: 'M001', name: 'Feuersalamander', type: CardType.Monster,
      attribute: Attribute.Fire, race: Race.Fire, rarity: Rarity.Common, level: 3, atk: 1000, def: 800,
      description: 'A fire salamander',
    };
    const ac = cardDataToAcCard(card, 1);
    expect(ac.id).toBe(1);
    expect(ac.type).toBe(AC_TYPE_MONSTER);
    expect(ac.level).toBe(3);
    expect(ac.atk).toBe(1000);
    expect(ac.def).toBe(800);
    expect(ac.rarity).toBe(AC_RARITY_COMMON);
    expect(ac.attribute).toBe(attributeToInt(Attribute.Fire));
    expect(ac.race).toBe(raceToInt(Race.Fire));
    expect(ac.effect).toBeUndefined();
  });

  it('converts a spell CardData to AcCard (no atk/def/attribute/race)', () => {
    const card = {
      id: 'S001', name: 'Feuerball', type: CardType.Spell,
      description: 'Deal damage',
      spellType: 'normal',
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 800 }] }
    };
    const ac = cardDataToAcCard(card, 100);
    expect(ac.id).toBe(100);
    expect(ac.type).toBe(AC_TYPE_SPELL);
    expect(ac.atk).toBeUndefined();
    expect(ac.def).toBeUndefined();
    expect(ac.attribute).toBeUndefined();
    expect(ac.effect).toBe('onSummon:dealDamage(opponent,800)');
  });

  it('extracts card definition', () => {
    const card = { id: 'M001', name: 'Feuersalamander', description: 'A fire salamander', type: CardType.Monster };
    const def = cardDataToAcDef(card, 1);
    expect(def.id).toBe(1);
    expect(def.name).toBe('Feuersalamander');
    expect(def.description).toBe('A fire salamander');
  });
});
