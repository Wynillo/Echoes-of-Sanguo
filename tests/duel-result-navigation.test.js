// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { computeCampaignDuelNav } from '../src/campaign-duel-result.ts';

function makeOps(overrides = {}) {
  return {
    markNodeComplete: vi.fn(),
    nodeExists: vi.fn().mockReturnValue(true),
    addCoins: vi.fn(),
    ownsCard: vi.fn().mockReturnValue(false),
    addCardsToCollection: vi.fn(),
    recordDuelResult: vi.fn(),
    applyBadgeMultiplier: (n) => n,
    rollSRankDrops: () => [],
    ...overrides,
  };
}

const baseStats = {
  turns: 5,
  monstersPlayed: 3,
  fusionsPerformed: 1,
  spellsActivated: 1,
  trapsActivated: 0,
  cardsDrawn: 5,
  lpRemaining: 4000,
  opponentLpRemaining: 0,
  deckRemaining: 25,
  graveyardSize: 5,
  opponentMonstersPlayed: 2,
  opponentFusionsPerformed: 0,
  opponentSpellsActivated: 1,
  opponentTrapsActivated: 0,
  opponentDeckRemaining: 28,
  opponentGraveyardSize: 3,
  endReason: 'lp_zero',
};

const baseBadges = {
  pow: { category: 'POW', rank: 'A', score: 80 },
  tec: { category: 'TEC', rank: 'B', score: 50 },
  best: 'A',
  coinMultiplier: 1.5,
};

