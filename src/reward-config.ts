import { Rarity } from './types.js';

export type BadgeRank = 'S' | 'A' | 'B';
export type RewardMode = 'campaign' | 'free' | 'both';

export interface DropPoolEntry {
  cardId: string;
  weight: number;
}

export interface RankRewardEffect {
  coinMultiplier: number;
  cardDropCount: number;
  rarityRates?: Partial<Record<Rarity, number>>;
}

export interface DuelRewardConfig {
  mode?: RewardMode;
  ranks: Record<BadgeRank, RankRewardEffect>;
  dropPool?: DropPoolEntry[];
}

export const DEFAULT_REWARD_CONFIG: DuelRewardConfig = {
  mode: 'both',
  ranks: {
    S: { coinMultiplier: 2.5, cardDropCount: 3 },
    A: { coinMultiplier: 1.0, cardDropCount: 0 },
    B: { coinMultiplier: 0.8, cardDropCount: 0 },
  },
};

export function resolveRewardConfig(
  nodeConfig?: DuelRewardConfig,
  opponentConfig?: DuelRewardConfig,
  mode?: 'campaign' | 'free',
): DuelRewardConfig {
  const candidates = [nodeConfig, opponentConfig];
  for (const cfg of candidates) {
    if (!cfg) continue;
    if (!mode || !cfg.mode || cfg.mode === 'both' || cfg.mode === mode) return cfg;
  }
  return DEFAULT_REWARD_CONFIG;
}

export function getRankEffect(config: DuelRewardConfig, rank: BadgeRank): RankRewardEffect {
  return config.ranks[rank];
}
