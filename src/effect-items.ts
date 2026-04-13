export interface EffectSource {
  id: string;
  name: string;
  rarity: number;
}

export const EFFECT_SOURCES: Record<string, EffectSource> = {};

export function getEffectSource(id: string): EffectSource | undefined {
  return EFFECT_SOURCES[id];
}

export function getEffectSourcesByRarity(rarity: number): EffectSource[] {
  return Object.values(EFFECT_SOURCES).filter(e => e.rarity === rarity);
}

export function registerEffectSource(source: EffectSource): void {
  EFFECT_SOURCES[source.id] = source;
}