describe('computeCampaignDuelNav', () => {
  it('navigates to duel-result on standard campaign victory', () => {
    const ops = makeOps();
    const nav = computeCampaignDuelNav(
      {
        result: 'victory',
        stats: baseStats,
        badges: baseBadges,
        opponentId: 1,
        pending: { nodeId: 'n1', rewards: { coins: 100 } },
      },
      ops,
    );

    expect(nav.screen).toBe('duel-result');
    expect(nav.data.result).toBe('victory');
    expect(nav.data.nextScreen).toBe('campaign');
    expect(nav.data).toHaveProperty('newCardIds');
    expect(nav.data).toHaveProperty('badges');
    expect(ops.markNodeComplete).toHaveBeenCalledWith('n1');
  });

  it('navigates to duel-result on victory with post-dialogue', () => {
    const ops = makeOps();
    const nav = computeCampaignDuelNav(
      {
        result: 'victory',
        stats: baseStats,
        badges: baseBadges,
        opponentId: 1,
        pending: {
          nodeId: 'n1',
          rewards: { coins: 50 },
          postDialogue: { background: 'bg_default', dialogue: [{ textKey: 'dialogue.scene1', speaker: 'Narrator', portrait: null, side: 'left', foregrounds: null }] },
        },
      },
      ops,
    );

    expect(nav.screen).toBe('duel-result');
    expect(nav.data.result).toBe('victory');
    expect(nav.data.nextScreen).toBe('dialogue');
    expect(nav.data).toHaveProperty('dialogueData');
  });

  it('navigates to duel-result on campaign defeat', () => {
    const ops = makeOps();
    const nav = computeCampaignDuelNav(
      {
        result: 'defeat',
        stats: baseStats,
        badges: null,
        opponentId: 1,
        pending: { nodeId: 'n1' },
      },
      ops,
    );

    expect(nav.screen).toBe('duel-result');
    expect(nav.data.result).toBe('defeat');
  });

  it('navigates to campaign directly when completeOnLoss without dialogue', () => {
    const ops = makeOps();
    const nav = computeCampaignDuelNav(
      {
        result: 'defeat',
        stats: baseStats,
        badges: null,
        opponentId: 1,
        pending: { nodeId: 'n1', completeOnLoss: true },
      },
      ops,
    );

    expect(nav.screen).toBe('campaign');
    expect(ops.markNodeComplete).toHaveBeenCalledWith('n1');
  });

  it('navigates to dialogue when completeOnLoss with post-dialogue', () => {
    const ops = makeOps();
    const nav = computeCampaignDuelNav(
      {
        result: 'defeat',
        stats: baseStats,
        badges: null,
        opponentId: 1,
        pending: {
          nodeId: 'n1',
          completeOnLoss: true,
          postDialogue: { background: 'bg_default', dialogue: [{ textKey: 'dialogue.loss', speaker: 'Narrator', portrait: null, side: 'left', foregrounds: null }] },
        },
      },
      ops,
    );

    expect(nav.screen).toBe('dialogue');
    expect(nav.data).toHaveProperty('scene');
  });

  it('includes newCardIds for cards not already owned', () => {
    const ops = makeOps({
      ownsCard: vi.fn((id) => id === 'c1'),
    });
    const nav = computeCampaignDuelNav(
      {
        result: 'victory',
        stats: baseStats,
        badges: baseBadges,
        opponentId: 1,
        pending: { nodeId: 'n1', rewards: { cards: ['c1', 'c2', 'c3'] } },
      },
      ops,
    );

    expect(nav.data.newCardIds).toEqual(['c2', 'c3']);
  });

  it('applies badge multiplier to coin rewards', () => {
    const ops = makeOps({
      applyBadgeMultiplier: (n) => n * 2,
    });
    const nav = computeCampaignDuelNav(
      {
        result: 'victory',
        stats: baseStats,
        badges: baseBadges,
        opponentId: 1,
        pending: { nodeId: 'n1', rewards: { coins: 100 } },
      },
      ops,
    );

    expect(ops.addCoins).toHaveBeenCalledWith(200);
  });

  it('records duel result for opponent', () => {
    const ops = makeOps();
    computeCampaignDuelNav(
      {
        result: 'victory',
        stats: baseStats,
        badges: null,
        opponentId: 42,
        pending: { nodeId: 'n1' },
      },
      ops,
    );

    expect(ops.recordDuelResult).toHaveBeenCalledWith(42, true);
  });

  it('includes S-rank card drops in rewards', () => {
    const ops = makeOps({
      rollSRankDrops: () => ['bonus1', 'bonus2'],
      ownsCard: vi.fn().mockReturnValue(false),
    });
    const nav = computeCampaignDuelNav(
      {
        result: 'victory',
        stats: baseStats,
        badges: baseBadges,
        opponentId: 1,
        pending: { nodeId: 'n1', rewards: { cards: ['c1'] } },
      },
      ops,
    );

    expect(ops.addCardsToCollection).toHaveBeenCalledWith(['c1', 'bonus1', 'bonus2']);
    expect(nav.data.newCardIds).toEqual(['c1', 'bonus1', 'bonus2']);
  });

  it('always navigates to duel-result on victory (never hangs on blank screen)', () => {
    const ops = makeOps();
    const scenarios = [
      { nodeId: 'n1' },
      { nodeId: 'n1', rewards: { coins: 100 } },
      { nodeId: 'n1', rewards: { coins: 50, cards: ['c1'] } },
      { nodeId: 'n1', postDialogue: { background: 'bg_default', dialogue: [{ textKey: 'd1', speaker: 'Narrator', portrait: null, side: 'left', foregrounds: null }] } },
      { nodeId: 'n1', rewards: { coins: 200 }, postDialogue: { background: 'bg_default', dialogue: [{ textKey: 'd1', speaker: 'Narrator', portrait: null, side: 'left', foregrounds: null }] } },
    ];

    for (const pending of scenarios) {
      const nav = computeCampaignDuelNav(
        {
          result: 'victory',
          stats: baseStats,
          badges: baseBadges,
          opponentId: 1,
          pending,
        },
        makeOps(),
      );
      expect(nav.screen).toBe('duel-result');
      expect(nav.data).toBeDefined();
      expect(nav.data.result).toBe('victory');
    }
  });
});
