import { useState, useMemo } from 'react';
import { useTranslation }   from 'react-i18next';
import type { TFunction }   from 'i18next';
import { useScreen }        from '../contexts/ScreenContext.js';
import { useCampaign }      from '../contexts/CampaignContext.js';
import { useGame }           from '../contexts/GameContext.js';
import { OPPONENT_CONFIGS }  from '../../cards.js';
import type { CampaignNode, Chapter } from '../../campaign-types.js';
import styles from './CampaignScreen.module.css';

function getUnlockHint(node: CampaignNode, t: TFunction): string {
  const cond = node.unlockCondition;
  if (!cond) return t('campaign.locked');
  switch (cond.type) {
    case 'nodeComplete':
      return t('campaign.unlock_complete_node', 'Complete "{{node}}" first', { node: t(`campaign.node_${cond.nodeId}`, cond.nodeId) });
    case 'allComplete':
      return t('campaign.unlock_complete_all', 'Complete all prerequisite nodes first');
    case 'anyComplete':
      return t('campaign.unlock_complete_any', 'Complete any prerequisite node first');
    default:
      return t('campaign.locked');
  }
}

const NODE_ICONS: Record<CampaignNode['type'], string> = {
  duel:   '\u2694',   // crossed swords
  story:  '\uD83D\uDCD6', // open book
  reward: '\uD83C\uDF81', // gift
  shop:   '\uD83D\uDED2', // shopping cart
  branch: '\u2726',   // star
};

const GAUNTLET_ICON = '\uD83D\uDD25'; // fire — used for gauntlet duel nodes

