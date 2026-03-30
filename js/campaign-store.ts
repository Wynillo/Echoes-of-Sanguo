// ============================================================
// ECHOES OF SANGUO — Campaign Store
// Holds campaign data and provides query functions
// ============================================================

import type { CampaignData, CampaignNode, CampaignProgress, Chapter } from './campaign-types.js';
import { Progression } from './progression.js';

export const CAMPAIGN_DATA: CampaignData = { chapters: [] };

/**
 * Replace the current campaign data with new data.
 * Flattens scene.dialogue[].textKey into dialogueKeys[] so the UI can render them.
 */
export function applyCampaignData(data: CampaignData): void {
  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      const raw = node as unknown as Record<string, unknown>;
      const scene = raw['scene'] as { dialogue?: { textKey?: string }[] } | undefined;
      if (scene?.dialogue && !node.dialogueKeys?.length) {
        node.dialogueKeys = scene.dialogue
          .map(d => d.textKey)
          .filter((k): k is string => !!k);
      }
    }
  }
  CAMPAIGN_DATA.chapters = data.chapters;
}

/**
 * Check whether a campaign node is unlocked given the player's progress.
 */
export function isNodeUnlocked(nodeId: string, progress: CampaignProgress): boolean {
  const node = getNode(nodeId);
  if (!node) return false;

  // No unlock condition means always unlocked (start node)
  if (node.unlockCondition === null) return true;

  const cond = node.unlockCondition;
  switch (cond.type) {
    case 'nodeComplete':
      return progress.completedNodes.includes(cond.nodeId);
    case 'allComplete':
      return cond.nodeIds.every(id => progress.completedNodes.includes(id));
    case 'anyComplete':
      return cond.nodeIds.some(id => progress.completedNodes.includes(id));
    case 'cardOwned':
      return Progression.ownsCard(cond.cardId);
    case 'winsCount': {
      const opponents = Progression.getOpponents();
      const totalWins = Object.values(opponents).reduce((sum, o) => sum + o.wins, 0);
      return totalWins >= cond.count;
    }
    default:
      return false;
  }
}

/**
 * Get a chapter by ID.
 */
export function getChapter(chapterId: string): Chapter | undefined {
  return CAMPAIGN_DATA.chapters.find(ch => ch.id === chapterId);
}

/**
 * Get a node by ID, searching all chapters.
 */
export function getNode(nodeId: string): CampaignNode | undefined {
  for (const ch of CAMPAIGN_DATA.chapters) {
    const node = ch.nodes.find(n => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

/**
 * Check if campaign data has been loaded.
 */
export function hasCampaignData(): boolean {
  return CAMPAIGN_DATA.chapters.length > 0;
}
