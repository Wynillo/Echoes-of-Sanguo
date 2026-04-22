import { Rarity } from './types.js';

export interface EffectSource {
  id: string;
  name: string;
  rarity: Rarity;
}

export const EFFECT_SOURCES: Record<string, EffectSource> = {};

export function getEffectSource(id: string): EffectSource | undefined {
  return EFFECT_SOURCES[id];
}

<<<<<<< HEAD
export function getEffectSourcesByRarity(rarity: Rarity): EffectSource[] {
  return Object.values(EFFECT_SOURCES).filter(e => e.rarity === rarity);
}