export default function CampaignScreen() {
  const { t } = useTranslation();
  const { navigateTo } = useScreen();
  const { campaignData, progress, isNodeUnlocked, completeNode, getOpponentForNode, setPendingDuel } = useCampaign();
  const { startGame } = useGame();
  const [dialogueNode, setDialogueNode] = useState<CampaignNode | null>(null);

  const chapters = campaignData.chapters;

  // Auto-select the latest unlocked chapter
  const activeChapterIdx = useMemo(() => {
    let latest = 0;
    for (let i = 1; i < chapters.length; i++) {
      const prev = chapters[i - 1];
      const allDuelsComplete = prev.nodes
        .filter(n => n.type === 'duel')
        .every(n => progress.completedNodes.includes(n.id));
      if (allDuelsComplete) latest = i;
    }
    return latest;
  }, [chapters, progress.completedNodes]);

  const activeChapter: Chapter | undefined = chapters[activeChapterIdx];

  function getNodeState(node: CampaignNode): 'completed' | 'available' | 'locked' {
    if (progress.completedNodes.includes(node.id)) return 'completed';
    if (isNodeUnlocked(node.id)) return 'available';
    return 'locked';
  }

  // Only show nodes that are available/completed, or locked but marked alwaysVisible
  const visibleNodes = useMemo(() => {
    if (!activeChapter) return [];
    return activeChapter.nodes.filter(node => {
      const state = getNodeState(node);
      if (state !== 'locked') return true;
      return node.alwaysVisible === true;
    });
  }, [activeChapter, progress.completedNodes]);

  // Normalize node positions to percentages so they always fit the container width
  const PADDING_X = 12; // % horizontal padding on each side
  const PADDING_TOP = 40; // px top padding
  const PADDING_BOTTOM = 50; // px bottom padding

  const { nodePositions, mapHeight } = useMemo(() => {
    if (visibleNodes.length === 0) return { nodePositions: new Map<string, { leftPct: number; topPx: number }>(), mapHeight: 300 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const node of visibleNodes) {
      if (node.position.x < minX) minX = node.position.x;
      if (node.position.x > maxX) maxX = node.position.x;
      if (node.position.y < minY) minY = node.position.y;
      if (node.position.y > maxY) maxY = node.position.y;
    }

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    const positions = new Map<string, { leftPct: number; topPx: number }>();
    for (const node of visibleNodes) {
      const leftPct = rangeX === 0
        ? 50
        : PADDING_X + ((node.position.x - minX) / rangeX) * (100 - 2 * PADDING_X);
      const topPx = rangeY === 0
        ? PADDING_TOP + 60
        : PADDING_TOP + ((node.position.y - minY) / rangeY) * Math.max(rangeY, 200);
      positions.set(node.id, { leftPct, topPx });
    }

    const maxTop = Math.max(...Array.from(positions.values()).map(p => p.topPx));
    return { nodePositions: positions, mapHeight: maxTop + PADDING_BOTTOM };
  }, [visibleNodes]);

  function handleNodeClick(node: CampaignNode) {
    const state = getNodeState(node);
    if (state === 'locked') return;

    switch (node.type) {
      case 'duel': {
        if (node.gauntlet && node.gauntlet.length > 0) {
          const ok = window.confirm(
            t('campaign.gauntlet_warning', 'This is a gauntlet: {{count}} consecutive duels. You cannot save between fights. Continue?', { count: node.gauntlet.length })
          );
          if (!ok) return;
          const firstOppId = node.gauntlet[0];
          const firstCfg = (OPPONENT_CONFIGS as import('../../types.js').OpponentConfig[]).find(c => c.id === firstOppId);
          if (firstCfg) {
            setPendingDuel({
              nodeId: node.id,
              completeOnLoss: node.completeOnLoss,
              rewards: node.rewards,
              postDialogue: node.postDialogue ?? null,
              gauntletOpponents: node.gauntlet,
              gauntletIndex: 0,
            });
            if (node.preDialogue && node.preDialogue.dialogue.length > 0) {
              navigateTo('dialogue', {
                scene: node.preDialogue,
                nextScreen: 'game',
                nextScreenData: { campaignOpponentConfig: firstCfg },
              });
            } else {
              startGame(firstCfg);
              navigateTo('game');
            }
          }
        } else {
          // Standard single duel
          const opponent = getOpponentForNode(node.id);
          if (opponent) {
            setPendingDuel({
              nodeId: node.id,
              completeOnLoss: node.completeOnLoss,
              rewards: node.rewards,
              postDialogue: node.postDialogue ?? null,
            });
            if (node.preDialogue && node.preDialogue.dialogue.length > 0) {
              navigateTo('dialogue', {
                scene: node.preDialogue,
                nextScreen: 'game',
                nextScreenData: { campaignOpponentConfig: opponent },
              });
            } else {
              startGame(opponent);
              navigateTo('game');
            }
          }
        }
        break;
      }
      case 'story':
        setDialogueNode(node);
        break;
      case 'reward':
        if (state === 'available') {
          completeNode(node.id);
        }
        break;
      case 'shop':
        navigateTo('shop');
        break;
      case 'branch':
        // Branch nodes auto-complete when clicked
        if (state === 'available') {
          completeNode(node.id);
        }
        break;
    }
  }

  function handleDialogueClose() {
    if (dialogueNode && getNodeState(dialogueNode) === 'available') {
      completeNode(dialogueNode.id);
    }
    setDialogueNode(null);
  }

  // Build connection lines between visible nodes only
  const connections = useMemo(() => {
    if (!activeChapter) return [];
    const visibleSet = new Set(visibleNodes.map(n => n.id));
    const nodeMap = new Map(activeChapter.nodes.map(n => [n.id, n]));
    const lines: Array<{ from: CampaignNode; to: CampaignNode; completed: boolean }> = [];
    for (const node of visibleNodes) {
      if (node.connections) {
        for (const targetId of node.connections) {
          if (!visibleSet.has(targetId)) continue;
          const target = nodeMap.get(targetId);
          if (target) {
            const completed = progress.completedNodes.includes(node.id) && progress.completedNodes.includes(targetId);
            lines.push({ from: node, to: target, completed });
          }
        }
      }
    }
    return lines;
  }, [activeChapter, visibleNodes, progress.completedNodes]);

  if (!activeChapter) {
    return (
      <div className={styles.screen}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('campaign.title')}</h2>
          <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('common.back')}</button>
        </div>
        <p style={{ color: '#6080a0', marginTop: 40 }}>{t('campaign.no_data')}</p>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('campaign.title')}</h2>
        <button className={`btn-secondary ${styles.backBtn}`} onClick={() => navigateTo('save-point')}>{t('common.back')}</button>
      </div>

      {activeChapter && (() => {
        const totalNodes = activeChapter.nodes.filter(n => n.type === 'duel').length;
        const completedCount = activeChapter.nodes.filter(n => n.type === 'duel' && progress.completedNodes.includes(n.id)).length;
        return totalNodes > 0 ? (
          <div className={styles.chapterProgress ?? ''} style={{ textAlign: 'center', padding: '4px 0', fontSize: 'var(--font-sm, 0.875rem)', color: 'var(--text-dim)' }}>
            {t('campaign.progress', '{{done}}/{{total}} duels completed', { done: completedCount, total: totalNodes })}
          </div>
        ) : null;
      })()}

      <div className={styles.mapContainer}>
        {visibleNodes.length === 0 && (
          <p style={{ color: '#6080a0', textAlign: 'center', marginTop: 40 }}>{t('campaign.no_missions')}</p>
        )}
        <div className={styles.mapInner} style={{ height: mapHeight }}>
          {/* Connection lines (SVG overlay) */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            preserveAspectRatio="none"
          >
            {connections.map((conn, i) => {
              const fromPos = nodePositions.get(conn.from.id);
              const toPos = nodePositions.get(conn.to.id);
              if (!fromPos || !toPos) return null;
              return (
                <line
                  key={i}
                  x1={`${fromPos.leftPct}%`}
                  y1={fromPos.topPx}
                  x2={`${toPos.leftPct}%`}
                  y2={toPos.topPx}
                  className={`${styles.connectionLine}${conn.completed ? ` ${styles.connectionLineCompleted}` : ''}`}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {visibleNodes.map(node => {
            const state = getNodeState(node);
            const pos = nodePositions.get(node.id);
            if (!pos) return null;

            const nodeClass = [
              styles.node,
              state === 'completed' ? styles.nodeCompleted : '',
              state === 'available' ? styles.nodeAvailable : '',
              state === 'locked' ? styles.nodeLocked : '',
            ].filter(Boolean).join(' ');

            const labelClass = [
              styles.nodeLabel,
              state === 'completed' ? styles.nodeLabelCompleted : '',
              state === 'available' ? styles.nodeLabelAvailable : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                key={node.id}
                className={nodeClass}
                style={{ left: `${pos.leftPct}%`, top: pos.topPx }}
                onClick={() => handleNodeClick(node)}
                disabled={state === 'locked'}
                aria-label={`${t(`campaign.node_${node.id}`, node.id)} — ${t(`campaign.${state}`)}`}
                title={state === 'locked' ? getUnlockHint(node, t) : `${t(`campaign.node_${node.id}`, node.id)}${node.rewards?.coins ? ` — +${node.rewards.coins} ${t('common.coins')}` : ''}${node.rewards?.cards?.length ? ` — +${node.rewards.cards.length} ${t('common.cards')}` : ''}`}
              >
                <span className={styles.nodeIcon}>
                  {node.gauntlet && node.gauntlet.length > 0 ? GAUNTLET_ICON : NODE_ICONS[node.type]}
                </span>
                <span className={labelClass}>
                  {t(`campaign.node_${node.id}`, node.id)}
                  {node.gauntlet && node.gauntlet.length > 0 && (
                    <span style={{ fontSize: '0.6em', opacity: 0.7, marginLeft: 4 }}>
                      ({node.gauntlet.length} {t('gauntlet.duels')})
                    </span>
                  )}
                </span>
                <span className={`${styles.nodeStatus} ${
                  state === 'completed' ? styles.statusCompleted :
                  state === 'available' ? styles.statusAvailable :
                  styles.statusLocked
                }`}>
                  {t(`campaign.${state}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story dialogue overlay */}
      {dialogueNode && (
        <div className={styles.dialogueOverlay} onClick={handleDialogueClose}>
          <div className={styles.dialogueBox} onClick={e => e.stopPropagation()}>
            {(dialogueNode.dialogueKeys ?? []).map((key, i) => (
              <p key={i} className={styles.dialogueText}>{t(key, key)}</p>
            ))}
            {(!dialogueNode.dialogueKeys || dialogueNode.dialogueKeys.length === 0) && (
              <p className={styles.dialogueText}>{t(`campaign.story_${dialogueNode.id}`, '...')}</p>
            )}
            <button className={`btn-primary ${styles.dialogueClose}`} onClick={handleDialogueClose}>
              {t('common.ok')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
