export interface EffectSource {
  id: string;
  name: string;
  rarity: number;
}

export const EFFECT_SOURCES: Record<string, EffectSource> = {};

export function getEffectSource(id: string): EffectSource | undefined {
  return EFFECT_SOURCES[id];
}
