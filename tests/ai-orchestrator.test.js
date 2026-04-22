// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { aiBattlePickTarget } from '../src/ai-orchestrator.ts';
import { FieldCard } from '../src/field.ts';
import { resolveAIBehavior } from '../src/ai-behaviors.ts';

function monster(atk, def = 0, extras = {}) {
  return { id: 'M' + atk, name: `Mon${atk}`, type: 1, atk, def, ...extras };
}

function makeFC(atk, def = 0, opts = {}) {
  const fc = new FieldCard(monster(atk, def, opts.cardExtras), opts.position ?? 'atk');
  if (opts.cannotBeAttacked) fc.cannotBeAttacked = true;
  if (opts.indestructible) fc.indestructible = true;
  if (opts.faceDown) fc.faceDown = true;
  return fc;
}

function makeBehavior(strategy) {
  const b = resolveAIBehavior();
  b.battleStrategy = strategy;
  return b;
}

describe('aiBattlePickTarget', () => {
  describe('aggressive strategy', () => {
    const behavior = makeBehavior('aggressive');

    it('picks winnable battle with highest value', () => {
      const atk = makeFC(2000);
      const plrMonsters = [makeFC(1000), makeFC(1500), null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      // Should pick the higher value target it can beat (1500)
      expect(target).toBe(1);
    });

    it('attacks even unfavorably — picks weakest to minimize damage', () => {
      const atk = makeFC(1000);
      const plrMonsters = [makeFC(2000), makeFC(3000), null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(0); // weakest opponent
    });

    it('skips  cannotBeAttacked monsters', () => {
      const atk = makeFC(2000);
      const plrMonsters = [makeFC(500, 0, { cannotBeAttacked: true }), makeFC(1500), null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(1);
    });

    it('returns -1 when all monsters have  cannotBeAttacked', () => {
      const atk = makeFC(2000);
      const plrMonsters = [makeFC(500, 0, { cannotBeAttacked: true }), null, null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(-1);
    });

    it('prefers effect monsters when winning (bonus +500)', () => {
      const atk = makeFC(3000);
      const plrMonsters = [
        makeFC(1200),  // score: 1200
        makeFC(1000, 0, { cardExtras: { effect: { trigger: 'onSummon', actions: [{ type: 'dealDamage' }] } } }),  // score: 1000 + 500 = 1500
        null, null, null,
      ];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(1); // effect monster has higher score
    });

    it('returns -1 for empty field', () => {
      const atk = makeFC(2000);
      const plrMonsters = [null, null, null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(-1);
    });
  });

  describe('smart strategy', () => {
    const behavior = makeBehavior('smart');

    it('picks winnable target with ATK-mode bonus', () => {
      const atk = makeFC(2000);
      const plrMonsters = [
        makeFC(1000, 0, { position: 'def' }),  // in ATK mode still, combatValue = ATK
        makeFC(1500),                            // ATK mode, score += 200
        null, null, null,
      ];
      // Both beatable. Zone 0 score: 1000, Zone 1 score: 1500 + 200 = 1700
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(1);
    });

    it('never targets indestructible monsters (score -Infinity)', () => {
      const atk = makeFC(5000);
      const plrMonsters = [
        makeFC(500, 0, { indestructible: true }),
        makeFC(1500),
        null, null, null,
      ];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(1);
    });

    it('returns -1 when only indestructible targets exist and no safe DEF', () => {
      const atk = makeFC(3000);
      const plrMonsters = [makeFC(500, 0, { indestructible: true }), null, null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      // Winnable score is -Infinity for indestructible, no DEF targets
      expect(target).toBe(-1);
    });

    it('attacks safe DEF-position targets when no winnable ATK targets', () => {
      const atk = makeFC(2000);
      const plrMonsters = [
        makeFC(3000),  // can't beat
        makeFC(1000, 800, { position: 'def' }),  // DEF: 800, beatable
        null, null, null,
      ];
      // Can't beat zone 0 (3000 > 2000), but can safely attack zone 1 DEF (800 < 2000)
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(1);
    });
  });

  describe('conservative strategy', () => {
    const behavior = makeBehavior('conservative');

    it('picks winnable battles', () => {
      const atk = makeFC(2000);
      const plrMonsters = [makeFC(1500), null, null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(0);
    });

    it('returns -1 when no favorable targets', () => {
      const atk = makeFC(1000);
      const plrMonsters = [makeFC(2000), makeFC(1500), null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(-1);
    });

    it('does not attack unfavorably unlike aggressive', () => {
      const atk = makeFC(1000);
      const plrMonsters = [makeFC(1500), null, null, null, null];
      const target = aiBattlePickTarget(atk, plrMonsters, behavior);
      expect(target).toBe(-1);
    });
  });
});
