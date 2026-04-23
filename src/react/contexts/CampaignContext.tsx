import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { CampaignData, CampaignProgress, CampaignNode, PendingDuel, NodeRewards } from '../../campaign-types.js';
import { CAMPAIGN_DATA, isNodeUnlocked as storeIsNodeUnlocked, getNode, hasCampaignData } from '../../campaign-store.js';
import { Progression } from '../../progression.js';
import { DEFAULT_CHAPTER } from '../../economy-config.js';
import { useProgression } from './ProgressionContext.js';
import { OPPONENT_CONFIGS } from '../../cards.js';
import type { OpponentConfig } from '../../types.js';

interface CampaignCtx {
  campaignData: CampaignData;
  progress: CampaignProgress;
  isNodeUnlocked: (nodeId: string) => boolean;
  completeNode: (nodeId: string) => void;
  hasCampaign: boolean;
  getOpponentForNode: (nodeId: string) => OpponentConfig | undefined;
  pendingDuel: PendingDuel | null;
  setPendingDuel: (d: PendingDuel | null) => void;
  refreshCampaignProgress: () => void;
}

const CampaignContext = createContext<CampaignCtx>({
  campaignData: { chapters: [] },
  progress: { completedNodes: [], currentChapter: DEFAULT_CHAPTER },
  isNodeUnlocked: () => false,
  completeNode: () => {},
  hasCampaign: false,
  getOpponentForNode: () => undefined,
  pendingDuel: null,
  setPendingDuel: () => {},
  refreshCampaignProgress: () => {},
});

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<CampaignProgress>(() => {
    try {
      return Progression.getCampaignProgress();
    } catch {
      return { completedNodes: [], currentChapter: DEFAULT_CHAPTER };
    }
  });
  const [pendingDuel, setPendingDuel] = useState<PendingDuel | null>(null);
  const { refresh } = useProgression();

  // Re-read campaign data on mount (it may have been loaded after initial render)
  const [campaignData, setCampaignData] = useState<CampaignData>(CAMPAIGN_DATA);
  useEffect(() => {
    setCampaignData({ ...CAMPAIGN_DATA });
  }, []);

  const hasCampaign = useMemo(() => hasCampaignData(), [campaignData]);

  const isNodeUnlockedFn = useCallback((nodeId: string): boolean => {
    return storeIsNodeUnlocked(nodeId, progress);
  }, [progress]);

  const getOpponentForNode = useCallback((nodeId: string): OpponentConfig | undefined => {
    const node = getNode(nodeId);
    if (!node) {
      console.warn(`[getOpponentForNode] Node "${nodeId}" not found. CAMPAIGN_DATA has ${CAMPAIGN_DATA.chapters.length} chapters.`);
      return undefined;
    }
    if (node.type !== 'duel') {
      console.warn(`[getOpponentForNode] Node "${nodeId}" is type "${node.type}", not "duel".`);
      return undefined;
    }
    if (node.opponentId === undefined) {
      console.warn(`[getOpponentForNode] Node "${nodeId}" has no opponentId.`);
      return undefined;
    }
    const config = (OPPONENT_CONFIGS as OpponentConfig[]).find(c => c.id === node.opponentId);
    if (!config) {
      console.warn(`[getOpponentForNode] Opponent config ${node.opponentId} not found. OPPONENT_CONFIGS has ${OPPONENT_CONFIGS.length} entries.`);
    }
    return config;
  }, [campaignData, OPPONENT_CONFIGS.length]);

  const refreshCampaignProgress = useCallback(() => {
    setProgress({ ...Progression.getCampaignProgress() });
  }, []);

  const completeNode = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;

    // Mark node as complete
    const updated = Progression.markNodeComplete(nodeId);

    // Apply rewards
    if (node.rewards) {
      if (node.rewards.coins) {
        Progression.addCoins(node.rewards.coins);
      }
      if (node.rewards.cards && node.rewards.cards.length > 0) {
        Progression.addCardsToCollection(node.rewards.cards);
      }
    }

    setProgress({ ...updated });
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ campaignData, progress, isNodeUnlocked: isNodeUnlockedFn, completeNode, hasCampaign, getOpponentForNode, pendingDuel, setPendingDuel, refreshCampaignProgress }),
    [campaignData, progress, isNodeUnlockedFn, completeNode, hasCampaign, getOpponentForNode, pendingDuel, refreshCampaignProgress],
  );

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() { return useContext(CampaignContext); }
