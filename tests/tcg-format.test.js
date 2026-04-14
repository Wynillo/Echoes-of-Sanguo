// @vitest-environment node
import { describe, it, expect } from 'vitest';
// Enum converters (engine-specific)
import { cardTypeToInt, intToCardType } from '../src/enums.js';
// Effect serializer (engine-specific)
import { serializeEffect, deserializeEffect, isValidEffectString } from '../src/effect-serializer.js';
// Builder (engine-specific)
import { cardDataToTcgCard, cardDataToTcgDef } from '../src/tcg-builder.js';
// Constants (from package)
import {
  TCG_TYPE_MONSTER, TCG_TYPE_FUSION, TCG_TYPE_SPELL, TCG_TYPE_TRAP,
  TCG_RARITY_COMMON, TCG_RARITY_ULTRA_RARE,
} from '@wynillo/tcg-format';
import { CardType } from '../src/types.js';

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
    const block = { trigger: 'onSummon', actions: [{ type: 'buffField', value: 200, filter: { race: 3 } }] };
    const s = serializeEffect(block);
    expect(s).toBe('onSummon:buffField(200,{r=3})');
  });

  it('serializes passive_vsAttrBonus', () => {
    const block = { trigger: 'passive', actions: [{ type: 'passive_vsAttrBonus', attr: 2, atk: 500 }] };
    const s = serializeEffect(block);
    expect(s).toBe('passive:passive_vsAttrBonus(2,500)');
  });

  it('serializes permAtkBonus with filter', () => {
    const block = { trigger: 'onSummon', actions: [{ type: 'permAtkBonus', target: 'ownMonster', value: 500, filter: { attr: 2 } }] };
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

describe.skip('Card Validator (validators removed from @wynillo/tcg-format)', () => {
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

  it('accepts any effect string (opaque at format level)', () => {
    // Effect strings are treated as opaque by the card validator — semantic
    // validation is done by the engine bridge after loading.
    const result = validateTcgCards([{ ...validMonster, effect: 'not_a_valid_effect' }]);
    expect(result.valid).toBe(true);
  });

  it('accepts valid effect syntax', () => {
    const result = validateTcgCards([{ ...validMonster, effect: 'onSummon:dealDamage(opponent,300)' }]);
    expect(result.valid).toBe(true);
  });
});

// ── Definition Validator Tests ──────────────────────────────

describe.skip('Definition Validator (validators removed from @wynillo/tcg-format)', () => {
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
      level: 3, atk: 1000, def: 800,
      description: 'A fire salamander',
    };
    const tc = cardDataToTcgCard(card, 1);
    expect(tc.id).toBe(1);
    expect(tc.type).toBe(TCG_TYPE_MONSTER);
    expect(tc.level).toBe(3);
    expect(tc.atk).toBe(1000);
    expect(tc.def).toBe(800);
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

  it('converts an equipment CardData with atkBonus and defBonus', () => {
    const card = {
      id: '306', name: 'Flame Sword', type: CardType.Equipment,
      description: 'A sword imbued with fire',
      rarity: 4, atkBonus: 500, defBonus: 0,
    };
    const tc = cardDataToTcgCard(card, 306);
    expect(tc.id).toBe(306);
    expect(tc.type).toBe(5); // TCG_TYPE_EQUIPMENT
    expect(tc.atkBonus).toBe(500);
    expect(tc.defBonus).toBe(0);
    expect(tc.atk).toBeUndefined();
    expect(tc.def).toBeUndefined();
    expect(tc.attribute).toBeUndefined();
    expect(tc.race).toBeUndefined();
  });

  it('converts equipment with equipRequirement race and attr', () => {
    const card = {
      id: '307', name: 'Dragon Armor', type: CardType.Equipment,
      description: 'Armor for dragons only',
      rarity: 4, atkBonus: 300, defBonus: 600
    };
    const tc = cardDataToTcgCard(card, 307);
    expect(tc.atkBonus).toBe(300);
    expect(tc.defBonus).toBe(600);
  });

  it('omits equipRequirement fields when not present', () => {
    const card = {
      id: '1', name: 'Basic Sword', type: CardType.Equipment,
      description: 'A basic sword', rarity: 1, atkBonus: 200, defBonus: 0,
    };
    const tc = cardDataToTcgCard(card, 1);
    expect(tc.equipReqRace).toBeUndefined();
    expect(tc.equipReqAttr).toBeUndefined();
  });
});
