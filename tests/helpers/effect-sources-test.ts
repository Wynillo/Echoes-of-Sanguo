import { EFFECT_SOURCES, type EffectSource } from '../../src/effect-items.js';

export function registerEffectSourceForTest(source: EffectSource): void {
  EFFECT_SOURCES[source.id] = source;
}

export function getEffectSourcesByRarityForTest(rarity: number): EffectSource[] {
  return Object.values(EFFECT_SOURCES).filter(e => e.rarity === rarity);
}
