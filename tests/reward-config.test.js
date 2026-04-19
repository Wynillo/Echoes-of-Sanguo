import { describe, it, expect } from 'vitest';
import {
  DEFAULT_REWARD_CONFIG,
  resolveRewardConfig,
  getRankEffect,
} from '../src/reward-config.ts';

describe('DEFAULT_REWARD_CONFIG', () => {
  it('matches legacy hardcoded values', () => {
    const s = getRankEffect(DEFAULT_REWARD_CONFIG, 'S');
    expect(s.coinMultiplier).toBe(2.5);
    expect(s.cardDropCount).toBe(3);

    const a = getRankEffect(DEFAULT_REWARD_CONFIG, 'A');
    expect(a.coinMultiplier).toBe(1.0);
    expect(a.cardDropCount).toBe(0);

    const b = getRankEffect(DEFAULT_REWARD_CONFIG, 'B');
    expect(b.coinMultiplier).toBe(0.8);
    expect(b.cardDropCount).toBe(0);
  });
});

describe('resolveRewardConfig', () => {
  const campaignOnly = {
    mode: 'campaign',
    ranks: {
      S: { coinMultiplier: 3.0, cardDropCount: 5 },
      A: { coinMultiplier: 1.5, cardDropCount: 1 },
      B: { coinMultiplier: 1.0, cardDropCount: 0 },
    },
  };

  const freeOnly = {
    mode: 'free',
    ranks: {
      S: { coinMultiplier: 2.0, cardDropCount: 2 },
      A: { coinMultiplier: 1.0, cardDropCount: 0 },
      B: { coinMultiplier: 0.5, cardDropCount: 0 },
    },
  };

  const bothModes = {
    mode: 'both',
    ranks: {
      S: { coinMultiplier: 4.0, cardDropCount: 4, rarityRates: { [4]: 0.5 } }, // 4 = Rarity.RARE
      A: { coinMultiplier: 2.0, cardDropCount: 2 },
      B: { coinMultiplier: 1.0, cardDropCount: 1 },
    },
  };

  it('returns default when no configs provided', () => {
    expect(resolveRewardConfig()).toBe(DEFAULT_REWARD_CONFIG);
    expect(resolveRewardConfig(undefined, undefined)).toBe(DEFAULT_REWARD_CONFIG);
    expect(resolveRewardConfig(undefined, undefined, 'free')).toBe(DEFAULT_REWARD_CONFIG);
  });

  it('node config takes priority over opponent config', () => {
    const result = resolveRewardConfig(bothModes, freeOnly, 'free');
    expect(result).toBe(bothModes);
  });

  it('falls back to opponent config when node config is undefined', () => {
    const result = resolveRewardConfig(undefined, bothModes, 'campaign');
    expect(result).toBe(bothModes);
  });

  it('skips config whose mode does not match', () => {
    const result = resolveRewardConfig(campaignOnly, freeOnly, 'free');
    expect(result).toBe(freeOnly);
  });

  it('falls to default when all configs have wrong mode', () => {
    const result = resolveRewardConfig(freeOnly, freeOnly, 'campaign');
    expect(result).toBe(DEFAULT_REWARD_CONFIG);
  });

  it('mode "both" matches any mode', () => {
    expect(resolveRewardConfig(bothModes, undefined, 'campaign')).toBe(bothModes);
    expect(resolveRewardConfig(bothModes, undefined, 'free')).toBe(bothModes);
  });

  it('accepts config with no mode set (treated as "both")', () => {
    const noMode = {
      ranks: {
        S: { coinMultiplier: 1.0, cardDropCount: 1 },
        A: { coinMultiplier: 1.0, cardDropCount: 0 },
        B: { coinMultiplier: 1.0, cardDropCount: 0 },
      },
    };
    expect(resolveRewardConfig(noMode, undefined, 'campaign')).toBe(noMode);
    expect(resolveRewardConfig(noMode, undefined, 'free')).toBe(noMode);
  });
});

describe('getRankEffect', () => {
  it('returns the correct effect for each rank', () => {
    const config = {
      ranks: {
        S: { coinMultiplier: 3.0, cardDropCount: 5, rarityRates: { [4]: 0.5 } }, // 4 = Rarity.RARE
        A: { coinMultiplier: 1.5, cardDropCount: 1 },
        B: { coinMultiplier: 0.8, cardDropCount: 0 },
      },
    };

    expect(getRankEffect(config, 'S').coinMultiplier).toBe(3.0);
    expect(getRankEffect(config, 'S').cardDropCount).toBe(5);
    expect(getRankEffect(config, 'S').rarityRates).toEqual({ [4]: 0.5 }); // 4 = Rarity.RARE
    expect(getRankEffect(config, 'A').cardDropCount).toBe(1);
    expect(getRankEffect(config, 'B').rarityRates).toBeUndefined();
  });
});
