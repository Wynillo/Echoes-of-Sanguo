// ============================================================
// ECHOES OF SANGUO — Campaign Types
// Graph-based campaign system with chapters and nodes
// ============================================================

export interface CampaignData {
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  nodes: CampaignNode[];
}

export interface CampaignNode {
  id: string;
  type: 'duel' | 'story' | 'reward' | 'shop' | 'branch';
  opponentId?: number;        // for duel nodes
  completeOnLoss?: boolean;   // node completes even on defeat (e.g. scripted loss)
  gauntlet?: number[];        // ordered opponent IDs for back-to-back duels (no saving between)
  position: { x: number; y: number };  // for map rendering
  unlockCondition: UnlockCondition | null;  // null = always unlocked (start node)
  rewards?: NodeRewards;
  dialogueKeys?: string[];    // i18n keys for story nodes
  connections?: string[];     // visual connections to other nodes
}

export type UnlockCondition =
  | { type: 'nodeComplete'; nodeId: string }
  | { type: 'allComplete'; nodeIds: string[] }
  | { type: 'anyComplete'; nodeIds: string[] }
  | { type: 'cardOwned'; cardId: string }
  | { type: 'winsCount'; count: number };

export interface NodeRewards {
  coins?: number;
  cards?: string[];
  unlocks?: string[];  // node IDs that become available
}

export interface CampaignProgress {
  completedNodes: string[];
  currentChapter: string;
}

export interface PendingDuel {
  nodeId: string;
  completeOnLoss?: boolean;
  rewards?: NodeRewards;
  postDialogue?: string[];
  /** Ordered opponent IDs for gauntlet (back-to-back duels, no saving between). */
  gauntletOpponents?: number[];
  /** Index of the current opponent within gauntletOpponents (0-based). */
  gauntletIndex?: number;
}
