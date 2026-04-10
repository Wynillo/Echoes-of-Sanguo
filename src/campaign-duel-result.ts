import type { DialogueScene } from '@wynillo/tcg-format';
import type { DuelStats } from './types.js';
import type { Rarity } from './types.js';
import type { NodeRewards } from './campaign-types.js';
import type { BattleBadges } from './battle-badges.js';
import type { DuelRewardConfig } from './reward-config.js';
import { getRankEffect } from './reward-config.js';

export interface CampaignDuelNav {
  screen: 'duel-result' | 'dialogue' | 'campaign';
  data?: Record<string, unknown>;
}

export interface CampaignDuelOps {
  markNodeComplete: (nodeId: string) => void;
  nodeExists: (nodeId: string) => boolean;
  addCurrency: (currencyId: string, amount: number) => void;
  ownsCard: (id: string) => boolean;
  addCardsToCollection: (ids: string[]) => void;
  recordDuelResult: (opponentId: number, won: boolean) => void;
  applyBadgeMultiplier: (base: number) => number;
  rollCardDrops: (count: number, rarityRates?: Partial<Record<Rarity, number>>) => string[];
}

export interface CampaignDuelInput {
  result: 'victory' | 'defeat';
  stats: DuelStats | undefined;
  badges: BattleBadges | null;
  opponentId: number | null;
  pending: {
    nodeId: string;
    completeOnLoss?: boolean;
    rewards?: NodeRewards;
    rewardConfig?: DuelRewardConfig;
    postDialogue?: DialogueScene | null;
  };
}

/**
 * Pure function that computes the navigation target and applies side effects
 * (coin/card rewards, node completion) for a standard (non-gauntlet) campaign duel.
 */
export function computeCampaignDuelNav(
  input: CampaignDuelInput,
  ops: CampaignDuelOps,
): CampaignDuelNav {
  const { result, stats, badges, opponentId, pending } = input;

  const resultData = (
    r: 'victory' | 'defeat',
    extra?: Record<string, unknown>,
  ): Record<string, unknown> => ({ result: r, stats, ...extra });

  const isComplete = result === 'victory' || !!pending.completeOnLoss;
  let newCardIds: string[] = [];

  if (isComplete) {
    if (ops.nodeExists(pending.nodeId)) {
      ops.markNodeComplete(pending.nodeId);
    }

    const dropCount = badges?.cardDropCount ?? 0;
    const effect = badges && pending.rewardConfig ? getRankEffect(pending.rewardConfig, badges.best) : null;
    const badgeDrops = result === 'victory' && dropCount > 0
      ? ops.rollCardDrops(dropCount, effect?.rarityRates)
      : [];
    const adjustedRewards: NodeRewards | undefined = pending.rewards
      ? { ...pending.rewards }
      : undefined;

    if (adjustedRewards?.coins && result === 'victory') {
      adjustedRewards.coins = ops.applyBadgeMultiplier(adjustedRewards.coins);
    }
    const rewardCurrencyId = pending.rewardConfig?.ranks?.S?.currencyId
      ?? pending.rewards?.currencyId
      ?? 'coins';
    const rewardCoins = adjustedRewards?.coins ?? 0;
    if (rewardCoins > 0) {
      ops.addCurrency(rewardCurrencyId, rewardCoins);
    }

    const allCards = [...(adjustedRewards?.cards ?? []), ...badgeDrops];
    newCardIds = allCards.filter(id => !ops.ownsCard(id));
    if (allCards.length) {
      ops.addCardsToCollection(allCards);
      if (adjustedRewards && badgeDrops.length) adjustedRewards.cards = allCards;
    }

    pending.rewards = adjustedRewards;
  }

  if (opponentId) {
    ops.recordDuelResult(opponentId, result === 'victory');
  }

  if (result === 'victory' && pending.postDialogue && pending.postDialogue.dialogue?.length > 0) {
    return {
      screen: 'duel-result',
      data: resultData('victory', {
        rewards: pending.rewards,
        badges,
        newCardIds,
        nextScreen: 'dialogue',
        dialogueData: {
          scene: pending.postDialogue,
          nextScreen: 'campaign',
        },
      }),
    };
  }

  if (result === 'victory') {
    return {
      screen: 'duel-result',
      data: resultData('victory', {
        rewards: pending.rewards,
        badges,
        newCardIds,
        nextScreen: 'campaign',
      }),
    };
  }

  if (isComplete && pending.postDialogue && pending.postDialogue.dialogue?.length > 0) {
    return {
      screen: 'dialogue',
      data: {
        scene: pending.postDialogue,
        nextScreen: 'campaign',
      },
    };
  }

  if (isComplete) {
    return { screen: 'campaign' };
  }

  return { screen: 'duel-result', data: resultData('defeat') };
}
