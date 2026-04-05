// ============================================================
// Card Data Integrity Tests
// Ensures card descriptions match actual card data and contain
// no localization bugs (mixed languages, wrong metadata, etc.)
// ============================================================
import { describe, it, expect } from 'vitest';
import { CARD_DB } from '../src/cards.js';
import { CardType } from '../src/types.js';
import { isValidEffectString } from '../src/effect-serializer.js';
import { buildCardEffectText } from '../src/effect-text-builder.js';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const GERMAN_PATTERN = /\b(der|die|das|ein|eine|und|auf|ist|des|dem|den|mit|von|für|oder|nicht|werden|wird|haben|hat|sind|wenn|alle|dein|deinem|deinen|deiner|erhalt|erhalten|Spielfeld|Stufe|Krieger|Drache|Zauberer|Karte|Feld|Gegner|Schaden|Angriff|Verteidigung|Zerstore|Negiere|Aktiviere|Fuge|Wahle|Schadenspunkte|Beschwort|zuruckgeschickt|gehartetem|massiver|Verstarkt|Umhang|Schutz|Bietet|gefertigt|uralten|Starkt|Effekt|Zauberkarte|Fallenkarte)\b/;

// Extract raw JSON files from the pre-built base.tcg archive
const tcgPath = path.resolve('node_modules/@wynillo/echoes-mod-base/dist/base.tcg');
const tcgBuf = fs.readFileSync(tcgPath);
const zip = await JSZip.loadAsync(tcgBuf);

async function readJsonFromZip(entryPath) {
  const entry = zip.file(entryPath);
  if (!entry) throw new Error(`Entry "${entryPath}" not found in base.tcg`);
  return JSON.parse(await entry.async('string'));
}

const cardsJson = await readJsonFromZip('cards.json');

function allCards() {
  return Object.values(CARD_DB);
}

// ── Source file integrity ───────────────────────────────────

describe('TCG source file integrity', () => {
  it('no duplicate IDs in cards.json', () => {
    const ids = cardsJson.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
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
  it('effect text builder produces output for all effect monsters', () => {
    const stubT = (key, opts) => {
      let result = key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
        }
      }
      return result;
    };
    const violations = [];
    for (const card of allCards()) {
      if (card.type === CardType.Monster && card.effect) {
        const lines = buildCardEffectText(card, stubT);
        if (lines.length === 0) {
          violations.push(`#${card.id} (${card.name}): effect text builder produced no output`);
        }
      }
    }
    expect(violations, `${violations.length} effect monsters with empty builder output:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('normal monsters have no effect blocks', () => {
    const violations = [];
    for (const card of allCards()) {
      if (card.type === CardType.Monster && !card.effect) {
        const stubT = (key) => key;
        const lines = buildCardEffectText(card, stubT);
        if (lines.length > 0) {
          violations.push(`#${card.id} (${card.name}): normal monster unexpectedly has effect blocks`);
        }
      }
    }
    expect(violations, `${violations.length} normal monsters with unexpected effect blocks:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('all effect strings in cards.json are valid', () => {
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

  it.skip('effect monster descriptions contain keywords matching their actual effect', () => {
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
