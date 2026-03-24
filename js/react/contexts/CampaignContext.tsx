import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { CampaignData, CampaignProgress, CampaignNode } from '../../campaign-types.js';
import { CAMPAIGN_DATA, isNodeUnlocked as storeIsNodeUnlocked, getNode, hasCampaignData } from '../../campaign-store.js';
import { Progression } from '../../progression.js';
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
}

const CampaignContext = createContext<CampaignCtx>({
  campaignData: { chapters: [] },
  progress: { completedNodes: [], currentChapter: 'ch1' },
  isNodeUnlocked: () => false,
  completeNode: () => {},
  hasCampaign: false,
  getOpponentForNode: () => undefined,
});

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<CampaignProgress>(Progression.getCampaignProgress());
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
    if (!node || node.type !== 'duel' || node.opponentId === undefined) return undefined;
    return (OPPONENT_CONFIGS as OpponentConfig[]).find(c => c.id === node.opponentId);
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
    () => ({ campaignData, progress, isNodeUnlocked: isNodeUnlockedFn, completeNode, hasCampaign, getOpponentForNode }),
    [campaignData, progress, isNodeUnlockedFn, completeNode, hasCampaign, getOpponentForNode],
  );

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() { return useContext(CampaignContext); }
