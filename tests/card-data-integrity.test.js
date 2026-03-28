// ============================================================
// Card Data Integrity Tests
// Ensures card descriptions match actual card data and contain
// no localization bugs (mixed languages, wrong metadata, etc.)
// ============================================================
import { describe, it, expect } from 'vitest';
import { CARD_DB } from '../js/cards.js';
import { CardType } from '../js/types.js';
import { isValidEffectString } from '../js/tcg-format/index.js';
import fs from 'fs';
import path from 'path';

const GERMAN_PATTERN = /\b(der|die|das|ein|eine|und|auf|ist|des|dem|den|mit|von|für|oder|nicht|werden|wird|haben|hat|sind|wenn|alle|dein|deinem|deinen|deiner|erhalt|erhalten|Spielfeld|Stufe|Krieger|Drache|Zauberer|Karte|Feld|Gegner|Schaden|Angriff|Verteidigung|Zerstore|Negiere|Aktiviere|Fuge|Wahle|Schadenspunkte|Beschwort|zuruckgeschickt|gehartetem|massiver|Verstarkt|Umhang|Schutz|Bietet|gefertigt|uralten|Starkt|Effekt|Zauberkarte|Fallenkarte)\b/;

function allCards() {
  return Object.values(CARD_DB);
}

// ── Source file integrity ───────────────────────────────────

describe('TCG source file integrity', () => {
  const cardsJsonPath = path.resolve('public/base.tcg-src/cards.json');
  const descsJsonPath = path.resolve('public/base.tcg-src/locales/cards_description.json');
  const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
  const descsJson = JSON.parse(fs.readFileSync(descsJsonPath, 'utf8'));

  it('cards_description.json is an array', () => {
    expect(Array.isArray(descsJson)).toBe(true);
  });

  it('every card in cards.json has a matching description entry', () => {
    const descIds = new Set(descsJson.map(d => d.id));
    for (const card of cardsJson) {
      expect(descIds.has(card.id), `Card #${card.id} missing from cards_description.json`).toBe(true);
    }
  });

  it('every description entry has a matching card', () => {
    const cardIds = new Set(cardsJson.map(c => c.id));
    for (const desc of descsJson) {
      expect(cardIds.has(desc.id), `Description for id ${desc.id} has no matching card`).toBe(true);
    }
  });

  it('no duplicate IDs in cards.json', () => {
    const ids = cardsJson.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('no duplicate IDs in cards_description.json', () => {
    const ids = descsJson.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all description entries have non-empty name and description', () => {
    for (const desc of descsJson) {
      expect(desc.name?.trim().length > 0, `Card #${desc.id} has empty name`).toBe(true);
      expect(desc.description?.trim().length > 0, `Card #${desc.id} has empty description`).toBe(true);
    }
  });
});

// ── No German text in English descriptions ──────────────────

describe('No German text in card descriptions', () => {
  it('no card description contains German words', () => {
    const violations = [];
    for (const card of allCards()) {
      if (GERMAN_PATTERN.test(card.description)) {
        violations.push(`#${card.id} (${card.name}): "${card.description.substring(0, 60)}"`);
      }
    }
    expect(violations, `German text found in ${violations.length} descriptions:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('no card name contains German words', () => {
    const violations = [];
    for (const card of allCards()) {
      if (GERMAN_PATTERN.test(card.name)) {
        violations.push(`#${card.id}: "${card.name}"`);
      }
    }
    expect(violations, `German text found in ${violations.length} names:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

// ── Effect description consistency ──────────────────────────

describe('Effect description consistency', () => {
  it('effect monsters must have [Effect] or [Passive] tag in description', () => {
    const violations = [];
    for (const card of allCards()) {
      if (card.type === CardType.Monster && card.effect) {
        if (!card.description.startsWith('[Effect]') && !card.description.startsWith('[Passive]')) {
          violations.push(`#${card.id} (${card.name}): "${card.description.substring(0, 60)}"`);
        }
      }
    }
    expect(violations, `${violations.length} effect monsters missing [Effect]/[Passive] tag:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('normal monsters must NOT have [Effect] or [Passive] tag', () => {
    const violations = [];
    for (const card of allCards()) {
      if (card.type === CardType.Monster && !card.effect) {
        if (card.description.startsWith('[Effect]') || card.description.startsWith('[Passive]')) {
          violations.push(`#${card.id} (${card.name}): "${card.description.substring(0, 60)}"`);
        }
      }
    }
    expect(violations, `${violations.length} normal monsters wrongly tagged:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('all effect strings in cards.json are valid', () => {
    const cardsJson = JSON.parse(fs.readFileSync(path.resolve('public/base.tcg-src/cards.json'), 'utf8'));
    const invalid = [];
    for (const card of cardsJson) {
      if (card.effect && !isValidEffectString(card.effect)) {
        invalid.push(`#${card.id}: "${card.effect}"`);
      }
    }
    expect(invalid, `${invalid.length} cards have invalid effect strings:\n${invalid.join('\n')}`).toHaveLength(0);
  });
});

// ── Description-to-effect keyword alignment ─────────────────

describe('Description matches actual effect', () => {
  const EFFECT_KEYWORDS = {
    dealDamage:          ['damage'],
    gainLP:              ['LP', 'Gain'],
    draw:                ['Draw', 'draw'],
    buffField:           ['ATK', 'DEF', 'gain'],
    tempBuffField:       ['ATK', 'DEF', 'gain'],
    debuffField:         ['lose', 'ATK'],
    tempDebuffField:     ['lose', 'ATK'],
    searchDeckToHand:    ['Deck', 'hand'],
    bounceStrongestOpp:  ['hand', 'Return'],
    bounceAllOppMonsters:['hand', 'Return'],
    tempAtkBonus:        ['ATK'],
    permAtkBonus:        ['ATK'],
    tempDefBonus:        ['DEF'],
    permDefBonus:        ['DEF'],
    cancelAttack:        ['Negate', 'attack'],
    destroyAttacker:     ['Destroy', 'attacking'],
    passive_piercing:    ['Piercing', 'piercing'],
    passive_untargetable:['targeted'],
    passive_directAttack:['directly'],
    passive_phoenixRevival:['Graveyard', 'Special Summon'],
  };

  it('effect monster descriptions contain keywords matching their actual effect', () => {
    const violations = [];
    for (const card of allCards()) {
      if (!card.effect || card.type !== CardType.Monster) continue;

      for (const action of card.effect.actions) {
        const keywords = EFFECT_KEYWORDS[action.type];
        if (!keywords) continue;

        const hasMatch = keywords.some(kw => card.description.includes(kw));
        if (!hasMatch) {
          violations.push(`#${card.id} (${card.name}): effect "${action.type}" but description has none of [${keywords.join(', ')}]`);
        }
      }
    }
    expect(violations, `${violations.length} effect-description mismatches:\n${violations.join('\n')}`).toHaveLength(0);
  });
});
