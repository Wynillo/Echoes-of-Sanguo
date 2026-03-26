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
  validateTcgCards, validateTcgDefinitions,
  // Builder
  cardDataToTcgCard, cardDataToTcgDef,
  // Constants
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP,
  TCG_RARITY_COMMON, TCG_RARITY_ULTRA_RARE,
} from '../js/tcg-format/index.js';
import { CardType, Attribute, Race, Rarity } from '../js/types.js';

// ── Enum Converter Tests ────────────────────────────────────

describe('Enum Converters', () => {
  describe('CardType', () => {
    it('maps Monster to 1', () => {
      expect(cardTypeToInt(CardType.Monster)).toBe(TCG_TYPE_MONSTER);
    });

    it('maps fusion to 2, spell to 3, trap to 4', () => {
      expect(cardTypeToInt(CardType.Fusion)).toBe(TCG_TYPE_FUSION);
      expect(cardTypeToInt(CardType.Spell)).toBe(TCG_TYPE_SPELL);
      expect(cardTypeToInt(CardType.Trap)).toBe(TCG_TYPE_TRAP);
    });

    it('converts back from int', () => {
      expect(intToCardType(TCG_TYPE_MONSTER, false)).toBe(CardType.Monster);
      expect(intToCardType(TCG_TYPE_MONSTER, true)).toBe(CardType.Monster);
      expect(intToCardType(TCG_TYPE_FUSION, false)).toBe(CardType.Fusion);
      expect(intToCardType(TCG_TYPE_SPELL, false)).toBe(CardType.Spell);
      expect(intToCardType(TCG_TYPE_TRAP, false)).toBe(CardType.Trap);
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
      const races = [Race.Dragon, Race.Spellcaster, Race.Warrior, Race.Beast, Race.Plant, Race.Rock, Race.Phoenix, Race.Undead, Race.Aqua, Race.Insect, Race.Machine, Race.Pyro];
      for (const race of races) {
        const n = raceToInt(race);
        expect(intToRace(n)).toBe(race);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(12);
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

  it('serializes debuffField', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'debuffField', atkD: 600, defD: 0 }] };
    expect(serializeEffect(block)).toBe('onSummon:debuffField(600,0)');
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

  it('serializes buffField with race filter', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'buffField', value: 200, filter: { race: Race.Pyro } }] };
    const s = serializeEffect(block);
    expect(s).toBe(`onSummon:buffField(200,{r=${raceToInt(Race.Pyro)}})`);
  });

  it('serializes passive_vsAttrBonus', () => {
    const block = { trigger: 'passive', actions: [{ type: 'passive_vsAttrBonus', attr: Attribute.Dark, atk: 500 }] };
    const s = serializeEffect(block);
    expect(s).toBe(`passive:passive_vsAttrBonus(${attributeToInt(Attribute.Dark)},500)`);
  });

  it('serializes permAtkBonus with filter', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 500, filter: { attr: Attribute.Dark } }] };
    const s = serializeEffect(block);
    expect(s).toContain('permAtkBonus(ownMonster,500,{a=');
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
    const result = validateTcgCards([validMonster, validSpell, validTrap]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-array', () => {
    const result = validateTcgCards({});
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateTcgCards([]);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid id', () => {
    const result = validateTcgCards([{ ...validMonster, id: -1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('id');
  });

  it('rejects invalid level', () => {
    const result = validateTcgCards([{ ...validMonster, level: 0 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('level');
  });

  it('rejects invalid rarity', () => {
    const result = validateTcgCards([{ ...validMonster, rarity: 3 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('rarity');
  });

  it('rejects invalid type', () => {
    const result = validateTcgCards([{ ...validMonster, type: 99 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('type');
  });

  it('allows attribute on spells (race-specific spells)', () => {
    const result = validateTcgCards([{ ...validSpell, attribute: 1 }]);
    expect(result.valid).toBe(true);
  });

  it('allows race on traps (race-specific traps)', () => {
    const result = validateTcgCards([{ ...validTrap, race: 1 }]);
    expect(result.valid).toBe(true);
  });

  it('rejects atk on spells', () => {
    const result = validateTcgCards([{ ...validSpell, atk: 100 }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('atk');
  });

  it('detects duplicate ids', () => {
    const result = validateTcgCards([validMonster, { ...validSpell, id: 1 }]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });

  it('rejects invalid effect syntax', () => {
    const result = validateTcgCards([{ ...validMonster, effect: 'not_a_valid_effect' }]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('effect');
  });

  it('accepts valid effect syntax', () => {
    const result = validateTcgCards([{ ...validMonster, effect: 'onSummon:dealDamage(opponent,300)' }]);
    expect(result.valid).toBe(true);
  });
});

// ── Definition Validator Tests ──────────────────────────────

describe('Definition Validator', () => {
  it('validates correct definitions', () => {
    const result = validateTcgDefinitions([
      { id: 1, name: 'Fire Dragon', description: 'A fiery dragon' },
      { id: 2, name: 'Ice Spell', description: 'A cold spell' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('rejects non-array', () => {
    const result = validateTcgDefinitions('not an array');
    expect(result.valid).toBe(false);
  });

  it('rejects empty array', () => {
    const result = validateTcgDefinitions([]);
    expect(result.valid).toBe(false);
  });

  it('rejects missing name', () => {
    const result = validateTcgDefinitions([{ id: 1, name: '', description: 'test' }]);
    expect(result.valid).toBe(false);
  });

  it('rejects missing description', () => {
    const result = validateTcgDefinitions([{ id: 1, name: 'Test', description: '' }]);
    expect(result.valid).toBe(false);
  });

  it('rejects invalid id', () => {
    const result = validateTcgDefinitions([{ id: 0, name: 'Test', description: 'Test' }]);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate ids', () => {
    const result = validateTcgDefinitions([
      { id: 1, name: 'A', description: 'A' },
      { id: 1, name: 'B', description: 'B' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('duplicate'))).toBe(true);
  });
});

// ── Builder Tests ───────────────────────────────────────────

describe('TCG Builder', () => {
  it('converts a monster CardData to TcgCard', () => {
    const card = {
      id: '1', name: 'Feuersalamander', type: CardType.Monster,
      attribute: Attribute.Fire, race: Race.Beast, rarity: Rarity.Common, level: 3, atk: 1000, def: 800,
      description: 'A fire salamander',
    };
    const tc = cardDataToTcgCard(card, 1);
    expect(tc.id).toBe(1);
    expect(tc.type).toBe(TCG_TYPE_MONSTER);
    expect(tc.level).toBe(3);
    expect(tc.atk).toBe(1000);
    expect(tc.def).toBe(800);
    expect(tc.rarity).toBe(TCG_RARITY_COMMON);
    expect(tc.attribute).toBe(attributeToInt(Attribute.Fire));
    expect(tc.race).toBe(raceToInt(Race.Beast));
    expect(tc.effect).toBeUndefined();
  });

  it('converts a spell CardData to TcgCard (no atk/def/attribute/race)', () => {
    const card = {
      id: '100', name: 'Feuerball', type: CardType.Spell,
      description: 'Deal damage',
      spellType: 'normal',
      effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage', target: 'opponent', value: 800 }] }
    };
    const tc = cardDataToTcgCard(card, 100);
    expect(tc.id).toBe(100);
    expect(tc.type).toBe(TCG_TYPE_SPELL);
    expect(tc.atk).toBeUndefined();
    expect(tc.def).toBeUndefined();
    expect(tc.attribute).toBeUndefined();
    expect(tc.effect).toBe('onSummon:dealDamage(opponent,800)');
  });

  it('extracts card definition', () => {
    const card = { id: '1', name: 'Feuersalamander', description: 'A fire salamander', type: CardType.Monster };
    const def = cardDataToTcgDef(card, 1);
    expect(def.id).toBe(1);
    expect(def.name).toBe('Feuersalamander');
    expect(def.description).toBe('A fire salamander');
  });
});
